# RUNBOOK 004 — Deploy hardening + RefreshToken security (2 phase, goal lớn)

> Bạn là **runner**. Đọc hết rồi thực thi tới GOAL của CẢ HAI phase.
> KHÔNG hỏi Ken giữa chừng — TỰ QUYẾT cái tốt nhất; gặp ngã ba thật sự không quyết được
> thì gọi @trim-manager; chỉ dừng khi chạm STOP LIST.
> Mỗi phase commit RIÊNG. Phase 1 (an toàn) trước, Phase 2 (rủi ro cao) sau — nếu Phase 2
> park thì Phase 1 vẫn đã landed sạch.
> Ghi liên tục RUN_LOG.md.

Trạng thái vào: backend 194 pass / 0 fail, working tree sạch (sau 1c commit).

═══════════════════════════════════════════════════════════════════════════
## STOP LIST (áp cho CẢ hai phase)
1. `.env` trong git status/commit
2. Test PASS tụt dưới 194, hoặc test đang xanh bỗng đỏ
3. Sắp cài dependency mới — NGOẠI LỆ pre-approve: KHÔNG có ngoại lệ ở runbook này
   (không cần dep mới; nếu bạn nghĩ cần, STOP và hỏi)
4. Sắp sửa dữ liệu người dùng thật (migration) — chỉ dry-run được phép, apply thì PARK
5. Sắp sửa file ngoài phạm vi phase đang làm
6. **TTL/`expires`** — CẤM Ở MỌI NƠI, TRỪ đúng một chỗ được cho phép tường minh trong
   Phase 2 (RefreshToken.expiresAt). Bất kỳ `expires`/TTL nào khác chỗ đó → STOP.
7. @trim-security trả finding mức chặn
═══════════════════════════════════════════════════════════════════════════

# ══════════ PHASE 1 — DEPLOY HARDENING (an toàn, làm trước) ══════════

## P1.0 Baseline
`cd trim-backend && npm test 2>&1 | tee /tmp/trim-p4-baseline.txt` — không 194/0 → STOP.

## P1.1 trust proxy (finding F3 — bản lề của rate-limit trên prod)
`app.js`: thêm `app.set('trust proxy', 1)` TRƯỚC khi mount rate limiter.
Lý do: sau proxy Railway, không set thì express-rate-limit key nhầm IP → authLimiter vô dụng.
Chỉ tin 1 hop proxy (giá trị 1), KHÔNG dùng `true` (tin mọi proxy = có thể bị spoof
X-Forwarded-For → lách rate limit).
**Xong khi:** có test hoặc log xác nhận app.set gọi đúng; suite vẫn 194/0.

## P1.2 Index tự tạo trên production — xác minh, không giả định
Read-first: `config/database.js` + chỗ gọi syncAllIndexes (GĐ2). Xác nhận: khi
NODE_ENV=production (autoIndex tắt), syncAllIndexes VẪN chạy lúc khởi động để tạo index.
Nếu chưa chắc chắn → thêm/sửa cho chắc, có log chứng minh index được tạo với NODE_ENV=production giả lập.
**Xong khi:** test/log chứng minh index tồn tại sau khởi động ở chế độ production.

## P1.3 baseURL theo môi trường (bỏ hardcode IP)
`trim-app/src/services/api.js`: BASE_URL hiện hardcode LAN IP. Đổi sang đọc từ env/app
config: dev → LAN IP (giữ default hiện tại làm fallback dev), production → URL Railway.
Dùng cơ chế env của Expo (app.config / process.env.EXPO_PUBLIC_*). KHÔNG hardcode URL prod
thật vào code nếu chưa có — dùng placeholder qua env, ghi log "cần set EXPO_PUBLIC_API_URL
khi deploy". KHÔNG cài dependency mới; nếu expo-constants vẫn chưa hoist thì dùng
process.env.EXPO_PUBLIC_API_URL (Expo inject lúc build).
**Xong khi:** api.js đọc baseURL từ env với fallback dev; không còn IP cứng là đường duy nhất.

## P1.4 Checkpoint + commit Phase 1
@trim-security trên diff Phase 1 (đặc biệt: trust proxy value=1 không phải true; không lộ
secret). Finding chặn → STOP.
Commit: "feat(deploy): trust proxy for prod rate-limit, verify prod index sync, env-based baseURL"

# ══════════ PHASE 2 — REFRESHTOKEN SECURITY (rủi ro cao, làm sau) ══════════

> Đây là task đụng auth token. Làm hỏng = user bị đăng xuất hàng loạt hoặc session không
> hết hạn. Gate chặt hơn bình thường. TTL được phép ĐÚNG MỘT CHỖ ở đây.

