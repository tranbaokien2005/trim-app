# RUN_LOG — RUNBOOK 001 (Quick Log v1.0)

[00:44] START — đọc RUNBOOK_001_quicklog.md, chụp baseline trước task 1.

[00:44] OK — baseline chạy xong: `cd trim-backend && npm test`
        Tests:       3 failed, 155 passed, 158 total
        Test Suites: 1 failed, 4 passed, 5 total
        (đã strip ANSI, lưu ở scratchpad/trim-baseline.txt)

[00:45] STOP — baseline KHÔNG phải 148 pass / 3 fail như Ken chỉ định.
        Con số thật: 155 pass / 3 fail.

        Nguyên nhân: RUNBOOK 001 ĐÃ ĐƯỢC THỰC THI VÀ COMMIT rồi.
        `git log --oneline`:
          c662b85 chore: add Trim agent team, /gate skill, and runbooks
          794474c feat(quicklog): idempotent quick-log endpoint + trim:// deep links  <-- Commit 2
          d43bb93 refactor(parse): extract GPT parse logic into utils/parseText.js    <-- Commit 1

        155 = 148 (baseline sau Commit 1) + 7 test quicklog của task 5.
        `PASS src/__tests__/quicklog.test.js` có trong output.

        Ba test fail vẫn là đúng ba cái baseline, đúng lý do cũ:
          - Weights › POST /api/weights creates a log
            → expect res.body toHaveProperty('bmi'), body không có bmi
          - Meals › GET /api/meals/search returns results
            → Array.isArray(res.body) === false
          - Stats › GET /api/stats/daily aggregates meals and activities correctly
            → res.body.bmr === 0, không > 0

        Theo lệnh của Ken ("nếu không phải 148/3 → DỪNG, báo cáo ngay,
        đừng làm gì thêm"): dừng tại đây. KHÔNG sửa file nào, KHÔNG chạy task 1–9.

        `git status --porcelain` (không đổi, không có .env):
          M trim-app/src/screens/onboarding/RegisterScreen.js
          M trim-app/src/services/api.js
          M trim-app/src/services/auth.js

---

[01:10] START — Task 7 mutation A/B trên code đã commit (794474c). Ken yêu cầu rõ,
        chạy trên nhánh xác minh, không sửa gì ngoài quicklog.js và luôn khôi phục.

[01:11] AGENT/OK — MUTATION A (tắt lớp 1 findOne bằng `false &&`, giữ lớp 2 E11000)
        Sửa dòng 70: `if (false && existing) return duplicateResponse(...)`
        `npx jest quicklog` → 7 passed, 7 total.
        Test "firing the same clientId twice ..." → PASS (√, 21 ms).
        → ĐÚNG DỰ ĐOÁN. Với lớp 1 tắt: POST 2 bỏ qua findOne, save() ném E11000,
          lớp 2 bắt được, tra lại, trả duplicate:true. Index + lớp 2 đang gánh thật.
        → Index unique CÓ TỒN TẠI (nếu không, POST 2 sẽ tạo doc thứ 2 và test fail).
        Khôi phục dòng 70 → `git diff quicklog.js` sạch.

[01:13] AGENT/OK — MUTATION B (tắt CẢ lớp 1 và lớp 2 bằng `false &&`)
        Sửa dòng 70 (như trên) + dòng 138: `if (false && err.code === 11000) {`
        (Runbook ghi dòng 139; thực tế `if (err.code === 11000)` ở DÒNG 138 — áp đúng dòng đó.)
        `npx jest quicklog` → 1 failed, 6 passed, 7 total.
        Test "firing the same clientId twice ..." → FAIL (×, 42 ms).
        → ĐÚNG DỰ ĐOÁN (test FAIL) → chứng minh test số 2 KHÔNG rỗng.

        LỆCH SO VỚI RUNBOOK: runbook dự đoán response 500. Thực tế là **400**.
        Assertion vỡ đầu tiên: dòng 111 `expect(second.status).toBe(200)` → nhận 400.
        Nguyên nhân: có TẦNG THỨ 3 — global errorHandler.
          trim-backend/src/middleware/errorHandler.js:14
            `if (err.code === 11000) { return res.status(400).json(...) }`
          Khi cả 2 lớp app tắt, save() vẫn ném E11000, `throw err` → next(error)
          → errorHandler map E11000 thành 400 (KHÔNG trả duplicate:true).
        Kết luận về hướng test vẫn nguyên: test FAIL đúng như dự đoán, test không rỗng.

[01:14] DEC — CÂU HỎI QUAN TRỌNG của runbook: assertion `countDocuments === 1`
        (dòng 116) dưới Mutation B là PASS hay FAIL?
        Quan sát: test dừng SỚM ở dòng 111 (status 400 ≠ 200), Jest KHÔNG chạy tới
        dòng 116, nên không có kết quả trực tiếp cho assertion đó.

        Chứng minh countDocuments === 1 VẪN ĐÚNG dưới Mutation B (suy luận từ bằng chứng):
          1. POST 2 trả status 400.
          2. errorHandler.js:14 chỉ trả 400 khi `err.code === 11000`.
          3. ⇒ lỗi từ save() ở POST 2 là E11000 (duplicate-key của MongoDB).
          4. MongoDB chỉ ném E11000 khi UNIQUE INDEX từ chối ghi vì trùng khoá.
          5. ⇒ index ở tầng DB đã CHẶN write lần 2 → doc thứ 2 không bao giờ được ghi.
          6. ⇒ countDocuments({user, clientId}) === 1 (chỉ còn doc lần 1).
        Nếu KHÔNG có index, POST 2 sẽ save thành công → 201, không có lỗi, không có 400.
        Chính response 400 (dấu vân tay của E11000) là bằng chứng index đang chặn.

        ⇒ KẾT LUẬN cho @trim-test-skeptic:
          - `countDocuments === 1` VẪN PASS dưới Mutation B, do UNIQUE INDEX (lớp 3, DB)
            chặn ghi lần 2 — kể cả khi cả hai lớp app đã tắt.
          - Nghĩa là: test số 2 chứng minh được "app còn xử lý duplicate êm" (qua
            assertion duplicate:true — assertion NÀY vỡ dưới Mutation B, nên nó không rỗng),
            nhưng assertion countDocuments===1 một mình KHÔNG chứng minh "index còn chặn".
          - Việc chứng minh index tồn tại đúng hình dạng (unique + partialFilterExpression,
            KHÔNG phải sparse) là do TEST SỐ 7 (đọc collection.indexes()) đảm nhiệm.

[01:15] OK — Khôi phục cả dòng 70 và 138. `git diff trim-backend/src/routes/quicklog.js`
        SẠCH. git status chỉ còn 3 file modified sẵn (không đụng) + RUN_LOG.md.

---

[01:30] AGENT/@trim-test-skeptic — soi quicklog.test.js (chỉ đọc). Kết luận:

  CÂU HỎI 1 — test số 2 (dòng 102–118):
  - Assert CẢ HAI: `duplicate === true` (dòng 113) VÀ `countDocuments === 1`
    (query dòng 116, `expect(count).toBe(1)` dòng 117). Xác nhận.
  - Thứ tự hiện tại: `expect(second.status).toBe(200)` ở DÒNG 111 đứng TRƯỚC
    `expect(count).toBe(1)` ở dòng 117. countDocuments là assertion CUỐI CÙNG.
  - Xác nhận bối cảnh: dưới mutation tắt cả 2 lớp, test vỡ ngay dòng 111 (status
    400 do errorHandler map E11000→400), Jest KHÔNG chạy tới dòng 112–117 →
    countDocuments không hề được đánh giá. Test vẫn FAIL nhưng vỡ vì "status",
    không phải vì "đếm được 2 document".
  - KHUYẾN NGHỊ: CÓ — nên đảo thứ tự. Assertion load-bearing thật sự là
    "chỉ 1 document được ghi"; status 200 vs 201 chỉ là chi tiết HTTP contract.
    Đặt status trước che mất assertion quan trọng nhất khi status sai (đúng cạm
    bẫy "đếm layer"). Thứ tự đề xuất:
      1. first.status===201 + first.duplicate===false (giữ)
      2. QUERY DB TRƯỚC: countDocuments → expect(count).toBe(1)
      3. rồi mới second.status===200, second.duplicate===true, created._id khớp.
    (Đây là KHUYẾN NGHỊ để Ken quyết — KHÔNG sửa file. Ngoài phạm vi runbook 001.)

  CÂU HỎI 2 — test số 7 (dòng 162–175):
  - CÓ đọc collection.indexes() trên CẢ 3 collection: vòng lặp
    `for (const Model of [MealLog, ActivityLog, WeightLog])` (dòng 163),
    `Model.collection.indexes()` (dòng 164). Không sót collection nào.
  - CÓ gọi syncIndexes() trong beforeAll (dòng 47–51, Promise.all cho cả 3) →
    tránh cạm bẫy autoIndex/async index build.
  - CÓ khẳng định đầy đủ shape:
      dedupe.toBeDefined() (169), unique===true (170),
      partialFilterExpression toEqual {clientId:{$type:'string'}} (171),
      sparse toBeUndefined() (173 — chặn việc đổi sang sparse).
  - KHÔNG pass giả: match theo shape của key (user===1 && clientId===1, dòng 166),
    không phải theo tên index; bao cả 3 collection.
  - Ghi chú độ chặt (không phải lỗi): không kiểm tường minh "không có field thừa"
    trong key, và cố định dạng partial filter là $type:'string' (chặt, đúng ý muốn).

  ⇒ Chốt: test số 7 THẬT SỰ chứng minh index tồn tại đúng hình dạng trên cả 3
    collection — đúng như thiết kế để bù cho việc test số 2 một mình không chứng
    minh được index (khớp kết luận mutation B ở trên).

---

[01:40] AGENT/@trim-security — soi commit 794474c (chỉ đọc). Kết luận:
        KHÔNG có finding mức CHẶN (blocking).

  Checklist thường lệ — tất cả PASS:
  - TTL/expires: PASS. 3 index mới đều composite thường, không expires. User.js:88-92
    giữ comment cảnh báo không đặt expires trên refreshTokens.createdAt.
  - .env/secret bị commit: PASS. Chỉ source/test/package-lock.
  - Credential hard-code: PASS. uuid.js:1-4 ghi rõ Math.random chỉ cho idempotency,
    không dùng bảo mật.
  - origin enum + unique partial index: PASS (điểm tốt). partialFilterExpression
    {clientId:{$type:'string'}} thay vì sparse — đúng chuẩn. Route cũ clientId
    undefined nên bị loại khỏi index, không va chạm.
  - WeightLog.date: PASS, vẫn type Date (WeightLog.js:13-16).
  - Auth: PASS. router.use(authenticate), userId từ req.user._id không từ body → không IDOR.
  - Rate limit / validate trước DB / dependency: PASS (chỉ thêm jest devDep phía app).

  Account enumeration (câu hỏi thêm của Ken):
  - errorHandler map E11000→400 KHÔNG tạo vector enumeration MỚI qua commit này.
    Collision {user,clientId} scope trong chính user đăng nhập; route quicklog tự
    bắt E11000 (quicklog.js:138-141) trước khi tới errorHandler.
  - Vector enumeration THẬT là ở REGISTER, PRE-EXISTING, KHÔNG thuộc commit 794474c:
    auth.js:19 → `if (existingUser) return 400 "User already exists"` cho biết email
    đã có tài khoản. Đường race cũng lộ qua errorHandler.js:14-18 ("Email already exists").
    Login thì an toàn (auth.js:52,57 trả "Invalid credentials" chung).
    → security boundary, cần fix server-side, nhưng NGOÀI phạm vi runbook 001.

  Findings (không cái nào chặn):
  #1 [Thấp, data-integrity/ops] config/database.js:10 — autoIndex gate
     NODE_ENV!=='production'. Trên Railway (production) autoIndex=FALSE → unique
     {user,clientId} SẼ KHÔNG tự tạo. Khi đó lớp 2 (E11000) không tồn tại trên prod,
     chỉ còn lớp 1 findOne vốn có khe race → 2 Back Tap đồng thời có thể tạo 2 bản ghi.
     KHUYẾN NGHỊ: tạo index thủ công trên Atlas/Railway (hoặc chạy syncIndexes khi deploy).
     ⇒ Đây là điểm đáng theo dõi nhất, cần Ken xử lý trước khi tin vào dedupe ở prod.
  #2 [Thấp-trung, pre-existing] Account enumeration ở register (auth.js:19). Ngoài commit này.
  #3 [Thông tin] errorHandler dùng keyValue key đầu → message có thể sai
     ("User already exists" cho collision {user,clientId}). Chỉ tới được ở edge. Không lộ chéo user.

═══════════════════════════════════════════════════════════════════════════════
BÁO CÁO CUỐI — RUNBOOK 001 (chế độ xác minh trên code đã commit 794474c)
═══════════════════════════════════════════════════════════════════════════════

BỐI CẢNH: RUNBOOK 001 đã được thực thi & commit từ trước (794474c). Baseline thật là
155 pass / 3 fail (không phải 148/3). Vì vậy KHÔNG chạy task 1–6/9 (đã có trong commit);
Ken chỉ định chạy task 7 (mutation) + task 8 (checkpoint agent) để XÁC MINH.

ĐÃ XONG (kèm bằng chứng):
- Baseline: `cd trim-backend && npm test` → Tests: 3 failed, 155 passed, 158 total.
  3 fail đúng 3 cái baseline, đúng lý do cũ (bmi missing / search không phải array / bmr=0).
- Mutation A (tắt lớp 1, giữ lớp 2): dedupe test PASS (7/7) → index+lớp 2 gánh thật,
  unique index tồn tại. Khôi phục, diff sạch.
- Mutation B (tắt cả 2 lớp): dedupe test FAIL (1 failed/6 passed) → test không rỗng.
  Vỡ ở dòng 111 status===200 (nhận 400 do errorHandler lớp 3 map E11000→400).
  countDocuments===1 KHÔNG chạy tới (short-circuit) nhưng suy luận từ E11000 ⇒ vẫn đúng,
  do unique index tầng DB chặn write 2. Khôi phục cả 2 dòng, diff sạch.
- @trim-test-skeptic: xác nhận test 2 assert cả duplicate:true + countDocuments===1;
  test 7 THẬT SỰ đọc collection.indexes() cả 3 collection, có syncIndexes(), assert
  unique+partialFilterExpression, chặn sparse — không pass giả.
- @trim-security: không finding chặn. Commit sạch trên mọi hard-block.

QUYẾT ĐỊNH ĐÃ TỰ LÀM (Ken duyệt lại):
- Áp mutation lên DÒNG 138 (không phải 139 như runbook ghi) vì `if (err.code===11000)`
  thật sự ở dòng 138. Đây là sửa chỉ-số-dòng hiển nhiên, không đổi ý nghĩa mutation.
- Không chạy task 1–6/9 vì đã có trong commit 794474c (tránh trùng lặp/ghi đè).

CẦN KEN QUYẾT (khuyến nghị, KHÔNG tự làm — ngoài phạm vi runbook 001):
- [test-skeptic] Đảo thứ tự assertion trong test 2: đưa countDocuments===1 lên TRƯỚC
  status===200, để assertion load-bearing luôn được đánh giá kể cả khi status sai.
- [security #1] autoIndex TẮT trên production → tạo unique index thủ công trên Atlas
  (hoặc chạy syncIndexes lúc deploy) để lớp 2 dedupe thật sự tồn tại ở prod.
- [security #2] Account enumeration ở register (pre-existing) — cân nhắc fix riêng.

TRẠNG THÁI CÂY: sạch. quicklog.test/route không đụng (đã khôi phục hết). git status:
  M trim-app/src/screens/onboarding/RegisterScreen.js
  M trim-app/src/services/api.js
  M trim-app/src/services/auth.js   (3 file này thuộc commit khác, KHÔNG đụng)
  ?? RUN_LOG.md
Không có .env. Không thêm expires/TTL. Không cài dependency. WeightLog.date vẫn Date.

═══════════════════════════════════════════════════════════════════════════════
RUNBOOK 002 — Giai đoạn 2
═══════════════════════════════════════════════════════════════════════════════

[07:00] START — đọc RUNBOOK_002_phase2.md. Làm tuần tự Task 0→1→2 rồi DỪNG chờ Ken.

[07:00] OK — TASK 0 baseline: `cd trim-backend && npm test`
        Tests: 3 failed, 155 passed, 158 total | Test Suites: 1 failed, 4 passed, 5 total
        → KHỚP 155/3, tiếp tục. Lưu scratchpad/trim-p2-baseline.txt (ANSI stripped).
        3 test đỏ + thông điệp lỗi:
        1) Weights › POST /api/weights creates a log
           phase1.test.js:158 → expect(res.body).toHaveProperty('bmi'); body KHÔNG có bmi.
           (body có: weight, date, origin, source, user, _id — thiếu bmi)
        2) Meals › GET /api/meals/search returns results
           phase1.test.js:324 → expect(Array.isArray(res.body)).toBe(true) === false.
        3) Stats › GET /api/stats/daily aggregates meals and activities correctly
           phase1.test.js:470 → expect(res.body.bmr).toBeGreaterThan(0); nhận 0.

