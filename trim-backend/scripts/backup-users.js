/**
 * Backup collection `users` -> file JSON ở gốc trim-backend TRƯỚC khi cleanup legacy
 * refreshTokens array (RUNBOOK 004 P2.3).
 *
 * AN TOÀN:
 *   - Chỉ ĐỌC, không ghi DB.
 *   - KHÔNG in URI hay nội dung document — chỉ in SỐ document đã backup.
 *   - File backup chứa data người dùng (gồm passwordHash) → đã thêm .gitignore, KHÔNG commit.
 *
 * Dùng: node scripts/backup-users.js
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('THIẾU MONGODB_URI trong .env — dừng.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    const docs = await mongoose.connection.db.collection('users').find({}).toArray();

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(__dirname, '..', `backup-users-${stamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(docs, null, 2));

    // Chỉ in số lượng + tên file — KHÔNG in nội dung/URI.
    console.log(`Backed up ${docs.length} document(s) -> ${path.basename(outPath)}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Backup error:', err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
