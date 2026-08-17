const express = require('express');
const authenticate = require('../middleware/auth');
const MealLog = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const { calculateBMR, calculateAge, calculateTDEE } = require('../utils/bmr');
const { getTodayInTz, subtractDays, isValidDateString } = require('../utils/date');

const router = express.Router();
router.use(authenticate);

const buildDailyStats = async (userId, user, date) => {
  const [meals, activities] = await Promise.all([
    MealLog.find({ user: userId, date }),
    ActivityLog.find({ user: userId, date }),
  ]);

  const caloriesConsumed = meals.reduce((s, m) => s + (m.totals?.calories || 0), 0);
  const caloriesBurned = activities.reduce((s, a) => s + (a.summary?.totalCaloriesBurned || 0), 0);

  let bmr = 0;
  const { profile, currentStats, goals } = user;
  if (profile?.dateOfBirth && profile?.height && profile?.gender) {
    const age = calculateAge(profile.dateOfBirth);
    bmr = Math.round(calculateBMR(currentStats?.weight || 70, profile.height, age, profile.gender));
  }

  const tdee = calculateTDEE(bmr, caloriesBurned);
  const deficit = tdee - caloriesConsumed; // positive = deficit, negative = surplus
  const activeGoal = goals?.find((g) => g.isActive);

  return {
    date,
    caloriesConsumed: Math.round(caloriesConsumed),
    caloriesBurned: Math.round(caloriesBurned),
    bmr,
    tdee: Math.round(tdee),
    deficit: Math.round(deficit),
    dailyTarget: Math.round(activeGoal?.dailyCalorieTarget || 0),
    meals,
    activities,
  };
};

// GET /api/stats/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res, next) => {
  try {
    const date = req.query.date || getTodayInTz(req.user.profile?.timezone);
    const stats = await buildDailyStats(req.user._id, req.user, date);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/stats/weekly
router.get('/weekly', async (req, res, next) => {
  try {
    const end = req.query.end || getTodayInTz(req.user.profile?.timezone);
    if (!isValidDateString(end)) {
      return res.status(400).json({ message: 'Invalid end date, expected YYYY-MM-DD' });
    }

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);

    // mảng ngày tăng dần, phần tử cuối là `end`
    const dates = Array.from({ length: days }, (_, i) => subtractDays(end, days - 1 - i));

    const dayStats = await Promise.all(dates.map((date) => buildDailyStats(req.user._id, req.user, date)));

    res.json({
      days: dayStats,
      totals: {
        caloriesConsumed: dayStats.reduce((s, d) => s + d.caloriesConsumed, 0),
        caloriesBurned: dayStats.reduce((s, d) => s + d.caloriesBurned, 0),
        avgDeficit: Math.round(dayStats.reduce((s, d) => s + d.deficit, 0) / days),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
