/**
 * Dọn field `refreshTokens` (array cũ) khỏi các document User trên DB thật.
 *
 * Bối cảnh: RUNBOOK 004 P2.3 chuyển refresh token sang collection RefreshToken riêng và
 * BỎ field array `refreshTokens` khỏi User schema. Document User cũ vẫn còn array này
 * (chứa JWT THÔ — nên dọn cho sạch, vừa gọn vừa bớt token thô nằm trong DB).
 *
 * AN TOÀN:
 *   - MẶC ĐỊNH --dry-run: chỉ ĐẾM số user còn field, KHÔNG ghi DB.
 *   - Phải --apply tường minh mới $unset. (Runbook: KHÔNG tự apply — Ken chạy sau khi backup.)
 *   - Chỉ $unset đúng field refreshTokens; KHÔNG đụng field khác, KHÔNG xoá document.
 *
 * Dùng:
 *   node scripts/cleanup-user-refreshtokens.js            # dry-run
 *   node scripts/cleanup-user-refreshtokens.js --apply     # ghi thật (cần backup trước)
 */

async function migrate(db, { apply = false } = {}) {
  const coll = db.collection('users');
  const filter = { refreshTokens: { $exists: true } };
  const matched = await coll.countDocuments(filter);
  let modified = 0;
  if (apply && matched > 0) {
    const res = await coll.updateMany(filter, { $unset: { refreshTokens: '' } });
    modified = res.modifiedCount;
  }
  return { matched, modified, applied: apply };
}

function printReport(res, { apply }) {
  console.log('─'.repeat(60));
  console.log(`Cleanup User.refreshTokens (array cũ) — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('─'.repeat(60));
  console.log(`User còn field refreshTokens: ${res.matched}`);
  if (apply) console.log(`Đã $unset: ${res.modified} document`);
  else console.log('KHÔNG ghi gì (dry-run).');
  if (res.matched === 0) console.log('  (không còn user nào có field — đã sạch)');
  console.log('─'.repeat(60));
}

if (require.main === module) {
  (async () => {
    const apply = process.argv.includes('--apply');
    const mongoose = require('mongoose');
    require('dotenv').config();
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('THIẾU MONGODB_URI — dừng.'); process.exit(1); }
    try {
      await mongoose.connect(uri);
      const res = await migrate(mongoose.connection.db, { apply });
      printReport(res, { apply });
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Cleanup error:', err.message);
      try { await mongoose.disconnect(); } catch (_) {}
      process.exit(1);
    }
  })();
}

module.exports = { migrate };
