# RUNBOOK 003 — Giai đoạn 1c: Validation, password rules, anti-enumeration, lockout

> Bạn là **runner**. Đọc hết rồi thực thi tới khi đạt GOAL, KHÔNG dừng hỏi Ken.
> Gặp quyết định → TỰ CHỌN cái tốt nhất (gọi @trim-manager nếu cần cân nhắc).
> Chỉ STOP khi chạm STOP LIST, hoặc khi @trim-manager trả ESCALATE (thật sự bế tắc).
> Ghi liên tục vào RUN_LOG.md. Cuối cùng commit.

Trạng thái vào: backend 178 pass / 0 fail, working tree sạch (sau a9e142b).

## QUYẾT ĐỊNH ĐÃ CHỐT SẴN (không hỏi lại)
1. **Dùng `zod`** cho validation. Đã approve. (STOP LIST cấm dep mới TRỪ zod.)
2. **Register anti-enumeration = hướng (a):** giữ reject duplicate email, nhưng đảm bảo
   nó KHÔNG rò qua global 400 handler theo cách khác lạ, VÀ siết rate limit trên route
   register. Chống enum hoàn hảo ở register cần email verification (thuộc GĐ1d, chưa có
   domain) → phần đó DEFER, ghi log là đã defer, KHÔNG chặn runbook này.
   Login thì chống enum hoàn toàn ngay (generic + timing-safe, Task 5).

---

## GOAL
- [ ] Route auth (register, login) + route ghi chính (meals, activities, weights, quicklog)
      validate input bằng zod, trả 400 + message an toàn khi malformed
- [ ] Register enforce password mạnh (≥8 ký tự, có chữ và số), có test
- [ ] Login trả GENERIC "Invalid email or password" cho CẢ sai email LẪN sai mật khẩu,
      timing-safe, có test khẳng định hai nhánh trả message + status GIỐNG HỆT
- [ ] Khoá tài khoản tạm sau 5 login sai trong cửa sổ 15 phút, login đúng reset, có test
- [ ] Register không rò tồn tại tài khoản qua global 400; rate limit siết trên register
- [ ] Toàn bộ test xanh (178 cũ + mới, 0 fail), @trim-security không finding chặn
- [ ] Đã commit; `.env` không trong git

## STOP LIST
1. `.env` trong git · 2. thêm `expires`/TTL · 3. PASS tụt dưới 178 hoặc test xanh bỗng đỏ ·
4. dep mới NGOÀI zod · 5. sửa file ngoài phạm vi task · 6. @trim-security finding chặn

## LUẬT PARK / ESCALATE
Gặp ngã ba → tự chọn cái tốt nhất; phân vân thật sự → @trim-manager. Nó trả ESCALATE
(bế tắc thật) → PARK, ghi log, sang task khác. Tối đa 3 lần thử mỗi blocker.

---

## TASK 0 — Baseline
`cd trim-backend && npm test 2>&1 | tee /tmp/trim-p1c-baseline.txt`
Ghi pass/fail + tên/lỗi test fail. Không phải 178/0 → STOP.

## TASK 1 — Read-first (đọc, ghi log, TỰ ĐI TIẾP — không dừng chờ Ken)
Đọc và ghi vào RUN_LOG.md (dùng làm cơ sở cho các task sau, KHÔNG chờ xác nhận):
1. auth.js — register/login hiện trả gì cho: email trùng / sai email / sai mật khẩu (file:line, message, status)
2. Validation hiện có ở đâu; zod đã trong package.json chưa
3. middleware rate limiter áp route nào, cấu hình gì
4. User.js — có failedLoginAttempts/lockUntil chưa; hình dạng currentStats/refreshTokens (để không đụng nhầm)
5. errorHandler.js — đường E11000→400; register duplicate có rơi vào đó không
Nếu phát hiện điều gì mâu thuẫn quyết định đã chốt sẵn ở trên → lúc đó mới @trim-manager.

## TASK 2 — Lớp validation (zod)
Schema zod cho register, login, quicklog/meal, weight, activity. Middleware validate →
400 + message an toàn (không lộ internal, không echo giá trị nhạy cảm). Áp vào route.
Xong khi: body thiếu/sai kiểu → 400; body hợp lệ → qua như cũ.

## TASK 3 — Password strength (register)
≥8 ký tự, có ít nhất một chữ và một số (kiểm trong zod, không cần lib). Message rõ khi fail.
Xong khi: password yếu → 400; đạt → tạo user.

## TASK 4 — Login generic + timing-safe
Sai email VÀ sai mật khẩu → CÙNG "Invalid email or password", CÙNG 401. Luôn chạy
bcrypt.compare kể cả khi email không tồn tại (so hash giả) để không lộ qua thời gian.
Xong khi: test khẳng định hai nhánh trả message + status GIỐNG HỆT.

## TASK 5 — Lockout + register anti-enum (theo quyết định đã chốt: hướng a)
- Thêm failedLoginAttempts + lockUntil vào User. 5 sai → lockUntil 15 phút. Đúng → reset.
  Đang khoá → 401 với message chung ("too many attempts, try again later"), KHÔNG lộ tồn tại tài khoản.
- Register: giữ reject duplicate qua đường có kiểm soát (không rơi global 400 khác lạ),
  siết rate limit. Phần verification-based anti-enum: ghi log "DEFER sang GĐ1d".
Xong khi: test lockout (5 sai → khoá → 401), test reset khi login đúng.

## TASK 6 — Checkpoint
@trim-test-skeptic (test mới load-bearing; mutation: phá một nhánh login cho khác đi →
test "hai nhánh giống nhau" phải FAIL). @trim-security (còn vector enum? lockout tự mở
khoá đúng? validation bypass được không? .env/secret/TTL). Finding chặn → STOP.

## TASK 7 — Commit
`git status` (không .env) → commit:
"feat(auth): zod validation, password rules, generic login, account lockout, register anti-enum (verify deferred to 1d)"

## RUN_LOG.md
Ghi liên tục. BÁO CÁO CUỐI: Đã xong (bằng chứng) · PARK (nếu có) · quyết định tự làm ·
GOAL từng dòng + output. "Tests pass" không phải bằng chứng — số + tên test mới là.