[07:02] OK — TASK 1: đảo thứ tự assertion trong test 2 (quicklog.test.js).
        Đưa countDocuments===1 LÊN TRƯỚC status===200. `npx jest quicklog` → 7/7 xanh.

[07:20] OK — TASK 2 (read-first, KHÔNG sửa). Báo cáo 5 mục:

  ── MỤC 1: User.js ──
  - currentStats CÓ SẴN (User.js:34-38): { weight, bmi, weightUpdatedAt }.
    → CHƯA có bmr, CHƯA có baseline (cần thêm ở Task 5).
  - email CÓ unique (User.js:4-10: `unique: true`).
  - LƯU Ý: User.js:98-99 còn thêm `userSchema.index({ email: 1 })` — index THƯỜNG,
    trùng lặp với unique index do `unique:true` sinh ra. Redundant, nên gộp/bỏ ở Task 3.

  ── MỤC 2: Totals/summary tính ở đâu ──
  - THỦ CÔNG TRONG ROUTE, không có hook. Qua utils/logHelpers.js:
    calcTotals (logHelpers.js:11), calcSummary (logHelpers.js:19).
  - Gọi tại: meals.js:173,212,241 (totals); activities.js:54,94 (summary);
    quicklog.js:93,112; patterns.js:224,242 (patterns.js:15,24 tự định nghĩa BẢN SAO
    calcTotals/calcSummary — trùng lặp logic).
  - Model MealLog.js:27-28 và ActivityLog.js:35 chỉ KHAI BÁO field totals/summary,
    KHÔNG tự tính. → Task 4 (pre('save') hook) sẽ gom về model.

  ── MỤC 3: Phân loại 3 test đỏ (CẦN KEN XÁC NHẬN) ──

  TEST 1 — Weights POST thiếu bmi (phase1.test.js:158):
    Root cause: route weights.js:21-22 chỉ tính bmi khi `req.user.profile?.height`
    tồn tại. Test user KHÔNG có profile.height vì:
      - register (auth.js:11,26) CHỈ lưu {name, email, passwordHash}, BỎ QUA height/
        dob/gender/weight dù test gửi height:165 (phase1.test.js:18) trong payload.
      - test KHÔNG gọi complete-profile → profile rỗng.
    ⇒ AMBIGUOUS — "xanh" được bằng 2 cách (đây là tiêu chí ESCALATE):
      (a) CODE thiếu: register nên nhận & lưu profile fields gửi kèm → bmi tính được.
      (b) TEST thiếu setup: test nên set profile (gọi complete-profile hoặc set trực
          tiếp profile.height) trước khi assert bmi.
    Bằng chứng cho (b): CLAUDE.md quyết định #8 "No WeightLog during /auth/register";
    luồng thật set profile qua complete-profile (users.js:62-71). Register cố tình
    tối giản. → nghiêng (b) nhưng CẦN KEN CHỐT.

  TEST 3 — Stats daily bmr=0 (phase1.test.js:470):
    Root cause: stats.js:20-24 đặt bmr=0 trừ khi có ĐỦ profile.dateOfBirth &&
    profile.height && profile.gender. Test user rỗng profile → bmr=0.
    ⇒ CÙNG ROOT CAUSE với Test 1 (register bỏ qua profile). Cùng 2 cách xanh (a)/(b).
    → Chốt chung với Test 1: quyết (a) hay (b) áp cho cả hai.

  TEST 2 — Meals search không phải array (phase1.test.js:324):
    Root cause: route trả OBJECT, không phải array. meals.js:91 `res.json({ results })`
    và meals.js:93 `res.json({ results: FALLBACK_FOODS })` (nhánh catch). Body luôn là
    {results:[...]}. Test assert `Array.isArray(res.body)`.
    ⇒ AMBIGUOUS:
      (a) CODE: đổi route trả array trực tiếp `res.json(results)`.
      (b) TEST: đổi assert sang `res.body.results` là array.
    Bằng chứng: CLAUDE.md quyết định #9 "Food search removed from UI — AI Chat là
    primary input". Search deprecated ở UI → đổi contract (a) rủi ro & giá trị thấp.
    → nghiêng (b) nhưng CẦN KEN CHỐT.

  ── MỤC 4: database.js autoIndex ──
  - database.js:10 `autoIndex: process.env.NODE_ENV !== 'production'`.
    → Prod (NODE_ENV=production) autoIndex=FALSE → index KHÔNG tự tạo trên prod.
    Đây chính là finding #1 cần xử lý ở Task 3 (gọi syncIndexes lúc khởi động).

  ── MỤC 5: WeightLog.date đọc/ghi (đầu vào cho migration Task 8) ──
  - Schema: WeightLog.js:13 `date: { type: Date }`; index WeightLog.js:44 {user:1,date:-1}.
  - GHI (write):
      weights.js:25   → date: logDate  (Date object: new Date(date) | new Date())
      quicklog.js:126 → date: new Date(date) | new Date()  (Date object)
      users.js:78     → date: today  = getTodayInTz(profile.timezone) → CHUỖI 'YYYY-MM-DD'
                        (Mongoose CAST chuỗi này thành Date lúc save)
    ⚠ KHÔNG NHẤT QUÁN sẵn: 2 nơi ghi Date object, 1 nơi ghi chuỗi (bị cast).
  - ĐỌC (read) cho LOGIC: KHÔNG có. weights.js sort theo createdAt (39,51,64), KHÔNG
    theo date. stats.js KHÔNG đọc WeightLog.date. → date hiện gần như write-only,
    chỉ xuất hiện trong response body (frontend hiển thị).
  - Index {user:1,date:-1} (WeightLog.js:44) sẽ cần rebuild nếu đổi kiểu date.
  - File dùng WeightLog: models/WeightLog.js, routes/{quicklog,users,weights}.js,
    utils/{deleteUserData,logHelpers}.js (2 utils này KHÔNG đụng field date).

