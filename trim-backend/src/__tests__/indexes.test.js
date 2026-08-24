/**
 * TASK 3 — syncAllIndexes() tạo index kể cả khi autoIndex=false (giả lập production).
 *
 * Finding #1: trên production database.js đặt autoIndex=false, nên unique/partial
 * index KHÔNG tự tạo. Test này chứng minh syncAllIndexes() lấp khoảng đó:
 *   1. Kết nối với autoIndex=false (giống production) → index KHÔNG tự sinh.
 *   2. Gọi syncAllIndexes() → index xuất hiện đúng hình dạng trên cả 4 model.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Nạp model trước để mongoose.models có đủ (syncAllIndexes đọc từ đó).
const User = require('../models/User');
const MealLog = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const WeightLog = require('../models/WeightLog');
require('../models/Template');
const RefreshToken = require('../models/RefreshToken');
const { syncAllIndexes } = require('../config/database');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Giả lập production: autoIndex=false → index không tự build khi tạo model.
  await mongoose.connect(mongod.getUri(), { autoIndex: false });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const indexNames = async (Model) =>
  (await Model.collection.indexes()).map((i) => i.name);

describe('syncAllIndexes (production index bootstrap)', () => {
  test('với autoIndex=false, index tuỳ biến KHÔNG tự tạo trước khi sync', async () => {
    // Ép collection tồn tại (insert 1 doc) để indexes() không ném NamespaceNotFound.
    await User.collection.insertOne({ email: 'x@x.com', passwordHash: 'h', name: 'x' });
    const before = await indexNames(User);
    // Chỉ có _id (Mongo tự tạo), CHƯA có unique index email do autoIndex=false.
    expect(before).toEqual(['_id_']);
  });

  test('syncAllIndexes() tạo index đúng hình dạng trên các model sở hữu', async () => {
    const synced = await syncAllIndexes();

    // Trả về map model → danh sách tên index (createIndexes, không drop).
    expect(Object.keys(synced).sort()).toEqual(
      ['ActivityLog', 'MealLog', 'RefreshToken', 'Template', 'User', 'WeightLog']
    );

    // RefreshToken: TTL document-level đúng hình dạng (GATE — chỗ TTL DUY NHẤT được phép).
    const rtIdx = await RefreshToken.collection.indexes();
    const ttl = rtIdx.find((i) => i.key && i.key.expiresAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl.expireAfterSeconds).toBe(0);
    // KHÔNG có TTL trên field nào khác (chỉ expiresAt mới có expireAfterSeconds).
    const ttlCount = rtIdx.filter((i) => i.expireAfterSeconds !== undefined).length;
    expect(ttlCount).toBe(1);

    // User: email unique (do unique:true), KHÔNG có index {email:1} trùng.
    const userIdx = (await User.collection.indexes());
    const emailIdx = userIdx.filter(
      (i) => i.key && i.key.email === 1 && i.key.user === undefined
    );
    expect(emailIdx).toHaveLength(1); // đúng MỘT index trên email, không trùng
    expect(emailIdx[0].unique).toBe(true);

    // 3 log model: unique partial index {user:1, clientId:1}.
    for (const Model of [MealLog, ActivityLog, WeightLog]) {
      const idx = await Model.collection.indexes();
      const dedupe = idx.find(
        (i) => i.key && i.key.user === 1 && i.key.clientId === 1
      );
      expect(dedupe).toBeDefined();
      expect(dedupe.unique).toBe(true);
      expect(dedupe.partialFilterExpression).toEqual({ clientId: { $type: 'string' } });
      expect(dedupe.sparse).toBeUndefined();
    }
  });
});
