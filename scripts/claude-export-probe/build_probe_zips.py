#!/usr/bin/env python3
"""
build_probe_zips.py — Gemini「Import chats」导入失败排查探针

背景
----
本项目 `SettingsModal.tsx` 的「导出为 Claude 格式」生成 `Claude_Export_<ts>.zip`，
其中的 `All_Conversations.zip`（根目录只有一个 `conversations.json`）在
2026-08-20 还能被 gemini.google.com/import 正常导入，2026-09-10 起开始报：

    无法导入文件
    无法读取上传的文件。请确保该文件来自受支持的 AI 应用。

本项目导出代码最后一次改动是 2026-07-25，失败批次比成功批次还小，
说明变的是对面的「来源识别 / 校验」逻辑。本脚本按 2×2 维度生成探针包：

              │ 真实数据                  │ 已知可用的最小样例
    ──────────┼───────────────────────────┼─────────────────────────
    整包特征  │ 01-full-fidelity.zip      │ 02-control-bundle.zip
    (多文件)  │                           │
    ──────────┼───────────────────────────┼─────────────────────────
    裸 json   │ 00-current-output.zip     │ 03-control-bare.zip
              │ (= 现状，已知失败)         │ (= 2026-06 实测可用)

    04-vanilla-no-thinking.zip：真实数据 + 整包特征，但不输出 thinking 块

用法
----
    python3 scripts/claude-export-probe/build_probe_zips.py
    python3 scripts/claude-export-probe/build_probe_zips.py --all      # 全部会话
    python3 scripts/claude-export-probe/build_probe_zips.py --out /tmp/probe

只用 Python 标准库。
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import zipfile
from datetime import datetime, timedelta, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SESSIONS_DIR = os.path.join(REPO_ROOT, "data", "sessions")
PROBE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(PROBE_DIR, "out")
CONTROL_SAMPLE = os.path.join(PROBE_DIR, "control-sample-conversations.json")

# 固定账号 UUID，保证多次生成结果稳定（真实导出里是账号主键）
ACCOUNT_UUID = "7c3d41e5-9b02-4a6f-8f14-2d5e6a90c431"

CLOSED_THINK_RE = re.compile(r"<think>([\s\S]*?)</think>", re.IGNORECASE)

# 探针会话：覆盖 thinking 块 / 超大正文 / 未闭合 <think> / 纯文本 等边界
PROBE_SESSION_IDS = [
    "929097a8-b187-4752-8de4-a8ea0f44aff8",  # 你贴出来的那条（纯文本，无 thinking）
    "14e501fd-78f6-4abd-af90-412d136c3e5e",  # 最大的一条（~290 KB，LaTeX 密集）
    "c7e1fcbe-3da7-416a-a25f-61ace34c3689",  # 含未闭合 <think>
    "4765c520-d93d-42d1-8c13-6f2ee9b047ec",  # 含未闭合 <think>
]


# ---------------------------------------------------------------------------
# 与 src/components/SettingsModal.tsx 等价的两个工具函数（已与 TS 实现对拍）
# ---------------------------------------------------------------------------

def format_claude_date(date_str: str) -> str:
    """等价于 formatClaudeDate()：ISO-8601 UTC，微秒补满 6 位，结尾大写 Z。"""
    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00")).astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond:06d}Z"


def parse_stamp(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str.replace("Z", "+00:00")).astimezone(timezone.utc)


def to_stamp(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond:06d}Z"


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
    by_id: dict[str, dict] = {}
    for path in sorted(glob.glob(os.path.join(SESSIONS_DIR, "*.json"))):
        with open(path, encoding="utf-8") as handle:
            session = json.load(handle)
        by_id[session["id"]] = session

    if all_sessions:
        chosen = list(by_id.values())
    else:
        chosen = [by_id[sid] for sid in PROBE_SESSION_IDS if sid in by_id]
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
    """现状：没有 text 字段，只有 content 块（正文为空时留一个空 text 块）。"""
    thoughts, main = extract_thinking_blocks(message["content"] or "")
    blocks: list[dict] = [{"type": "thinking", "thinking": t} for t in thoughts]
    blocks.append({"type": "text", "text": main})
    stamp = format_claude_date(message["createdAt"])
    return {
        "uuid": message["id"],
        "sender": "human" if message["role"] == "user" else "assistant",
        "content": blocks,
        "created_at": stamp,
        "updated_at": stamp,
        "attachments": [],
        "files": [],
    }


def build_message_full(message: dict, stamp: str) -> dict:
    """规范完整版：text + content(thinking 带时间戳) + 必填空数组。"""
    thoughts, main = extract_thinking_blocks(message["content"] or "")
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
        "sender": "human" if message["role"] == "user" else "assistant",
        "created_at": stamp,
        "updated_at": stamp,
        "attachments": [],
        "files": [],
    }


def build_message_vanilla(message: dict, stamp: str) -> dict:
    """老式最小结构：没有 thinking 块，text 与 content 同源。"""
    thoughts, main = extract_thinking_blocks(message["content"] or "")
    plain = main
    if not plain and thoughts:
        plain = "\n\n".join(thoughts)
    return {
        "uuid": message["id"],
        "text": plain,
        "content": [{"type": "text", "text": plain}],
        "sender": "human" if message["role"] == "user" else "assistant",
        "created_at": stamp,
        "updated_at": stamp,
        "attachments": [],
        "files": [],
    }


def monotonic_stamps(session: dict) -> list[str]:
    """消息时间戳单调不降，避免严格校验器挑刺。"""
    stamps: list[datetime] = []
    previous: datetime | None = None
    for message in session["messages"]:
        current = parse_stamp(message["createdAt"])
        if previous is not None and current < previous:
            current = previous + timedelta(microseconds=1000)
        stamps.append(current)
        previous = current
    return [to_stamp(s) for s in stamps]


def build_conversation(session: dict, kind: str) -> dict:
    """kind: current | full | vanilla"""
    if kind == "current":
        return {
            "uuid": session["id"],
            "name": session.get("title") or "",
            "created_at": format_claude_date(session["createdAt"]),
            "updated_at": format_claude_date(session["updatedAt"]),
            "chat_messages": [build_message_current(m) for m in session["messages"]],
        }

    stamps = monotonic_stamps(session)
    builder = build_message_full
    if kind == "vanilla":
        builder = build_message_vanilla
    messages = [builder(m, s) for m, s in zip(session["messages"], stamps)]

    created = parse_stamp(session["createdAt"])
    updated = parse_stamp(session["updatedAt"])
    if stamps:
        created = min(created, parse_stamp(stamps[0]))
        updated = max(updated, parse_stamp(stamps[-1]))
    if updated < created:
        updated = created

    return {
        "uuid": session["id"],
        "name": session.get("title") or "",
        "created_at": to_stamp(created),
        "updated_at": to_stamp(updated),
        "account": {"uuid": ACCOUNT_UUID},
        "chat_messages": messages,
    }


# ---------------------------------------------------------------------------
# 上传前自检
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
        if parse_stamp(conversation["updated_at"]) < parse_stamp(conversation["created_at"]):
            problems.append(f"conv[{index}] updated_at 早于 created_at")
        previous = None
        for position, message in enumerate(conversation.get("chat_messages", [])):
            if message.get("sender") not in ("human", "assistant"):
                problems.append(f"conv[{index}].msg[{position}] sender 非法")
            if not UUID_V4.match(message.get("uuid", "")):
                problems.append(f"conv[{index}].msg[{position}] uuid 不是 v4")
            if message.get("uuid") in seen:
                problems.append(f"conv[{index}].msg[{position}] uuid 重复")
            seen.add(message.get("uuid"))
            if require_text and not isinstance(message.get("text"), str):
                problems.append(f"conv[{index}].msg[{position}] 缺少 text")
            if require_text and not message.get("text"):
                problems.append(f"conv[{index}].msg[{position}] text 为空")
            if not isinstance(message.get("content"), list):
                problems.append(f"conv[{index}].msg[{position}] content 不是数组")
            for key in ("attachments", "files"):
                if not isinstance(message.get(key), list):
                    problems.append(f"conv[{index}].msg[{position}] {key} 不是数组")
            for key in ("created_at", "updated_at"):
                if not STAMP.match(message.get(key, "")):
                    problems.append(f"conv[{index}].msg[{position}] {key} 时间戳格式错误")
            current = parse_stamp(message["created_at"])
            if previous is not None and current < previous:
                problems.append(f"conv[{index}].msg[{position}] 时间戳回退")
            previous = current
    return problems


# ---------------------------------------------------------------------------
# 打包
# ---------------------------------------------------------------------------

def dump(obj) -> str:
    """与 JSON.stringify(obj, null, 2) 一致。"""
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


def bundle_members(conversations_json: str) -> dict[str, str]:
    """模仿真实 Claude 导出包：conversations.json 之外还有账号/项目文件。"""
    users = [
        {
            "uuid": ACCOUNT_UUID,
            "full_name": "AI Math Chat Studio",
            "email_address": "export@localhost",
            "verified_phone_number": None,
        }
    ]
    return {
        "conversations.json": conversations_json,
        "users.json": dump(users),
        "projects.json": dump([]),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--all", action="store_true", help="导出全部会话而不是探针子集")
    args = parser.parse_args()

    sessions = load_sessions(args.all)
    print(f"选中 {len(sessions)} 个会话 / {sum(len(s['messages']) for s in sessions)} 条消息")

    current = [build_conversation(s, "current") for s in sessions]
    full = [build_conversation(s, "full") for s in sessions]
    vanilla = [build_conversation(s, "vanilla") for s in sessions]
    with open(CONTROL_SAMPLE, encoding="utf-8") as handle:
        control_text = handle.read()
    control = json.loads(control_text)

    for label, data, require_text in (
        ("00-current-output", current, False),
        ("01-full-fidelity", full, True),
        ("04-vanilla-no-thinking", vanilla, True),
        ("control-sample", control, True),
    ):
        problems = validate(data, require_text)
        status = "OK"
        if problems:
            status = f"{len(problems)} 处问题 -> {problems[:3]}"
        print(f"  自检 {label}: {status}")

    write_zip(os.path.join(args.out, "00-current-output.zip"), {"conversations.json": dump(current)})
    write_zip(os.path.join(args.out, "01-full-fidelity.zip"), bundle_members(dump(full)))
    write_zip(os.path.join(args.out, "02-control-bundle.zip"), bundle_members(control_text))
    write_zip(os.path.join(args.out, "03-control-bare.zip"), {"conversations.json": control_text})
    write_zip(os.path.join(args.out, "04-vanilla-no-thinking.zip"), bundle_members(dump(vanilla)))

    print("\n输出目录:", args.out)
    for name in sorted(os.listdir(args.out)):
        size = os.path.getsize(os.path.join(args.out, name))
        print(f"  {name:30s} {size / 1024:8.1f} KB")


if __name__ == "__main__":
    main()
