/**
 * Backup collection `weightlogs` -> file JSON ở gốc trim-backend TRƯỚC khi migrate.
 *
 * AN TOÀN:
 *   - Chỉ ĐỌC, không ghi DB.
 *   - KHÔNG in URI hay nội dung document ra console — chỉ in SỐ document đã backup.
 *   - File backup chứa data người dùng → đã thêm vào .gitignore, KHÔNG commit.
 *
 * Dùng: node scripts/backup-weightlogs.js
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
    const docs = await mongoose.connection.db.collection('weightlogs').find({}).toArray();

    // Timestamp an toàn cho tên file (không có ký tự : . )
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(__dirname, '..', `backup-weightlogs-${stamp}.json`);
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
