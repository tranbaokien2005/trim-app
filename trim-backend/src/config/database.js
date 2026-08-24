const mongoose = require('mongoose');

// Các model "sở hữu" index. createIndexes() được gọi lúc khởi động để đảm bảo
// index tồn tại kể cả khi autoIndex=false trên production (finding #1).
// Bao gồm Template (finding F2 của trim-security) để index Template cũng được tạo.
const OWNING_MODELS = ['User', 'MealLog', 'ActivityLog', 'WeightLog', 'Template', 'RefreshToken'];

// Tạo index cho các model sở hữu. Vì production đặt autoIndex=false
// (tránh schema sai âm thầm dựng lại index nguy hiểm), index unique/partial
// sẽ KHÔNG tự tạo nếu không gọi tường minh. Hàm này lấp khoảng đó.
//
// DÙNG createIndexes() CHỨ KHÔNG syncIndexes() — có chủ đích (finding F1 của
// trim-security): syncIndexes() sẽ DROP mọi index không có trong schema, nên nó
// có thể âm thầm xoá index tạo tay trên Atlas (vd để cứu query chậm) ở mỗi lần
// deploy. createIndexes() chỉ TẠO index còn thiếu, KHÔNG drop — không phá huỷ
// metadata, an toàn để chạy tự động lúc khởi động.
const syncAllIndexes = async () => {
  // Yêu cầu model đã được nạp (require) trước khi gọi.
  const results = {};
  for (const name of OWNING_MODELS) {
    const Model = mongoose.models[name];
    if (!Model) continue;
    await Model.createIndexes();
    results[name] = (await Model.collection.indexes()).map((i) => i.name);
  }
  return results;
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Production KHÔNG tự tạo index — tránh việc một schema sai
      // âm thầm dựng lại index nguy hiểm trên DB thật.
      autoIndex: process.env.NODE_ENV !== 'production',
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Đảm bảo index tồn tại kể cả trên production (autoIndex=false).
    // Guard: KHÔNG chạy trong test — test tự quản index (MongoMemoryServer +
    // createIndexes/syncIndexes tường minh trong setup).
    if (process.env.NODE_ENV !== 'test') {
      // Nạp model để mongoose.models có đủ trước khi tạo index.
      require('../models/User');
      require('../models/MealLog');
      require('../models/ActivityLog');
      require('../models/WeightLog');
      require('../models/Template');
      require('../models/RefreshToken');
      try {
        const created = await syncAllIndexes();
        console.log('Indexes ensured:', JSON.stringify(created));
      } catch (idxErr) {
        // Lỗi tạo index KHÔNG được làm sập server đã kết nối thành công.
        console.error('Index create error:', idxErr.message);
      }
    }
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.syncAllIndexes = syncAllIndexes;
