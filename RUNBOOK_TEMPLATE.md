# RUNBOOK — <tên việc>

> Bạn là **runner**. Đọc hết file này rồi thực thi tới khi đạt GOAL.
> Không hỏi tôi giữa chừng, trừ khi chạm vào STOP LIST.
> Ghi mọi thứ vào `RUN_LOG.md`. Tôi sẽ đọc file đó khi bạn xong.

---

## GOAL — tiêu chí xong, bằng SỐ

Việc này xong khi và chỉ khi tất cả các dòng sau đúng:

- [ ] <điều kiện có con số cụ thể, ví dụ: backend 155 pass / 3 fail, đúng 3 tên cũ>
- [ ] <điều kiện kiểm chứng được bằng một lệnh>
- [ ] ...

Không có dòng nào là "hoạt động tốt" hay "chạy ổn". Mọi dòng phải chạy được một lệnh
để biết đúng hay sai.

---

## STOP LIST — chạm vào là DỪNG NGAY, ghi log, chờ tôi

Không được tự quyết, không được tự sửa, không được đi vòng:

1. `.env` xuất hiện trong `git status` hoặc trong một commit
2. Sắp thêm `expires` hoặc bất kỳ TTL index nào
3. Số test PASS **giảm** so với baseline, hoặc có test mới fail
4. Một test đang fail ở baseline bây giờ fail vì **lý do khác**
5. Sắp xoá hoặc migrate dữ liệu người dùng
6. Sắp cài dependency mới, hoặc thêm một dịch vụ tốn tiền
7. Sắp sửa file không nằm trong danh sách được phép ở dưới
8. `trim-security` hoặc `trim-appstore` trả về một finding mức chặn

---

## QUYỀN TỰ QUYẾT

**Tự quyết, không cần hỏi ai:**
tên biến, cách chia hàm, cách viết test, thứ tự làm, sửa lỗi cú pháp,
sửa lỗi test do chính mình vừa gây ra, format code.

**Gọi `@trim-manager` rồi làm theo quyết định của nó:**
có nhiều hơn một cách hợp lý để sửa một blocker; một lựa chọn ảnh hưởng tới thiết kế
hoặc phạm vi; runbook không nói rõ phải làm gì.

**ESCALATE (park lại, báo cuối buổi):**
khi `@trim-manager` trả về `ESCALATE`.

---

## LUẬT PARK — không đâm đầu vào tường

Với **mỗi** blocker:

1. Thử sửa. Nếu hỏng, **chẩn đoán nguyên nhân gốc trước** rồi mới sửa tiếp — không đoán mò.
2. **Tối đa 3 lần thử.** Đếm và ghi số lần vào log.
3. Sau lần thứ 3: **PARK**. Viết vào `RUN_LOG.md`:
   - đã thử gì, mỗi lần kết quả ra sao
   - giả thuyết hiện tại về nguyên nhân
   - việc này chặn những task nào khác
   Rồi `git stash` phần dở (hoặc revert cho cây sạch) và **chuyển sang task tiếp theo**.
4. Không bao giờ để cây làm việc ở trạng thái hỏng khi chuyển task.

---

## FILE ĐƯỢC PHÉP SỬA

Chỉ những file sau. Cần sửa file khác → STOP LIST mục 7.

- `<đường dẫn>`
- `<đường dẫn>`

---

## CHECKPOINT — gọi agent ở đúng những điểm này

| Sau khi | Gọi | Nếu nó chặn |
|---|---|---|
| Viết xong test mới | `@trim-test-skeptic` | Sửa test, chạy lại nó |
| Xong toàn bộ code | `@trim-security` | Finding mức chặn → STOP LIST mục 8 |
| Đạt GOAL, trước commit cuối | `@trim-auditor` | Mâu thuẫn với tài liệu → ghi log, không tự sửa doc |

Ghi **tóm tắt kết luận của từng agent** vào `RUN_LOG.md`. Nếu bạn không đồng ý với một
agent, ghi cả lý do — đừng lặng lẽ bỏ qua.

---

## TASK — làm theo đúng thứ tự

### 1. <tên task>
**Làm gì:** ...
**Xong khi:** <lệnh chạy được + kết quả mong đợi>

### 2. <tên task>
...

---

## RUN_LOG.md — ghi liên tục, không để tới cuối

Tạo hoặc append vào `RUN_LOG.md` ở gốc repo. Mỗi mục một dòng, có dấu thời gian:

```
[HH:MM] START  <task>
[HH:MM] OK     <task> — <bằng chứng: số test, hash commit, output lệnh>
[HH:MM] FAIL   <task> lần 1/3 — <lỗi> — <giả thuyết>
[HH:MM] PARK   <task> — sau 3 lần — <chẩn đoán> — chặn: <task nào>
[HH:MM] DEC    <quyết định> — bởi trim-manager — <lý do một dòng>
[HH:MM] AGENT  trim-security — <kết luận> — <hành động>
[HH:MM] STOP   <mục STOP LIST số mấy> — <chi tiết>
```

Cuối buổi, thêm phần này vào cuối `RUN_LOG.md`:

```
## BÁO CÁO CUỐI

### Đã xong
- <task> — <bằng chứng>

### Đã PARK — cần Ken quyết
- <task> — <đã thử gì> — <giả thuyết> — <tôi đề xuất>

### Quyết định đã tự làm — Ken duyệt lại
- <quyết định> — <lý do> — <đánh đổi gì>

### GOAL
- [x] / [ ] từng dòng, kèm output lệnh chứng minh
```

---

## MỘT ĐIỀU CUỐI

Đừng báo cáo thành công mà không có bằng chứng chạy được.
"Tests pass" không phải bằng chứng. Con số pass/fail cùng với tên các test đang fail
mới là bằng chứng.