[07:21] STOP (điểm dừng theo runbook) — Task 2 xong. DỪNG chờ Ken xác nhận phân loại
        3 test đỏ (Test 1 & 3 chung quyết định (a)/(b); Test 2 quyết (a)/(b) riêng)
        TRƯỚC khi làm Task 3→8. Cây sạch (chỉ có sửa Task 1 + 3 file FE modified sẵn).

[08:00] DEC (Ken chốt) — phân loại 3 test đỏ:
  - Test 1 & 3 → (b) sửa TEST setup, seed profile đầy đủ (height, dateOfBirth, gender)
    trước assert. ĐK CỨNG: test phải assert CẢ HAI chiều:
      (i) user KHÔNG profile → bmi/bmr vắng hoặc 0;
      (ii) user CÓ profile đầy đủ → bmi/bmr ra giá trị ĐÚNG ≠ 0 (từ utils/bmr.js).
    Nếu seed đủ mà vẫn sai → DỪNG, bug code thật, báo cáo.
  - Test 2 → (b) sửa test expect res.body.results.
  Nhắc: Task 3 gộp/bỏ index {email:1} thừa (User.js:99) trùng unique:true (dòng 7).
  Task 8 chuẩn hoá cả 3 nơi ghi WeightLog.date về chuỗi 'YYYY-MM-DD', DRY-RUN rồi PARK.

[08:01] START — TASK 3 (unique index + tự tạo trên production).

[08:10] OK — TASK 3 (unique index + tự tạo trên production).
  - Bỏ index THỪA `userSchema.index({ email: 1 })` (User.js cũ dòng 99) — email đã có
    unique index do `unique:true`. Thay bằng comment giải thích, không tạo index trùng.
  - Thêm `syncAllIndexes()` vào config/database.js (export riêng), gọi trong connectDB
    SAU khi connect thành công, GUARD `NODE_ENV !== 'test'`. Bọc try/catch để lỗi sync
    không làm sập server đã kết nối. syncIndexes cho 4 model: User, MealLog, ActivityLog,
    WeightLog. Log ra JSON tên index đã sync.
  - Test mới src/__tests__/indexes.test.js (2 test, giả lập production autoIndex=false):
    (1) autoIndex=false → User chỉ có _id_ index (index tuỳ biến KHÔNG tự tạo) — √
    (2) sau syncAllIndexes(): email đúng 1 unique index (không trùng), và cả 3 log model
        có {user:1,clientId:1} unique + partialFilterExpression (không sparse) — √
  - `npx jest indexes` → 2 passed, 2 total. Finding #1 xử lý xong.

[08:20] OK — TASK 4 (pre('save') totals/summary hook).
  - MealLog.js: thêm `mealLogSchema.pre('save', ...)` gọi calcTotals(this.items) — tái
    dùng logHelpers, KHÔNG viết lại công thức. Import { calcTotals } ở đầu file.
  - ActivityLog.js: thêm `pre('save')` gọi calcSummary(this.entries). Import { calcSummary }.
  - Kiểm require cycle: MealLog→logHelpers→User→mongoose (User không require MealLog) →
    KHÔNG vòng. OK.
  - Test mới src/__tests__/hooks.test.js (3 test): tạo doc KHÔNG set totals/summary →
    sau save hook tính đúng (meal 500cal; activity 330cal/50min); và test totals thủ công
    sai bị hook ghi đè về đúng. `npx jest hooks` → 3 passed.
  - MUTATION: thêm `+1` vào calcTotals.calories → 2 meal test FAIL (Expected 500 got 501,
    Expected 78 got 79), activity test độc lập vẫn PASS → test KHÔNG rỗng. Khôi phục
    logHelpers.js, git diff sạch, chạy lại 3 passed.

[08:35] OK — TASK 5 (currentStats.bmr + baseline trên User).
  - PHÁT HIỆN BUG ẨN: complete-profile (users.js) ĐÃ ghi currentStats.bmr/baseline,
    NHƯNG schema currentStats (User.js) THIẾU 2 field này → Mongoose strict âm thầm
    loại bỏ khi lưu → bmr/baseline KHÔNG persist. Đã thêm bmr:Number, baseline:Number
    vào schema currentStats (User.js).
  - Thêm helper syncCurrentStatsBmr(userId) trong logHelpers.js: đọc user mới nhất,
    tính qua calculateBMRFromUser + calculateBaseline (utils/bmr.js — KHÔNG viết lại
    công thức). Thiếu dữ liệu (null) → KHÔNG ghi (bmr vắng, đúng yêu cầu Ken chiều (i)).
  - Chain syncCurrentStatsBmr vào syncCurrentStatsWeight (weight đổi → bmr đổi). Bây giờ
    POST /weights + quicklog weight tự cập nhật bmr. Thêm gọi ở PUT /me (profile đổi).
  - Kiểm cycle: logHelpers→bmr (bmr không require gì) — không vòng.
  - Test mới src/__tests__/currentstats-bmr.test.js (3 test, assert CẢ HAI chiều):
    (ii) user đủ profile → bmr/baseline == giá trị tính độc lập từ bmr.js, ≠ 0 — √
    (i)  user thiếu profile → bmr/baseline undefined — √
    thiếu weight → không ghi — √. `npx jest currentstats-bmr` → 3 passed.
    (Assertion load-bearing: nếu helper không ghi, bmr undefined ≠ expected → fail.)

[08:50] START — TASK 6 (3 test đỏ → xanh).
  - Test 2 (search): sửa test → expect res.body.results (array). XANH.
  - Test 1 (weights bmi): thêm user P có profile đầy đủ (seed trong beforeAll); tách 2 test:
    (ii) tokenP có profile → bmi đúng công thức ≠ 0; (i) tokenA không profile → bmi undefined.
    Cả hai XANH. `npx jest phase1` → chỉ còn Test 3 đỏ.

