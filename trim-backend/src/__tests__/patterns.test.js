const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request  = require('supertest');
const app      = require('../app');
const MealLog     = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const User        = require('../models/User');

let mongod;
let token, userId;

const USER = {
  name:     'Dana',
  email:    'dana_patterns@example.com',
  password: 'password123',
};

const auth = (t) => ({ Authorization: `Bearer ${t}` });

/**
 * YYYY-MM-DD that is n UTC days before today.
 * Mirrors getTodayInTz(undefined) which falls back to UTC.
 */
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const res = await request(app).post('/api/auth/register').send(USER);
  expect(res.status).toBe(201);
  token  = res.body.accessToken;
  userId = res.body.user._id;

  // Set profile so BMR is computable
  await User.findByIdAndUpdate(userId, {
    'profile.height':      165,
    'profile.gender':      'female',
    'profile.dateOfBirth': new Date('1990-01-15'),
    'currentStats.weight': 65,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await MealLog.deleteMany({});
  await ActivityLog.deleteMany({});
  // Ensure no stale timezone from Scenario G
  await User.findByIdAndUpdate(userId, { $unset: { 'profile.timezone': '' } });
});

// =============================================================================
// GET /api/patterns/today — source-day duplication model
// =============================================================================

describe('GET /api/patterns/today', () => {

  // ── Auth ─────────────────────────────────────────────────────────────────
  test('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/patterns/today');
    expect(res.status).toBe(401);
  });

  // ── Below threshold: no data ──────────────────────────────────────────────
  test('returns pattern: null with dataPointCount 0 when no logs exist', async () => {
    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { pattern: null, dataPointCount: 0 } });
  });

  // ── Valid shape when threshold met ────────────────────────────────────────
  test('returns full pattern shape when threshold is met', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'lunch',
      items:  [{ name: 'Rice', calories: 300, protein: 5, carbs: 60, fat: 2 }],
      totals: { calories: 300 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { pattern } = res.body.data;
    expect(pattern).not.toBeNull();
    expect(pattern).toHaveProperty('dayOfWeek');
    expect(pattern).toHaveProperty('dataPointCount');
    expect(pattern).toHaveProperty('sourceDate');
    expect(pattern).toHaveProperty('preview');
    expect(pattern.preview).toHaveProperty('totalCaloriesConsumed');
    expect(pattern.preview).toHaveProperty('totalCaloriesBurned');
    expect(pattern.preview).toHaveProperty('estimatedTDEE');
    expect(Array.isArray(pattern.preview.meals)).toBe(true);
    expect(Array.isArray(pattern.preview.activities)).toBe(true);
  });

  // ── sourceDate = most recent matching date ────────────────────────────────
  test('sourceDate is the most recent date that has a log', async () => {
    // Seed two matching dates: today-7 and today-14
    await MealLog.create({
      user: userId, date: daysAgo(14), mealType: 'lunch',
      items: [{ name: 'Old Meal', calories: 400 }], totals: { calories: 400 },
    });
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'dinner',
      items: [{ name: 'Recent Meal', calories: 500 }], totals: { calories: 500 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern.sourceDate).toBe(daysAgo(7));
    expect(res.body.data.pattern.dataPointCount).toBe(2);
  });

  // ── preview.meals items come from sourceDate, not older days ──────────────
  test('preview.meals contains items from sourceDate only', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(14), mealType: 'breakfast',
      items: [{ name: 'Old Item', calories: 200 }], totals: { calories: 200 },
    });
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'breakfast',
      items: [{ name: 'Recent Item', calories: 350 }], totals: { calories: 350 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    const { pattern } = res.body.data;
    expect(pattern.sourceDate).toBe(daysAgo(7));
    // Only the recent item should appear
    expect(pattern.preview.meals[0].items[0].name).toBe('Recent Item');
    expect(pattern.preview.totalCaloriesConsumed).toBe(350);
  });

  // ── preview.meals merges two logs with same mealType ─────────────────────
  test('merges items from two breakfast logs on sourceDate into one preview entry', async () => {
    // Two separate breakfast documents on daysAgo(7)
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'breakfast',
      items: [{ name: 'Oats', calories: 300 }], totals: { calories: 300 },
    });
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'breakfast',
      items: [{ name: 'Banana', calories: 90 }], totals: { calories: 90 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    const { meals } = res.body.data.pattern.preview;
    // Must merge into exactly 1 preview entry for breakfast
    expect(meals.filter((m) => m.mealType === 'breakfast')).toHaveLength(1);
    const bfEntry = meals.find((m) => m.mealType === 'breakfast');
    expect(bfEntry.items).toHaveLength(2);
    const names = bfEntry.items.map((i) => i.name);
    expect(names).toContain('Oats');
    expect(names).toContain('Banana');
    // totalCaloriesConsumed = sum of both doc totals
    expect(res.body.data.pattern.preview.totalCaloriesConsumed).toBe(390);
  });

  // ── preview.totalCaloriesConsumed ─────────────────────────────────────────
  test('totalCaloriesConsumed equals sum of all meal totals.calories on sourceDate', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'breakfast',
      items: [{ name: 'Eggs', calories: 200 }], totals: { calories: 200 },
    });
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'dinner',
      items: [{ name: 'Chicken', calories: 450 }], totals: { calories: 450 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.body.data.pattern.preview.totalCaloriesConsumed).toBe(650);
  });

  // ── preview.activities + totalCaloriesBurned ──────────────────────────────
  test('preview.activities and totalCaloriesBurned reflect sourceDate activity log', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'lunch',
      items: [{ name: 'Salad', calories: 200 }], totals: { calories: 200 },
    });
    await ActivityLog.create({
      user: userId, date: daysAgo(7),
      entries: [
        { name: 'Running', durationMinutes: 30, caloriesBurned: 300 },
        { name: 'Stretching', durationMinutes: 10, caloriesBurned: 40 },
      ],
      summary: { totalCaloriesBurned: 340, totalActiveMinutes: 40 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    const { preview } = res.body.data.pattern;
    expect(preview.totalCaloriesBurned).toBe(340);
    expect(preview.activities).toHaveLength(2);
    expect(preview.activities[0].name).toBe('Running');
    expect(preview.activities[0].caloriesBurned).toBe(300);
    expect(preview.activities[1].name).toBe('Stretching');
  });

  // ── estimatedTDEE ─────────────────────────────────────────────────────────
  test('estimatedTDEE is a positive integer', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'dinner',
      items: [{ name: 'Chicken', calories: 500 }], totals: { calories: 500 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    const { estimatedTDEE } = res.body.data.pattern.preview;
    expect(estimatedTDEE).toBeGreaterThan(0);
    expect(Number.isInteger(estimatedTDEE)).toBe(true);
  });

  // ── 21-day window boundary ────────────────────────────────────────────────
  test('ignores logs 28 days ago (same DOW, outside 21-day window)', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(28), mealType: 'lunch',
      items: [{ name: 'Old Food', calories: 300 }], totals: { calories: 300 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern).toBeNull();
    expect(res.body.data.dataPointCount).toBe(0);
  });

  // ── DOW filter ────────────────────────────────────────────────────────────
  test('ignores logs on a different day-of-week (yesterday)', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(1), mealType: 'dinner',
      items: [{ name: 'Wrong Day', calories: 500 }], totals: { calories: 500 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern).toBeNull();
    expect(res.body.data.dataPointCount).toBe(0);
  });

  // ── Activity-only day counts ──────────────────────────────────────────────
  test('activity-only day (no meals) counts as a data point', async () => {
    await ActivityLog.create({
      user: userId, date: daysAgo(7),
      entries: [{ name: 'Yoga', durationMinutes: 30, caloriesBurned: 120 }],
      summary: { totalCaloriesBurned: 120, totalActiveMinutes: 30 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern).not.toBeNull();
    expect(res.body.data.pattern.dataPointCount).toBe(1);
  });

  // ── Date deduplication ────────────────────────────────────────────────────
  test('date with both meal and activity logs counts as exactly 1 data point', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'breakfast',
      items: [{ name: 'Eggs', calories: 200 }], totals: { calories: 200 },
    });
    await ActivityLog.create({
      user: userId, date: daysAgo(7),
      entries: [{ name: 'Walk', durationMinutes: 20, caloriesBurned: 80 }],
      summary: { totalCaloriesBurned: 80, totalActiveMinutes: 20 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.body.data.pattern.dataPointCount).toBe(1);
    expect(res.body.data.pattern.preview.totalCaloriesConsumed).toBe(200);
    expect(res.body.data.pattern.preview.totalCaloriesBurned).toBe(80);
  });

  // ── dayOfWeek matches today ───────────────────────────────────────────────
  test('dayOfWeek in response matches today\'s UTC day-of-week', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'snack',
      items: [{ name: 'Apple', calories: 80 }], totals: { calories: 80 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.body.data.pattern.dayOfWeek).toBe(new Date().getUTCDay());
  });

});

