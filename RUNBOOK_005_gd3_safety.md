# RUNBOOK 005 — GĐ3 Safety & Consent (2 phase)

> Bạn là **runner**. Đọc hết rồi thực thi tới GOAL của CẢ HAI phase.
> TỰ QUYẾT phương án tốt nhất — KHÔNG hỏi Ken giữa chừng; ngã ba thật sự không quyết được thì
> @trim-manager; chỉ dừng khi STOP LIST. Mỗi phase commit riêng, an toàn (backend) trước.
> Ghi liên tục RUN_LOG.md.

Trạng thái vào: backend 203 pass / 0 fail, working tree sạch.
Nội dung chữ (disclaimer/consent) lấy từ file Ken đã có (TRIM_LEGAL_GD3.html) — dùng ĐÚNG
các chuỗi tiếng Anh nêu trong runbook này, đừng tự chế lại.

═══════════════════════════════════════════════════════════════════
## STOP LIST (cả 2 phase)
1. `.env` trong git status/commit
2. Test PASS tụt dưới 203, hoặc test đang xanh bỗng đỏ
3. Cài dependency mới — KHÔNG có ngoại lệ ở runbook này (không cần dep mới)
4. Sắp sửa dữ liệu người dùng thật (migration) — không có task nào cần; nếu phát sinh, PARK
5. Sắp thêm `expires`/TTL bất kỳ đâu
6. Sửa file ngoài phạm vi phase đang làm
7. @trim-security finding mức chặn
═══════════════════════════════════════════════════════════════════

# ══════ PHASE 1 — BACKEND SAFETY GUARDS (testable, làm trước) ══════
> Đây là phần guideline 1.4.1 (app không được khuyến khích hành vi hại sức khoẻ) + gate
> consent trước khi gọi OpenAI. Chặn CỨNG bằng if ở server, KHÔNG bằng prompt.

## P1.0 Baseline
`cd trim-backend && npm test 2>&1 | tee /tmp/trim-p5-baseline.txt` — không 203/0 → STOP.

## P1.1 Read-first (đọc, ghi log, TỰ tiếp — không dừng chờ Ken)
1. Endpoint đặt/cập nhật goal ở đâu (routes/goals? users complete-profile?). Body nhận gì:
   goalType, weeklyRate, target weight? Trích file:line.
2. utils/bmr.js — hàm nào tính dailyTarget, BMI. Chữ ký chính xác (đừng viết lại công thức).
3. User schema — có field consent AI chưa? Có sex/gender field tên gì (cho ngưỡng calo)?
4. Chỗ nào gọi OpenAI (meals parse, quicklog AI, food photo) — để gate consent.

## P1.2 Unsafe-goal guards — chặn tại endpoint đặt goal
Ba chặn, mỗi cái reject (400) + message an toàn rõ ràng, dùng utils/bmr.js đã có:
- **weeklyRate > 1.0 kg/tuần** → reject. Message: "For your safety, weight loss is capped at
  1 kg per week. Please choose a slower rate."
- **dailyTarget tính ra < ngưỡng theo sex** (nữ 1200, nam 1500 kcal) → reject. Message:
  "This goal would set your daily calories below a safe minimum (1200 for women / 1500 for men).
  Please choose a gentler goal or consult a professional."
- **BMI của cân nặng mục tiêu < 18.5** → reject. Message: "Your target weight falls below a
  healthy BMI. We recommend speaking with a healthcare professional before setting this goal."
Ngưỡng để hằng số ở utils/bmr.js (SAFE_MIN_CALORIES_FEMALE=1200, MALE=1500, MIN_HEALTHY_BMI=18.5,
MAX_WEEKLY_LOSS_KG=1.0) — không rải magic number trong route.
**Xong khi:** test mỗi chặn (goal vượt → 400 + message đúng; goal an toàn → qua). Mutation:
bỏ một chặn → test tương ứng FAIL.

## P1.3 Consent gate cho AI
- User schema: thêm `aiConsent: { granted: Boolean default false, grantedAt: Date }`.
- Endpoint `POST /api/users/ai-consent` (auth) → set granted=true, grantedAt=now. Idempotent.
- Mọi endpoint GỌI OpenAI: kiểm `req.user.aiConsent?.granted`. Nếu false → **403** với
  `{ code: 'AI_CONSENT_REQUIRED' }`, KHÔNG gọi OpenAI. Log tay (manual) KHÔNG bị ảnh hưởng.
