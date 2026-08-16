const express = require('express');
const authenticate = require('../middleware/auth');
const MealLog = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const { calculateBMR, calculateAge } = require('../utils/bmr');

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

  const baseline = Math.round(bmr * 0.2);
  const tdee = bmr + baseline + Math.round(caloriesBurned);
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
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const stats = await buildDailyStats(req.user._id, req.user, date);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/stats/weekly
router.get('/weekly', async (req, res, next) => {
  try {
    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const days = await Promise.all(dates.map((date) => buildDailyStats(req.user._id, req.user, date)));

    res.json({
      days,
      totals: {
        caloriesConsumed: days.reduce((s, d) => s + d.caloriesConsumed, 0),
        caloriesBurned: days.reduce((s, d) => s + d.caloriesBurned, 0),
        avgDeficit: Math.round(days.reduce((s, d) => s + d.deficit, 0) / 7),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
