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


/**
 * Suy ra bữa ăn ("breakfast" | "lunch" | "dinner" | "snack") theo giờ ĐỊA PHƯƠNG
 * của user. Dùng cho những đường log không gửi kèm mealType (deep link, Shortcut).
 *
 * Buckets giống hệt ChatInputScreen phía app — đừng để hai nơi lệch nhau.
 * timezone thiếu/rỗng/không hợp lệ => UTC, KHÔNG ném lỗi (giống getTodayInTz).
 * now: truyền vào để test không phụ thuộc giờ chạy máy.
 */
function getMealTypeInTz(timezone, now = new Date()) {
  const tz = timezone || 'UTC';
  let hour;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone:  tz,
      hour:      '2-digit',
      hourCycle: 'h23',
    }).format(now);
    hour = parseInt(parts, 10);
  } catch (_) {
    hour = NaN;
  }
  if (!Number.isInteger(hour)) hour = now.getUTCHours();
  hour = hour % 24; // vài phiên bản ICU trả 24 cho nửa đêm

  if (hour >= 6  && hour <= 10) return 'breakfast';
  if (hour >= 11 && hour <= 14) return 'lunch';
  if (hour >= 15 && hour <= 17) return 'snack';
  if (hour >= 18 && hour <= 22) return 'dinner';
  return 'snack';
}

module.exports = { getTodayInTz, getMealTypeInTz, subtractDays, isValidDateString };
