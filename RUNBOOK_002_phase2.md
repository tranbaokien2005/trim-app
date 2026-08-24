# RUNBOOK 002 — Giai đoạn 2: Index, hooks, migration, fix test đỏ

> Bạn là **runner**. Đọc hết file này rồi thực thi tới khi đạt GOAL.
> KHÔNG hỏi Ken giữa chừng, trừ khi chạm STOP LIST hoặc gặp một ESCALATE.
> Ghi liên tục vào `RUN_LOG.md`. Ken chỉ đọc file đó ở cuối.
>
> Đây là goal BỰ, nhiều task. Làm tuần tự theo thứ tự (an toàn → rủi ro).
> Task cuối (migration) là ESCALATE — làm dry-run rồi PARK cho Ken, đừng tự apply.

Trạng thái vào: backend 155 pass / 3 fail (sau quicklog commit 794474c).

---

## GOAL

- [ ] Backend: **≥ 158 pass / 0 fail** — ba test đỏ hiện tại chuyển xanh
- [ ] Ba test đỏ xanh vì **đúng nguyên nhân gốc đã được chẩn đoán và ghi log**,
      KHÔNG phải vì sửa test cho khớp code sai
- [ ] Unique index tồn tại và **tự tạo được cả trên production** (finding #1 của verify)
- [ ] `pre('save')` hook tự tính totals cho MealLog và ActivityLog, có test chứng minh
- [ ] `currentStats.bmr` và `currentStats.baseline` được ghi trên User, có test
- [ ] `.env` không xuất hiện trong `git status`
- [ ] Ba file frontend cũ (`api.js`, `auth.js`, `RegisterScreen.js`) vẫn modified, chưa commit
- [ ] WeightLog.date migration: **dry-run xong, PARK chờ Ken** (KHÔNG tự apply)

---

## STOP LIST — chạm là DỪNG, ghi log, chờ Ken

1. `.env` trong `git status` hoặc commit
2. Sắp thêm `expires` / TTL index bất kỳ
3. Test PASS tụt dưới 155, hoặc test đang xanh bỗng đỏ
4. Sắp **apply** thay đổi lên dữ liệu người dùng thật (migration) — chỉ dry-run được phép
5. Sắp cài dependency mới không có trong package.json
6. Sắp sửa file ngoài danh sách cho phép của task đang làm
7. `@trim-security` trả finding mức chặn

## ESCALATE — gọi @trim-manager, làm theo quyết định; nếu nó trả ESCALATE thì PARK

- Có nhiều hơn một cách hợp lý để làm một task
- Một test đỏ có thể "xanh" bằng hai cách khác nhau (sửa code vs sửa test) và chưa rõ cách nào đúng

---

## LUẬT PARK
Tối đa 3 lần thử mỗi blocker, chẩn đoán gốc trước khi thử lại. Quá 3 lần: ghi PARK
(đã thử gì, giả thuyết, chặn task nào), đưa cây về sạch, sang task tiếp theo.
Không bao giờ để cây làm việc ở trạng thái hỏng khi chuyển task.

---

## TASK 0 — Baseline
```bash
cd trim-backend && npm test 2>&1 | tee /tmp/trim-p2-baseline.txt
```
Ghi vào log: pass/fail count + tên 3 test đỏ + **thông điệp lỗi** từng cái (strip ANSI).
Nếu không phải 155/3 → STOP, báo cáo.

---

## TASK 1 — Sửa thứ tự assertion (finding từ verify, trivial)
File: `trim-backend/src/__tests__/quicklog.test.js`
Trong test chống trùng (test số 2): đưa `expect(countDocuments).toBe(1)` LÊN TRƯỚC
`expect(status).toBe(200)`. Lý do: "chỉ 1 document được ghi" mới là assertion
load-bearing; nó phải luôn được đánh giá kể cả khi status assertion vỡ.
**Xong khi:** `npx jest quicklog` vẫn 7/7 xanh.

---

## TASK 2 — Read-first cho phần còn lại (ĐỌC, KHÔNG SỬA, rồi báo cáo + DỪNG chờ Ken)

Đọc và trả lời, không sửa gì:
1. `src/models/User.js` — có field `currentStats` chưa? Hình dạng? Có `email` unique chưa?
2. `src/models/MealLog.js` + `ActivityLog.js` — totals/summary hiện được tính Ở ĐÂU?
   (trong route? trong hook? thủ công?) Trích chính xác `file:line`.
3. Ba test đỏ — với TỪNG cái, đọc test VÀ code nó gọi, rồi phân loại:
   (a) test đúng, code thiếu tính năng → phải implement
   (b) test sai/lỗi thời → phải sửa test
   Nêu bằng chứng `file:line` cho mỗi phân loại. ĐỪNG ĐOÁN.
   - Weights POST → res.body thiếu `bmi`
   - Meals search → res.body không phải array
   - Stats daily → res.body.bmr = 0
4. `src/config/database.js` — autoIndex đang cấu hình thế nào (dòng nào)?
5. Mọi nơi `WeightLog.date` được ĐỌC hoặc GHI (grep toàn backend) — liệt kê `file:line`.
   Đây là đầu vào cho task migration.

**Báo cáo 5 mục rồi DỪNG. Chờ Ken xác nhận phân loại 3 test đỏ trước khi sửa.**
(Đây là điểm dừng DUY NHẤT giữa chừng — vì "xanh bằng cách sửa test" có thể che một bug thật.)

---

## TASK 3 — Unique index + tự tạo trên production (finding #1)

Sau khi Ken xác nhận task 2:
- Thêm unique index còn thiếu theo kết quả task 2 (ví dụ `email` trên User nếu chưa có).
  Dùng `partialFilterExpression` nếu field có thể null. TUYỆT ĐỐI không `expires`.
- **Giải quyết finding #1:** đảm bảo index tự tạo trên production. Cách khuyến nghị:
  thêm một bước gọi `syncIndexes()` cho các model sở hữu vào lúc server khởi động
  (sau khi kết nối DB thành công), có guard để không chạy trong test.
  Nếu @trim-manager thấy cách khác an toàn hơn (migration script chạy lúc deploy) thì theo nó.
**Xong khi:** có test hoặc log chứng minh index được tạo khi khởi động với NODE_ENV=production giả lập.

---

## TASK 4 — pre('save') totals hook
`MealLog` và `ActivityLog`: thêm `schema.pre('save')` tự tính totals/summary từ items/entries,
để route không phải tự cộng thủ công (giảm chỗ sai lệch).
- Không đổi hình dạng field totals đang có.
- Viết test: tạo doc với items, KHÔNG set totals thủ công → sau save, totals đúng.
- Mutation check: phá phép cộng trong hook → test phải FAIL.
**Xong khi:** test hook xanh, mutation chứng minh test không rỗng.

---

## TASK 5 — currentStats.bmr + baseline trên User
Ghi `currentStats.bmr` và `currentStats.baseline` (dùng `utils/bmr.js` đã có — KHÔNG viết lại
công thức) khi profile/weight cập nhật. Có test.
**Xong khi:** test xác nhận hai field được ghi đúng giá trị từ bmr.js.

---

## TASK 6 — Ba test đỏ → xanh
Theo phân loại đã chốt ở task 2. Với mỗi test: sửa (code hoặc test) đúng như đã phân loại,
ghi log "test X xanh vì <nguyên nhân gốc>".
**Xong khi:** cả 3 xanh, và tổng ≥ 158 pass / 0 fail.

---

## TASK 7 — Checkpoint
- `@trim-test-skeptic` trên mọi test mới (task 3,4,5) — có assert load-bearing không, có rỗng không
- `@trim-security` trên toàn bộ diff GĐ2 — expires/TTL, .env, index sai hình dạng
Ghi kết luận vào log. Finding mức chặn → STOP.

---

## TASK 8 — WeightLog.date migration (ESCALATE — DRY-RUN rồi PARK)

Đây là task DUY NHẤT chạm dữ liệu người dùng thật. KHÔNG tự apply.

1. Đổi schema `WeightLog.date` từ `Date` sang `String` 'YYYY-MM-DD', và sửa mọi nơi
   đọc/ghi nó (theo danh sách task 2, mục 5) — phần CODE này làm được, có test.
2. Viết script migration `scripts/migrate-weightdate.js` có cờ `--dry-run` (mặc định)
   và `--apply`. Dry-run: in ra sẽ đổi bao nhiêu document, từ giá trị gì sang gì,
   KHÔNG ghi DB.
3. Chạy `--dry-run`, ghi output vào log.
4. **PARK task apply.** Ghi vào BÁO CÁO CUỐI: "migration sẵn sàng, dry-run cho thấy
   sẽ đổi N document, cần Ken chạy --apply thủ công sau khi backup."
   KHÔNG chạy `--apply`. KHÔNG commit phần schema change nếu nó làm test đỏ khi
   DB thật chưa migrate — nếu có mâu thuẫn đó, PARK cả task 8, ghi rõ.

---

## RUN_LOG.md
Ghi liên tục `[HH:MM] START/OK/FAIL/PARK/DEC/AGENT/STOP/ESCALATE`.
Cuối cùng thêm **BÁO CÁO CUỐI**: Đã xong (kèm bằng chứng: số test, hash) · Đã PARK
(cần Ken quyết) · Quyết định tự làm (Ken duyệt lại) · từng dòng GOAL tick/không kèm output.

**"Tests pass" không phải bằng chứng.** Con số pass/fail + tên test đỏ mới là.
Ghi rõ nếu đổi model giữa chừng.
