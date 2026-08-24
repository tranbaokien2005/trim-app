/**
 * TASK 8 — test logic migration WeightLog.date (Date -> 'YYYY-MM-DD').
 * Seed hỗn hợp document (Date cũ + chuỗi mới), kiểm:
 *   - dry-run: đếm đúng, KHÔNG ghi gì.
 *   - apply: đổi đúng document Date sang chuỗi UTC, KHÔNG đụng document đã là chuỗi.
 *   - idempotent: chạy lại apply lần 2 → matched === 0.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { migrate, toDateString } = require('../../scripts/migrate-weightdate');

let mongod;
let db;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  db = mongoose.connection.db;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await db.collection('weightlogs').deleteMany({});
});

const userId = () => new mongoose.Types.ObjectId();

async function seedMixed() {
  const coll = db.collection('weightlogs');
  await coll.insertMany([
    { user: userId(), weight: 70, date: new Date('2026-08-01T00:00:00.000Z'), source: 'manual' },
    { user: userId(), weight: 71, date: new Date('2026-08-10T00:00:00.000Z'), source: 'manual' },
    { user: userId(), weight: 72, date: '2026-08-20', source: 'manual' }, // đã là chuỗi
  ]);
}

describe('migrate-weightdate', () => {
  test('dry-run: đếm đúng document Date, KHÔNG ghi', async () => {
    await seedMixed();
    const res = await migrate(db, { apply: false });

    expect(res.applied).toBe(false);
    expect(res.matched).toBe(2);   // 2 doc Date, doc chuỗi bị loại
    expect(res.converted).toBe(0); // dry-run không ghi

    // DB KHÔNG đổi: vẫn còn 2 doc date kiểu Date.
    const stillDate = await db.collection('weightlogs').countDocuments({ date: { $type: 'date' } });
    expect(stillDate).toBe(2);

    // Mẫu chỉ ra from->to đúng.
    const s = res.samples.find((x) => x.to === '2026-08-01');
    expect(s).toBeDefined();
  });

  test('apply: đổi Date -> chuỗi UTC, không đụng chuỗi sẵn có', async () => {
    await seedMixed();
    const res = await migrate(db, { apply: true });

    expect(res.matched).toBe(2);
    expect(res.converted).toBe(2);

    // Sau apply: KHÔNG còn doc kiểu Date.
    const stillDate = await db.collection('weightlogs').countDocuments({ date: { $type: 'date' } });
    expect(stillDate).toBe(0);

    // Tất cả date giờ là chuỗi 'YYYY-MM-DD'.
    const docs = await db.collection('weightlogs').find({}).sort({ weight: 1 }).toArray();
    expect(docs.map((d) => d.date)).toEqual(['2026-08-01', '2026-08-10', '2026-08-20']);
  });

  test('idempotent: apply lần 2 → matched 0', async () => {
    await seedMixed();
    await migrate(db, { apply: true });
    const second = await migrate(db, { apply: true });
    expect(second.matched).toBe(0);
    expect(second.converted).toBe(0);
  });

  test('toDateString: Date -> YYYY-MM-DD (UTC)', () => {
    expect(toDateString(new Date('2026-08-01T00:00:00.000Z'))).toBe('2026-08-01');
    expect(toDateString(new Date('2026-12-31T23:59:00.000Z'))).toBe('2026-12-31');
  });
});
