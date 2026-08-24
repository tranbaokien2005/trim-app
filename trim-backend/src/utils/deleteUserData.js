const MealLog      = require('../models/MealLog');
const ActivityLog  = require('../models/ActivityLog');
const WeightLog    = require('../models/WeightLog');
const Template     = require('../models/Template');
const RefreshToken = require('../models/RefreshToken');
const User         = require('../models/User');

/**
 * Xoá TOÀN BỘ dữ liệu thuộc về một user.
 *
 * Dùng chung bởi:
 *   - DELETE /api/users/me            (user tự xoá tài khoản)
 *   - script dọn orphan               (deleteUser = false)
 *
 * QUAN TRỌNG: khi thêm collection mới có tham chiếu tới user,
 * PHẢI thêm vào mảng OWNED_COLLECTIONS bên dưới. Quên = sinh rác mồ côi.
 */
const OWNED_COLLECTIONS = [
  { name: 'meals',      model: MealLog },
  { name: 'activities', model: ActivityLog },
  { name: 'weights',    model: WeightLog },
  { name: 'templates',  model: Template },
  { name: 'refreshTokens', model: RefreshToken },
];

const deleteUserData = async (userId, { deleteUser = true } = {}) => {
  const deleted = {};

  for (const { name, model } of OWNED_COLLECTIONS) {
    const res = await model.deleteMany({ user: userId });
    deleted[name] = res.deletedCount;
  }

  if (deleteUser) {
    const res = await User.deleteOne({ _id: userId });
    deleted.user = res.deletedCount;
  }

  return deleted;
};

module.exports = { deleteUserData, OWNED_COLLECTIONS };
