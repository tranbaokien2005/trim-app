# RUNBOOK 006 — Pre-launch: build prep + Shortcuts + password reset (dormant)

> Runner. Thực thi tới GOAL cả 3 phase. TỰ QUYẾT; không hỏi Ken giữa chừng trừ STOP LIST /
> @trim-manager. Mỗi phase commit riêng, an toàn → phức tạp. Ghi RUN_LOG.md.

Trạng thái vào: 218 pass / 0 fail, working tree sạch.

═══════════════════════════════════════════════════════════════════
## STOP LIST (cả 3 phase)
1. `.env` trong git · 2. test tụt dưới 218 hoặc test xanh bỗng đỏ · 3. cài dep mới — NGOẠI LỆ:
KHÔNG dep mới (Resend gọi bằng fetch, không SDK) · 4. sửa dữ liệu người dùng thật · 5. sửa
file ngoài phạm vi phase · 6. **TTL/expires** — CẤM, TRỪ đúng PasswordResetToken.expiresAt ở
Phase 3 (giống RefreshToken) · 7. @trim-security finding chặn.
═══════════════════════════════════════════════════════════════════

# ══════ PHASE 1 — BUILD PREP (nhỏ, trước) ══════
## P1.1 app.json — định danh để build được App Store
Thêm (nếu chưa có): `ios.bundleIdentifier` = "com.<slug>.trim" (ví dụ com.baokien.trim —
chọn reverse-domain hợp lệ, ghi log giá trị đã dùng), `android.package` = cùng dạng.
Thêm `ios.buildNumber` "1" và `version` "1.0.0" nếu thiếu.
**Xong khi:** app.json có bundleIdentifier + package; `npx expo config` không lỗi.
Không cài gì, không build (build là việc Ken làm ở checklist deploy).

# ══════ PHASE 2 — QUICKLOG SHORTCUTS HELP (nhỏ) ══════
> Deep link trim:// ĐÃ có (RUNBOOK 001). Chỉ cần màn hướng dẫn trong app.
## P2.1 Màn Settings "Quick Log (Back Tap)"
Thêm một mục trong Settings → màn hướng dẫn tĩnh:
- Giải thích: gõ 2 cái vào lưng iPhone để log nhanh không mở tìm app.
- Các bước: Settings → Accessibility → Touch → Back Tap → chọn Shortcut "Trim Quick Log".
- Ghi rõ: user tạo Shortcut gồm Ask for Input (Text) → Open URL `trim://log?text=[input]`.
  (Ken sẽ phát hành link iCloud Shortcut sau; để chỗ cho link đó, hiện tại hướng dẫn tay.)
- Đặt mục này ở Settings, KHÔNG ở onboarding (tính năng cho power user).
**Xong khi:** màn hiển thị đúng, điều hướng vào/ra sạch. Không cần test tự động.

# ══════ PHASE 3 — PASSWORD RESET (dormant, flag-gated) ══════
> Code ĐẦY ĐỦ + test, nhưng NGỦ cho tới khi Ken cấu hình email. KHÔNG hiện UI khi chưa bật →
> không có nút chết. Kích hoạt sau bằng env, không cần sửa code.

## P3.0 Read-first (ghi log, tự tiếp)
auth.js login/register flow; cách hash password; RefreshToken model (làm mẫu cho TTL + hash token).

## P3.1 Backend
- Model `PasswordResetToken`: user, tokenHash (SHA-256, KHÔNG lưu thô), expiresAt (Date).
  **TTL đúng MỘT chỗ:** `expiresAt` index document-level `{ expires: 0 }` — giống RefreshToken.
  **GATE TTL:** in `PasswordResetToken.collection.getIndexes()`, xác nhận {expiresAt:1}
  expireAfterSeconds document-level, KHÔNG trên array. Sai → STOP.
- `services/email.js`: hàm sendPasswordResetEmail(to, rawToken). Gọi Resend HTTP API bằng
  **fetch** (KHÔNG SDK). Nếu `process.env.RESEND_API_KEY` vắng → log "email not configured,
  skipping" và return (no-op). KHÔNG in token/email ra log ở production.
- `POST /api/auth/forgot-password`: nhận email. LUÔN trả 200 generic "If an account exists, a
  reset link has been sent." (anti-enumeration). Nếu user tồn tại VÀ email configured → sinh
  token thô, lưu hash + expiresAt (15 phút), gọi sendPasswordResetEmail. Rate-limit chặt.
- `POST /api/auth/reset-password`: nhận rawToken + newPassword. Hash token → tra → nếu hợp lệ
  & chưa hết hạn → validate password (dùng lại zod rule GĐ1c) → set password mới → xoá token →
  revoke toàn bộ RefreshToken của user (buộc đăng nhập lại). Token sai/hết hạn → 400 generic.

## P3.2 Frontend (flag-gated OFF)
- Màn ForgotPassword (nhập email → gọi forgot-password → hiện "check your email") + màn
  ResetPassword (nếu deep link trim://reset?token= — nhập password mới → gọi reset-password).
- **Nút "Forgot password?" ở màn Login CHỈ hiện khi** `process.env.EXPO_PUBLIC_PASSWORD_RESET
  === 'true'` (mặc định không set = ẩn). Launch: ẩn. Khi Ken có email: set true, hiện.
  → Không có nút chết ở v1.

## P3.3 Test + checkpoint
Test: forgot-password luôn 200 generic (user tồn tại / không) · reset-password token hợp lệ đổi
được password + revoke refresh tokens · token hết hạn/sai → 400 · GATE TTL. Mutation: bỏ check
hết hạn → test token-expired FAIL.
@trim-test-skeptic + @trim-security (TTL shape, token hash không thô, anti-enum, không .env).
Finding chặn → STOP.

## Commit (mỗi phase riêng)
P1: "chore(build): add iOS bundleIdentifier + Android package for store builds"
P2: "feat(app): Quick Log (Back Tap) help screen in Settings"
P3: "feat(auth): password reset (dormant behind EXPO_PUBLIC_PASSWORD_RESET + RESEND_API_KEY)"

## RUN_LOG.md — BÁO CÁO CUỐI: đã xong (bằng chứng) · PARK · quyết định tự làm · GOAL từng dòng.

## GOAL
- [ ] app.json có bundleIdentifier + android.package (ghi log giá trị)
- [ ] Settings có màn Quick Log help
- [ ] Password reset: backend + FE đầy đủ, TTL đúng (GATE pass), nút ẩn ở v1 (flag off),
      test + mutation xanh
- [ ] Suite ≥ 218 + mới, 0 fail · không .env · không dep mới · TTL chỉ ở PasswordResetToken.expiresAt
