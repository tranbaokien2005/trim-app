const express = require('express');
const authenticate = require('../middleware/auth');
const MealLog     = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return today's date string (YYYY-MM-DD) in the given IANA timezone. */
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

/** Return YYYY-MM-DD string that is n days before dateStr. */
function subtractDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Mifflin-St Jeor BMR. Returns null if profile data is incomplete. */
function computeBMR(user) {
  const weight = user.currentStats?.weight;
  const height = user.profile?.height;
  const dob    = user.profile?.dateOfBirth;
  const gender = user.profile?.gender;
  if (!weight || !height || !dob) return null;
  const ageMs = Date.now() - new Date(dob).getTime();
  const age   = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  const base  = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male')   return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78;
}

function calcTotals(items) {
  return {
    calories: items.reduce((s, i) => s + (i.calories || 0), 0),
    protein:  items.reduce((s, i) => s + (i.protein  || 0), 0),
    carbs:    items.reduce((s, i) => s + (i.carbs    || 0), 0),
    fat:      items.reduce((s, i) => s + (i.fat      || 0), 0),
  };
}

function calcSummary(entries) {
  return {
    totalCaloriesBurned: entries.reduce((s, e) => s + (e.caloriesBurned  || 0), 0),
    totalActiveMinutes:  entries.reduce((s, e) => s + (e.durationMinutes || 0), 0),
  };
}