## P2.0 Read-first (đọc, báo cáo vào log, TỰ tiếp — không dừng chờ Ken)
1. `models/User.js` — refreshTokens hiện là array shape gì (đây là chỗ TTL-trên-array từng
   xoá 18 tài khoản — ĐỌC KỸ, KHÔNG lặp lại lỗi đó).
2. `routes/auth.js` — refresh endpoint + logout hiện xử lý refreshTokens thế nào (cấp, xoay,
   thu hồi)? Trích file:line.
3. `trim-app/src/services/api.js` — interceptor refresh token gọi endpoint nào, kỳ vọng
   response shape gì (để không phá client).

## P2.1 Model RefreshToken mới (collection riêng)
Tạo `models/RefreshToken.js`:
- `user` (ObjectId, index)
- `tokenHash` (String) — LƯU SHA-256 của token, KHÔNG lưu token thô
- `family` (String) — id nhóm để reuse-detection (mọi token xoay từ một lần login cùng family)
- `expiresAt` (Date) — **ĐÂY là chỗ TTL DUY NHẤT được phép**:
  `expiresAt: { type: Date, index: { expires: 0 } }` — TTL document-level trên field Date
  top-level. KHÔNG đặt expires trên field trong array. KHÔNG đặt ở model khác.
- `revokedAt` (Date, nullable)

**GATE TTL BẮT BUỘC (vì lịch sử repo này):** sau khi tạo model, in ra index thật Mongoose
xây bằng `RefreshToken.collection.getIndexes()` (hoặc syncIndexes rồi đọc). Xác nhận:
- CÓ index `{ expiresAt: 1 }` với `expireAfterSeconds: 0`, document-level.
- KHÔNG có TTL trên bất kỳ field array/subdoc nào.
Nếu index sai hình dạng → STOP NGAY, đây là đúng lỗi đã xoá 18 tài khoản.

## P2.2 Cấp + xoay + reuse-detection
- Khi login/refresh: sinh token thô (crypto ngẫu nhiên), lưu SHA-256 hash + expiresAt +
  family. Trả token THÔ cho client (chỉ lần này).
- Refresh: nhận token thô → hash → tra. Nếu khớp và chưa revoke/expire → cấp token mới
  cùng family, revoke token cũ (rotation).
- **Reuse detection:** nếu nhận một token đã bị revoke (đã dùng rồi) → coi là bị đánh cắp →
  revoke TOÀN BỘ family đó (buộc đăng nhập lại). Log sự kiện.
- Logout: revoke token hiện tại (hoặc cả family).

## P2.3 Migrate khỏi User.refreshTokens (array cũ)
- Bỏ field array refreshTokens khỏi User schema SAU khi endpoint đã chuyển sang collection mới.
- User đang đăng nhập bằng token cũ: chấp nhận cho họ đăng nhập lại (refresh cũ fail →
  client về màn login). KHÔNG cần migrate token cũ sang mới (chúng sắp hết hạn).
- Nếu có script dọn array cũ trên dữ liệu thật → DRY-RUN rồi PARK (đừng tự apply).

## P2.4 Test + mutation
Test: cấp → refresh xoay (token cũ hết dùng được) → reuse token đã revoke → cả family bị
revoke. Test expiresAt được set. Test logout revoke.
Mutation: tắt reuse-detection → test "reuse → revoke family" phải FAIL. Khôi phục.

## P2.5 Checkpoint + commit Phase 2
- @trim-test-skeptic: mọi test load-bearing; đặc biệt test reuse-detection có thật không.
- @trim-security: **xác nhận lại GATE TTL** (index shape đúng), token lưu dạng hash không
  phải thô, reuse-detection đóng đúng, không .env/secret.
Finding chặn → STOP.
Commit: "feat(auth): RefreshToken collection - hashed tokens, rotation, reuse detection, document TTL"

═══════════════════════════════════════════════════════════════════════════
## RUN_LOG.md
Ghi liên tục [HH:MM] START/OK/FAIL/PARK/DEC/AGENT/STOP. BÁO CÁO CUỐI: Đã xong (bằng chứng:
số test, hash) · PARK (cần Ken) · quyết định tự làm (Ken duyệt) · từng dòng GOAL tick + output.
"Tests pass" không phải bằng chứng — số + tên test mới là. Ghi rõ nếu đổi model giữa chừng.

## GOAL tổng
- [ ] Phase 1: trust proxy set (value 1), prod index sync verify, env baseURL — commit riêng
- [ ] Phase 2: RefreshToken collection hashed+rotation+reuse-detection, document TTL đúng
      hình dạng (GATE TTL pass 2 lần), array cũ bỏ khỏi User, client refresh vẫn chạy — commit riêng
- [ ] Suite ≥ 194 + test mới, 0 fail
- [ ] Không .env; TTL chỉ tồn tại trên RefreshToken.expiresAt và không ở đâu khác