[08:52] ESCALATE — TASK 6 Test 3 (stats bmr). Ken chốt (b) seed profile, ĐK cứng:
  "seed profile mà bmr/bmi vẫn sai → DỪNG báo cáo". Sau khi seed profile (bmr>0):
    - Assertion bmr>0 (phase1:504) sẽ PASS (bmr đúng).
    - NHƯNG assertion tdee (phase1:506) `tdee === bmr + caloriesBurned` sẽ FAIL.
  Bằng chứng thực nghiệm (tính từ chính utils/bmr.js, user weight60/h165/female/age36):
    bmr=1290, baseline=258, burned=250.
    CODE tdee = calculateTDEE = bmr+baseline+burned = 1798.
    TEST kỳ vọng   = bmr+burned = 1540.  → lệch đúng bằng baseline (258). MATCH=false.
  Mâu thuẫn nguồn sự thật:
    - CLAUDE.md dòng 225 "TDEE = BMR + logged_activity_calories (preferred)" → KHỚP TEST (không baseline).
    - CLAUDE.md dòng 91 activity card "BMR/Baseline/Burned/TDEE" → baseline LÀ thành phần TDEE → KHỚP CODE.
    - bmr.js calculateTDEE cộng baseline (bmr+baseline+burned) → KHỚP CODE.
  ⇒ Test 3 xanh được 2 cách (đúng tiêu chí ESCALATE):
    (a) sửa TEST: tdee === bmr + baseline + burned (code là nguồn sự thật). Localized, không đổi product.
        (baseline chưa có trong response stats → phải expose hoặc tính lại trong test.)
    (b) sửa CODE bmr.js: bỏ baseline khỏi calculateTDEE (khớp doc #7). Blast radius LỚN:
        calculateTDEE dùng ở stats.js:27, users.js:94 & 141 (dailyCalorieTarget của
        complete-profile + goal update) → đổi calorie target của MỌI user. Không test nào
        khác assert giá trị tdee tuyệt đối (chỉ Test 3), nên rủi ro test thấp; rủi ro PRODUCT cao.
  → Gọi @trim-manager quyết. Chưa đụng Test 3 (vẫn ở trạng thái đỏ gốc, cây sạch phần đó).

[09:10] DEC (@trim-manager) — Test 3 → HƯỚNG (a): sửa TEST cho khớp CODE.
  Lý do: baseline là feature ĐANG SHIP thật, không phải loose end — persist ở
  User.js:38, ghi mỗi lần weight/profile đổi (logHelpers), trả bởi complete-profile
  (users.js:123), hiển thị activity card (CLAUDE.md:91), có test riêng
  (currentstats-bmr.test.js:57-61). Doc CLAUDE.md:225 / Key Decision #7 LỖI THỜI
  (viết trước khi baseline được thêm). Dòng 506 cũ chỉ pass vì bmr=0→baseline=0,
  nó CHƯA BAO GIỜ validate mô hình no-baseline. Option (b) đổi công thức = blast
  radius rộng (calorie target mọi user) = vượt thẩm quyền, chỉ Ken quyết → không làm.
  KHÔNG expose baseline trong response stats.js (ngoài phạm vi Task 6, test lấy
  baseline từ bmr.js — nguồn sự thật). Ken's STOP KHÔNG kích hoạt: bmr đã đúng (>0),
  lỗi là assertion tdee lỗi thời, không phải bug bmr/bmi.
  ⚠ DOC DEBT (cần Ken, KHÔNG tự sửa canon): CLAUDE.md:225 + Key Decision #7 mâu thuẫn
  code. Ghi lại để người sau không "sửa code ngược về dòng doc lỗi thời".

[09:12] OK — TASK 6 hoàn tất (theo quyết định (a)):
  - Test 3: chuyển sang tokenP (có profile) → bmr>0; sửa assertion tdee thành
    `tdee === bmr + calculateBaseline(bmr) + burned` (import calculateBaseline từ bmr.js).
    Thêm test chiều (i): tokenA không profile → bmr===0 + warning PROFILE_INCOMPLETE.
  - `npx jest phase1` → 43 passed. Full suite → Test Suites: 8 passed; Tests: 168 passed, 0 fail.
  - Nguyên nhân gốc từng test (ghi rõ, KHÔNG sửa test cho khớp code sai):
    * Test 1 (weights bmi) XANH vì: test seed profile.height (register không lưu profile;
      luồng thật qua complete-profile) → route tính được bmi. Bug là TEST SETUP thiếu.
    * Test 2 (search array) XANH vì: route trả {results:[...]} (contract thật, search đã
      gỡ khỏi UI #9); test cũ assert array top-level lỗi thời → sửa expect res.body.results.
    * Test 3 (stats bmr) XANH vì: (a) seed profile → bmr đúng; (b) assertion tdee lỗi thời
      (thiếu baseline) sửa cho khớp mô hình baseline đang ship. KHÔNG đổi code product.
  - GOAL "≥158 pass / 0 fail" → ĐẠT (168/0).

[09:30] AGENT/@trim-security — soi toàn bộ diff GĐ2. KHÔNG có finding mức CHẶN → Task 7 không STOP.
  Checklist: (1) TTL/expires MỚI: SẠCH (bmr/baseline là Number thuần, không index).
  (2) .env/secret: SẠCH. (3) bỏ index {email:1}: an toàn (email vẫn unique do unique:true).
  (4) syncCurrentStatsWeight async: mọi caller await đúng (weights.js:28, quicklog.js:145,
  users.js:53) — không fire-and-forget, không race. (5) hook macro không chặn âm/lớn: LOW self-data.
  Findings:
    F1 [HIGH ops, KHÔNG chặn] syncIndexes() tự chạy lúc boot DROP index không có trong schema
       → có thể xoá nhầm index tạo tay trên Atlas mỗi lần deploy. (Khác vụ TTL: không mất
       document, phục hồi được.)
    F2 [LOW] Template thiếu trong OWNING_MODELS → index Template không tạo trên production.
    F3 [LOW self-data] hook không chặn macro âm/khổng lồ.
  → XỬ LÝ F1 + F2 NGAY (nằm trong database.js — file Task 3 của tôi):
    - F1: đổi syncAllIndexes dùng `createIndexes()` thay `syncIndexes()`. createIndexes CHỈ
      tạo index thiếu, KHÔNG drop → bỏ hẳn footgun xoá metadata, an toàn chạy tự động boot.
    - F2: thêm 'Template' vào OWNING_MODELS + require Template trong connectDB.
    - Cập nhật indexes.test.js: require Template, expect 5 model. `npx jest indexes` → 2 passed.
    - F3: để nguyên (LOW self-data, đúng đánh giá — chỉ lệch số của chính user).

[09:35] AGENT/@trim-test-skeptic — soi test mới GĐ2. Cả 3 test (indexes, hooks, currentstats-bmr)
  + phase1 tdee đều LOAD-BEARING, KHÔNG rỗng:
    - indexes: chứng minh index TẠO bởi syncAllIndexes (nếu no-op → chỉ _id_ → fail); assert
      unique+partialFilterExpression, không sparse.
    - hooks: mọi assert trên GIÁ TRỊ số; gỡ hook → totals=0 → fail (khớp mutation +1 tôi đã chạy).
    - currentstats-bmr: kỳ vọng tính độc lập từ bmr.js; chiều (i) undefined là bằng chứng thật;
      afterEach chạy SAU assertion nên không che.
    - phase1 tdee: LOAD-BEARING nhưng YẾU (self-referential) — bắt được nếu stats bỏ baseline,
      NHƯNG mù với đổi BASELINE_RATIO và lỗi GIÁ TRỊ bmr (bmr ở cả hai vế; suite chỉ assert bmr>0).
  Điểm yếu hệ thống: không test nào neo hằng số công thức (Mifflin, BASELINE_RATIO) vào literal.
  → GIA CỐ: thêm src/__tests__/bmr.test.js (9 test) — ground-truth literal thuần, không phụ
    thuộc ngày: BASELINE_RATIO===0.2, calculateBMR male/female/other literal, calculateBaseline,
    calculateTDEE. Đổi hệ số công thức => test này FAIL (đóng blind spot cho cả phase1 & currentstats-bmr).
  (Không thêm literal bmr vào phase1 vì calculateAge dùng new Date() thật → literal sẽ giòn theo
   ngày; bmr.test.js truyền age trực tiếp nên ổn định. Đây là lựa chọn có chủ đích.)

[09:36] OK — TASK 7 hoàn tất. Full suite sau gia cố: Test Suites 9 passed; Tests 174 passed, 0 fail.
  Không có finding chặn. F1/F2 đã siết. Test mù được đóng bằng bmr.test.js.

[09:50] START — TASK 8 (WeightLog.date migration — ESCALATE, DRY-RUN rồi PARK).

[09:52] OK — Phần CODE (schema + read/write sites + test):
  - WeightLog.js: date đổi Date -> String (bỏ default Date.now). Comment giải thích
    'YYYY-MM-DD' sort từ điển == thời gian nên index {user,date:-1} vẫn đúng.
  - weights.js:20 sửa `new Date(date)|new Date()` -> `date || getTodayInTz(tz)` (chuỗi).
    Import getTodayInTz.
  - quicklog.js:126 weight branch sửa `new Date(date)|new Date()` -> `day` (chuỗi đã tính).
    Cập nhật comment cũ ("date kiểu Date khác 2 model kia" — không còn đúng).
  - users.js:78 (complete-profile) ĐÃ ghi chuỗi getTodayInTz — không cần đổi.
  - Không test nào assert định dạng WeightLog.date; history sort theo createdAt → an toàn.
  - Full suite sau schema change: 174 passed, 0 fail (KHÔNG làm test đỏ → không chạm
    điều kiện PARK-cả-task-8 của runbook).

[09:54] OK — Migration script scripts/migrate-weightdate.js:
  - MẶC ĐỊNH --dry-run (chỉ đếm + in mẫu, KHÔNG ghi). Phải --apply tường minh mới ghi.
  - Dùng native collection, filter { date: { $type: 'date' } } (chỉ doc Date, bỏ chuỗi →
    idempotent). Chuyển đổi Date -> UTC 'YYYY-MM-DD' (toISOString().slice(0,10)).
    Ghi rõ caveat: doc tạo bằng `new Date()` không có tz-info → lấy ngày UTC là xấp xỉ.
  - Export { migrate, toDateString } để test gọi được; CLI chỉ chạy khi require.main===module.
  - Test src/__tests__/migrate-weightdate.test.js (4 test): dry-run đếm đúng + không ghi;
    apply đổi đúng Date->chuỗi & không đụng chuỗi sẵn; idempotent (apply lần 2 matched=0);
    toDateString UTC. → 4 passed.

[09:56] OK — DRY-RUN thật (read-only, được phép theo STOP LIST #4; KHÔNG apply):
  `node scripts/migrate-weightdate.js --dry-run` kết nối .env MONGODB_URI:
    Document có date kiểu Date (cần đổi): 1
    Mẫu: 69fbd467500de8987bd14b7f  2026-05-06T23:53:11.691Z  ->  '2026-05-06'
  ⚠ Doc này tạo bằng `new Date()` (giờ 23:53 UTC) → nếu user ở tz phía tây UTC, ngày local
    có thể là 2026-05-06 (khớp) nhưng cần Ken rà nếu muốn chính xác tuyệt đối theo tz.

[09:57] PARK — TASK 8 apply. KHÔNG chạy --apply (chạm dữ liệu người dùng thật, ngoài thẩm
  quyền runner). Migration SẴN SÀNG. Cần Ken:
    1) Backup collection weightlogs.
    2) Chạy `node scripts/migrate-weightdate.js --apply` (đổi 1 document).
    3) Deploy code (schema=String) CÙNG hoặc SAU khi apply — KHÔNG deploy schema trước khi
       apply, vì doc Date còn lại sẽ bị Mongoose cast xấu khi đọc.
  Phần code schema/script/test để ở working tree (CHƯA commit — runbook 002 không có bước commit).

