/**
 * POST /api/quicklog — chống trùng (idempotency) + origin.
 *
 * Parse AI được mock: ở đây ta kiểm hợp đồng của endpoint, không kiểm GPT.
 * Mock phải đặt TRƯỚC require('../app') vì route nạp parseText lúc load module.
 */
jest.mock('../utils/parseText', () => ({
  parseMealText: jest.fn(),
  parseActivityText: jest.fn(),
  ParseTextError: class ParseTextError extends Error {},
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const { parseMealText } = require('../utils/parseText');
const MealLog = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const WeightLog = require('../models/WeightLog');

let mongod;
let tokenA, userA;
let tokenB, userB;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

const PHO = [
  { name: 'Pho Bo', calories: 420, protein: 26, carbs: 52, fat: 8, servingSize: '1 bowl' },
  { name: 'Ca Phe Sua', calories: 120, protein: 2, carbs: 20, fat: 4, servingSize: '1 cup' },
];

const body = (over = {}) => ({
  kind: 'meal',
  text: 'pho bo va 1 ly ca phe sua',
  clientId: 'c0ffee00-1111-4222-8333-444444444444',
  source: 'deeplink',
  origin: 'deeplink',
  ...over,
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Index chống trùng phải tồn tại thật trước khi chạy test 2 và test 7.
  await Promise.all([
    MealLog.syncIndexes(),
    ActivityLog.syncIndexes(),
    WeightLog.syncIndexes(),
  ]);

  const a = await request(app).post('/api/auth/register')
    .send({ name: 'Quick A', email: 'quick_a@example.com', password: 'password123' });
  expect(a.status).toBe(201);
  tokenA = a.body.accessToken;
  userA = a.body.user._id;

  const b = await request(app).post('/api/auth/register')
    .send({ name: 'Quick B', email: 'quick_b@example.com', password: 'password123' });
  expect(b.status).toBe(201);
  tokenB = b.body.accessToken;
  userB = b.body.user._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    MealLog.deleteMany({}),
    ActivityLog.deleteMany({}),
    WeightLog.deleteMany({}),
  ]);
  parseMealText.mockReset();
  parseMealText.mockResolvedValue(PHO);
});

describe('Quicklog', () => {
  // 1 ─────────────────────────────────────────────────────────────────────────
  test('POST /api/quicklog with kind=meal creates exactly one MealLog with origin=deeplink', async () => {
    const res = await request(app).post('/api/quicklog').set(auth(tokenA)).send(body());

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.kind).toBe('meal');
    expect(res.body.created.origin).toBe('deeplink');
    expect(res.body.created.totals.calories).toBe(540);

    const logs = await MealLog.find({ user: userA });
    expect(logs).toHaveLength(1);
    expect(logs[0].origin).toBe('deeplink');
    expect(logs[0].clientId).toBe(body().clientId);
    // source (provenance) không bị origin đụng tới
    expect(logs[0].items[0].source).toBe('manual');
  });

  // 2 ─────────────────────────────────────────────────────────────────────────
  test('firing the same clientId twice creates only one document and reports duplicate', async () => {
    const payload = body({ clientId: 'dbldbl00-2222-4333-8444-555555555555' });

    const first = await request(app).post('/api/quicklog').set(auth(tokenA)).send(payload);
    const second = await request(app).post('/api/quicklog').set(auth(tokenA)).send(payload);

    expect(first.status).toBe(201);
    expect(first.body.duplicate).toBe(false);

    expect(second.status).toBe(200);
    expect(second.body.ok).toBe(true);
    expect(second.body.duplicate).toBe(true);
    expect(String(second.body.created._id)).toBe(String(first.body.created._id));

    const count = await MealLog.countDocuments({ user: userA, clientId: payload.clientId });
    expect(count).toBe(1);
  });

  // 3 ─────────────────────────────────────────────────────────────────────────
  test('same clientId from a different user is not a duplicate', async () => {
    const payload = body({ clientId: 'shared00-3333-4444-8555-666666666666' });

    const forA = await request(app).post('/api/quicklog').set(auth(tokenA)).send(payload);
    const forB = await request(app).post('/api/quicklog').set(auth(tokenB)).send(payload);

    expect(forA.status).toBe(201);
    expect(forB.status).toBe(201);
    expect(forB.body.duplicate).toBe(false);

    expect(await MealLog.countDocuments({ user: userA, clientId: payload.clientId })).toBe(1);
    expect(await MealLog.countDocuments({ user: userB, clientId: payload.clientId })).toBe(1);
  });

  // 4 ─────────────────────────────────────────────────────────────────────────
  test('missing clientId returns 400', async () => {
    const payload = body();
    delete payload.clientId;

    const res = await request(app).post('/api/quicklog').set(auth(tokenA)).send(payload);

    expect(res.status).toBe(400);
    expect(await MealLog.countDocuments({ user: userA })).toBe(0);
  });

  // 5 ─────────────────────────────────────────────────────────────────────────
  test('invalid kind returns 400', async () => {
    const res = await request(app).post('/api/quicklog').set(auth(tokenA))
      .send(body({ kind: 'mood' }));

    expect(res.status).toBe(400);
    expect(await MealLog.countDocuments({ user: userA })).toBe(0);
  });

  // 6 ─────────────────────────────────────────────────────────────────────────
  test('no token returns 401', async () => {
    const res = await request(app).post('/api/quicklog').send(body());
    expect(res.status).toBe(401);
  });

  // 7 ─────────────────────────────────────────────────────────────────────────
  test('dedupe index exists on all three collections: unique + partialFilterExpression', async () => {
    for (const Model of [MealLog, ActivityLog, WeightLog]) {
      const indexes = await Model.collection.indexes();
      const dedupe = indexes.find(
        (i) => i.key && i.key.user === 1 && i.key.clientId === 1
      );

      expect(dedupe).toBeDefined();
      expect(dedupe.unique).toBe(true);
      expect(dedupe.partialFilterExpression).toEqual({ clientId: { $type: 'string' } });
      // sparse là lựa chọn SAI ở đây — nếu ai đó đổi sang sparse, test phải đỏ
      expect(dedupe.sparse).toBeUndefined();
    }
  });
});