**Xong khi:** test — chưa consent + gọi AI endpoint → 403 AI_CONSENT_REQUIRED, KHÔNG chạm OpenAI;
sau POST consent → AI endpoint qua (mock OpenAI). Test log tay vẫn chạy khi chưa consent.

## P1.4 Checkpoint + commit Phase 1
@trim-test-skeptic (guard test load-bearing, mutation chứng minh) + @trim-security
(guard là if server-side không phải prompt; consent gate không bypass được). Finding chặn → STOP.
Commit: "feat(safety): unsafe-goal server guards + AI consent gate (guideline 1.4.1, 5.1.2(i))"

# ══════ PHASE 2 — FRONTEND CONSENT & DISCLAIMER (sau) ══════
> UI khó unit-test bằng jest như backend. Làm đúng + đọc kỹ; verify bằng runner tự đọc lại
> code đã wire đúng luồng, không cần test RN screen.

## P2.0 Read-first (ghi log, tự tiếp)
1. Onboarding flow (navigation/onboarding) — thêm 1 bước disclaimer vào đâu.
2. Nơi hiển thị số calo/TDEE (HomeScreen?) — để thêm dòng disclaimer tại chỗ.
3. Luồng gọi AI ở client (ChatInputScreen/quicklog) — để chèn consent screen trước lần đầu.

## P2.1 Màn hình OpenAI consent
- Component ConsentScreen hiện MỘT LẦN trước khi user dùng AI lần đầu (hoặc khi API trả
  403 AI_CONSENT_REQUIRED). Dùng ĐÚNG copy:
  Tiêu đề: "Use AI to analyze your food & activity?"
  Thân: "To estimate nutrition from a photo or from what you type, Trim sends that text and
  image to OpenAI, an AI provider, which processes it and sends back an estimate. OpenAI does
  not use this data to train its models."
  Dòng phụ: "This is optional. You can always log food, activity, and weight manually without
  AI. Estimates may be inaccurate."
  Nút: "Enable AI analysis" (→ POST /api/users/ai-consent rồi tiếp tục) và
  "Not now — I'll log manually" (→ đóng, về log tay).
- Client bắt 403 AI_CONSENT_REQUIRED → hiện màn này thay vì báo lỗi thô.

## P2.2 Medical disclaimer
- Onboarding: thêm bước bắt buộc đọc, nút "I understand" mới tiếp. Copy:
  "Before you start — Trim helps you track food, activity, and weight. It is a wellness tool,
  not a medical service. The calorie and health numbers it shows are estimates, not professional
  advice. Please talk to a doctor or registered dietitian before making significant changes to
  your diet or exercise — especially if you have a health condition, are pregnant, or have ever
  struggled with disordered eating."
- Tại chỗ: dưới con số calo/TDEE ở Home, thêm dòng nhỏ mờ: "Estimated — not medical advice."
  KHÔNG giấu trong Settings.

## P2.3 Checkpoint + commit Phase 2
@trim-security (consent screen thật sự chặn trước AI; disclaimer hiển thị đúng chỗ, không giấu).
Commit: "feat(app): OpenAI consent screen + medical disclaimer (onboarding + in-place)"

═══════════════════════════════════════════════════════════════════
## DEFER (ghi log, KHÔNG làm ở runbook này)
- Chặn nội dung rối loạn ăn uống trong chat AI → thuộc feature /chat chưa build (làm khi gộp /chat).
  Xem claude/AI_COMPANION_DESIGN.md vòng 4.
- Điền placeholder Privacy Policy/Terms + host URL → việc của Ken, ngoài code.

## RUN_LOG.md
Ghi liên tục. BÁO CÁO CUỐI: Đã xong (bằng chứng: số test, hash) · PARK · quyết định tự làm ·
từng dòng GOAL. "Tests pass" không phải bằng chứng — số + tên test mới là.

## GOAL tổng
- [ ] Phase 1: 3 unsafe-goal guards (reject + message, hằng số ở bmr.js) + AI consent gate
      (403 AI_CONSENT_REQUIRED, không chạm OpenAI khi chưa consent) — test + mutation — commit riêng
- [ ] Phase 2: consent screen (đúng copy, bắt 403) + disclaimer onboarding + dòng tại chỗ — commit riêng
- [ ] Suite ≥ 203 + test mới, 0 fail · không .env · không dep mới · không TTL
