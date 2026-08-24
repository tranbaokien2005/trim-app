# RUNBOOK 001 — Quick Log v1.0

> Bạn là **runner**. Đọc hết file này rồi thực thi tới khi đạt GOAL.
> KHÔNG hỏi Ken giữa chừng, trừ khi chạm STOP LIST.
> Ghi liên tục vào `RUN_LOG.md`. Ken chỉ đọc file đó khi bạn xong.

Trạng thái hiện tại: Commit 1 (tách `parseText.js`) đã xong, 148 pass / 3 fail.
Baseline lỗi đã lưu ở `/tmp/trim-baseline.txt`.

---

## GOAL

- [ ] `cd trim-backend && npm test` → **155 pass / 3 fail**
- [ ] Ba test fail là đúng ba cái cũ, **và fail vì đúng lý do cũ**:
      `Weights › POST /api/weights creates a log`,
      `Meals › GET /api/meals/search returns results`,
      `Stats › GET /api/stats/daily aggregates meals and activities correctly`
- [ ] Test `parseTrimUrl` phía app xanh, ghi rõ số lượng vào log
- [ ] `git status` không có `.env`
- [ ] `trim-app/src/services/api.js`, `auth.js`, `RegisterScreen.js` **vẫn ở trạng thái
      modified, chưa commit** — chúng thuộc commit khác, đừng đụng
- [ ] Mutation A cho kết quả PASS, Mutation B cho kết quả FAIL
- [ ] Không có `expires` mới trong `trim-backend/src/models/`
- [ ] `WeightLog.date` vẫn là kiểu `Date`

---

## STOP LIST

1. `.env` trong `git status` hoặc trong commit
2. Sắp thêm `expires` / TTL index bất kỳ
3. Test PASS giảm dưới 148, hoặc có test mới fail
4. Một trong 3 test baseline fail vì **lý do khác** lý do cũ
5. Sắp xoá hoặc migrate dữ liệu — **kể cả `WeightLog.date`**
6. Sắp cài dependency mới (`expo-linking`, `uuid`, `expo-crypto`… đều KHÔNG được cài)
7. Sắp sửa file ngoài danh sách dưới
8. `trim-security` trả về finding mức chặn

---

## FILE ĐƯỢC PHÉP SỬA

```
trim-backend/src/models/MealLog.js
trim-backend/src/models/ActivityLog.js
trim-backend/src/models/WeightLog.js
trim-backend/src/routes/quicklog.js          (tạo mới)
trim-backend/src/app.js                      (chỉ để mount route)
trim-backend/src/utils/date.js
trim-backend/src/__tests__/quicklog.test.js  (tạo mới)
trim-app/app.json
trim-app/src/utils/parseTrimUrl.js           (tạo mới)
trim-app/src/utils/uuid.js                   (tạo mới)
trim-app/App.js  HOẶC  trim-app/src/navigation/RootNavigator.js
trim-app/src/__tests__/parseTrimUrl.test.js  (tạo mới)
```

---

## TASK

### 1. Field `origin` + index chống trùng
Trên cả 3 model:
```js
clientId: { type: String, default: undefined },
origin: { type: String, enum: ['app','deeplink','shortcut','widget','siri','intent'], default: 'app' },
```
```js
schema.index({ user: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });
```
**KHÔNG đụng field `source` sẵn có.** Nó mang nghĩa khác (provenance dữ liệu:
`manual` / `ai_parsed`), không phải bề mặt khởi tạo.
Dùng `partialFilterExpression`, KHÔNG dùng `sparse` — với unique index, `sparse` vẫn
va chạm khi có nhiều document `clientId: null`.

**Xong khi:** `npm test` vẫn 148/3.

### 2. `getMealTypeInTz(timezone, now)` trong `src/utils/date.js`
Cạnh `getTodayInTz` sẵn có. Tham số `now` bắt buộc để test inject được thời điểm.
Thiếu timezone → fallback `'UTC'`, không ném lỗi. Dùng đúng bucket giờ như
`ChatInputScreen.getMealType()`.

**Xong khi:** có test inject 07:00 → `breakfast`, 13:00 → `lunch`, 20:00 → `dinner`.

### 3. `POST /api/quicklog`
```
{ kind: "meal"|"activity"|"weight",  // BẮT BUỘC, không tự đoán
  text, value, clientId,             // clientId BẮT BUỘC
  origin: "deeplink", date?, mealType? }
```
Luồng: validate → `findOne({user, clientId})` → nếu có, trả **200**
`{ok:true, duplicate:true, created}` → nếu chưa, gọi lại đúng hàm trong `parseText.js`
(KHÔNG viết lại logic parse) → bắt E11000 do race, tra lại, trả như trên.
Mount theo đúng cách các route khác đang mount.