// ---------------------------------------------------------------------------
// GET /api/patterns/today
//
// Returns the most recent past day (same weekday, within 21 days) as a
// "source day" preview.  The frontend can pass sourceDate to POST /apply.
// ---------------------------------------------------------------------------
router.get('/today', async (req, res, next) => {
  try {
    const user     = req.user;
    const today    = getTodayInTz(user.profile?.timezone);
    const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=Sun…6=Sat

    const THRESHOLD = process.env.NODE_ENV === 'production' ? 3 : 1;

    // The 3 past dates that share today's day-of-week within 21 days
    const matchDates = [
      subtractDays(today, 7),
      subtractDays(today, 14),
      subtractDays(today, 21),
    ];

    const [mealLogs, activityLogs] = await Promise.all([
      MealLog.find({ user: user._id, date: { $in: matchDates } }),
      ActivityLog.find({ user: user._id, date: { $in: matchDates } }),
    ]);

    // Distinct dates with at least one log, sorted most-recent first
    const dateSet = new Set([
      ...mealLogs.map((m) => m.date),
      ...activityLogs.map((a) => a.date),
    ]);
    const dataPointCount = dateSet.size;

    if (dataPointCount < THRESHOLD) {
      return res.json({ success: true, data: { pattern: null, dataPointCount } });
    }

    // Most recent matching date becomes the source
    const sourceDate = [...dateSet].sort().reverse()[0];

    // Fetch ALL logs for sourceDate
    const [sourceMeals, sourceActs] = await Promise.all([
      MealLog.find({ user: user._id, date: sourceDate }),
      ActivityLog.find({ user: user._id, date: sourceDate }),
    ]);

    // Build preview.meals[] — group by mealType, merging items from same-type logs
    const mealsByType = {};
    for (const log of sourceMeals) {
      if (!mealsByType[log.mealType]) mealsByType[log.mealType] = [];
      for (const item of log.items) {
        mealsByType[log.mealType].push({
          name:            item.name,
          calories:        item.calories,
          protein:         item.protein,
          carbs:           item.carbs,
          fat:             item.fat,
          servingSize:     item.servingSize,
          servingQuantity: item.servingQuantity,
        });
      }
    }
    const mealsPreview = Object.entries(mealsByType).map(([mealType, items]) => ({
      mealType,
      items,
    }));

    // Build preview.activities[] — all entries from every activity log
    const activitiesPreview = sourceActs.flatMap((log) =>
      log.entries.map((e) => ({
        name:            e.name,
        type:            e.type,
        durationMinutes: e.durationMinutes,
        caloriesBurned:  e.caloriesBurned,
        intensity:       e.intensity,
      }))
    );

    const totalCaloriesConsumed = sourceMeals.reduce(
      (s, m) => s + (m.totals?.calories || 0), 0,
    );
    const totalCaloriesBurned = sourceActs.reduce(
      (s, a) => s + a.entries.reduce((es, e) => es + (e.caloriesBurned || 0), 0),
      0,
    );

    const bmr = computeBMR(user);
    const estimatedTDEE = bmr != null
      ? Math.round(bmr * 1.2 + totalCaloriesBurned)
      : Math.round(totalCaloriesConsumed + totalCaloriesBurned);

    return res.json({
      success: true,
      data: {
        pattern: {
          dayOfWeek:     todayDow,
          dataPointCount,
          sourceDate,
          preview: {
            totalCaloriesConsumed,
            totalCaloriesBurned,
            estimatedTDEE,
            meals:      mealsPreview,
            activities: activitiesPreview,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/patterns/apply
//
// Body: { sourceDate: "YYYY-MM-DD" }
// Duplicates the source day's meal + activity logs onto today's date.
// ---------------------------------------------------------------------------
router.post('/apply', async (req, res, next) => {
  try {
    const user  = req.user;
    const today = getTodayInTz(user.profile?.timezone);

    const { sourceDate } = req.body;

    // ── Validate sourceDate ──────────────────────────────────────────────────
    if (!sourceDate || typeof sourceDate !== 'string' || !sourceDate.trim()) {
      return res.status(400).json({ success: false, error: 'sourceDate is required' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate.trim())) {
      return res.status(400).json({
        success: false,
        error: 'sourceDate must be in YYYY-MM-DD format',
      });
    }
    if (sourceDate === today) {
      return res.status(400).json({ success: false, error: 'sourceDate cannot be today' });
    }

    const matchDates = [
      subtractDays(today, 7),
      subtractDays(today, 14),
      subtractDays(today, 21),
    ];
    if (!matchDates.includes(sourceDate)) {
      return res.status(400).json({
        success: false,
        error: "sourceDate must be within the last 21 days and share today's day-of-week",
      });
    }

    // ── Idempotency: reject if today already has any logs ────────────────────
    const [todayMeals, todayActs] = await Promise.all([
      MealLog.find({ user: user._id, date: today }),
      ActivityLog.find({ user: user._id, date: today }),
    ]);
    const conflictCount = todayMeals.length + todayActs.length;
    if (conflictCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'Today already has logs. Apply would overwrite.',
        conflictCount,
      });
    }

    // ── Fetch source logs ────────────────────────────────────────────────────
    const [sourceMeals, sourceActs] = await Promise.all([
      MealLog.find({ user: user._id, date: sourceDate }),
      ActivityLog.find({ user: user._id, date: sourceDate }),
    ]);

    // ── Bulk-create today's logs with rollback on partial failure ────────────
    const createdMealIds = [];
    const createdActIds  = [];

    try {
      for (const src of sourceMeals) {
        const copiedItems = src.items.map((item) => ({
          name:            item.name,
          calories:        item.calories,
          protein:         item.protein,
          carbs:           item.carbs,
          fat:             item.fat,
          servingSize:     item.servingSize,
          servingQuantity: item.servingQuantity,
          source:          'pattern_apply',
        }));
        const newMeal = await MealLog.create({
          user:     user._id,
          date:     today,
          mealType: src.mealType,
          items:    copiedItems,
          totals:   calcTotals(copiedItems),
          notes:    `Applied from ${sourceDate}`,
        });
        createdMealIds.push(newMeal._id);
      }

      for (const src of sourceActs) {
        const copiedEntries = src.entries.map((e) => ({
          name:            e.name,
          type:            e.type,
          durationMinutes: e.durationMinutes,
          caloriesBurned:  e.caloriesBurned,
          intensity:       e.intensity,
        }));
        const newAct = await ActivityLog.create({
          user:    user._id,
          date:    today,
          entries: copiedEntries,
          summary: calcSummary(copiedEntries),
        });
        createdActIds.push(newAct._id);
      }
    } catch (insertErr) {
      // Rollback: delete any docs created so far
      await Promise.all([
        MealLog.deleteMany({ _id: { $in: createdMealIds } }),
        ActivityLog.deleteMany({ _id: { $in: createdActIds } }),
      ]);
      return next(insertErr);
    }

    // ── Build response totals from source ────────────────────────────────────
    const totalCaloriesConsumed = sourceMeals.reduce(
      (s, m) => s + (m.totals?.calories || 0), 0,
    );
    const totalCaloriesBurned = sourceActs.reduce(
      (s, a) => s + a.entries.reduce((es, e) => es + (e.caloriesBurned || 0), 0),
      0,
    );

    return res.json({
      success: true,
      data: {
        appliedDate:         today,
        sourceDate,
        mealLogsCreated:     createdMealIds.length,
        activityLogsCreated: createdActIds.length,
        totalCaloriesConsumed,
        totalCaloriesBurned,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
