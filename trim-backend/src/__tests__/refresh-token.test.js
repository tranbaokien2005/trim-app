/**
 * RUNBOOK 004 Phase 2 — RefreshToken: hashed storage, rotation, reuse-detection, TTL.
 * Test qua ENDPOINT (integration) + kiểm DB trực tiếp cho các invariant bảo mật.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

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
  await RefreshToken.deleteMany({});
});

const registerAndLogin = async (email = 'rt@example.com') => {
  await request(app).post('/api/auth/register').send({ name: 'RT', email, password: 'password123' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return res.body; // { accessToken, refreshToken, user }
};
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

describe('RefreshToken — storage & TTL', () => {
  test('login lưu HASH (không phải token thô) + expiresAt + family, chưa revoke', async () => {
    const { refreshToken } = await registerAndLogin();
    expect(typeof refreshToken).toBe('string');

    // KHÔNG có bản ghi nào lưu token thô.
    const rawInDb = await RefreshToken.findOne({ tokenHash: refreshToken });
    expect(rawInDb).toBeNull();

    // CÓ bản ghi lưu SHA-256 của token thô.
    const rec = await RefreshToken.findOne({ tokenHash: sha256(refreshToken) });
    expect(rec).toBeTruthy();
    expect(rec.family).toBeTruthy();
    expect(rec.revokedAt == null).toBe(true);
    // expiresAt được set trong tương lai (~30 ngày).
    expect(rec.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(rec.expiresAt.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 3600 * 1000);
  });
});

describe('RefreshToken — rotation', () => {
  test('refresh xoay token: trả token MỚI + access; token CŨ hết dùng được', async () => {
    const { refreshToken: t1 } = await registerAndLogin();

    const r = await request(app).post('/api/auth/refresh').send({ refreshToken: t1 });
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeDefined();
    expect(r.body.refreshToken).toBeDefined();
    const t2 = r.body.refreshToken;
    expect(t2).not.toBe(t1);

    // token CŨ (t1) PHẢI bị revoke trong DB sau rotation (kiểm trực tiếp, tránh cascade
    // reuse-detection làm nhiễu). Đây là bằng chứng "token cũ hết dùng được".
    const t1rec = await RefreshToken.findOne({ tokenHash: sha256(t1) });
    expect(t1rec.revokedAt).toBeTruthy();

    // token MỚI dùng được.
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: t2 });
    expect(r2.status).toBe(200);
  });

  test('missing token → 400', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('RefreshToken — reuse detection (LOAD-BEARING)', () => {
  test('trình lại token đã revoke → 401 VÀ revoke CẢ family (token mới cũng chết)', async () => {
    const { refreshToken: t1 } = await registerAndLogin();
    // family của session này (khác family token cấp lúc register — mỗi session 1 family).
    const family = (await RefreshToken.findOne({ tokenHash: sha256(t1) })).family;

    // Xoay: t1 → t2 (t1 bị revoke).
    const rot = await request(app).post('/api/auth/refresh').send({ refreshToken: t1 });
    const t2 = rot.body.refreshToken;
    expect(rot.status).toBe(200);

    // REUSE: gửi lại t1 (đã revoke) → 401.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: t1 });
    expect(reuse.status).toBe(401);

    // Hệ quả reuse-detection: CẢ family bị revoke → t2 (đang hợp lệ) giờ cũng chết.
    const afterReuse = await request(app).post('/api/auth/refresh').send({ refreshToken: t2 });
    expect(afterReuse.status).toBe(401);

    // DB: mọi token CỦA FAMILY NÀY đều revokedAt != null (session khác không bị đụng).
    const activeInFamily = await RefreshToken.countDocuments({ family, revokedAt: null });
    expect(activeInFamily).toBe(0);

    // Positive-control: family KHÁC (token cấp lúc register) KHÔNG bị over-reach — vẫn active.
    const activeOtherFamily = await RefreshToken.countDocuments({ family: { $ne: family }, revokedAt: null });
    expect(activeOtherFamily).toBe(1);
  });

  test('token không tồn tại → 401 (generic, không lộ)', async () => {
    await registerAndLogin();
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'deadbeef-not-real' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token');
  });
});

describe('RefreshToken — logout', () => {
  test('logout revoke token hiện tại; sau đó refresh token đó → 401', async () => {
    const { refreshToken } = await registerAndLogin();

    const out = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(out.status).toBe(200);

    const rec = await RefreshToken.findOne({ tokenHash: sha256(refreshToken) });
    expect(rec.revokedAt).toBeTruthy();

    const r = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(r.status).toBe(401);
  });
});
