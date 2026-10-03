/**
 * Unicode-safety helpers shared by the client and the server.
 *
 * 背景：会话标题曾用 `text.slice(0, 50)` 按 UTF-16 码元截断，把数学字母数字符号
 * （U+1D400–U+1D7FF，例如 ℝ 的粗体/双线体变体 𝐑、𝕟 等）这类代理对从中间切开，
 * 在标题末尾留下孤立高位代理项（lone surrogate，如 \uD835）。
 * JSON.stringify 会把它序列化成 "\ud835" 转义——语法上是合法 JSON，
 * 但解码后是非良构（ill-formed）Unicode。Gemini「Import chats」等严格校验的
 * 后端会因此拒收整个 conversations.json（表现为会话多了就上传失败，
 * 删到只剩没中招的前几条就能成功）。
 */

/**
 * Remove ill-formed UTF-16 (lone surrogates) plus characters that strict JSON
 * consumers commonly reject: C0 control characters (except \t \n \r), DEL,
 * and the BMP noncharacters U+FFFE / U+FFFF.
 *
 * Valid surrogate pairs (astral characters such as 𝐑, emoji, CJK extension B)
 * are preserved as-is.
 */
export function stripIllFormedUnicode(value: string): string {
  if (!value) return value ?? '';

  let out = '';
  let dirty = false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);

    // High surrogate: keep only when followed by a low surrogate.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1];
        i++;
      } else {
        dirty = true; // drop lone high surrogate
      }
      continue;
    }

    // Lone low surrogate (a preceding pair was already consumed above).
    if (code >= 0xdc00 && code <= 0xdfff) {
      dirty = true;
      continue;
    }

    // C0 control characters except \t \n \r, plus DEL.
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) {
      dirty = true;
      continue;
    }

    // BMP noncharacters.
    if (code === 0xfffe || code === 0xffff) {
      dirty = true;
      continue;
    }

    out += value[i];
  }

  return dirty ? out : value;
}

/**
 * Truncate `value` to at most `maxLength` UTF-16 code units without splitting
 * a surrogate pair, appending `ellipsis` when truncation happened.
 */
export function truncateWellFormed(value: string, maxLength: number, ellipsis = '...'): string {
  if (value.length <= maxLength) return value;

  let cut = value.slice(0, maxLength);
  const last = cut.charCodeAt(cut.length - 1);
  // Never end on a dangling high surrogate.
  if (last >= 0xd800 && last <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut + ellipsis;
}