// =============================================================================
// Smoke Test Scenarios A-G (end-to-end shape verification)
// =============================================================================

describe('Smoke Test Scenarios A-G', () => {

  // Scenario A — Empty user ──────────────────────────────────────────────────
  test('Scenario A: empty user returns { pattern: null, dataPointCount: 0 }', async () => {
    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { pattern: null, dataPointCount: 0 } });
  });

  // Scenario B — Threshold met, all preview fields populated ────────────────
  test('Scenario B: one matching day returns full pattern with all preview fields', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'lunch',
      items: [{ name: 'Bun Bo Hue', calories: 480, protein: 28, carbs: 55, fat: 12 }],
      totals: { calories: 480 },
    });
    await ActivityLog.create({
      user: userId, date: daysAgo(7),
      entries: [{ name: 'Swimming', durationMinutes: 40, caloriesBurned: 320 }],
      summary: { totalCaloriesBurned: 320, totalActiveMinutes: 40 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);

    const { pattern } = res.body.data;
    expect(pattern).not.toBeNull();
    expect(pattern.sourceDate).toBe(daysAgo(7));
    expect(pattern.dataPointCount).toBe(1);

    expect(pattern.preview.totalCaloriesConsumed).toBe(480);
    expect(pattern.preview.totalCaloriesBurned).toBe(320);
    expect(pattern.preview.meals[0].items[0].name).toBe('Bun Bo Hue');
    expect(pattern.preview.activities[0].name).toBe('Swimming');

    // estimatedTDEE > totalCaloriesBurned (BMR * 1.2 alone is hundreds)
    expect(pattern.preview.estimatedTDEE).toBeGreaterThan(pattern.preview.totalCaloriesBurned);
  });

  // Scenario C — Wrong day-of-week ──────────────────────────────────────────
  test('Scenario C: logs on a different DOW are excluded → pattern: null', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(1), mealType: 'dinner',
      items: [{ name: 'Pizza', calories: 700 }], totals: { calories: 700 },
    });
    await ActivityLog.create({
      user: userId, date: daysAgo(2),
      entries: [{ name: 'Cycling', durationMinutes: 30, caloriesBurned: 200 }],
      summary: { totalCaloriesBurned: 200, totalActiveMinutes: 30 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern).toBeNull();
  });

  // Scenario D — Outside 21-day window ─────────────────────────────────────
  test('Scenario D: logs 28+ days ago excluded even if DOW matches → pattern: null', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(28), mealType: 'breakfast',
      items: [{ name: 'Old Food', calories: 350 }], totals: { calories: 350 },
    });
    await MealLog.create({
      user: userId, date: daysAgo(35), mealType: 'breakfast',
      items: [{ name: 'Older Food', calories: 300 }], totals: { calories: 300 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern).toBeNull();
    expect(res.body.data.dataPointCount).toBe(0);
  });

  // Scenario E (revised) — sourceDate is the most recent matching date ──────
  test('Scenario E: sourceDate points to the most recent matching day, not an older one', async () => {
    // Seed data on all 3 matching dates
    for (const offset of [7, 14, 21]) {
      await MealLog.create({
        user: userId, date: daysAgo(offset), mealType: 'lunch',
        items: [{ name: `Day ${offset}`, calories: 400 }], totals: { calories: 400 },
      });
    }

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);

    const { pattern } = res.body.data;
    expect(pattern).not.toBeNull();
    expect(pattern.dataPointCount).toBe(3);
    // sourceDate must be the most recent: today-7, not today-14 or today-21
    expect(pattern.sourceDate).toBe(daysAgo(7));
    // preview items come from today-7
    expect(pattern.preview.meals[0].items[0].name).toBe('Day 7');
  });

  // Scenario F — Auth check ──────────────────────────────────────────────────
  test('Scenario F: no Authorization header → 401 with message', async () => {
    const res = await request(app).get('/api/patterns/today');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  // Scenario G — Timezone-aware dayOfWeek ───────────────────────────────────
  test('Scenario G: dayOfWeek calculation uses user timezone (Asia/Ho_Chi_Minh)', async () => {
    const TZ = 'Asia/Ho_Chi_Minh'; // UTC+7

    try {
      await User.findByIdAndUpdate(userId, { 'profile.timezone': TZ });

      // Compute today in HCM using the same formula as the route
      const todayInHCM = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const expectedDow = new Date(`${todayInHCM}T00:00:00Z`).getUTCDay();

      // Seed a log on HCM-today minus 7 days
      const seedD = new Date(`${todayInHCM}T00:00:00Z`);
      seedD.setUTCDate(seedD.getUTCDate() - 7);
      const seedDate = seedD.toISOString().slice(0, 10);

      await MealLog.create({
        user: userId, date: seedDate, mealType: 'dinner',
        items: [{ name: 'Com Tam', calories: 550 }], totals: { calories: 550 },
      });

      const res = await request(app).get('/api/patterns/today').set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data.pattern).not.toBeNull();
      expect(res.body.data.pattern.dayOfWeek).toBe(expectedDow);
      expect(res.body.data.pattern.sourceDate).toBe(seedDate);
    } finally {
      await User.findByIdAndUpdate(userId, { $unset: { 'profile.timezone': '' } });
    }
  });

});

