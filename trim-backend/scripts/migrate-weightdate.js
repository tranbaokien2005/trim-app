/**
 * Migration: WeightLog.date  Date  ->  String 'YYYY-MM-DD'
 *
 * Bối cảnh: schema WeightLog.date đã đổi từ Date sang String 'YYYY-MM-DD' (nhất quán
 * với MealLog/ActivityLog). Document CŨ vẫn lưu date kiểu BSON Date. Script này chuẩn
 * hoá chúng về chuỗi 'YYYY-MM-DD'.
 *
 * AN TOÀN:
 *   - MẶC ĐỊNH là --dry-run: chỉ ĐẾM và IN mẫu, KHÔNG ghi DB.
 *   - Phải truyền --apply tường minh mới ghi. (Runbook: KHÔNG tự apply — để Ken chạy
 *     sau khi backup.)
 *   - Dùng native collection (không qua Mongoose) để đọc được giá trị Date thô kể cả
 *     khi schema đã là String.
 *
 * Quy ước chuyển đổi: Date -> UTC 'YYYY-MM-DD' (toISOString().slice(0,10)).
 *   Vì đường ghi cũ tạo Date bằng `new Date('YYYY-MM-DD')` = nửa đêm UTC, nên slice UTC
 *   khôi phục ĐÚNG chuỗi ngày ban đầu. (Bản ghi tạo bằng `new Date()` không có tz-info,
 *   lấy ngày UTC là xấp xỉ tốt nhất — nêu rõ trong output để Ken rà.)
 *
 * Dùng:
 *   node scripts/migrate-weightdate.js            # dry-run (mặc định)
 *   node scripts/migrate-weightdate.js --dry-run  # tường minh
 *   node scripts/migrate-weightdate.js --apply     # GHI thật (cần backup trước)
 */

const COLLECTION = 'weightlogs';

/** Date -> 'YYYY-MM-DD' theo UTC. */
function toDateString(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Chạy migration trên một db (native driver connection).
 * @param {Db} db  - mongoose.connection.db hoặc MongoClient db
 * @param {{ apply?: boolean, sampleSize?: number }} opts
 * @returns {{ matched:number, converted:number, samples:Array, applied:boolean }}
 */
async function migrate(db, { apply = false, sampleSize = 10 } = {}) {
  const coll = db.collection(COLLECTION);
  // Chỉ những document date còn là BSON Date mới cần đổi. Chuỗi thì bỏ qua (idempotent).
  const filter = { date: { $type: 'date' } };

  const matched = await coll.countDocuments(filter);
  const samples = [];
  let converted = 0;

  const cursor = coll.find(filter);
  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    const to = toDateString(doc.date);
    if (samples.length < sampleSize) {
      samples.push({ _id: String(doc._id), from: doc.date, to });
    }
    if (apply) {
      await coll.updateOne({ _id: doc._id }, { $set: { date: to } });
      converted++;
    }
  }

  return { matched, converted, samples, applied: apply };
}

function printReport(res, { apply }) {
  console.log('─'.repeat(60));
  console.log(`WeightLog.date migration — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('─'.repeat(60));
  console.log(`Document có date kiểu Date (cần đổi): ${res.matched}`);
  if (!apply) {
    console.log('KHÔNG ghi gì (dry-run). Mẫu (tối đa 10):');
  } else {
    console.log(`ĐÃ đổi: ${res.converted} document. Mẫu:`);
  }
  for (const s of res.samples) {
    console.log(`  ${s._id}: ${new Date(s.from).toISOString()}  ->  '${s.to}'`);
  }
  if (res.matched === 0) console.log('  (không có document nào cần đổi — có thể đã migrate rồi)');
  console.log('─'.repeat(60));
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Chỉ chạy khi gọi trực tiếp (không phải khi require từ test).
if (require.main === module) {
  (async () => {
    const apply = process.argv.includes('--apply');
    const mongoose = require('mongoose');
    require('dotenv').config();
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('THIẾU MONGODB_URI trong môi trường/.env — dừng.');
      process.exit(1);
    }
    try {
      await mongoose.connect(uri);
      const res = await migrate(mongoose.connection.db, { apply });
      printReport(res, { apply });
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Migration error:', err.message);
      try { await mongoose.disconnect(); } catch (_) {}
      process.exit(1);
    }
  })();
}

module.exports = { migrate, toDateString };
