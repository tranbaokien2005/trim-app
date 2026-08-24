/**
 * Zod schemas cho các route auth + route ghi chính.
 * Nguồn DUY NHẤT cho hình dạng input hợp lệ. Middleware validate() (../middleware/validate)
 * dùng các schema này để trả 400 + message AN TOÀN (không echo giá trị nhạy cảm như password).
 */
const { z } = require('zod');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const KINDS = ['meal', 'activity', 'weight'];
const ORIGINS = ['app', 'deeplink', 'shortcut', 'widget', 'siri', 'intent'];

// Email: regex đơn giản, chuẩn hoá trim + lowercase (khớp User model lowercase:true).
const email = z
  .string({ message: 'email is required' })
  .trim()
  .min(1, 'email is required')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address')
  .transform((s) => s.toLowerCase());

// YYYY-MM-DD
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

// ── AUTH ─────────────────────────────────────────────────────────────────────

// Password mạnh nhưng không khắt khe quá (UX + Apple): >=8 ký tự, có chữ VÀ số.
// KHÔNG echo password trong message.
const strongPassword = z
  .string({ message: 'password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const registerSchema = z.object({
  name: z.string({ message: 'name is required' }).trim().min(1, 'name is required'),
  email,
  password: strongPassword,
});

// Login KHÔNG áp strength (mật khẩu cũ có thể yếu hơn rule mới); chỉ cần có mặt.
const loginSchema = z.object({
  email,
  password: z.string({ message: 'password is required' }).min(1, 'password is required'),
});

// ── WRITE ROUTES ─────────────────────────────────────────────────────────────

const mealItem = z.object({
  name: z.string().trim().min(1, 'each item requires a name'),
  calories: z.number('each item requires numeric calories').min(0, 'calories must be >= 0'),
});

const mealSchema = z.object({
  date: dateString,
  mealType: z.enum(MEAL_TYPES, { message: 'mealType must be breakfast, lunch, dinner, or snack' }),
  items: z.array(mealItem).min(1, 'items array is required and must not be empty'),
});

const activityEntry = z.object({
  name: z.string().trim().min(1, 'each entry requires a name'),
  durationMinutes: z.number('durationMinutes must be a number').min(0, 'durationMinutes must be >= 0'),
  caloriesBurned: z.number('caloriesBurned must be a number').min(0, 'caloriesBurned must be >= 0'),
});

const activitySchema = z.object({
  date: dateString,
  entries: z.array(activityEntry).min(1, 'entries array is required and must not be empty'),
});

const weightSchema = z.object({
  weight: z.number('Valid weight in kg is required').positive('Valid weight in kg is required'),
});

// Quicklog: validate theo kind. Giữ đúng ràng buộc cũ trong routes/quicklog.js.
const quicklogSchema = z
  .object({
    kind: z.enum(KINDS, { message: 'kind must be meal, activity, or weight' }),
    clientId: z.string('clientId is required').trim().min(1, 'clientId is required'),
    text: z.string().optional(),
    value: z.number().optional(),
    origin: z.enum(ORIGINS, { message: 'origin is not a recognised surface' }).optional(),
    mealType: z.enum(MEAL_TYPES, { message: 'mealType must be breakfast, lunch, dinner, or snack' }).optional(),
    date: dateString.optional(),
  })
  .refine(
    (d) => !((d.kind === 'meal' || d.kind === 'activity') && (typeof d.text !== 'string' || !d.text.trim())),
    { message: 'text is required for kind meal and activity', path: ['text'] }
  )
  .refine(
    (d) => !(d.kind === 'weight' && !(typeof d.value === 'number' && d.value > 0)),
    { message: 'Valid weight in kg is required', path: ['value'] }
  );

module.exports = {
  registerSchema,
  loginSchema,
  mealSchema,
  activitySchema,
  weightSchema,
  quicklogSchema,
};