// =============================================================================
// POST /api/patterns/apply
// =============================================================================

describe('POST /api/patterns/apply', () => {

  const applyUrl = '/api/patterns/apply';

  // Apply-1: 401 without auth ────────────────────────────────────────────────
  test('Apply-1: returns 401 without auth token', async () => {
    const res = await request(app).post(applyUrl).send({ sourceDate: daysAgo(7) });
    expect(res.status).toBe(401);
  });

  // Apply-2: 400 if sourceDate missing ──────────────────────────────────────
  test('Apply-2: returns 400 when sourceDate is missing from body', async () => {
    const res = await request(app).post(applyUrl).set(auth(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/sourceDate/i);
  });

  // Apply-3: 400 if sourceDate invalid format ────────────────────────────────
  test('Apply-3: returns 400 for sourceDate with wrong format ("2026/05/07")', async () => {
    const res = await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: '2026/05/07' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/YYYY-MM-DD/i);
  });

  // Apply-4: 400 if sourceDate is today ─────────────────────────────────────
  test('Apply-4: returns 400 when sourceDate is today', async () => {
    const res = await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: daysAgo(0) });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/today/i);
  });

  // Apply-5: 400 if sourceDate outside 21-day window ────────────────────────
  test('Apply-5: returns 400 when sourceDate is 28 days ago (outside window, same DOW)', async () => {
    const res = await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: daysAgo(28) });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Apply-6: 400 if sourceDate DOW doesn't match today ──────────────────────
  test('Apply-6: returns 400 when sourceDate has different day-of-week (yesterday)', async () => {
    const res = await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: daysAgo(1) });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Apply-7: 409 if today already has a meal_log ────────────────────────────
  test('Apply-7: returns 409 when today already has a meal log', async () => {
    // Existing meal for today
    await MealLog.create({
      user: userId, date: daysAgo(0), mealType: 'breakfast',
      items: [{ name: 'Existing', calories: 300 }], totals: { calories: 300 },
    });

    const res = await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: daysAgo(7) });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already has logs/i);
    expect(res.body.conflictCount).toBe(1);
  });

  // Apply-8: 409 if today already has an activity_log ───────────────────────
  test('Apply-8: returns 409 when today already has an activity log', async () => {
    await ActivityLog.create({
      user: userId, date: daysAgo(0),
      entries: [{ name: 'Existing Run', durationMinutes: 30, caloriesBurned: 200 }],
      summary: { totalCaloriesBurned: 200, totalActiveMinutes: 30 },
    });

    const res = await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: daysAgo(7) });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.conflictCount).toBe(1);
  });

  // Apply-9: HAPPY PATH ──────────────────────────────────────────────────────
  test('Apply-9: happy path — creates correct meal+activity logs for today, source unchanged', async () => {
    const srcDate = daysAgo(7);

    // Seed source: 2 meal logs (breakfast + dinner) + 1 activity log
    await MealLog.create({
      user: userId, date: srcDate, mealType: 'breakfast',
      items: [{ name: 'Pho', calories: 420, protein: 20, carbs: 50, fat: 8 }],
      totals: { calories: 420 },
    });
    await MealLog.create({
      user: userId, date: srcDate, mealType: 'dinner',
      items: [
        { name: 'Chicken', calories: 300, protein: 35, carbs: 0,  fat: 6 },
        { name: 'Rice',    calories: 200, protein: 4,  carbs: 44, fat: 1 },
      ],
      totals: { calories: 500 },
    });
    await ActivityLog.create({
      user: userId, date: srcDate,
      entries: [{ name: 'Running', durationMinutes: 30, caloriesBurned: 300 }],
      summary: { totalCaloriesBurned: 300, totalActiveMinutes: 30 },
    });

    const res = await request(app)
      .post(applyUrl).set(auth(token)).send({ sourceDate: srcDate });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.sourceDate).toBe(srcDate);
    expect(data.appliedDate).toBe(daysAgo(0));
    expect(data.mealLogsCreated).toBe(2);
    expect(data.activityLogsCreated).toBe(1);
    expect(data.totalCaloriesConsumed).toBe(920);   // 420 + 500
    expect(data.totalCaloriesBurned).toBe(300);

    // DB: today has exactly 2 meal logs
    const todayMeals = await MealLog.find({ user: userId, date: daysAgo(0) }).lean();
    expect(todayMeals).toHaveLength(2);
    const mealTypes = todayMeals.map((m) => m.mealType).sort();
    expect(mealTypes).toEqual(['breakfast', 'dinner']);

    // DB: today has exactly 1 activity log
    const todayActs = await ActivityLog.find({ user: userId, date: daysAgo(0) }).lean();
    expect(todayActs).toHaveLength(1);
    expect(todayActs[0].entries[0].name).toBe('Running');

    // Source logs are UNCHANGED
    expect(await MealLog.countDocuments({ user: userId, date: srcDate })).toBe(2);
    expect(await ActivityLog.countDocuments({ user: userId, date: srcDate })).toBe(1);
  });

  // Apply-10: Items deep-copied — different _ids ────────────────────────────
  test('Apply-10: copied items have different _ids from source items', async () => {
    const srcDate = daysAgo(7);
    const srcMeal = await MealLog.create({
      user: userId, date: srcDate, mealType: 'lunch',
      items: [{ name: 'Banh Mi', calories: 280, protein: 12, carbs: 38, fat: 9 }],
      totals: { calories: 280 },
    });
    const srcItemId = srcMeal.items[0]._id.toString();

    await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: srcDate });

    const newMeal = await MealLog.findOne({ user: userId, date: daysAgo(0) }).lean();
    expect(newMeal).not.toBeNull();
    const newItemId = newMeal.items[0]._id.toString();
    expect(newItemId).not.toBe(srcItemId);
  });

  // Apply-11: source field on copied items ──────────────────────────────────
  test('Apply-11: copied meal items have source === "pattern_apply"', async () => {
    const srcDate = daysAgo(7);
    await MealLog.create({
      user: userId, date: srcDate, mealType: 'snack',
      items: [{ name: 'Nuts', calories: 180, source: 'manual' }],
      totals: { calories: 180 },
    });

    await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: srcDate });

    const newMeal = await MealLog.findOne({ user: userId, date: daysAgo(0) }).lean();
    expect(newMeal.items[0].source).toBe('pattern_apply');
  });

  // Apply-12: notes field on created MealLog ─────────────────────────────────
  test('Apply-12: created MealLog has notes = "Applied from <sourceDate>"', async () => {
    const srcDate = daysAgo(7);
    await MealLog.create({
      user: userId, date: srcDate, mealType: 'breakfast',
      items: [{ name: 'Toast', calories: 150 }],
      totals: { calories: 150 },
    });

    await request(app).post(applyUrl).set(auth(token)).send({ sourceDate: srcDate });

    const newMeal = await MealLog.findOne({ user: userId, date: daysAgo(0) }).lean();
    expect(newMeal.notes).toBe(`Applied from ${srcDate}`);
  });

});

