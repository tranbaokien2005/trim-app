/**
 * Helper dùng chung cho mọi đường ghi log (routes/meals, routes/activities,
 * routes/weights, routes/quicklog).
 *
 * Tách thuần tuý từ các route đã có — không đổi công thức, không đổi thứ tự.
 * Mục đích: /api/quicklog dùng lại ĐÚNG logic cũ thay vì viết bản sao thứ hai.
 */
const User = require('../models/User');

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
 * Đồng bộ currentStats sau khi tạo WeightLog. (từ routes/weights.js POST)
 * Quên gọi hàm này = Home hiển thị cân nặng cũ — lỗi đã có trong Common Mistakes.
 */
const syncCurrentStatsWeight = (userId, weight, bmi) =>
  User.findByIdAndUpdate(userId, {
    'currentStats.weight': weight,
    'currentStats.bmi': bmi,
    'currentStats.weightUpdatedAt': new Date(),
  });

module.exports = { calcTotals, calcSummary, syncCurrentStatsWeight };