**Xong khi:** 6 test ở task 5 xanh.

### 4. Phía app
- `app.json`: thêm `"scheme": "trim"`. Nếu đã có scheme khác → STOP, báo cáo.
- `uuid.js`: helper ~5 dòng, KHÔNG cài dependency. Comment đầu file:
  *dùng Math.random, chỉ cho idempotency, không dùng cho bảo mật.*
- `parseTrimUrl.js`: hàm **thuần**, không side effect, trả `{kind,text?,value?}` hoặc `null`.
  `decodeURIComponent` **bọc try/catch**, lỗi thì **dùng chuỗi gốc**, không trả null.
  (iOS Shortcuts không tự encode — thiếu bước này là mọi log tiếng Việt hỏng.)
- Xử lý URL ở tầng gốc bằng `Linking` built-in của React Native
  (`getInitialURL` + `addEventListener`, nhớ gỡ listener). Sinh `clientId` **một lần
  cho mỗi URL**. Chưa đăng nhập hoặc đang khôi phục token → **buffer lại**, xử lý sau
  khi vào MainTabs. Không được nuốt mất.
  Thành công → toast có nút Hoàn tác. `duplicate:true` → toast "Đã ghi rồi", không báo lỗi.
  Thất bại → điều hướng tới màn Log với text điền sẵn.

### 5. Test backend — 7 cái
1. kind=meal hợp lệ → tạo 1 MealLog, `origin === 'deeplink'`
2. Gửi 2 lần cùng `clientId` → lần 2 có `duplicate:true`,
   **và `MealLog.countDocuments({user, clientId}) === 1`**
3. Cùng `clientId`, khác user → tạo bình thường
4. Thiếu `clientId` → 400
5. `kind` sai → 400
6. Không token → 401
7. **Index tồn tại đúng hình dạng** — gọi `syncIndexes()` trong setup, đọc
   `collection.indexes()`, assert có `{user:1, clientId:1}` với `unique:true` và
   `partialFilterExpression` (KHÔNG phải `sparse`). Lặp cho cả 3 collection.

Test 7 tồn tại vì test 2 **pass được chỉ nhờ `findOne`** — nó không chứng minh index có thật.

### 6. Test app — `parseTrimUrl`
7 case: `trim://log?text=pho%20bo` → `{kind:'meal',text:'pho bo'}` ·
`trim://log?text=phở bò` (KHÔNG encode) → `text:'phở bò'` ·
`trim://weight?value=71.2` → `{kind:'weight',value:71.2}` ·
`trim://weight?value=abc` → `null` · `trim://log` → `null` ·
`https://example.com/log?text=x` → `null` · `trim://` → `null`

### 7. Mutation — hai lần, riêng biệt
- **A**: tắt lớp `findOne`, giữ lớp E11000. **Dự đoán: test 2 vẫn PASS** →
  chứng minh index thật sự đang chặn. Nếu FAIL, index chưa được tạo → bug nghiêm trọng, STOP.
- **B**: tắt cả hai lớp. **Dự đoán: test 2 FAIL** → chứng minh test không rỗng.

Khôi phục sau mỗi lần. `git diff` phải sạch trước khi báo cáo.

### 8. Checkpoint
- Sau task 5+6: `@trim-test-skeptic`
- Sau task 7: `@trim-security`
- Trước commit cuối: `@trim-auditor` xác nhận GOAL

### 9. Commit
```
feat(quicklog): idempotent quick-log endpoint + trim:// deep links

- POST /api/quicklog with clientId dedupe (partial unique index)
- origin field for surface attribution
- trim://log, trim://activity, trim://weight handled at root, survives cold start
- 7 backend tests + parseTrimUrl unit tests, dedupe verified by two-layer mutation
```

---

## LUẬT PARK
Tối đa **3 lần thử** mỗi blocker. Chẩn đoán nguyên nhân gốc trước khi sửa lại — không đoán mò.
Sau lần 3: ghi PARK vào log (đã thử gì, giả thuyết, chặn task nào), đưa cây về trạng thái
sạch, chuyển task tiếp theo. Không bao giờ bỏ cây làm việc ở trạng thái hỏng.

## RUN_LOG.md
Ghi liên tục, format `[HH:MM] START/OK/FAIL/PARK/DEC/AGENT/STOP`.
Cuối cùng thêm mục **BÁO CÁO CUỐI** gồm: đã xong (kèm bằng chứng) · đã PARK (cần Ken quyết) ·
quyết định đã tự làm (Ken duyệt lại) · từng dòng GOAL tick hay không, kèm output lệnh.

**"Tests pass" không phải bằng chứng.** Con số pass/fail cùng tên các test đang fail mới là.
