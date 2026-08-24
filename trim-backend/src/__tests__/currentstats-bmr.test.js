/**
 * TASK 5 — currentStats.bmr + baseline được ghi trên User từ utils/bmr.js.
 *
 * Assert CẢ HAI chiều (yêu cầu cứng của Ken):
 *   (i)  user KHÔNG đủ profile  → bmr/baseline KHÔNG được ghi (vắng).
 *   (ii) user CÓ đủ profile     → bmr/baseline ra giá trị ĐÚNG ≠ 0, tính từ bmr.js.
 * Cũng chốt regression schema: currentStats.bmr/baseline phải PERSIST (trước đây
 * schema thiếu field → Mongoose strict âm thầm loại bỏ khi lưu).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const User = require('../models/User');
const { syncCurrentStatsBmr } = require('../utils/logHelpers');
const {
  calculateBMR,
  calculateAge,
  calculateBaseline,
} = require('../utils/bmr');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

const DOB = '1990-05-15';

describe('syncCurrentStatsBmr', () => {
  test('(ii) user đủ profile → bmr/baseline ĐÚNG giá trị từ bmr.js, ≠ 0', async () => {
    const user = await User.create({
      email: 'full@example.com',
      passwordHash: 'h',
      name: 'Full',
      profile: { dateOfBirth: new Date(DOB), gender: 'female', height: 165 },
      currentStats: { weight: 60 },
    });

    await syncCurrentStatsBmr(user._id);

    const fresh = await User.findById(user._id);

    // Giá trị kỳ vọng tính ĐỘC LẬP từ chính bmr.js (không hardcode).
    const expectedBmr = Math.round(
      calculateBMR(60, 165, calculateAge(new Date(DOB)), 'female')
    );
    const expectedBaseline = calculateBaseline(expectedBmr);

    expect(expectedBmr).toBeGreaterThan(0);
    expect(fresh.currentStats.bmr).toBe(expectedBmr);
    expect(fresh.currentStats.baseline).toBe(expectedBaseline);
    // Chốt regression: giá trị THẬT SỰ được lưu (không bị strict loại bỏ).
    expect(fresh.currentStats.bmr).toBeGreaterThan(0);
  });

  test('(i) user thiếu profile → bmr/baseline KHÔNG được ghi', async () => {
    const user = await User.create({
      email: 'empty@example.com',
      passwordHash: 'h',
      name: 'Empty',
      currentStats: { weight: 60 }, // có weight nhưng KHÔNG có height/dob/gender
    });

    await syncCurrentStatsBmr(user._id);

    const fresh = await User.findById(user._id);
    expect(fresh.currentStats.bmr).toBeUndefined();
    expect(fresh.currentStats.baseline).toBeUndefined();
  });

  test('thiếu weight cũng KHÔNG ghi (calculateBMRFromUser trả null)', async () => {
    const user = await User.create({
      email: 'noweight@example.com',
      passwordHash: 'h',
      name: 'NoWeight',
      profile: { dateOfBirth: new Date(DOB), gender: 'male', height: 180 },
      // không có currentStats.weight
    });

    await syncCurrentStatsBmr(user._id);

    const fresh = await User.findById(user._id);
    expect(fresh.currentStats?.bmr).toBeUndefined();
  });
});
