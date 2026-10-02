#!/usr/bin/env python3
"""
build_probe_zips.py — Gemini "Import chats" 格式探针生成器

背景
----
本项目 `SettingsModal.tsx` 的「导出为 Claude 格式」会生成
`Claude_Export_<ts>.zip`，内含 `All_Conversations.zip`（根目录只有一个
`conversations.json`）。该 zip 从 2026 年 9 月起无法再被 Gemini 的
`gemini.google.com/import` →「Import chats」接受。

Gemini 每天只允许上传 5 个 zip，所以不能盲试。本脚本用**同一批真实会话**
生成几个只在「格式维度」上不同的 zip，便于用最少的上传次数定位原因。

生成的包
--------
  00-current-output.zip   当前代码产物的 1:1 复刻（对照组，已知失败，不必上传）
  01-full-fidelity.zip    按 Claude 官方导出规范补全：每条消息补 `text`、
                          对话补 `account`、thinking 块补时间戳，
                          zip 根目录再放 `users.json` / `projects.json`
  02-vanilla-text.zip     最保守的老式结构：只有 `conversations.json`，
                          消息只有 `text` + `content:[{type:text}]`，
                          完全不出现 `thinking` 块
  03-control-sample.zip   2026-06 实测可导入的最小样例（英文 2 段对话），
                          用来判断「Gemini 现在还接不接受手工 zip」

用法
----
    python3 scripts/claude-export-probe/build_probe_zips.py
    python3 scripts/claude-export-probe/build_probe_zips.py --all      # 全部 1453 个会话
    python3 scripts/claude-export-probe/build_probe_zips.py --out /tmp/probe

只用标准库，不需要 bun / node。
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import zipfile
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SESSIONS_DIR = os.path.join(REPO_ROOT, "data", "sessions")
DEFAULT_OUT = os.path.join(REPO_ROOT, "scripts", "claude-export-probe", "out")

# 固定账号 UUID，保证多次生成结果稳定（Claude 真实导出里是账号主键）
ACCOUNT_UUID = "7c3d41e5-9b02-4a6f-8f14-2d5e6a90c431"

CLOSED_THINK_RE = re.compile(r"<think>([\s\S]*?)</think>", re.IGNORECASE)

# 探针会话：覆盖 thinking 块 / 超大正文 / 未闭合 <think> / 纯文本 / 空正文 等边界
PROBE_SESSION_IDS = [
    "929097a8-b187-4752-8de4-a8ea0f44aff8",  # 用户贴出的那条（纯文本，无 thinking）
    "14e501fd-78f6-4abd-af90-412d136c3e5e",  # 最大的一条（~290 KB，LaTeX 密集）
    "c7e1fcbe-3da7-416a-a25f-61ace34c3689",  # 含未闭合 <think>
    "4765c520-d93d-42d1-8c13-6f2ee9b047ec",  # 含未闭合 <think>
]


# ---------------------------------------------------------------------------
# 与 src/components/SettingsModal.tsx 等价的两个工具函数
# ---------------------------------------------------------------------------

def format_claude_date(date_str: str) -> str:
    """等价于 formatClaudeDate()：ISO-8601 UTC，微秒补满 6 位，结尾大写 Z。"""
    cleaned = date_str.replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned).astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond:06d}" + "Z"


def extract_thinking_blocks(content: str) -> tuple[list[str], str]:
    """等价于 extractThinkingBlocks(content, allowUnclosed=false)。"""
    if not content:
        return [], ""
    thoughts: list[str] = []
    rest = content
    for match in CLOSED_THINK_RE.finditer(content):
        if match.group(1) and match.group(1).strip():
            thoughts.append(match.group(1).strip())
        rest = rest.replace(match.group(0), "", 1)
    return thoughts, rest.strip()


# ---------------------------------------------------------------------------
# 会话加载
# ---------------------------------------------------------------------------

def load_sessions(all_sessions: bool) -> list[dict]:
    paths = sorted(glob.glob(os.path.join(SESSIONS_DIR, "*.json")))
    by_id: dict[str, dict] = {}
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            session = json.load(handle)
        by_id[session["id"]] = session

    if all_sessions:
        chosen = list(by_id.values())
    else:
        chosen = [by_id[sid] for sid in PROBE_SESSION_IDS if sid in by_id]
        # 再补几条：有 thinking 块的中等长度会话 + 一条带空正文消息的会话
        extras: list[dict] = []
        empty_main_added = False
        for session in by_id.values():
            if session["id"] in PROBE_SESSION_IDS:
                continue
            raw = os.path.getsize(os.path.join(SESSIONS_DIR, session["id"] + ".json"))
            has_think = any(CLOSED_THINK_RE.search(m["content"] or "") for m in session["messages"])
            has_empty_main = any(
                not extract_thinking_blocks(m["content"] or "")[1] for m in session["messages"]
            )
            if has_empty_main and not empty_main_added:
                extras.append(session)
                empty_main_added = True
            elif has_think and 8_000 < raw < 40_000 and len(extras) < 8:
                extras.append(session)
        chosen.extend(extras[:8])

    chosen.sort(key=lambda s: s.get("updatedAt") or s.get("createdAt") or "", reverse=True)
    return chosen


# ---------------------------------------------------------------------------
# 三种消息结构
# ---------------------------------------------------------------------------

def build_message_current(message: dict) -> dict:
    """00 —— 当前代码的产物：没有 text 字段，只有 content 块。"""
    thoughts, main = extract_thinking_blocks(message["content"] or "")
    blocks: list[dict] = [{"type": "thinking", "thinking": t} for t in thoughts]
    blocks.append({"type": "text", "text": main})
    sender = "human" if message["role"] == "user" else "assistant"
    stamp = format_claude_date(message["createdAt"])
    return {
        "uuid": message["id"],
        "sender": sender,
        "content": blocks,
        "created_at": stamp,
        "updated_at": stamp,
        "attachments": [],
        "files": [],
    }


def build_message_full(message: dict) -> dict:
    """01 —— 严格按规范补全：text + content(thinking 带时间戳) + 其余必填数组。"""
    thoughts, main = extract_thinking_blocks(message["content"] or "")
    sender = "human" if message["role"] == "user" else "assistant"
    stamp = format_claude_date(message["createdAt"])

    plain = main
    if not plain and thoughts:
        plain = "\n\n".join(thoughts)

    blocks: list[dict] = []
    for thought in thoughts:
        blocks.append(
            {
                "type": "thinking",
                "thinking": thought,
                "start_timestamp": stamp,
                "stop_timestamp": stamp,
            }
        )
    if main:
        blocks.append({"type": "text", "text": main})
    elif not thoughts:
        blocks.append({"type": "text", "text": ""})

    return {
        "uuid": message["id"],
        "text": plain,
        "content": blocks,
        "sender": sender,
        "created_at": stamp,
        "updated_at": stamp,
        "attachments": [],
        "files": [],
    }


def build_message_vanilla(message: dict) -> dict:
    """02 —— 老式最小结构：没有 thinking 块，text 与 content 同源。"""
    thoughts, main = extract_thinking_blocks(message["content"] or "")
    plain = main
    if not plain and thoughts:
        plain = "\n\n".join(thoughts)
    sender = "human" if message["role"] == "user" else "assistant"
    stamp = format_claude_date(message["createdAt"])
    return {
        "uuid": message["id"],
        "text": plain,
        "content": [{"type": "text", "text": plain}],
        "sender": sender,
        "created_at": stamp,
        "updated_at": stamp,
        "attachments": [],
        "files": [],
    }


def build_conversation(session: dict, message_builder, with_account: bool) -> dict:
    conversation = {
        "uuid": session["id"],
        "name": session.get("title") or "",
        "created_at": format_claude_date(session["createdAt"]),
        "updated_at": format_claude_date(session["updatedAt"]),
    }
    if with_account:
        conversation["account"] = {"uuid": ACCOUNT_UUID}
    conversation["chat_messages"] = [message_builder(m) for m in session["messages"]]
    return conversation


# ---------------------------------------------------------------------------
# 校验（上传前自检，等价于文档「十二、常见错误检查清单」）
# ---------------------------------------------------------------------------

UUID_V4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
STAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$")


def validate(conversations: list[dict], require_text: bool) -> list[str]:
    problems: list[str] = []
    seen: set[str] = set()
    if not isinstance(conversations, list):
        return ["顶层不是 JSON 数组"]
    for index, conversation in enumerate(conversations):
        for key in ("uuid", "name", "created_at", "updated_at", "chat_messages"):
            if key not in conversation:
                problems.append(f"conv[{index}] 缺少 {key}")
        uuid_value = conversation.get("uuid", "")
        if not UUID_V4.match(uuid_value):
            problems.append(f"conv[{index}] uuid 不是 v4: {uuid_value}")
        if uuid_value in seen:
            problems.append(f"conv[{index}] uuid 重复: {uuid_value}")
        seen.add(uuid_value)
        for key in ("created_at", "updated_at"):
            if not STAMP.match(conversation.get(key, "")):
                problems.append(f"conv[{index}] {key} 时间戳格式错误: {conversation.get(key)}")
        for position, message in enumerate(conversation.get("chat_messages", [])):
            if message.get("sender") not in ("human", "assistant"):
                problems.append(f"conv[{index}].msg[{position}] sender 非法: {message.get('sender')}")
            if not UUID_V4.match(message.get("uuid", "")):
                problems.append(f"conv[{index}].msg[{position}] uuid 不是 v4")
            if message.get("uuid") in seen:
                problems.append(f"conv[{index}].msg[{position}] uuid 重复")
            seen.add(message.get("uuid"))
            if require_text and not isinstance(message.get("text"), str):
                problems.append(f"conv[{index}].msg[{position}] 缺少 text 字段")
            if not isinstance(message.get("content"), list):
                problems.append(f"conv[{index}].msg[{position}] content 不是数组")
            for key in ("attachments", "files"):
                if not isinstance(message.get(key), list):
                    problems.append(f"conv[{index}].msg[{position}] {key} 不是数组")
            for key in ("created_at", "updated_at"):
                if not STAMP.match(message.get(key, "")):
                    problems.append(f"conv[{index}].msg[{position}] {key} 时间戳格式错误")
    return problems


# ---------------------------------------------------------------------------
# 打包
# ---------------------------------------------------------------------------

def dump(obj) -> str:
    """与 JSON.stringify(obj, null, 2) 一致的输出。"""
    return json.dumps(obj, ensure_ascii=False, indent=2)


def write_zip(path: str, members: dict[str, str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, text in members.items():
            info = zipfile.ZipInfo(filename=name, date_time=(2026, 10, 2, 12, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            info.create_system = 0
            archive.writestr(info, text.encode("utf-8"))


def users_json() -> str:
    return dump(
        [
            {
                "uuid": ACCOUNT_UUID,
                "full_name": "AI Math Chat Studio",
                "email_address": "export@localhost",
                "verified_phone_number": None,
            }
        ]
    )


CONTROL_SAMPLE = os.path.join(os.path.dirname(__file__), "control-sample-conversations.json")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--all", action="store_true", help="导出全部会话，而不是探针子集")
    args = parser.parse_args()

    sessions = load_sessions(args.all)
    print(f"选中 {len(sessions)} 个会话，共 {sum(len(s['messages']) for s in sessions)} 条消息")

    current = [build_conversation(s, build_message_current, False) for s in sessions]
    full = [build_conversation(s, build_message_full, True) for s in sessions]
    vanilla = [build_conversation(s, build_message_vanilla, False) for s in sessions]

    for label, data, require_text in (
        ("00-current-output", current, False),
        ("01-full-fidelity", full, True),
        ("02-vanilla-text", vanilla, True),
    ):
        problems = validate(data, require_text)
        status = "OK"
        if problems:
            status = f"{len(problems)} 处问题 -> {problems[:3]}"
        print(f"  校验 {label}: {status}")

    write_zip(os.path.join(args.out, "00-current-output.zip"), {"conversations.json": dump(current)})
    write_zip(
        os.path.join(args.out, "01-full-fidelity.zip"),
        {
            "conversations.json": dump(full),
            "users.json": users_json(),
            "projects.json": dump([]),
        },
    )
    write_zip(os.path.join(args.out, "02-vanilla-text.zip"), {"conversations.json": dump(vanilla)})

    with open(CONTROL_SAMPLE, encoding="utf-8") as handle:
        control = handle.read()
    write_zip(os.path.join(args.out, "03-control-sample.zip"), {"conversations.json": control})

    print("\n输出目录:", args.out)
    for name in sorted(os.listdir(args.out)):
        full_path = os.path.join(args.out, name)
        print(f"  {name:28s} {os.path.getsize(full_path) / 1024:8.1f} KB")


if __name__ == "__main__":
    main()