// =============================================================================
// Sample Payloads — GET and POST (Step 4)
// =============================================================================

describe('Sample Payloads', () => {

  test('GET /api/patterns/today — prints realistic payload for visual inspection', async () => {
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'breakfast',
      items: [
        { name: 'Pho Bo',  calories: 420, protein: 26, carbs: 52, fat: 8 },
        { name: 'Tra Da',  calories:  20, protein:  0, carbs:  5, fat: 0 },
      ],
      totals: { calories: 440 },
    });
    await MealLog.create({
      user: userId, date: daysAgo(7), mealType: 'dinner',
      items: [{ name: 'Bun Bo Hue', calories: 480, protein: 28, carbs: 55, fat: 12 }],
      totals: { calories: 480 },
    });
    await ActivityLog.create({
      user: userId, date: daysAgo(7),
      entries: [
        { name: 'Chay Bo', durationMinutes: 30, caloriesBurned: 300 },
        { name: 'Yoga',    durationMinutes: 20, caloriesBurned:  80 },
      ],
      summary: { totalCaloriesBurned: 380, totalActiveMinutes: 50 },
    });

    const res = await request(app).get('/api/patterns/today').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.pattern).not.toBeNull();

    console.log('\n========== SAMPLE GET /api/patterns/today ==========');
    console.log(JSON.stringify(res.body, null, 2));
    console.log('====================================================\n');

    // Shape contract
    const { pattern } = res.body.data;
    expect(typeof pattern.dayOfWeek).toBe('number');
    expect(typeof pattern.dataPointCount).toBe('number');
    expect(typeof pattern.sourceDate).toBe('string');
    expect(typeof pattern.preview.totalCaloriesConsumed).toBe('number');
    expect(typeof pattern.preview.totalCaloriesBurned).toBe('number');
    expect(typeof pattern.preview.estimatedTDEE).toBe('number');
    pattern.preview.meals.forEach((m) => {
      expect(typeof m.mealType).toBe('string');
      expect(Array.isArray(m.items)).toBe(true);
    });
    pattern.preview.activities.forEach((a) => {
      expect(typeof a.name).toBe('string');
      expect(typeof a.caloriesBurned).toBe('number');
    });
  });

  test('POST /api/patterns/apply — prints realistic payload for visual inspection', async () => {
    const srcDate = daysAgo(7);
    await MealLog.create({
      user: userId, date: srcDate, mealType: 'lunch',
      items: [{ name: 'Com Tam', calories: 550, protein: 30, carbs: 60, fat: 14 }],
      totals: { calories: 550 },
    });
    await ActivityLog.create({
      user: userId, date: srcDate,
      entries: [{ name: 'Dap Xe', durationMinutes: 40, caloriesBurned: 280 }],
      summary: { totalCaloriesBurned: 280, totalActiveMinutes: 40 },
    });

    const res = await request(app)
      .post('/api/patterns/apply').set(auth(token)).send({ sourceDate: srcDate });
    expect(res.status).toBe(200);

    console.log('\n========== SAMPLE POST /api/patterns/apply ==========');
    console.log(JSON.stringify(res.body, null, 2));
    console.log('=====================================================\n');

    // Shape contract
    const { data } = res.body;
    expect(typeof data.appliedDate).toBe('string');
    expect(typeof data.sourceDate).toBe('string');
    expect(typeof data.mealLogsCreated).toBe('number');
    expect(typeof data.activityLogsCreated).toBe('number');
    expect(typeof data.totalCaloriesConsumed).toBe('number');
    expect(typeof data.totalCaloriesBurned).toBe('number');
  });

});