═══════════════════════════════════════════════════════════════════════════════
BÁO CÁO CUỐI — RUNBOOK 002 (Giai đoạn 2)
═══════════════════════════════════════════════════════════════════════════════

ĐÃ XONG (kèm bằng chứng):
- TASK 0 baseline 155/3 (khớp). TASK 1 đảo assertion quicklog test → 7/7.
- TASK 2 read-first 5 mục → Ken chốt phân loại 3 test đỏ.
- TASK 3 unique index + tự tạo production: bỏ index email thừa; syncAllIndexes dùng
  createIndexes() (KHÔNG drop — siết F1) cho 5 model gồm Template (F2); guard test.
  indexes.test.js 2/2 (giả lập autoIndex=false).
- TASK 4 pre('save') hook MealLog/ActivityLog: hooks.test.js 3/3 + mutation (+1 → 2 test
  FAIL) chứng minh không rỗng.
- TASK 5 currentStats.bmr+baseline: phát hiện & sửa bug schema strict-strip (thêm field vào
  User.js); helper syncCurrentStatsBmr chain vào weight/profile update; currentstats-bmr.test.js
  3/3 assert CẢ HAI chiều từ bmr.js.
- TASK 6 ba test đỏ → xanh, đúng nguyên nhân gốc:
  * Test 1 (weights bmi): TEST thiếu setup profile → seed profile.height; assert 2 chiều.
  * Test 2 (search): route trả {results} (contract thật, #9) → sửa test expect res.body.results.
  * Test 3 (stats bmr): seed profile → bmr đúng; assertion tdee lỗi thời (thiếu baseline) sửa
    khớp mô hình baseline đang ship — QUYẾT ĐỊNH @trim-manager (a). Doc #7 stale (doc debt).
- TASK 7 checkpoint: @trim-test-skeptic (tất cả test LOAD-BEARING; gia cố bmr.test.js 9 test
  neo hằng số công thức) + @trim-security (KHÔNG finding chặn; F1/F2 đã siết; F3 low self-data).
- TASK 8 code migration + script + dry-run: 1 document cần đổi.
- FULL SUITE CUỐI: Test Suites 10 passed; Tests 178 passed, 0 fail.

ĐÃ PARK (cần Ken quyết/hành động):
- TASK 8 --apply: backup + chạy --apply (1 doc) + deploy schema cùng/sau apply. Chưa apply.
- DOC DEBT: CLAUDE.md:225 + Key Decision #7 ("TDEE = BMR + logged") LỖI THỜI, mâu thuẫn code
  (TDEE = BMR + baseline + logged). Cần Ken sửa canon (không tự sửa file canon).
- SECURITY F3 (low, self-data): hook không chặn macro âm/khổng lồ — để sau, không chặn.
- Timezone edge của doc migration (tạo bằng new Date() lúc 23:53 UTC) — Ken rà nếu cần chính xác tz.

QUYẾT ĐỊNH ĐÃ TỰ LÀM (Ken duyệt lại):
- Escalate Test 3 tới @trim-manager (đúng tiêu chí runbook), theo quyết định (a) sửa test.
- Siết F1 ngay: syncIndexes → createIndexes (an toàn hơn, vẫn đạt goal "tự tạo trên production");
  thêm Template vào OWNING_MODELS (F2). Nằm trong file Task 3, HIGH ops finding → sửa luôn.
- Gia cố test bằng bmr.test.js (khuyến nghị test-skeptic) — đóng blind spot hằng số công thức.
- Không commit gì (runbook 002 không có bước commit) — mọi thay đổi ở working tree cho Ken review.

GOAL — từng dòng:
[x] Backend ≥158 pass / 0 fail → 178 passed, 0 fail.
[x] 3 test đỏ xanh vì đúng nguyên nhân gốc (đã chẩn đoán + ghi log), KHÔNG sửa test cho khớp code sai.
[x] Unique index tồn tại + tự tạo được trên production (createIndexes lúc boot + indexes.test.js).
[x] pre('save') hook totals cho MealLog & ActivityLog, có test + mutation.
[x] currentStats.bmr & baseline ghi trên User, có test (2 chiều).
[x] .env KHÔNG trong git status (đã verify).
[x] 3 file FE (api.js, auth.js, RegisterScreen.js) vẫn modified, CHƯA commit.
[x] WeightLog.date migration: dry-run xong (1 doc), PARK chờ Ken (KHÔNG apply).

Bằng chứng số: full suite `Test Suites: 10 passed, 10 total | Tests: 178 passed, 178 total`.

═══════════════════════════════════════════════════════════════════════════════
RUNBOOK 003 — Giai đoạn 1c (validation, password, anti-enum, lockout)
═══════════════════════════════════════════════════════════════════════════════

[10:30] START — đọc RUNBOOK_003_phase1c.md. Làm Task 0 → 2 rồi DỪNG chờ Ken.

[10:30] OK — TASK 0 baseline: Tests 178 passed, 0 fail; Test Suites 10 passed. KHỚP 178/0.
        Working tree sạch (chỉ RUNBOOK_003_phase1c.md untracked). Lưu scratchpad/trim-p1c-baseline.txt.

[10:40] OK — TASK 2 (read-first, KHÔNG sửa). Báo cáo 5 mục:

  ── MỤC 1: auth.js register/login hiện trả gì ──
  - Register email TRÙNG: auth.js:18-20 → 400 "User already exists"
    (findOne kiểm TƯỜNG MINH TRƯỚC khi save). → VECTOR ENUMERATION: nói rõ email đã tồn tại.
  - Login SAI EMAIL: auth.js:51-53 → 401 "Invalid credentials" (return SỚM, KHÔNG chạy bcrypt).
  - Login SAI MẬT KHẨU: auth.js:56-58 → 401 "Invalid credentials" (sau bcrypt.compare).
  - Nhận xét: login ĐÃ cùng message+status cho 2 nhánh. NHƯNG (a) message là "Invalid
    credentials" (Task 5 muốn "Invalid email or password"); (b) TIMING LEAK: nhánh sai email
    bỏ qua bcrypt → thời gian phản hồi khác nhánh sai mật khẩu → lộ email tồn tại qua timing.

  ── MỤC 2: Validation hiện có ──
  - THỦ CÔNG INLINE trong từng route, KHÔNG có middleware validation dùng chung.
    weights.js:17; quicklog.js:43-58; meals.js:165-200; activities.js:39-50.
  - package.json KHÔNG có zod, KHÔNG có express-validator. (zod được Ken pre-approve trong runbook.)

  ── MỤC 3: Rate limiter ──
  - app.js:27-32 `limiter` max 100/15min áp `/api/` (mọi route).
  - app.js:34-39 `authLimiter` max 5/15min (test: 10000) áp `/api/auth` — RIÊNG, chặt hơn.
    Đặt TRƯỚC khi mount routes. → auth ĐÃ được rate-limit. (GOAL "rate limit áp cho auth" đã đạt sẵn.)

  ── MỤC 4: User.js lockout fields ──
  - CHƯA có failedLoginAttempts, CHƯA có lockUntil → cần thêm (Task 6).
  - refreshTokens: [{ token: String, createdAt: Date (KHÔNG expires — có comment cảnh báo
    TTL trên mảng xoá cả user, vụ 18-account) }].
  - currentStats: { weight, bmi, bmr, baseline, weightUpdatedAt }. email unique. onboardingCompleted.
    Không còn index {email:1} thừa (đã dọn GĐ2). → thêm 2 field lockout là an toàn, không đụng mảng.

  ── MỤC 5: errorHandler.js đường E11000 ──
  - errorHandler.js:13-18: err.code===11000 → 400 "<Field> already exists" (vd "Email already exists").
  - Register duplicate HIỆN KHÔNG rơi vào đây (findOne tường minh chặn trước, trả 400 "User already
    exists"). NHƯNG nếu bỏ findOne, unique index ném E11000 khi save → errorHandler → "Email already
    exists" (VẪN lộ). → đường race cũng là vector enum.
  - Ngoài ra errorHandler.js:5-11: Mongoose ValidationError → 400 kèm mảng `errors` (echo message
    validation) — cần chú ý khi thiết kế message an toàn ở Task 3 (không echo giá trị nhạy cảm).

[10:41] STOP (điểm dừng bắt buộc) — Task 2 xong. DỪNG chờ Ken xác nhận:
  (a) đồng ý dùng zod cho lớp validation?
  (b) hướng chống enumeration cho REGISTER (Task 6):
      - Hướng (a): GIỮ reject duplicate, đảm bảo KHÔNG rò qua global 400 khác lạ + rate limit chặt.
        (Login đã generic; register vẫn nói "đã tồn tại" nhưng có rate limit 5/15min chặn dò hàng loạt.)
      - Hướng (b): đổi register → 200 generic "check your email" — NHƯNG cần email verification
        (CHƯA có, thuộc GĐ1d). Nếu Ken chọn (b) mà chưa có verify → PARK phần register anti-enum,
        làm (a) tạm, ghi log.
      Runner NGHIÊNG (a) vì (b) cần hạ tầng email verify chưa tồn tại; nhưng đây là quyết định của Ken.
  Cây sạch, chưa sửa file nào.

[11:00] DEC (Ken chốt) — tiếp tục tới GOAL, không dừng hỏi (trừ STOP/ESCALATE):
  - zod: DÙNG.
  - LOGIN: giữ message "Invalid credentials" (đã generic, KHÔNG đổi chữ). Vá TIMING LEAK:
    luôn chạy bcrypt.compare với hash giả cố định khi email không tồn tại → thời gian 2 nhánh
    bằng nhau. Test khẳng định 2 nhánh giống nhau về message+status (và bcrypt luôn được gọi nếu test được).
  - REGISTER anti-enum = hướng (a): giữ message thân thiện "This email is already registered" (UX).
    Anti-enum ĐẦY ĐỦ DEFER sang GĐ1d (cần email verification). Mitigation hiện tại = rate limit
    (authLimiter 5/15min) — xác nhận áp cho register. KHÔNG tốn effort giấu tồn tại ở register.

[11:01] START — cài zod (pre-approved) + khảo sát test deps trước khi code.

[11:20] OK — TASK 3/4/5/6 code:
  - Cài zod ^4.4.3 (pre-approved). Tạo src/validation/schemas.js (register, login, meal,
    activity, weight, quicklog) + src/middleware/validate.js (safeParse → 400 {message,errors};
    KHÔNG echo giá trị nhạy cảm; replace req.body chỉ cho auth để normalize email).
  - Áp validate: auth register/login (replace), meals/activities/weights/quicklog POST / (gate).
    Giữ nguyên validation thủ công cũ ở write routes (defense-in-depth; zod chặn trước).
  - TASK 4 password strength trong registerSchema: >=8 ký tự + có chữ + có số. Message rõ.
  - TASK 5 login timing-safe: LUÔN bcrypt.compare (DUMMY_HASH cùng cost khi email không tồn tại).
    Giữ message "Invalid credentials" (Ken: không đổi chữ). Hai nhánh sai-email/sai-mật-khẩu
    trả GIỐNG HỆT 401 + message.
  - TASK 6 lockout: thêm failedLoginAttempts + lockUntil (Date thường, KHÔNG expires/TTL) vào User.
    5 sai liên tiếp → lockUntil = now+15min (env chỉnh được), reset đếm. Đang khoá → 401 generic
    (không lộ trạng thái khoá). Login đúng → reset. REGISTER anti-enum = (a): message thân thiện
    "This email is already registered"; anti-enum ĐẦY ĐỦ DEFER GĐ1d (email verification).
  - Đổi test duplicate assertion phase1:128 /already exists/ → /already registered/ (message mới).
  - Full suite sau code: 178 passed, 0 fail (KHÔNG regression).

[11:30] OK — Test mới src/__tests__/auth-security.test.js (16 test), full suite 194 passed / 0 fail:
  - validation (5): thiếu field/sai email/thiếu password → 400; message KHÔNG echo password; hợp lệ → 201.
  - password strength (4): <8 / thiếu số / thiếu chữ → 400; đạt → 201.
  - login generic+timing (3): sai-email & sai-mật-khẩu CÙNG 401+message; email không tồn tại VẪN
    gọi bcrypt.compare (spy, timing-safe); đúng → 200.
  - lockout (3): 5 sai → khoá, lần 6 dù đúng vẫn 401 generic + lockUntil tương lai; login đúng reset
    đếm; lockUntil quá khứ → login đúng lại được.
  - register anti-enum (1): trùng → 400 "This email is already registered".
  MUTATION (runbook Task 7 yêu cầu): phá nhánh no-user trả 404 khác → test "hai nhánh giống nhau"
  FAIL (Expected 401, Received 404) → test KHÔNG rỗng. Khôi phục auth.js, xác nhận test xanh lại.

[11:45] AGENT/@trim-security — soi diff GĐ1c. KHÔNG có finding CHẶN → Task 7 không STOP.
  Checklist: (1) TTL/expires: PASS — lockUntil là Date thường KHÔNG expires (không TTL, không xoá
  user); failedLoginAttempts Number không index. (2) .env/secret: PASS — DUMMY_HASH là hash của
  chuỗi public, không phải secret. (3) validation bypass: PASS — mọi route ghi trong scope đã áp
  validate; message không echo giá trị nhạy cảm. (4) enum: login generic + timing-safe (message+
  status+đường bcrypt đồng nhất; locked cũng 401 y hệt); authLimiter 5/15min XÁC NHẬN áp
  /api/auth/register; không có route forgot/reset leak. (5) lockout tự hết sau cửa sổ (thuần tính
  toán, không cron), reset persist. (6) DUMMY_HASH cùng cost factor với hash thật.
  Findings LOW/INFO (defer, không chặn):
    F1 [LOW] residual timing enum: nhánh user-thật-sai-mật-khẩu chạy thêm user.save() (1 write)
       còn nhánh no-user thì không → chênh latency. bcrypt cost 12 áp đảo nên tín hiệu yếu.
    F2 [LOW] account-lockout DoS self-healing (authLimiter chặn single-IP, khoá tự hết 15min).
    F3 [INFO, pre-existing, ngoài diff] app.js chưa set 'trust proxy' → rate-limit key IP có thể
       sai sau proxy Railway (làm yếu mitigation enum register + F2). Cần Ken xử lý khi deploy.

[11:48] AGENT/@trim-test-skeptic — 16/16 test auth-security đều LOAD-BEARING. Xác nhận:
  - #10 (hai nhánh giống nhau): so sánh CHÉO hai response (status+message) + pin tuyệt đối 401/
    "Invalid credentials" — khớp mutation no-user→404 tôi đã chạy (FAIL đúng).
  - #11 (timing-safe): compare gọi đúng 1 lần với DUMMY_HASH; khôi phục early-return → 0 lần → FAIL.
  - #13/#14/#15 lockout: bỏ lockout → lần 6 thành 200 → FAIL; #15 chứng minh cửa sổ TỰ HẾT
    (lockUntil quá khứ → isLocked=false); #14 là test DUY NHẤT pin reset-đếm.
  - #16 duplicate: assert ĐÚNG message "This email is already registered" (không chỉ status) → nếu
    bỏ app-check, rơi vào E11000 "Email already exists" → FAIL. Tránh đúng bẫy two-layer.
  Gap gia cố (đã áp):
  - #11: thêm assert tham số 2 của compare là HASH BCRYPT thật (/^\$2[aby]\$\d{2}\$/) — chặn hồi
    quy về dummy rỗng/plaintext/rẻ (đóng đúng invariant timing-safety).
  - #2,#6,#7,#8: thêm assert message === 'Validation failed' (fail đúng lý do, không phải 400 bất kỳ).
  Full suite sau gia cố: 194 passed, 0 fail.

[11:52] OK — TASK 8 commit: `508e96d feat(auth): input validation (zod), password rules,
  generic login, account lockout, anti-enumeration`. .env KHÔNG trong staged (verify). Commit
  body ghi rõ DEFER (register full anti-enum → GĐ1d) + security LOW/INFO deferred.

═══════════════════════════════════════════════════════════════════════════════
BÁO CÁO CUỐI — RUNBOOK 003 (Giai đoạn 1c)
═══════════════════════════════════════════════════════════════════════════════

ĐÃ XONG (bằng chứng: số + tên test):
- TASK 0 baseline 178/0. TASK 2 read-first → Ken chốt (zod: dùng; login giữ "Invalid
  credentials" + vá timing; register anti-enum hướng a).
- TASK 3 validation zod: middleware/validate.js + validation/schemas.js áp register, login,
  meals, activities, weights, quicklog POST. Test: "register thiếu field/sai email → 400",
  "login thiếu password → 400", "message KHÔNG echo password", "body hợp lệ → 201".
- TASK 4 password strength (≥8 + chữ + số): test "<8 / thiếu số / thiếu chữ → 400", "đạt → 201".
- TASK 5 login generic + timing-safe: LUÔN bcrypt.compare (DUMMY_HASH cùng cost). Test
  "sai email VÀ sai mật khẩu → CÙNG message+status" (load-bearing, mutation no-user→404 FAIL);
  "email không tồn tại VẪN gọi compare với hash bcrypt thật" (gia cố regex $2[aby]).
- TASK 6 lockout: failedLoginAttempts + lockUntil (Date thường, KHÔNG TTL). Test "5 sai → khoá,
  lần 6 dù đúng vẫn 401 generic + lockUntil tương lai", "login đúng reset đếm", "lockUntil quá
  khứ → login lại được (cửa sổ tự hết)". Register anti-enum (a): test "trùng → 400 'This email
  is already registered'" (không rơi vào E11000 handler).
- TASK 7 checkpoint: @trim-test-skeptic (16/16 LOAD-BEARING, đã gia cố #11 + #2/#6/#7/#8);
  @trim-security (KHÔNG finding chặn; F1/F2/F3 LOW/INFO defer).
- FULL SUITE CUỐI: Test Suites 11 passed; Tests 194 passed, 0 fail (178 cũ + 16 mới).

ĐÃ PARK / DEFER (cần Ken):
- Register anti-enum ĐẦY ĐỦ (giấu tồn tại) → GĐ1d, cần email verification. Hiện dùng hướng (a):
  message thân thiện + rate limit. (Ken đã chốt.)
- Security F1 (LOW): residual write-timing enum (user.save() chỉ ở nhánh sai-mật-khẩu). Defer.
- Security F2 (LOW): account-lockout DoS self-healing. Defer.
- Security F3 (INFO, pre-existing): app.js chưa set 'trust proxy' → rate-limit key IP sai sau
  proxy Railway. Nên set trước khi tin vào authLimiter trên prod. Ngoài diff GĐ1c.

QUYẾT ĐỊNH ĐÃ TỰ LÀM (Ken duyệt lại):
- Giữ validation thủ công cũ ở write routes song song zod (defense-in-depth) thay vì gỡ (giảm rủi ro).
- Áp zod chỉ cho route trong scope runbook (auth + 4 write route); KHÔNG đụng templates (ngoài scope,
  có test assert message riêng).
- Gia cố 2 test theo khuyến nghị test-skeptic (đóng invariant timing-safety + fail đúng lý do).
- LƯU Ý message login: GOAL nêu "Invalid email or password" nhưng Ken CHỐT giữ "Invalid credentials"
  (đã generic, không lộ tồn tại). Bản chất anti-enum (2 nhánh giống hệt) ĐẠT; chỉ khác chữ theo ý Ken.

GOAL — từng dòng:
[x] Route auth + route ghi chính validate input, 400 + message an toàn khi malformed.
[x] Register password mạnh (≥8 + chữ + số), có test.
[x] Login generic cho CẢ sai email LẪN sai mật khẩu (cùng message+status), timing-safe, có test
    chứng minh 2 nhánh giống nhau. (Message = "Invalid credentials" theo Ken, không phải chữ trong GOAL.)
[x] Khoá tài khoản sau 5 lần sai trong cửa sổ 15min, có test.
[x] Register không rò qua global 400 handler (app-check trả friendly 400 trước E11000; test #16).
[x] Rate limit xác nhận áp cho route auth (authLimiter 5/15min /api/auth, gồm register).
[x] Toàn bộ test xanh (194, 0 fail); @trim-security KHÔNG finding chặn.
[x] Đã commit (508e96d); .env KHÔNG trong git.

Bằng chứng số: `Test Suites: 11 passed | Tests: 194 passed, 194 total`. Commit 508e96d.

═══════════════════════════════════════════════════════════════════════════════
RUNBOOK 004 — Deploy hardening + RefreshToken security
═══════════════════════════════════════════════════════════════════════════════

[12:00] START — Phase 1 (an toàn) trước. P1.0 baseline: 194 passed, 0 fail. Tree sạch. Tiếp.

[12:10] OK — PHASE 1 code:
  - P1.1 app.js: `app.set('trust proxy', 1)` TRƯỚC rate limiter. Giá trị 1 (1 hop), KHÔNG `true`
    (tránh spoof X-Forwarded-For lách rate limit). Verify runtime: app.get('trust proxy')===1.
  - P1.2 verify prod index sync: đọc database.js — connectDB guard `NODE_ENV!=='test'` → production
    CHẠY syncAllIndexes (autoIndex off). Test deploy-config chứng minh syncAllIndexes tạo index thật
    khi autoIndex=false (email unique tồn tại sau sync).
  - P1.3 api.js (frontend): BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_FALLBACK (LAN IP).
    Không hardcode URL prod, không cài dep. Ghi cảnh báo deploy phải set EXPO_PUBLIC_API_URL.
  - Test mới src/__tests__/deploy-config.test.js (3): trust proxy===1 (không true); guard prod;
    syncAllIndexes tạo index dù autoIndex=false. Full suite: 197 passed, 0 fail.

[12:20] AGENT/@trim-security Phase 1 — GO, KHÔNG finding chặn. trust proxy=1 (không true) đúng
  thứ tự trước rate limiter (app.js:23); với 1 hop Railway, Express lấy IP thật từ XFF, attacker
  không spoof lách authLimiter được. api.js không hardcode URL prod/secret; fallback LAN IP fail an
  toàn. Không TTL/expires mới. 2 lưu ý LOW ops (defer): (a) xem lại số hop nếu thêm proxy trước
  Railway; (b) tuyệt đối không để secret vào EXPO_PUBLIC_* (nằm trong client bundle).

[12:21] OK — P2.0 read-first (đọc, tự tiếp):
  1. User.refreshTokens = [{ token: String (JWT THÔ), createdAt: Date (KHÔNG expires) }]. Lưu token
     THÔ trong ARRAY. Mảng phình theo mỗi login; logout $pull 1 phần tử. (Đây là chỗ TTL-trên-array
     từng xoá 18 account — comment cảnh báo còn nguyên.)
  2. auth.js:
     - login (42-44) + register (93-95): generateRefreshToken (JWT 30d) → push {token} vào mảng.
     - refresh (109-134): verify JWT → findOne user có refreshTokens.token===token → cấp CHỈ access
       token mới. KHÔNG xoay refresh. Response { accessToken }.
     - logout (137-153): verify JWT → $pull token khỏi mảng. Response { message }.
     - jwt.js: refresh token là JWT ký JWT_REFRESH_SECRET, exp 30d.
  3. client api.js interceptor: POST /auth/refresh { refreshToken } → CHỈ đọc data.accessToken,
     KHÔNG lưu refresh token mới. ⚠ HỆ QUẢ: nếu Phase 2 xoay token mà client không lưu token mới,
     lần refresh sau dùng token cũ (đã revoke) → reuse-detection revoke cả family → đăng xuất nhầm.
     ⇒ Phase 2 PHẢI cập nhật client: refresh response trả { accessToken, refreshToken } và interceptor
       lưu refreshToken mới vào SecureStore. (Nằm trong scope: GOAL "client refresh vẫn chạy".)

[12:40] OK — PHASE 2 code (RefreshToken security):
  - P2.1 models/RefreshToken.js: collection RIÊNG. Fields: user(index), tokenHash(unique, SHA-256,
    KHÔNG lưu thô), family(index), expiresAt (TTL document-level: index {expires:0}), revokedAt.
  - GATE TTL (lần 1): in RefreshToken.collection.indexes() → CÓ {expiresAt:1} expireAfterSeconds:0
    document-level; các index khác (user, tokenHash unique, family) KHÔNG TTL; KHÔNG TTL trên
    array/subdoc. HÌNH DẠNG ĐÚNG. (indexes.test.js cũng assert: expireAfterSeconds===0 và đúng 1
    index có expireAfterSeconds.)
  - P2.2 utils/refreshTokens.js: issueRefreshToken (raw crypto.randomBytes, lưu hash, family),
    rotateRefreshToken (atomic claim findOneAndUpdate revokedAt:null → issue mới cùng family,
    revoke cũ), reuse-detection (token đã revoke bị trình lại → revokeFamily + throw), revokeRefreshToken,
    revokeFamily. Generic 401 mọi nhánh fail.
  - auth.js: login/register issueRefreshToken (family mới); refresh → rotateRefreshToken, trả
    {accessToken, refreshToken mới}; logout → revokeRefreshToken. Bỏ generateRefreshToken/verifyRefreshToken.
  - P2.3: BỎ array refreshTokens khỏi User schema + toJSON. Thêm RefreshToken vào deleteUserData
    OWNED_COLLECTIONS (xoá token khi xoá account) + database.js OWNING_MODELS (tạo TTL/index trên prod).
  - client trim-app/src/services/api.js: interceptor LƯU data.refreshToken mới sau rotation (nếu
    không, lần sau gửi token cũ đã revoke → reuse → đăng xuất). GOAL "client refresh vẫn chạy".
  - indexes.test.js cập nhật: 6 model (thêm RefreshToken) + assert TTL shape (GATE trong test).

[12:42] OK — P2.4 test src/__tests__/refresh-token.test.js (6): lưu hash không phải thô + expiresAt +
  family; rotation (token cũ chết, mới dùng được); reuse → 401 + revoke CẢ family (t2 cũng chết,
  scope theo family); token không tồn tại → 401 generic; logout revoke; missing → 400.
  MUTATION: revokeFamily thành no-op (tắt reuse-detection) → test reuse FAIL (afterReuse t2 vẫn 200
  thay vì 401) → test KHÔNG rỗng. Khôi phục, xanh lại.
  Full suite: 203 passed, 0 fail (chạy 2 lần, deterministic — đã sửa indexes.test brittle count).

[12:44] OK — P2.3 cleanup script scripts/cleanup-user-refreshtokens.js (dry-run mặc định, --apply
  tường minh, chỉ $unset field refreshTokens, không xoá document). DRY-RUN thật: 8 user còn field
  refreshTokens (array JWT thô cũ). PARK apply — cần Ken backup rồi chạy --apply. KHÔNG tự apply.

[13:00] AGENT/@trim-test-skeptic Phase 2 — 6/6 test LOAD-BEARING. Xác nhận test reuse (quan trọng
  nhất): assertion afterReuse(t2)→401 mới là chỗ pin reuse-detection (mutation revokeFamily no-op →
  FAIL), scope countDocuments theo family đúng (không nhiễu token register). Test TTL indexes.test
  assert expireAfterSeconds===0 + đúng 1 TTL. Điểm yếu: Test rotation UNDER-ASSERT (không kiểm token
  cũ chết). GIA CỐ (đã áp): Test rotation thêm DB assert t1rec.revokedAt truthy sau rotation; Test
  reuse thêm positive-control family register vẫn active (không over-reach). refresh-token 6/6 sau gia cố.

[13:02] AGENT/@trim-security Phase 2 — GATE TTL PASS, KHÔNG finding chặn.
  - GATE TTL: RefreshToken.expiresAt là TTL document-level {expiresAt:1} expireAfterSeconds:0 trên
    field Date TOP-LEVEL; array-TTL ở User ĐÃ bỏ hoàn toàn; không TTL mới ở model khác (subscription.
    expiresAt, lockUntil là Date thường không index). indexes.test là regression guard cho vụ 18-account.
  - Token lưu SHA-256 hash, KHÔNG thô; raw chỉ trả client 1 lần (register/login/refresh); warn chỉ
    log family+user id, không log token. Reuse-detection atomic (findOneAndUpdate revokedAt:null) đóng
    race đúng; generic 401 mọi nhánh. crypto.randomBytes(32/16) đủ entropy; không Math.random.
  - .env không commit; deleteUserData xoá RefreshToken khi xoá account (không orphan); database.js
    OWNING_MODELS có RefreshToken (TTL tạo trên prod). Bỏ array = buộc login lại (session reset,
    KHÔNG mất dữ liệu) — chấp nhận được. cleanup script dry-run default.
  - 2 lưu ý LOW (không chặn): authLimiter 5/15min áp cả /refresh (xác nhận trước launch với access TTL
    15m); /refresh không zod (an toàn vì token chỉ để hash+so khớp). Defer.
  - GATE TTL lần 2 (security) = PASS. Full suite 203 passed, 0 fail.

[13:05] OK — Phase 2 committed: 30d485d. .env không staged (verify). Body ghi PARK cleanup (8 user).

═══════════════════════════════════════════════════════════════════════════════
BÁO CÁO CUỐI — RUNBOOK 004 (Deploy hardening + RefreshToken security)
═══════════════════════════════════════════════════════════════════════════════

ĐÃ XONG (bằng chứng: số test + hash):
PHASE 1 (commit e69f13e):
- P1.1 trust proxy=1 (không true), trước rate limiter (app.js). Verify: app.get('trust proxy')===1.
- P1.2 prod index sync: connectDB guard chạy syncAllIndexes khi NODE_ENV!=='test'; test chứng minh
  index tạo được khi autoIndex=false.
- P1.3 api.js baseURL = EXPO_PUBLIC_API_URL || DEV_FALLBACK (không hardcode prod, không dep mới).
- deploy-config.test.js (3 test). @trim-security Phase 1: GO, không chặn.
PHASE 2 (commit 30d485d):
- RefreshToken collection: hash SHA-256 (không lưu thô), family, TTL document-level {expiresAt:1}
  expireAfterSeconds:0. GATE TTL PASS 2 LẦN (in index thủ công + indexes.test assert + @trim-security).
- rotation + reuse-detection (atomic claim; reuse → revoke cả family). auth.js login/register/refresh/
  logout dùng collection mới; generic 401 mọi nhánh. Bỏ array refreshTokens khỏi User (chỗ TTL-array
  từng xoá 18 account). deleteUserData + OWNING_MODELS thêm RefreshToken. client lưu token xoay.
- refresh-token.test.js (6 test, đã gia cố rotation + positive-control) + indexes TTL assert.
  MUTATION: revokeFamily no-op → test reuse FAIL → không rỗng. @trim-test-skeptic: mọi test load-bearing.
  @trim-security: GATE TTL PASS, không chặn.
- FULL SUITE CUỐI: Test Suites 13 passed; Tests 203 passed, 0 fail (194 cũ + 3 deploy + 6 refresh).

ĐÃ PARK (cần Ken):
- P2.3 cleanup array cũ: scripts/cleanup-user-refreshtokens.js. Dry-run: 8 user còn field
  refreshTokens (array JWT thô). Cần Ken: backup users → `node scripts/cleanup-user-refreshtokens.js
  --apply` ($unset field, không xoá document). KHÔNG tự apply.
- LOW defer (từ security): authLimiter 5/15min áp cả /refresh (xác nhận với access TTL 15m trước
  launch); /refresh không zod (an toàn). trust proxy hop-count nếu đổi topology; không để secret vào
  EXPO_PUBLIC_*.

QUYẾT ĐỊNH ĐÃ TỰ LÀM (Ken duyệt lại):
- Refresh token đổi từ JWT → opaque random (crypto.randomBytes) + hash. Access token vẫn JWT.
- Rotation trả {accessToken, refreshToken} → PHẢI cập nhật client lưu refreshToken mới (nếu không,
  reuse-detection đăng xuất nhầm). Đã sửa api.js interceptor.
- reuse revoke theo FAMILY (session), không đụng session khác (multi-device an toàn).
- Gia cố 2 test theo test-skeptic (DB assert token cũ revoked + positive-control family register).
- Không đổi jwt.js (generateRefreshToken/verifyRefreshToken còn export nhưng auth không dùng nữa;
  verifyAccessToken vẫn dùng). Để nguyên, không dọn (ngoài scope, tránh rủi ro).

GOAL tổng — từng dòng:
[x] Phase 1: trust proxy set (value 1), prod index sync verify, env baseURL — commit e69f13e.
[x] Phase 2: RefreshToken hashed+rotation+reuse-detection, document TTL đúng hình dạng (GATE 2 lần),
    array cũ bỏ khỏi User, client refresh vẫn chạy — commit 30d485d.
[x] Suite ≥194 + test mới, 0 fail → 203 passed.
[x] Không .env; TTL CHỈ trên RefreshToken.expiresAt, không ở đâu khác (security xác nhận).

Bằng chứng: `Test Suites: 13 passed | Tests: 203 passed`. Commits: e69f13e (P1), 30d485d (P2).

═══════════════════════════════════════════════════════════════════════════════
RUNBOOK 005 — GĐ3 Safety & Consent
═══════════════════════════════════════════════════════════════════════════════

[14:00] START — Phase 1 backend trước. P1.0 baseline 203/0, tree sạch.
        (TRIM_LEGAL_GD3.html không có trong repo — nhưng copy Phase 2 đã inline trong runbook, đủ dùng.)

[14:20] OK — P1.1 read-first: 2 endpoint đặt goal (POST /me/complete-profile users.js:63; PUT /me/goal
  users.js:130), cả hai dùng calculateDailyTarget(tdee, type, weeklyRate). bmr.js: calculateBMI(w,h),
  calculateDailyTarget(tdee,type,rate), calculateBMRFromUser. User.profile.gender (enum male/female/
  other). CHƯA có aiConsent. OpenAI qua parseText.js: meals /parse-text, activities /parse-text,
  quicklog (kind meal/activity). meals/activities có router.use(authenticate).

[14:22] OK — P1.2 unsafe-goal guards:
  - Hằng số ở bmr.js: SAFE_MIN_CALORIES_FEMALE=1200, MALE=1500, MIN_HEALTHY_BMI=18.5, MAX_WEEKLY_LOSS_KG=1.0.
  - utils/goalSafety.js checkGoalSafety() (dùng lại bmr.js): rate>1.0 → msg tốc độ; dailyTarget<minCal
    (nam 1500/nữ+other 1200) → msg calo; targetBMI<18.5 → msg BMI. 3 message ĐÚNG chuỗi runbook.
  - Wire vào complete-profile (TRƯỚC mọi write — reject sạch, không để profile/weightlog mồ côi) +
    PUT /me/goal (trước khi vô hiệu goal cũ). Tái dùng bmr/tdee đã tính, không tính lại.
  - QUYẾT ĐỊNH: 'other' gender dùng ngưỡng calo nữ (1200, thấp hơn) tránh over-reject; guard vẫn chặn
    mọi target thực sự <1200 cho mọi giới.
  - Test safety-guards.test.js: 6 unit checkGoalSafety (deterministic, truyền tdee, không phụ thuộc
    ngày) + 3 integration complete-profile (rate→400+msg+không tạo goal; BMI→400+msg; safe→200).
  - MUTATION: tắt guard calo (!DISABLED) → 2 test calo FAIL (message→undefined). Khôi phục, xanh lại.

[14:24] OK — P1.3 AI consent gate:
  - User schema: aiConsent { granted:Boolean default false, grantedAt:Date default null }. KHÔNG TTL.
  - POST /api/users/ai-consent (auth, idempotent): granted=true, grantedAt=now (giữ lần đầu).
  - middleware/requireAiConsent.js: chưa granted → 403 {code:'AI_CONSENT_REQUIRED'}, KHÔNG next.
    Áp: meals /parse-text, activities /parse-text. quicklog: inline chỉ cho kind meal/activity (weight
    không gọi AI → không cần consent), đặt SAU dedupe.
  - Test: chưa consent + parse-text → 403 AI_CONSENT_REQUIRED + parseMealText KHÔNG được gọi (mock
    assert not called); sau POST consent → parse-text qua (mock); consent idempotent grantedAt không
    đổi; quicklog weight không cần consent; log tay POST /meals không cần consent (parseMealText not called).
  - Sửa quicklog.test.js: grant aiConsent cho userA/userB trong beforeAll (test kiểm cơ chế, không phải consent).
  - safety-guards.test.js: 14 test. Full suite: 217 passed, 0 fail.

[14:40] AGENT/@trim-security Phase 1 — KHÔNG finding chặn. Guard là if server-side (không prompt),
  cả 2 goal-write site (complete-profile users.js:70-83 + PUT /me/goal:158-167) đều guard TRƯỚC write
  (grep $push goals chỉ 2 nơi, đều covered); mọi đường OpenAI (parseText.js là call duy nhất) đều gated
  (meals/activities middleware + quicklog inline) — KHÔNG bypass; 403 không next. aiConsent.grantedAt
  Date thường KHÔNG TTL; message cố định không leak; consent chỉ set cho req.user._id (không set hộ user
  khác). 2 lưu ý non-blocking: complete-profile không null-check body (pre-existing, 500 nếu malformed);
  quicklog lặp gate inline (maintainability). Defer.

[14:42] AGENT/@trim-test-skeptic Phase 1 — 14/14 LOAD-BEARING (mutation A-G xác nhận): guard rate/calo/
  BMI độc lập (mutation B: tắt BMI → integration BMI thành 200, calo KHÔNG preempt); message assert đúng
  CHUỖI đầy đủ (toBe, không toBeTruthy); clean-reject invariant (onboardingCompleted false) load-bearing
  (mutation G); consent not-called + over-application (weight/manual không cần consent) load-bearing.
  Gap đã GIA CỐ:
  - Test idempotent trước diff 2 clock → có thể false-pass nếu cùng ms. Sửa: spy findByIdAndUpdate,
    assert lần consent 2 KHÔNG gọi update (idempotent thật). 
  - Guard calo trước chỉ unit → thêm integration test qua complete-profile (calo<1200 → 400 + MSG_CAL
    + không tạo goal). safety-guards 15 test. Full suite 218 passed.

[14:44] OK — commit Phase 1.
