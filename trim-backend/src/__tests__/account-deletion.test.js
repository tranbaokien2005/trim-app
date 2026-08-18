const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');

const User        = require('../models/User');
const MealLog     = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const WeightLog   = require('../models/WeightLog');
const Template    = require('../models/Template');

let mongod;

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const TODAY = new Date().toISOString().slice(0, 10);
const PASSWORD = 'password123';

let seq = 0;

/**
 * Register a user and seed exactly one document in every owned collection,
 * so a cascade failure in any single collection is visible.
 */
const createSeededUser = async (name) => {
  seq += 1;
  const email = `${name}${seq}@example.com`;

  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);

  const token = res.body.accessToken;
  const id = res.body.user._id || res.body.user.id;

  await request(app).post('/api/weights').set(auth(token))
    .send({ weight: 70, date: TODAY }).expect(201);

  await request(app).post('/api/meals').set(auth(token)).send({
    date: TODAY,
    mealType: 'lunch',
    items: [{ name: 'Chicken', calories: 300, protein: 30, carbs: 0, fat: 5 }],
  }).expect(201);

  await request(app).post('/api/activities').set(auth(token)).send({
    date: TODAY,
    entries: [{ name: 'Running', durationMinutes: 30, caloriesBurned: 250 }],
  }).expect(201);

  // Seed the template directly — the route has a free-tier cap and extra
  // validation that is irrelevant to what we are testing here.
  await Template.create({ user: id, type: 'meal', name: 'Usual lunch' });

  return { token, id, email };
};

const countsFor = async (id) => ({
  users:      await User.countDocuments({ _id: id }),
  meals:      await MealLog.countDocuments({ user: id }),
  activities: await ActivityLog.countDocuments({ user: id }),
  weights:    await WeightLog.countDocuments({ user: id }),
  templates:  await Template.countDocuments({ user: id }),
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('DELETE /api/users/me', () => {
  test('without a token returns 401', async () => {
    const res = await request(app)
      .delete('/api/users/me')
      .send({ password: PASSWORD });
    expect(res.status).toBe(401);
  });

  test('missing password returns 400 and keeps the account', async () => {
    const { token, id } = await createSeededUser('nopass');

    const res = await request(app).delete('/api/users/me').set(auth(token)).send({});
    expect(res.status).toBe(400);

    expect(await User.countDocuments({ _id: id })).toBe(1);
  });

  test('wrong password returns 401 and the user still exists', async () => {
    const { token, id } = await createSeededUser('wrongpass');

    const res = await request(app)
      .delete('/api/users/me')
      .set(auth(token))
      .send({ password: 'definitely-not-the-password' });
    expect(res.status).toBe(401);

    expect(await User.countDocuments({ _id: id })).toBe(1);
  });

  test('correct password returns 200 with a deleted summary', async () => {
    const { token } = await createSeededUser('happy');

    const res = await request(app)
      .delete('/api/users/me')
      .set(auth(token))
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deleted');
    expect(res.body.deleted).toEqual(
      expect.objectContaining({
        meals: 1, activities: 1, weights: 1, templates: 1, user: 1,
      })
    );
  });

  test('cascade removes the user and every owned document', async () => {
    const { token, id } = await createSeededUser('cascade');

    // everything seeded before we delete
    expect(await countsFor(id)).toEqual({
      users: 1, meals: 1, activities: 1, weights: 1, templates: 1,
    });

    await request(app)
      .delete('/api/users/me')
      .set(auth(token))
      .send({ password: PASSWORD })
      .expect(200);

    expect(await countsFor(id)).toEqual({
      users: 0, meals: 0, activities: 0, weights: 0, templates: 0,
    });
  });

  test("does not touch another user's data", async () => {
    const victim   = await createSeededUser('victim');
    const bystander = await createSeededUser('bystander');

    await request(app)
      .delete('/api/users/me')
      .set(auth(victim.token))
      .send({ password: PASSWORD })
      .expect(200);

    expect(await countsFor(victim.id)).toEqual({
      users: 0, meals: 0, activities: 0, weights: 0, templates: 0,
    });

    // the whole point: an unfiltered deleteMany would wipe this too
    expect(await countsFor(bystander.id)).toEqual({
      users: 1, meals: 1, activities: 1, weights: 1, templates: 1,
    });
  });
});
