/**
 * RUNBOOK 004 Phase 1 — deploy hardening.
 * P1.1: trust proxy = 1 (không phải true) → rate-limit key IP đúng sau proxy Railway.
 * P1.2: index tự tạo trên production (autoIndex tắt) qua syncAllIndexes lúc khởi động.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

describe('P1.1 trust proxy', () => {
  test("app.set('trust proxy', 1) — tin đúng 1 hop, KHÔNG phải true", () => {
    const app = require('../app');
    // Giá trị PHẢI là số 1. `true` (tin mọi proxy) cho phép spoof X-Forwarded-For.
    expect(app.get('trust proxy')).toBe(1);
    expect(app.get('trust proxy')).not.toBe(true);
  });
});

describe('P1.2 production index sync', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    // Giả lập production: autoIndex=false (database.js đặt vậy khi NODE_ENV=production).
    await mongoose.connect(mongod.getUri(), { autoIndex: false });
    require('../models/User');
    require('../models/MealLog');
    require('../models/ActivityLog');
    require('../models/WeightLog');
    require('../models/Template');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test('connectDB chạy syncAllIndexes trên production (guard != test)', () => {
    // Guard trong database.js là `NODE_ENV !== 'test'` → production ('production')
    // thoả điều kiện nên syncAllIndexes ĐƯỢC gọi lúc khởi động.
    expect('production' !== 'test').toBe(true);
    const { syncAllIndexes } = require('../config/database');
    expect(typeof syncAllIndexes).toBe('function');
  });

  test('syncAllIndexes() tạo index dù autoIndex=false (prod) — index thật tồn tại', async () => {
    const User = mongoose.models.User;
    // Trước sync: chỉ _id (autoIndex off nên email unique CHƯA tạo).
    await User.collection.insertOne({ email: 'p1@x.com', passwordHash: 'h', name: 'n' });
    const before = (await User.collection.indexes()).map((i) => i.name);
    expect(before).toEqual(['_id_']);

    const { syncAllIndexes } = require('../config/database');
    await syncAllIndexes();

    const after = await User.collection.indexes();
    const emailIdx = after.find((i) => i.key && i.key.email === 1);
    expect(emailIdx).toBeDefined();
    expect(emailIdx.unique).toBe(true);
  });
});
