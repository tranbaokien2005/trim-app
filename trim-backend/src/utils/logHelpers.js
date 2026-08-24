/**
 * Helper dùng chung cho mọi đường ghi log (routes/meals, routes/activities,
 * routes/weights, routes/quicklog).
 *
 * Tách thuần tuý từ các route đã có — không đổi công thức, không đổi thứ tự.
 * Mục đích: /api/quicklog dùng lại ĐÚNG logic cũ thay vì viết bản sao thứ hai.
 */
const User = require('../models/User');
const { calculateBMRFromUser, calculateBaseline } = require('./bmr');

/** Tổng macro của một mảng item món ăn. (từ routes/meals.js) */
const calcTotals = (items) => ({
  calories: items.reduce((s, i) => s + (i.calories || 0), 0),
  protein: items.reduce((s, i) => s + (i.protein || 0), 0),
  carbs: items.reduce((s, i) => s + (i.carbs || 0), 0),
  fat: items.reduce((s, i) => s + (i.fat || 0), 0),
});

/** Tổng kết một mảng entry hoạt động. (từ routes/activities.js) */
const calcSummary = (entries) => ({
  totalCaloriesBurned: entries.reduce((s, e) => s + (e.caloriesBurned || 0), 0),
  totalActiveMinutes: entries.reduce((s, e) => s + (e.durationMinutes || 0), 0),
});

/**
 * Ghi lại currentStats.bmr + baseline từ dữ liệu MỚI NHẤT của user.
 * Dùng utils/bmr.js — KHÔNG viết lại công thức. bmr đọc weight từ
 * currentStats.weight (nên gọi SAU khi weight đã cập nhật), height/dob/gender
 * từ profile. Thiếu dữ liệu (calculateBMRFromUser trả null) => KHÔNG ghi,
 * để bmr/baseline vắng (đúng yêu cầu: user chưa có profile thì bmr không có).
 */
const syncCurrentStatsBmr = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;
  const rawBmr = calculateBMRFromUser(user); // chưa làm tròn, hoặc null
  if (rawBmr == null) return;
  const bmr = Math.round(rawBmr);
  const baseline = calculateBaseline(bmr); // baseline tính từ bmr ĐÃ làm tròn
  await User.findByIdAndUpdate(userId, {
    'currentStats.bmr': bmr,
    'currentStats.baseline': baseline,
  });
};

/**
 * Đồng bộ currentStats sau khi tạo WeightLog. (từ routes/weights.js POST)
 * Quên gọi hàm này = Home hiển thị cân nặng cũ — lỗi đã có trong Common Mistakes.
 * Cân nặng đổi => BMR đổi => cập nhật luôn bmr/baseline (nếu đủ profile).
 */
const syncCurrentStatsWeight = async (userId, weight, bmi) => {
  await User.findByIdAndUpdate(userId, {
    'currentStats.weight': weight,
    'currentStats.bmi': bmi,
    'currentStats.weightUpdatedAt': new Date(),
  });
  await syncCurrentStatsBmr(userId);
};

module.exports = { calcTotals, calcSummary, syncCurrentStatsWeight, syncCurrentStatsBmr };
