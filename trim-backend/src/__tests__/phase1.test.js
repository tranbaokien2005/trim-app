const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');

let mongod;

// ── Shared state ─────────────────────────────────────────────────────────────
let tokenA, tokenB;
let userA, userB;

const USER_A = {
  name: 'Alice',
  email: 'alice@example.com',
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
  email: 'bob@example.com',
  password: 'password123',
  dob: '1985-08-22',
  gender: 'male',
  height: 180,
  weight: 90,
  goalType: 'lose',
  goalWeight: 80,
  targetRate: 0.5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const TODAY = new Date().toISOString().slice(0, 10);

const postWeight = (token, weight = 70, date = TODAY) =>
  request(app)
    .post('/api/weights')
    .set(auth(token))
    .send({ weight, date });

const postMeal = (token, overrides = {}) =>
  request(app)
    .post('/api/meals')
    .set(auth(token))
    .send({
      date: TODAY,
      mealType: 'lunch',
      items: [{ name: 'Chicken', calories: 300, protein: 30, carbs: 0, fat: 5 }],
      ...overrides,
    });

const postActivity = (token, overrides = {}) =>
  request(app)
    .post('/api/activities')
    .set(auth(token))
    .send({
      date: TODAY,
      entries: [{ name: 'Running', durationMinutes: 30, caloriesBurned: 250 }],
      ...overrides,
    });

// ── Setup / Teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Register User A
  const resA = await request(app).post('/api/auth/register').send(USER_A);
  expect(resA.status).toBe(201);
  tokenA = resA.body.accessToken;
  userA = resA.body.user;

  // Register User B
  const resB = await request(app).post('/api/auth/register').send(USER_B);
  expect(resB.status).toBe(201);
  tokenB = resB.body.accessToken;
  userB = resB.body.user;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear per-day data between tests, keep users
  await mongoose.connection.collection('weightlogs').deleteMany({});
  await mongoose.connection.collection('meallogs').deleteMany({});
  await mongoose.connection.collection('activitylogs').deleteMany({});
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
describe('Auth', () => {
  test('register rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(USER_A);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('login with correct credentials returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_A.email, password: USER_A.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  test('login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_A.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('login with unknown email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('refresh returns new access token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_A.email, password: USER_A.password });
    const { refreshToken } = loginRes.body;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  test('refresh with missing token returns 400', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTS
// ─────────────────────────────────────────────────────────────────────────────
describe('Weights', () => {
  test('POST /api/weights creates a log', async () => {
    const res = await postWeight(tokenA, 69.5);
    expect(res.status).toBe(201);
    expect(res.body.weight).toBe(69.5);
    expect(res.body).toHaveProperty('bmi');
  });

  test('POST /api/weights without token returns 401', async () => {
    const res = await request(app).post('/api/weights').send({ weight: 70, date: TODAY });
    expect(res.status).toBe(401);
  });

  test('POST /api/weights rejects invalid weight', async () => {
    const res = await request(app)
      .post('/api/weights')
      .set(auth(tokenA))
      .send({ weight: -5, date: TODAY });
    expect(res.status).toBe(400);
  });

  test('GET /api/weights returns only own logs', async () => {
    await postWeight(tokenA, 70);
    await postWeight(tokenB, 90);

    const res = await request(app).get('/api/weights').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((log) => {
      expect(log.user.toString()).toBe(userA._id.toString());
    });
  });

  test('GET /api/weights/latest returns most recent', async () => {
    await postWeight(tokenA, 70, '2024-01-01');
    await postWeight(tokenA, 68, TODAY);

    const res = await request(app).get('/api/weights/latest').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.weight).toBe(68);
  });

  test('GET /api/weights/latest without token returns 401', async () => {
    const res = await request(app).get('/api/weights/latest');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/weights/:id deletes own log', async () => {
    const create = await postWeight(tokenA, 70);
    const id = create.body._id;

    const del = await request(app).delete(`/api/weights/${id}`).set(auth(tokenA));
    expect(del.status).toBe(200);
  });

  test('DELETE /api/weights/:id cannot delete another user\'s log', async () => {
    const create = await postWeight(tokenA, 70);
    const id = create.body._id;

    const del = await request(app).delete(`/api/weights/${id}`).set(auth(tokenB));
    expect(del.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MEALS
// ─────────────────────────────────────────────────────────────────────────────
describe('Meals', () => {
  test('POST /api/meals creates a meal log with calculated totals', async () => {
    const res = await request(app)
      .post('/api/meals')
      .set(auth(tokenA))
      .send({
        date: TODAY,
        mealType: 'breakfast',
        items: [
          { name: 'Oats', calories: 300, protein: 10, carbs: 55, fat: 5 },
          { name: 'Banana', calories: 89, protein: 1, carbs: 23, fat: 0.3 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.totals.calories).toBe(389);
    expect(res.body.totals.protein).toBe(11);
    expect(res.body.mealType).toBe('breakfast');
  });

  test('POST /api/meals without token returns 401', async () => {
    const res = await request(app).post('/api/meals').send({
      date: TODAY, mealType: 'lunch',
      items: [{ name: 'X', calories: 100, protein: 5, carbs: 10, fat: 2 }],
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/meals rejects invalid mealType', async () => {
    const res = await request(app)
      .post('/api/meals')
      .set(auth(tokenA))
      .send({ date: TODAY, mealType: 'brunch', items: [{ name: 'X', calories: 100 }] });
    expect(res.status).toBe(400);
  });

  test('POST /api/meals rejects empty items array', async () => {
    const res = await request(app)
      .post('/api/meals')
      .set(auth(tokenA))
      .send({ date: TODAY, mealType: 'lunch', items: [] });
    expect(res.status).toBe(400);
  });

  test('GET /api/meals?date= returns only own meals', async () => {
    await postMeal(tokenA);
    await postMeal(tokenB);

    const res = await request(app).get(`/api/meals?date=${TODAY}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((m) => {
      expect(m.user.toString()).toBe(userA._id.toString());
    });
  });

  test('GET /api/meals without date returns 400', async () => {
    const res = await request(app).get('/api/meals').set(auth(tokenA));
    expect(res.status).toBe(400);
  });

  test('DELETE /api/meals/:id deletes own meal', async () => {
    const create = await postMeal(tokenA);
    const id = create.body._id;

    const del = await request(app).delete(`/api/meals/${id}`).set(auth(tokenA));
    expect(del.status).toBe(200);
  });

  test('DELETE /api/meals/:id cannot delete another user\'s meal', async () => {
    const create = await postMeal(tokenA);
    const id = create.body._id;

    const del = await request(app).delete(`/api/meals/${id}`).set(auth(tokenB));
    expect(del.status).toBe(404);
  });

  test('DELETE /api/meals/:mealId/items/:itemId removes item and recalculates totals', async () => {
    const create = await request(app)
      .post('/api/meals')
      .set(auth(tokenA))
      .send({
        date: TODAY,
        mealType: 'dinner',
        items: [
          { name: 'Rice', calories: 200, protein: 4, carbs: 44, fat: 0 },
          { name: 'Chicken', calories: 300, protein: 30, carbs: 0, fat: 5 },
        ],
      });
    const mealId = create.body._id;
    const itemId = create.body.items[0]._id;

    const res = await request(app)
      .delete(`/api/meals/${mealId}/items/${itemId}`)
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.totals.calories).toBe(300);
  });

  test('GET /api/meals/search returns results', async () => {
    const res = await request(app)
      .get('/api/meals/search?q=chicken')
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('calories');
  });

  test('GET /api/meals/search without q returns 400', async () => {
    const res = await request(app).get('/api/meals/search').set(auth(tokenA));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────
describe('Activities', () => {
  test('POST /api/activities creates a log with summary', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set(auth(tokenA))
      .send({
        date: TODAY,
        entries: [
          { name: 'Running', durationMinutes: 30, caloriesBurned: 300 },
          { name: 'Cycling', durationMinutes: 20, caloriesBurned: 150 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.summary.totalCaloriesBurned).toBe(450);
    expect(res.body.summary.totalActiveMinutes).toBe(50);
  });

  test('POST /api/activities without token returns 401', async () => {
    const res = await request(app).post('/api/activities').send({
      date: TODAY,
      entries: [{ name: 'Walk', durationMinutes: 20, caloriesBurned: 100 }],
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/activities requires date', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set(auth(tokenA))
      .send({ entries: [{ name: 'Walk', durationMinutes: 20, caloriesBurned: 100 }] });
    expect(res.status).toBe(400);
  });

  test('POST /api/activities requires non-empty entries', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set(auth(tokenA))
      .send({ date: TODAY, entries: [] });
    expect(res.status).toBe(400);
  });

  test('POST /api/activities rejects negative caloriesBurned', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set(auth(tokenA))
      .send({ date: TODAY, entries: [{ name: 'Walk', durationMinutes: 20, caloriesBurned: -10 }] });
    expect(res.status).toBe(400);
  });

  test('GET /api/activities?date= returns only own logs', async () => {
    await postActivity(tokenA);
    await postActivity(tokenB);

    const res = await request(app).get(`/api/activities?date=${TODAY}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    res.body.forEach((log) => {
      expect(log.user.toString()).toBe(userA._id.toString());
    });
  });

  test('GET /api/activities without date returns 400', async () => {
    const res = await request(app).get('/api/activities').set(auth(tokenA));
    expect(res.status).toBe(400);
  });

  test('DELETE /api/activities/:id deletes own log', async () => {
    const create = await postActivity(tokenA);
    const id = create.body._id;

    const del = await request(app).delete(`/api/activities/${id}`).set(auth(tokenA));
    expect(del.status).toBe(200);
  });

  test('DELETE /api/activities/:id cannot delete another user\'s log', async () => {
    const create = await postActivity(tokenA);
    const id = create.body._id;

    const del = await request(app).delete(`/api/activities/${id}`).set(auth(tokenB));
    expect(del.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────
describe('Stats', () => {
  test('GET /api/stats/daily without token returns 401', async () => {
    const res = await request(app).get(`/api/stats/daily?date=${TODAY}`);
    expect(res.status).toBe(401);
  });

  test('GET /api/stats/daily returns zeroes when no data logged', async () => {
    const res = await request(app)
      .get(`/api/stats/daily?date=${TODAY}`)
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.caloriesConsumed).toBe(0);
    expect(res.body.caloriesBurned).toBe(0);
  });

  test('GET /api/stats/daily aggregates meals and activities correctly', async () => {
    await request(app)
      .post('/api/meals')
      .set(auth(tokenA))
      .send({
        date: TODAY,
        mealType: 'breakfast',
        items: [{ name: 'Oats', calories: 300, protein: 10, carbs: 55, fat: 5 }],
      });
    await request(app)
      .post('/api/meals')
      .set(auth(tokenA))
      .send({
        date: TODAY,
        mealType: 'lunch',
        items: [{ name: 'Chicken', calories: 500, protein: 40, carbs: 10, fat: 8 }],
      });
    await request(app)
      .post('/api/activities')
      .set(auth(tokenA))
      .send({
        date: TODAY,
        entries: [{ name: 'Running', durationMinutes: 30, caloriesBurned: 250 }],
      });

    const res = await request(app)
      .get(`/api/stats/daily?date=${TODAY}`)
      .set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.caloriesConsumed).toBe(800);
    expect(res.body.caloriesBurned).toBe(250);
    expect(res.body.bmr).toBeGreaterThan(0);
    // tdee = bmr + caloriesBurned
    expect(res.body.tdee).toBe(res.body.bmr + res.body.caloriesBurned);
    // deficit = tdee - caloriesConsumed
    expect(res.body.deficit).toBe(res.body.tdee - res.body.caloriesConsumed);
  });

  test('GET /api/stats/daily defaults to today', async () => {
    const res = await request(app).get('/api/stats/daily').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('date', TODAY);
  });

  test('GET /api/stats/weekly returns 7 days', async () => {
    const res = await request(app).get('/api/stats/weekly').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(7);
    expect(res.body).toHaveProperty('totals');
    expect(res.body.totals).toHaveProperty('caloriesConsumed');
    expect(res.body.totals).toHaveProperty('caloriesBurned');
    expect(res.body.totals).toHaveProperty('avgDeficit');
  });

  test('GET /api/stats/weekly without token returns 401', async () => {
    const res = await request(app).get('/api/stats/weekly');
    expect(res.status).toBe(401);
  });

  test('Stats are isolated between users', async () => {
    await postMeal(tokenB);
    await postActivity(tokenB);

    const res = await request(app)
      .get(`/api/stats/daily?date=${TODAY}`)
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.caloriesConsumed).toBe(0);
    expect(res.body.caloriesBurned).toBe(0);
  });
});
