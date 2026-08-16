const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Template = require('../models/Template');
const User = require('../models/User');

let mongod;
let tokenA, tokenB, tokenPremium;
let userA, userB;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_A = {
  name: 'Alice',
  email: 'alice_tmpl@example.com',
  password: 'password123',
  dob: '1990-05-15',
  gender: 'female',
  height: 165,
  weight: 70,
  goalType: 'lose',
  goalWeight: 60,
  targetRate: 0.5,
};

const USER_B = {
  name: 'Bob',
  email: 'bob_tmpl@example.com',
  password: 'password123',
  dob: '1985-08-22',
  gender: 'male',
  height: 180,
  weight: 90,
  goalType: 'lose',
  goalWeight: 80,
  targetRate: 0.5,
};

const USER_PREMIUM = {
  name: 'Patty',
  email: 'patty_premium@example.com',
  password: 'password123',
  dob: '1992-03-10',
  gender: 'female',
  height: 170,
  weight: 65,
  goalType: 'lose',
  goalWeight: 58,
  targetRate: 0.5,
};

const MEAL_TMPL = {
  type: 'meal',
  name: 'Breakfast Bowl',
  mealType: 'breakfast',
  items: [
    { name: 'Oats',   calories: 300, protein: 10, carbs: 55, fat: 5 },
    { name: 'Banana', calories:  89, protein:  1, carbs: 23, fat: 0.3 },
  ],
};

