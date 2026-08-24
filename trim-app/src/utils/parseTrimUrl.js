/**
 * Đọc một URL trim:// thành ý định log — HÀM THUẦN, không side effect.
 *
 * Viết theo CommonJS (module.exports) để Jest chạy được thẳng, không cần babel.
 * Metro vẫn import bình thường: import { parseTrimUrl } from '../utils/parseTrimUrl'.
 *
 * Hỗ trợ:
 *   trim://log?text=...        -> { kind: 'meal',     text }
 *   trim://activity?text=...   -> { kind: 'activity', text }
 *   trim://weight?value=71.2   -> { kind: 'weight',   value }
 * Thêm tuỳ chọn cho log/activity: &mealType=breakfast|lunch|dinner|snack
 *
 * Trả null nếu URL không thuộc về Trim hoặc thiếu tham số bắt buộc.
 *
 * LƯU Ý QUAN TRỌNG: iOS Shortcuts KHÔNG tự URL-encode biến trong action
 * "Open URLs". Chuỗi tiếng Việt có dấu và dấu cách sẽ vào ở dạng thô, và
 * decodeURIComponent sẽ ném lỗi nếu gặp '%' lạc lõng. Khi đó ta dùng chuỗi
 * gốc — KHÔNG trả null. Không có bước này thì mọi log tiếng Việt qua Shortcut
 * đều hỏng.
 */
const SCHEME = 'trim://';

const HOST_TO_KIND = {
  log: 'meal',
  activity: 'activity',
  weight: 'weight',
};

const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    // '%' không phải escape hợp lệ (vd "50% protein") -> giữ nguyên chuỗi gốc
    return value;
  }
}

function stripTrailingSlashes(str) {
  let end = str.length;
  while (end > 0 && str[end - 1] === '/') end -= 1;
  return str.slice(0, end);
}

function parseQuery(query) {
  const out = {};
  if (!query) return out;
  const pairs = query.split('&');
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? '' : pair.slice(eq + 1);
    const key = safeDecode(rawKey).trim();
    if (!key) continue;
    // Tham số đầu tiên thắng — Shortcut lặp key là lỗi cấu hình, đừng đoán bừa.
    if (out[key] === undefined) out[key] = safeDecode(rawVal);
  }
  return out;
}

function parseTrimUrl(url) {
  if (typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (trimmed.slice(0, SCHEME.length).toLowerCase() !== SCHEME) return null;

  const rest = trimmed.slice(SCHEME.length);
  if (!rest) return null;

  const qIdx = rest.indexOf('?');
  const host = stripTrailingSlashes(qIdx === -1 ? rest : rest.slice(0, qIdx)).toLowerCase();
  const params = parseQuery(qIdx === -1 ? '' : rest.slice(qIdx + 1));

  const kind = HOST_TO_KIND[host];
  if (!kind) return null;

  if (kind === 'weight') {
    if (params.value === undefined) return null;
    const value = Number(String(params.value).trim());
    if (!Number.isFinite(value) || value <= 0) return null;
    return { kind, value };
  }

  const text = typeof params.text === 'string' ? params.text.trim() : '';
  if (!text) return null;

  const result = { kind, text };
  if (VALID_MEAL_TYPES.indexOf(params.mealType) !== -1) result.mealType = params.mealType;
  return result;
}

module.exports = { parseTrimUrl };
