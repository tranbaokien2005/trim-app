/**
 * Tiện ích ngày dùng chung cho backend.
 *
 * NGUYÊN TẮC: server KHÔNG BAO GIỜ tự suy "hôm nay" bằng UTC.
 * Ngày phải do client gửi lên; nếu thiếu thì suy theo timezone của user.
 */

/**
 * Trả 'YYYY-MM-DD' của hôm nay theo timezone truyền vào.
 * timezone: IANA string, vd 'America/New_York'. Thiếu/không hợp lệ → UTC.
 * Dùng locale 'en-CA' vì nó cho ra đúng định dạng YYYY-MM-DD.
 */
function getTodayInTz(timezone) {
  const tz = timezone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year:  'numeric',
      month: '2-digit',
      day:   '2-digit',
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Trả 'YYYY-MM-DD' của n ngày trước dateStr. */
function subtractDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Kiểm tra chuỗi có đúng dạng YYYY-MM-DD và là ngày có thật không. */
function isValidDateString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

module.exports = { getTodayInTz, subtractDays, isValidDateString };