const ACTIVITY_TMPL = {
  type: 'activity',
  name: 'Morning Run',
  activityName: 'Running',
  durationMinutes: 30,
  caloriesBurned: 250,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const postTemplate = (token, body = MEAL_TMPL) =>
  request(app).post('/api/templates').set(auth(token)).send(body);

const validateDoc = async (doc) => {
  try {
    await doc.validate();
    return null;
  } catch (err) {
    return err;
  }
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const resA = await request(app).post('/api/auth/register').send(USER_A);
  expect(resA.status).toBe(201);
  tokenA = resA.body.accessToken;
  userA  = resA.body.user;

  const resB = await request(app).post('/api/auth/register').send(USER_B);
  expect(resB.status).toBe(201);
  tokenB = resB.body.accessToken;
  userB  = resB.body.user;

  const resPremium = await request(app).post('/api/auth/register').send(USER_PREMIUM);
  expect(resPremium.status).toBe(201);
  tokenPremium = resPremium.body.accessToken;
  // Promote directly in the DB so the route middleware sees premium plan
  await User.findByIdAndUpdate(resPremium.body.user._id, { 'subscription.plan': 'premium' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.collection('templates').deleteMany({});
});

// =============================================================================
// MODEL VALIDATION
// =============================================================================
describe('Template Model — validation', () => {
  const uid = () => new mongoose.Types.ObjectId();

  // ── name ────────────────────────────────────────────────────────────────────
  test('rejects missing name', async () => {
    const t = new Template({ type: 'meal', mealType: 'lunch', items: [{ name: 'X', calories: 100 }], user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.name).toBeDefined();
  });

  test('rejects empty name (minlength)', async () => {
    const t = new Template({ type: 'meal', name: '', mealType: 'lunch', items: [{ name: 'X', calories: 100 }], user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.name).toBeDefined();
  });

  test('rejects name longer than 100 chars', async () => {
    const t = new Template({ type: 'meal', name: 'a'.repeat(101), mealType: 'lunch', items: [{ name: 'X', calories: 100 }], user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.name).toBeDefined();
  });

  test('accepts name of exactly 100 chars', async () => {
    const t = new Template({ type: 'meal', name: 'a'.repeat(100), mealType: 'lunch', items: [{ name: 'X', calories: 100 }], user: uid() });
    expect(await validateDoc(t)).toBeNull();
  });

  // ── type enum ───────────────────────────────────────────────────────────────
  test('rejects type not in enum', async () => {
    const t = new Template({ type: 'snack', name: 'Test', user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.type).toBeDefined();
  });

  test('accepts type=meal', async () => {
    const t = new Template({ type: 'meal', name: 'Meal', mealType: 'lunch', items: [{ name: 'X', calories: 100 }], user: uid() });
    expect(await validateDoc(t)).toBeNull();
  });

  test('accepts type=activity', async () => {
    const t = new Template({ type: 'activity', name: 'Run', activityName: 'Running', durationMinutes: 30, caloriesBurned: 200, user: uid() });
    expect(await validateDoc(t)).toBeNull();
  });

  // ── mealType enum ────────────────────────────────────────────────────────────
  test('rejects invalid mealType', async () => {
    const t = new Template({ type: 'meal', name: 'Test', mealType: 'brunch', items: [{ name: 'X', calories: 100 }], user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.mealType).toBeDefined();
  });

  test.each(['breakfast', 'lunch', 'dinner', 'snack'])('accepts mealType=%s', async (mt) => {
    const t = new Template({ type: 'meal', name: `${mt} tmpl`, mealType: mt, items: [{ name: 'X', calories: 100 }], user: uid() });
    expect(await validateDoc(t)).toBeNull();
  });

  // ── activity fields ──────────────────────────────────────────────────────────
  test('rejects durationMinutes = 0 (min: 1)', async () => {
    const t = new Template({ type: 'activity', name: 'Walk', activityName: 'Walking', durationMinutes: 0, caloriesBurned: 100, user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.durationMinutes).toBeDefined();
  });

  test('rejects negative durationMinutes', async () => {
    const t = new Template({ type: 'activity', name: 'Walk', activityName: 'Walking', durationMinutes: -5, caloriesBurned: 100, user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.durationMinutes).toBeDefined();
  });

  test('rejects negative caloriesBurned', async () => {
    const t = new Template({ type: 'activity', name: 'Walk', activityName: 'Walking', durationMinutes: 30, caloriesBurned: -1, user: uid() });
    const err = await validateDoc(t);
    expect(err).not.toBeNull();
    expect(err.errors.caloriesBurned).toBeDefined();
  });

  test('accepts caloriesBurned = 0', async () => {
    const t = new Template({ type: 'activity', name: 'Stretch', activityName: 'Yoga', durationMinutes: 20, caloriesBurned: 0, user: uid() });
    expect(await validateDoc(t)).toBeNull();
  });
});

// =============================================================================
// POST /api/templates
// =============================================================================
describe('POST /api/templates', () => {
  test('creates a meal template', async () => {
    const res = await postTemplate(tokenA, MEAL_TMPL);
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('meal');
    expect(res.body.name).toBe('Breakfast Bowl');
    expect(res.body.mealType).toBe('breakfast');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.user.toString()).toBe(userA._id.toString());
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('createdAt');
  });

  test('creates an activity template', async () => {
    const res = await postTemplate(tokenA, ACTIVITY_TMPL);
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('activity');
    expect(res.body.name).toBe('Morning Run');
    expect(res.body.activityName).toBe('Running');
    expect(res.body.durationMinutes).toBe(30);
    expect(res.body.caloriesBurned).toBe(250);
  });

  test('trims whitespace from name', async () => {
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, name: '  My Meal  ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Meal');
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/templates').send(MEAL_TMPL);
    expect(res.status).toBe(401);
  });

  // ── name validation ──────────────────────────────────────────────────────────
  test('returns 400 when name is missing', async () => {
    const { name, ...noName } = MEAL_TMPL;
    const res = await postTemplate(tokenA, noName);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  test('returns 400 when name is whitespace-only', async () => {
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  // ── type validation ──────────────────────────────────────────────────────────
  test('returns 400 when type is missing', async () => {
    const { type, ...noType } = MEAL_TMPL;
    const res = await postTemplate(tokenA, noType);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/type/i);
  });

  test('returns 400 when type is invalid', async () => {
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, type: 'snack' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/type/i);
  });

  // ── meal-specific validation ─────────────────────────────────────────────────
  test('returns 400 when mealType is invalid', async () => {
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, mealType: 'brunch' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mealType/i);
  });

  test('returns 400 when mealType is missing', async () => {
    const { mealType, ...noMealType } = MEAL_TMPL;
    const res = await postTemplate(tokenA, noMealType);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mealType/i);
  });

  test('returns 400 when meal items array is empty', async () => {
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/items/i);
  });

  test('returns 400 when meal items is missing', async () => {
    const { items, ...noItems } = MEAL_TMPL;
    const res = await postTemplate(tokenA, noItems);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/items/i);
  });

  test('returns 400 when a meal item is missing calories', async () => {
    const res = await postTemplate(tokenA, {
      ...MEAL_TMPL,
      items: [{ name: 'Oats' }], // no calories
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/calories/i);
  });

  // ── activity-specific validation ─────────────────────────────────────────────
  test('returns 400 when activityName is missing', async () => {
    const { activityName, ...noAct } = ACTIVITY_TMPL;
    const res = await postTemplate(tokenA, noAct);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/activityName/i);
  });

  test('returns 400 when durationMinutes is 0', async () => {
    const res = await postTemplate(tokenA, { ...ACTIVITY_TMPL, durationMinutes: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/durationMinutes/i);
  });

  test('returns 400 when durationMinutes is negative', async () => {
    const res = await postTemplate(tokenA, { ...ACTIVITY_TMPL, durationMinutes: -10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/durationMinutes/i);
  });

  test('returns 400 when caloriesBurned is negative', async () => {
    const res = await postTemplate(tokenA, { ...ACTIVITY_TMPL, caloriesBurned: -1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/caloriesBurned/i);
  });

  test('accepts caloriesBurned = 0 for activity', async () => {
    const res = await postTemplate(tokenA, { ...ACTIVITY_TMPL, caloriesBurned: 0 });
    expect(res.status).toBe(201);
    expect(res.body.caloriesBurned).toBe(0);
  });
});

// =============================================================================
// GET /api/templates
// =============================================================================
describe('GET /api/templates', () => {
  beforeEach(async () => {
    await postTemplate(tokenA, MEAL_TMPL);
    await postTemplate(tokenA, ACTIVITY_TMPL);
    await postTemplate(tokenB, MEAL_TMPL); // different user — must not appear for A
  });

  test('returns only the authenticated user templates', async () => {
    const res = await request(app).get('/api/templates').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(2);
    res.body.templates.forEach((t) =>
      expect(t.user.toString()).toBe(userA._id.toString()),
    );
  });

  test('does not leak other user templates', async () => {
    const res = await request(app).get('/api/templates').set(auth(tokenA));
    res.body.templates.forEach((t) =>
      expect(t.user.toString()).not.toBe(userB._id.toString()),
    );
  });

  test('filters by type=meal', async () => {
    const res = await request(app).get('/api/templates?type=meal').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0].type).toBe('meal');
  });

  test('filters by type=activity', async () => {
    const res = await request(app).get('/api/templates?type=activity').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0].type).toBe('activity');
  });

  test('returns 400 for invalid type filter', async () => {
    const res = await request(app).get('/api/templates?type=snack').set(auth(tokenA));
    expect(res.status).toBe(400);
  });

  test('returns pagination metadata', async () => {
    const res = await request(app).get('/api/templates').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      total:      2,
      page:       1,
      totalPages: 1,
    });
  });

  test('pagination limit param is respected', async () => {
    const res = await request(app).get('/api/templates?limit=1').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(401);
  });

  test('returns empty list when user has no templates', async () => {
    // tokenPremium was never given templates in this describe scope
    const res = await request(app).get('/api/templates').set(auth(tokenPremium));
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });
});

// =============================================================================
// PUT /api/templates/:id
// =============================================================================
describe('PUT /api/templates/:id', () => {
  let mealId, actId;

  beforeEach(async () => {
    const r1 = await postTemplate(tokenA, MEAL_TMPL);
    mealId = r1.body._id;
    const r2 = await postTemplate(tokenA, ACTIVITY_TMPL);
    actId  = r2.body._id;
  });

  test('updates name of own template', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenA))
      .send({ name: 'Updated Meal' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Meal');
  });

  test('updates mealType', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenA))
      .send({ mealType: 'dinner' });
    expect(res.status).toBe(200);
    expect(res.body.mealType).toBe('dinner');
  });

  test('updates items array', async () => {
    const newItems = [{ name: 'Salad', calories: 150, protein: 5, carbs: 20, fat: 3 }];
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenA))
      .send({ items: newItems });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Salad');
  });

  test('updates activity durationMinutes', async () => {
    const res = await request(app)
      .put(`/api/templates/${actId}`)
      .set(auth(tokenA))
      .send({ durationMinutes: 60 });
    expect(res.status).toBe(200);
    expect(res.body.durationMinutes).toBe(60);
  });

  test('updates activity caloriesBurned', async () => {
    const res = await request(app)
      .put(`/api/templates/${actId}`)
      .set(auth(tokenA))
      .send({ caloriesBurned: 400 });
    expect(res.status).toBe(200);
    expect(res.body.caloriesBurned).toBe(400);
  });

  test('returns 400 for invalid mealType on update', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenA))
      .send({ mealType: 'brunch' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mealType/i);
  });

  test('returns 400 when setting items to empty array', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenA))
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/items/i);
  });

  test('returns 400 when setting durationMinutes to 0', async () => {
    const res = await request(app)
      .put(`/api/templates/${actId}`)
      .set(auth(tokenA))
      .send({ durationMinutes: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/durationMinutes/i);
  });

  test('returns 400 when setting caloriesBurned negative', async () => {
    const res = await request(app)
      .put(`/api/templates/${actId}`)
      .set(auth(tokenA))
      .send({ caloriesBurned: -50 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/caloriesBurned/i);
  });

  test('returns 400 when name becomes empty', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenA))
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  test('returns 403 when another user tries to update', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .set(auth(tokenB))
      .send({ name: 'Stolen' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied/i);
  });

  test('returns 404 for non-existent template id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/templates/${fakeId}`)
      .set(auth(tokenA))
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  test('returns 404 for malformed id', async () => {
    const res = await request(app)
      .put('/api/templates/not-a-valid-id')
      .set(auth(tokenA))
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .put(`/api/templates/${mealId}`)
      .send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// DELETE /api/templates/:id
// =============================================================================
describe('DELETE /api/templates/:id', () => {
  let templateId;

  beforeEach(async () => {
    const res = await postTemplate(tokenA, MEAL_TMPL);
    templateId = res.body._id;
  });

  test('deletes own template and returns message', async () => {
    const res = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  test('template is actually gone after delete', async () => {
    await request(app).delete(`/api/templates/${templateId}`).set(auth(tokenA));
    const getRes = await request(app).get('/api/templates').set(auth(tokenA));
    expect(getRes.body.templates).toHaveLength(0);
  });

  test('returns 403 when another user tries to delete', async () => {
    const res = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set(auth(tokenB));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied/i);
  });

  test('original template still exists after failed cross-user delete', async () => {
    await request(app).delete(`/api/templates/${templateId}`).set(auth(tokenB));
    const getRes = await request(app).get('/api/templates').set(auth(tokenA));
    expect(getRes.body.templates).toHaveLength(1);
  });

  test('returns 404 for non-existent template id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/templates/${fakeId}`)
      .set(auth(tokenA));
    expect(res.status).toBe(404);
  });

  test('returns 404 for malformed id', async () => {
    const res = await request(app)
      .delete('/api/templates/not-a-valid-id')
      .set(auth(tokenA));
    expect(res.status).toBe(404);
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/templates/${templateId}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FREEMIUM LIMIT
// =============================================================================
describe('Freemium Limit', () => {
  test('free user can create exactly 10 templates', async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await postTemplate(tokenA, { ...MEAL_TMPL, name: `Free Template ${i}` });
      expect(res.status).toBe(201);
    }
  });

  test('free user is blocked on the 11th template with 403', async () => {
    for (let i = 1; i <= 10; i++) {
      await postTemplate(tokenA, { ...MEAL_TMPL, name: `Free Template ${i}` });
    }
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, name: 'One Too Many' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/limit/i);
  });

  test('free user limit applies across both meal and activity types', async () => {
    // Mix of types still counts toward the 10-template cap
    for (let i = 1; i <= 5; i++) {
      await postTemplate(tokenA, { ...MEAL_TMPL,     name: `Meal ${i}` });
      await postTemplate(tokenA, { ...ACTIVITY_TMPL, name: `Activity ${i}` });
    }
    const res = await postTemplate(tokenA, { ...MEAL_TMPL, name: 'One Too Many' });
    expect(res.status).toBe(403);
  });

  test('premium user can create more than 10 templates', async () => {
    for (let i = 1; i <= 11; i++) {
      const res = await postTemplate(tokenPremium, { ...MEAL_TMPL, name: `Premium Template ${i}` });
      expect(res.status).toBe(201);
    }
  });

  test('free user limit is per-user (other users are not affected)', async () => {
    // Flood user A to the cap
    for (let i = 1; i <= 10; i++) {
      await postTemplate(tokenA, { ...MEAL_TMPL, name: `A Template ${i}` });
    }
    // User B should still be able to create their first template
    const res = await postTemplate(tokenB, { ...MEAL_TMPL, name: 'B First Template' });
    expect(res.status).toBe(201);
  });
});
