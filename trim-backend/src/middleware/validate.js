/**
 * Middleware validate(schema, { replace }) — cổng validation dùng zod.
 *
 * - Body không hợp lệ → 400 { message: 'Validation failed', errors: [{ field, message }] }.
 *   Message CHỈ mô tả ràng buộc (từ schema), KHÔNG echo giá trị người dùng gửi (tránh lộ
 *   password/nhạy cảm trong response hay log).
 * - replace=true: thay req.body bằng dữ liệu đã parse/chuẩn hoá (dùng cho auth để
 *   normalize email lowercase+trim). Mặc định false: chỉ gate, KHÔNG đụng req.body
 *   (route ghi vẫn đọc body gốc như cũ, tránh strip nhầm field).
 */
const validate = (schema, { replace = false } = {}) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.length ? i.path.join('.') : '(body)',
      message: i.message,
    }));
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  if (replace) req.body = result.data;
  next();
};

module.exports = validate;
