# Trim — Project State Report (2026-08-16)

## TÓM TẮT 10 DÒNG

1. Cả 2 repo đều có mặt: `trim-backend/` (Node/Express/Mongoose, 23 file src) và `trim-app/` (React Native + Expo, 29 file src).
2. Backend chạy được: 8 router mount, 32 endpoint thật, auth JWT access+refresh hoạt động, 5 model Mongoose.
3. Frontend chạy được: 3 navigator, 15 screen active, axios interceptor có refresh-token queue hoàn chỉnh.
4. Phase 1 + Smart Day Card (Tier 1) đúng là đã code xong cả BE lẫn FE — không phải placeholder.
5. Có 141 test backend trong 3 file (CLAUDE.md ghi 145 — lệch). **Chưa chạy test** (audit read-only, không invoke npm).
6. 🔴 **`.env` (chứa MONGODB_URI + JWT secret + OPENAI_API_KEY) ĐANG BỊ GIT TRACK** trong `trim-backend`. `.gitignore` thêm sau nên không untrack được. `node_modules/` cũng bị track.
7. 🔴 **Code KHÔNG hề nằm trên GitHub.** `trim-app/` và `trim-backend/` là nested git repo **không có remote**; repo gốc track chúng như gitlink mà không có `.gitmodules` → GitHub chỉ có `.gitignore` + `CLAUDE.md`.
8. 🔴 **Daily calorie target có 2 nguồn sự thật lệch nhau**: HomeScreen tự tính `tdee - dailyAdjustment` (có cộng burned), còn `/api/stats/daily` + StatsScreen dùng `activeGoal.dailyCalorieTarget` lưu trong DB (KHÔNG cộng burned). Cùng 1 ngày, 2 tab hiện 2 số khác nhau.
9. 🟡 `FirstLogChoiceScreen` + `TemplateSetupScreen` **không thể tới được** — SummaryScreen gọi `completeOnboarding()` làm RootNavigator nhảy thẳng sang MainTabs. 2 file dead khác: `CreateAccountScreen.js`, `TargetRateScreen.js`.
10. 🟡 Meal insight block ở ChatInputScreen/ActivityChatScreen **không bao giờ hiện** — FE đọc `data.calories.consumed/target`, BE trả `caloriesConsumed`/`dailyTarget`.

---

## PART 1 — PHẠM VI WORKSPACE

**Đường dẫn gốc:** `C:\Users\baoki\Downloads\WEIGHT LOSS APP\app`

**Cấp cao nhất:**
```
.claude/          (untracked, có trong .gitignore)
.git/
trim-app/         ← CÓ trong workspace
trim-backend/     ← CÓ trong workspace
.gitignore        (78 bytes)
CLAUDE.md         (9931 bytes)
```

### Git — repo gốc (`app/`)
- Branch: `main`, up to date với `origin/main`
- Remote: `https://github.com/tranbaokien2005/trim-app.git`
- Commit gần nhất: `0503651 Remove .claude folder from tracking`
- Uncommitted: `M CLAUDE.md`, `M trim-app`, `M trim-backend`
- **Tracked files toàn bộ repo gốc chỉ có 4 entry:** `.gitignore`, `CLAUDE.md`, `trim-app`, `trim-backend`
- `git submodule status` → `fatal: no submodule mapping found in .gitmodules for path 'trim-app'`
  → `trim-app` và `trim-backend` là **gitlink mồ côi** (nested repo, không phải submodule hợp lệ). Nội dung 2 thư mục này KHÔNG được push lên GitHub.

### Git — `trim-backend/`
- Branch: `master`, commit `20f54b4 Phase 0: backend auth complete` (chỉ 1 commit)
- **Remote: KHÔNG CÓ** → chưa từng push đi đâu
- Modified: `.env`, `.env.example`, `package.json`, `package-lock.json`, `node_modules/.package-lock.json`, `src/models/User.js`, `src/models/WeightLog.js`, `src/routes/auth.js`, `src/routes/users.js`, `src/server.js`, `src/utils/bmr.js`
- Untracked: `.gitignore`, `src/__tests__/`, `src/app.js`, `src/models/ActivityLog.js`, `src/models/MealLog.js`, `src/models/Template.js`, `src/routes/{activities,meals,patterns,stats,templates,weights}.js`
- **`.env` và `node_modules/` ĐANG BỊ TRACK** (xác nhận bằng `git ls-files --error-unmatch .env` → TRACKED)

### Git — `trim-app/`
- Branch: `master`, commit `2e9f837 WIP: Phase 2 ongoing — before Smart Day Card frontend`
- **Remote: KHÔNG CÓ**
- Modified: `src/screens/main/HomeScreen.js`, `src/services/api.js`
- Untracked: `.claude/`, `src/components/`, `src/utils/dateUtils.js`
- Lịch sử: `2e9f837` → `1da2a4f phase 1 85%` → `83e0a70 Phase 0: frontend onboarding + navigation complete`

**Kết luận:** toàn bộ Phase 1 + Phase 2 code chưa được commit ở repo con, và chưa từng rời khỏi máy này.

---

## PART 2 — CÂY FILE THẬT

### trim-backend/src/ (23 file)

```
src/app.js                       (51)  — Tạo Express app: helmet, cors, 2 rate limiter, json 10mb, mount 8 router /api/*, /health, 404 catch-all, errorHandler. Export app (không listen).
src/server.js                     (7)  — connectDB() rồi app.listen(PORT||5000). Không bind 0.0.0.0 tường minh.
src/config/database.js           (14)  — mongoose.connect(MONGODB_URI) với useNewUrlParser/useUnifiedTopology; lỗi → process.exit(1).
src/middleware/auth.js           (27)  — Đọc header `Bearer`, verifyAccessToken, User.findById(decoded.userId), gán FULL mongoose doc vào req.user. 401 cho expired/invalid, 500 cho lỗi khác.
src/middleware/errorHandler.js   (30)  — console.error(stack); map ValidationError→400, dup key 11000→400, JWT errors→401, còn lại err.status||500.
src/models/ActivityLog.js        (23)  — Sub-schema activityEntry + activityLog (user, date String, entries[], summary). Index {user,date}.
src/models/MealLog.js            (34)  — Sub-schema mealItem + mealLog (user, date String, mealType enum, items[], totals, notes). Index {user,date}.
src/models/Template.js           (41)  — Template meal/activity dùng chung 1 doc; field meal và activity nằm song song, không có validator điều kiện. Index {user} + {user,type}.
src/models/User.js              (102)  — User: email/passwordHash/name, profile, currentStats, goals[], settings, subscription, onboardingCompleted, refreshTokens[] (TTL 30d). toJSON xoá passwordHash+refreshTokens.
src/models/WeightLog.js          (27)  — WeightLog (user, weight, date Date, bmi, notes, source). Index {user, date:-1}.
src/routes/activities.js        (118)  — 5 endpoint: parse-text (GPT-4o-mini), POST, GET?date, PUT/:id (sửa 1 entry), DELETE/:id.
src/routes/auth.js               (98)  — 4 endpoint: register, login, refresh, logout. bcryptjs 12 rounds (1 khi test).
src/routes/meals.js             (235)  — 7 endpoint: GET /search (USDA), POST /search/nutrients (Nutritionix), parse-text (GPT-4o-mini), POST, GET?date, PUT/:id, DELETE/:id, DELETE/:mealId/items/:itemId.
src/routes/patterns.js          (283)  — 2 endpoint Smart Day Card: GET /today (tìm ngày cùng thứ trong 7/14/21 ngày trước), POST /apply (nhân bản log của source day sang hôm nay, idempotent 409).
src/routes/stats.js              (69)  — 2 endpoint: /daily, /weekly. Có helper buildDailyStats gộp meal+activity+BMR.
src/routes/templates.js         (214)  — 4 endpoint CRUD template + giới hạn 10 template cho plan free. Có ownership check tường minh.
src/routes/users.js             (164)  — 5 endpoint: GET /me, PUT /me, POST /me/complete-profile, PUT /me/goal, POST /complete-onboarding.
src/routes/weights.js            (73)  — 4 endpoint: POST, GET /latest, GET ?limit, DELETE /:id (rollback currentStats về log mới nhất).
src/utils/bmr.js                 (44)  — 5 hàm: calculateBMR, calculateBMI, calculateTDEE, calculateDailyCalorieTarget, calculateAge.
src/utils/jwt.js                 (23)  — generate/verify cho access + refresh token.
src/__tests__/patterns.test.js  (599)  — 35 test / 4 describe cho /api/patterns.
src/__tests__/phase1.test.js    (439)  — 41 test / 5 describe cho meals/activities/weights/stats.
src/__tests__/templates.test.js (577)  — 65 test / 6 describe cho /api/templates.
```

Không có file `[PLACEHOLDER]` nào trong backend.

### trim-app/src/ (29 file)

```
src/assets/logo.png                          — ảnh, không phải code.
src/components/SmartDayCard.js       (227)  — Card Tier 1: preview 3 stat + meal badge + activity list (max 3), nút Apply / Hide. Text tiếng Việt. Ghi AsyncStorage `smartCardDismissed:YYYY-MM-DD`. Bắt 409 riêng.
src/navigation/LogStack.js            (14)  — Native stack: LogMain, ChatInput, ActivityChat.
src/navigation/MainTabs.js            (62)  — Bottom tabs: Home, Log(=LogStack), Stats, Profile. Icon MaterialCommunityIcons, active #2ECC71.
src/navigation/OnboardingStack.js     (35)  — Native stack 10 screen. LƯU Ý: RegisterScreen đăng ký dưới tên route "CreateAccount".
src/navigation/RootNavigator.js       (44)  — Đọc SecureStore(authToken, authUser, onboardingCompleted) 1 lần lúc mount, rồi chọn OnboardingStack(Welcome) / OnboardingStack(AboutYou) / MainTabs.
src/screens/main/ActivityChatScreen.js  (528)  — Tier 3 cho activity: form + free text → /activities/parse-text → sửa/xoá → POST /activities.
src/screens/main/ChatInputScreen.js     (654)  — Tier 3 cho meal: quick-add form + free text → /meals/parse-text → multiplier 0.5–2x, edit panel → POST /meals.
src/screens/main/HomeScreen.js         (1208)  — Ring calo SVG, macro, goal card, activity card, weight card, Change Goal bottom sheet, SmartDayCard. Tự tính BMR/TDEE/target trên máy.
src/screens/main/LogScreen.js          (2761)  — 3 tab trong 1 file: MealsTab, ActivityTab, WeightTab + modal add/edit + template picker cho cả meal lẫn activity.
src/screens/main/ProfileScreen.js       (219)  — GET /users/me → body stats (height/weight/bmi), active goal, nút logout.
src/screens/main/StatsScreen.js         (311)  — GET /stats/weekly + /weights?limit=7 → bar chart 7 ngày + lịch sử cân + goal progress.
src/screens/onboarding/AboutYouScreen.js       (308)  — DOB picker, gender 3 lựa chọn, height cm/ft có auto-convert khi toggle. Xuất {dob, gender, height(cm)}.
src/screens/onboarding/CreateAccountScreen.js  (120)  — [DEAD] Bản register cũ nền trắng "Step 1 of 8", chỉ navigate không gọi API. KHÔNG được import ở đâu.
src/screens/onboarding/CurrentWeightScreen.js  (158)  — Nhập cân nặng, hiện BMI realtime. Xuất {weight}.
src/screens/onboarding/FirstLogChoiceScreen.js (156)  — [UNREACHABLE] Start Fresh / Template. Không screen nào navigate tới nó.
src/screens/onboarding/GoalTypeScreen.js       (161)  — lose/maintain/gain. maintain → skip thẳng Summary.
src/screens/onboarding/LoginScreen.js          (375)  — Email/password, validate client, gọi loginService rồi login() của authStore.
src/screens/onboarding/RegisterScreen.js       (425)  — 4 field + validate; gọi registerService (raw fetch) → login() → navigate AboutYou. Còn 3 console.log.
src/screens/onboarding/SummaryScreen.js        (232)  — Tính BMR/TDEE/target/projected date trên máy để HIỂN THỊ, rồi POST /users/me/complete-profile và completeOnboarding(true).
src/screens/onboarding/TargetRateScreen.js     (193)  — [DEAD] Màn chọn tốc độ 0.1–1.0 kg/tuần. KHÔNG được import ở đâu.
src/screens/onboarding/TargetSettingsScreen.js (226)  — Goal weight với smart default (BMI 22 / -5% / +10%), Alert cross-goal. HARDCODE targetRate = 0.5.
src/screens/onboarding/TemplateSetupScreen.js  (107)  — [UNREACHABLE] Chỉ có nút Continue gọi /users/complete-onboarding.
src/screens/onboarding/WelcomeScreen.js        (327)  — Splash + tagline "Less logging. More results." → nút Get Started navigate('Login').
src/services/api.js                     (81)  — axios instance, baseURL HARDCODE LAN IP, request interceptor gắn Bearer, response interceptor refresh 401 có hàng đợi. Export getPatternToday, applyPattern.
src/services/auth.js                    (47)  — register (raw fetch, URL hardcode lần 2), login (axios), logout (DEAD), getStoredToken (DEAD).
src/store/authStore.js                  (80)  — React Context (KHÔNG phải Zustand dù tên file là store): token, user, onboardingCompleted, showWelcome + login/logout/restoreSession/completeOnboarding.
src/utils/bmr.js                        (46)  — calcBMR, calcTDEE, calcDailyTarget, calcProjectedDate (bản FE, trùng logic với BE).
src/utils/dateUtils.js                  (24)  — formatDateYYYYMMDD, getDayNameVi, translateMealType.
```

---

## PART 3 — BACKEND: DEPENDENCIES

| Package | package.json | node_modules thật | Loại |
|---|---|---|---|
| bcryptjs | ^2.4.3 | 2.4.3 | dep |
| cors | ^2.8.5 | 2.8.6 | dep |
| dotenv | ^16.3.1 | 16.6.1 | dep |
| express | ^4.18.2 | 4.22.1 | dep |
| express-rate-limit | ^6.10.0 | 6.11.2 | dep |
| helmet | ^7.0.0 | 7.2.0 | dep |
| jsonwebtoken | ^9.0.2 | 9.0.3 | dep |
| mongoose | ^7.5.0 | 7.8.9 | dep |
| openai | ^6.37.0 | 6.37.0 | dep |
| jest | ^29.7.0 | 29.7.0 | dev |
| mongodb-memory-server | ^9.5.0 | 9.5.0 | dev |
| nodemon | ^3.0.1 | 3.1.14 | dev |
| supertest | ^6.3.4 | 6.3.4 | dev |

Không có ⚠️ nào — mọi version cài đặt đều nằm trong range của `^`.

**Scripts:** `start` = `node src/server.js` · `dev` = `nodemon src/server.js` · `test` = `jest --runInBand --forceExit`
**Jest config:** nằm trong package.json, `testEnvironment: node`, `testMatch: **/__tests__/**/*.test.js`
**`engines`:** KHÔNG CÓ. Node đang chạy trên máy: v24.15.0.

**Dead dependency:** không có. Tất cả 9 dep runtime đều được import trong `src/`.

---

## PART 4 — BACKEND: BIẾN MÔI TRƯỜNG

| Biến | Có trong .env? | Có trong .env.example? | Được đọc ở file nào |
|---|---|---|---|
| MONGODB_URI | SET | YES | src/config/database.js:5 |
| JWT_ACCESS_SECRET | SET | YES | src/utils/jwt.js:4, :16 |
| JWT_REFRESH_SECRET | SET | YES | src/utils/jwt.js:10, :20 |
| JWT_ACCESS_EXPIRES | SET | YES | src/utils/jwt.js:5 |
| JWT_REFRESH_EXPIRES | SET | YES | src/utils/jwt.js:11 |
| PORT | SET | YES | src/server.js:6 |
| USDA_API_KEY | SET | YES | src/routes/meals.js:48 |
| OPENAI_API_KEY | SET | **NO** | src/routes/meals.js:6, src/routes/activities.js:6 |
| NODE_ENV | **MISSING** | YES | app.js:20,:24 · auth.js:22 · patterns.js:78 |
| FRONTEND_URL | **MISSING** | **NO** | src/app.js:20 |
| NUTRITIONIX_APP_ID | **MISSING** | **NO** | src/routes/meals.js:34 |
| NUTRITIONIX_APP_KEY | **MISSING** | **NO** | src/routes/meals.js:35 |

**Biến code đọc nhưng KHÔNG có trong .env (bug tiềm ẩn):**
- `NODE_ENV` — hệ quả thật: `patterns.js:78` đặt `THRESHOLD = NODE_ENV === 'production' ? 3 : 1`. Vì `.env` không set NODE_ENV, threshold = **1**, tức Smart Day Card hiện chỉ với 1 data point — trái với Key Decision #6 trong CLAUDE.md. Cũng khiến `auth.js:22` luôn dùng bcrypt 12 rounds (đúng cho prod) và `app.js:20` CORS mở `origin: true` (mọi origin).
- `FRONTEND_URL` — chỉ dùng khi NODE_ENV=production; khi lên Railway mà quên set thì CORS origin = `undefined`.
- `NUTRITIONIX_APP_ID` / `NUTRITIONIX_APP_KEY` — endpoint `POST /api/meals/search/nutrients` gửi header rỗng → Nutritionix trả 401 → throw → 500. Endpoint này hiện KHÔNG được frontend gọi.

**Biến trong .env nhưng code không dùng:** không có (cả 8 biến đều được đọc).

**.gitignore:**
- `trim-backend/.gitignore` CÓ chứa `.env` và `node_modules/`.
- `app/.gitignore` (root) CÓ chứa `.env`, `node_modules/`, `.expo/`, `dist/`, `build/`, `ios/`, `android/`, `.claude/`.
- 🔴 **NHƯNG:** `git ls-files --error-unmatch .env` trong `trim-backend` trả về **TRACKED**. `.env` đã được commit ở `20f54b4` TRƯỚC khi `.gitignore` được thêm (`.gitignore` hiện vẫn đang untracked). `.gitignore` không untrack file đã tracked. `node_modules/` cũng nằm trong danh sách tracked file. Giá trị secret nằm trong git history của repo con.
- Giảm nhẹ: `trim-backend` **không có remote**, nên chưa bị đẩy ra ngoài.

---

## PART 5 — BACKEND: MODELS

### 5.1 User — collection `users`

| field | type | required | default | enum/min/max | index |
|---|---|---|---|---|---|
| email | String | ✅ | — | lowercase, trim | unique: true + `index({email:1})` |
| passwordHash | String | ✅ | — | — | — |
| name | String | ✅ | — | trim | — |
| profile.dateOfBirth | Date | — | — | — | — |
| profile.gender | String | — | — | male / female / other | — |
| profile.height | Number | — | — | (cm, ghi trong comment) | — |
| profile.baseActivityLevel | String | — | `lightly_active` | sedentary / lightly_active / moderately_active / very_active | — |
| profile.timezone | String | — | — | — | — |
| currentStats.weight | Number | — | — | (kg) | — |
| currentStats.bmi | Number | — | — | — | — |
| currentStats.weightUpdatedAt | Date | — | — | — | — |
| goals[].type | String | ✅ | — | lose / gain / maintain | — |
| goals[].targetWeight | Number | — | — | (kg) | — |
| goals[].startWeight | Number | — | — | (kg) | — |
| goals[].weeklyRate | Number | — | — | (kg/tuần) | — |
| goals[].startDate | Date | — | `Date.now` | — | — |
| goals[].targetDate | Date | — | — | — | — |
| goals[].dailyCalorieTarget | Number | — | — | — | — |
| goals[].isActive | Boolean | — | `true` | — | — |
| settings.units | String | — | `metric` | metric / imperial | — |
| settings.notifications.weightReminder | Boolean | — | `true` | — | — |
| settings.notifications.goalProgress | Boolean | — | `true` | — | — |
| settings.notifications.weeklyReport | Boolean | — | `true` | — | — |
| subscription.plan | String | — | `free` | free / premium | — |
| subscription.expiresAt | Date | — | — | — | — |
| onboardingCompleted | Boolean | — | `false` | — | — |
| refreshTokens[].token | String | — | — | — | — |
| refreshTokens[].createdAt | Date | — | `Date.now` | — | TTL `expires: '30d'` |
| createdAt / updatedAt | Date | auto | — | — | — |

- **Index:** `{email:1}` khai báo tường minh (dòng 96) + `unique:true` trên chính field email (dòng 7) → **trùng index**, Mongoose sẽ warn `Duplicate schema index`.
- **Hook:** KHÔNG CÓ pre/post hook nào.
- **Methods:** `toJSON()` (dòng 99) — xoá `passwordHash` và `refreshTokens` khỏi output.
- **Statics / Virtuals:** KHÔNG CÓ.
- **Dead field:** `profile.baseActivityLevel` (khai báo + có default, nhưng KHÔNG có route nào ghi vào, và không có công thức nào đọc — tất cả nơi tính TDEE đều dùng `bmr * 0.2` hardcode). `profile.timezone` (chỉ ĐỌC ở `patterns.js:75,188`, không có route nào GHI vào → luôn undefined → luôn fallback về UTC). `settings.*` và `subscription.expiresAt` chưa có route nào ghi. `subscription.plan` chỉ được ĐỌC ở `templates.js:115`.
- 🔴 **Ngược lại:** `users.js:98-99` ghi `'currentStats.bmr'` và `'currentStats.baseline'` — **hai field này KHÔNG tồn tại trong schema** → Mongoose strict mode bỏ im lặng, không bao giờ lưu được.

### 5.2 WeightLog — collection `weightlogs`

| field | type | required | default | enum/min/max | index |
|---|---|---|---|---|---|
| user | ObjectId ref User | ✅ | — | — | trong compound |
| weight | Number | ✅ | — | — | — |
| date | **Date** | — | `Date.now` | — | trong compound |
| bmi | Number | — | — | — | — |
| notes | String | — | — | — | — |
| source | String | — | `manual` | (không enum) | — |
| createdAt / updatedAt | Date | auto | — | — | — |

- **Index:** `{user:1, date:-1}`, không unique.
- **Hook / methods / statics / virtuals:** KHÔNG CÓ.
- **Dead field:** không có (tất cả đều được ghi ở `weights.js:24` hoặc `users.js:65`).
- ⚠️ `date` ở đây là **Date**, trong khi MealLog/ActivityLog dùng **String** — không nhất quán. Index `{user, date:-1}` cũng gần như không được dùng: mọi query đều `.sort({createdAt:-1})`.

### 5.3 MealLog — collection `meallogs`

| field | type | required | default | enum/min/max | index |
|---|---|---|---|---|---|
| user | ObjectId ref User | ✅ | — | — | trong compound |
| date | **String** (YYYY-MM-DD) | ✅ | — | — | trong compound |
| mealType | String | ✅ | — | breakfast / lunch / dinner / snack | — |
| items[]._id | ObjectId | auto | auto | — | — |
| items[].name | String | ✅ | — | — | — |
| items[].calories | Number | ✅ | — | min: 0 | — |
| items[].protein | Number | — | 0 | — | — |
| items[].carbs | Number | — | 0 | — | — |
| items[].fat | Number | — | 0 | — | — |
| items[].servingSize | String | — | — | — | — |
| items[].servingQuantity | Number | — | 1 | — | — |
| items[].source | String | — | `manual` | (không enum) | — |
| totals.calories | Number | — | 0 | — | — |
| totals.protein | Number | — | 0 | — | — |
| totals.carbs | Number | — | 0 | — | — |
| totals.fat | Number | — | 0 | — | — |
| notes | String | — | — | — | — |
| createdAt / updatedAt | Date | auto | — | — | — |

- **Index:** `{user:1, date:1}`, không unique. **Hook/methods/statics/virtuals:** KHÔNG CÓ. **Dead field:** không có.

### 5.4 ActivityLog — collection `activitylogs`

| field | type | required | default | enum/min/max | index |
|---|---|---|---|---|---|
| user | ObjectId ref User | ✅ | — | — | trong compound |
| date | **String** (YYYY-MM-DD) | ✅ | — | — | trong compound |
| entries[]._id | ObjectId | auto | auto | — | — |
| entries[].name | String | ✅ | — | — | — |
| entries[].type | String | — | — | (KHÔNG có enum) | — |
| entries[].durationMinutes | Number | ✅ | — | min: 0 | — |
| entries[].caloriesBurned | Number | ✅ | — | min: 0 | — |
| entries[].intensity | String | — | — | low / medium / high | — |
| summary.totalCaloriesBurned | Number | — | 0 | — | — |
| summary.totalActiveMinutes | Number | — | 0 | — | — |
| createdAt / updatedAt | Date | auto | — | — | — |

- **Index:** `{user:1, date:1}`. **Hook/methods/statics/virtuals:** KHÔNG CÓ. **Dead field:** không có.
- ⚠️ `entries[].type` không có enum dù AI prompt ở `activities.js:30` liệt kê 5 giá trị hợp lệ (cardio/strength/daily_activity/sport/other) — không có gì ép buộc.
- ⚠️ ActivityChatScreen gửi `source: 'ai_parsed'` cho mỗi entry nhưng schema **không có** field `source` → bị Mongoose bỏ im lặng.

### 5.5 Template — collection `templates`

| field | type | required | default | enum/min/max | index |
|---|---|---|---|---|---|
| user | ObjectId ref User | ✅ | — | — | `index: true` + trong compound |
| type | String | ✅ | — | meal / activity | trong compound |
| name | String | ✅ | — | trim, minlength 1, maxlength 100 | — |
| mealType | String | — | — | breakfast / lunch / dinner / snack | — |
| items[]._id | ObjectId | auto | auto | — | — |
| items[].name | String | ✅ | — | — | — |
| items[].calories | Number | ✅ | — | min: 0 | — |
| items[].protein | Number | — | 0 | — | — |
| items[].carbs | Number | — | 0 | — | — |
| items[].fat | Number | — | 0 | — | — |
| items[].servingSize | String | — | — | — | — |
| activityName | String | — | — | — | — |
| durationMinutes | Number | — | — | min: 1 | — |
| caloriesBurned | Number | — | — | min: 0 | — |
| createdAt / updatedAt | Date | auto | — | — | — |

- **Index:** `user` có `index:true` (dòng 17) **và** `{user:1, type:1}` (dòng 45) → index `{user:1}` là thừa vì đã là prefix của compound.
- **Hook/methods/statics/virtuals:** KHÔNG CÓ.
- **Dead field:** không có, nhưng schema cho phép doc `type:'meal'` vẫn lưu `activityName` — validation chỉ nằm ở route, không ở model.

---

## PART 6 — BACKEND: ENDPOINTS

Prefix mount ở `src/app.js:43-50`. 32 endpoint.

### /api/auth (routes/auth.js) — KHÔNG có auth middleware

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| POST | /api/auth/register | auth.js:9 | ❌ | có (chỉ check tồn tại 3 field) | `{name, email, password}` | `{accessToken, refreshToken, user:{_id, name, email, onboardingCompleted:false}}` | 201 |
| | | | | | | `{message:'name, email, and password are required'}` | 400 |
| | | | | | | `{message:'User already exists'}` | 400 |
| POST | /api/auth/login | auth.js:46 | ❌ | ❌ (không check thiếu field) | `{email, password}` | `{accessToken, refreshToken, user:{_id, name, email, onboardingCompleted}}` | 200 |
| | | | | | | `{message:'Invalid credentials'}` (cả user-not-found lẫn sai pass) | 401 |
| POST | /api/auth/refresh | auth.js:77 | ❌ | có | `{refreshToken}` | `{accessToken}` — **chỉ access token, KHÔNG rotate refresh** | 200 |
| | | | | | | `{message:'Refresh token required'}` | 400 |
| | | | | | | `{message:'Invalid refresh token'}` | 401 |
| POST | /api/auth/logout | auth.js:105 | ❌ | có | `{refreshToken}` | `{message:'Logged out successfully'}` | 200 |
| | | | | | | `{message:'Refresh token required'}` | 400 |

### /api/users (routes/users.js) — auth per-route

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| GET | /api/users/me | users.js:9 | ✅ | — | — | `{user: <full User doc, đã bỏ passwordHash + refreshTokens qua toJSON>}` | 200 |
| PUT | /api/users/me | users.js:19 | ✅ | whitelist `name, profile, settings` + runValidators | `{name?, profile?, settings?}` | `{user: <User doc mới>}` | 200 |
| POST | /api/users/me/complete-profile | users.js:47 | ✅ | ❌ **không validate gì** — `profile.dateOfBirth`/`profile.height`/`weight` thiếu là crash/NaN | `{profile:{dateOfBirth, gender, height}, weight, goal:{type, targetWeight, startWeight, weeklyRate}}` | `{success:true, bmr, baseline, tdee, dailyCalorieTarget}` | 200 |
| PUT | /api/users/me/goal | users.js:122 | ✅ | ❌ **không validate gì** | `{type, targetWeight, weeklyRate, startWeight}` | `{success:true, dailyCalorieTarget}` | 200 |
| POST | /api/users/complete-onboarding | users.js:179 | ✅ | — | — | `{success:true}` | 200 |

### /api/weights (routes/weights.js) — `router.use(authenticate)` toàn bộ

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| POST | /api/weights | weights.js:11 | ✅ | có (weight phải là number > 0) | `{weight, date?, notes?}` | `<WeightLog doc: {_id, user, weight, date, bmi, notes, source, createdAt, updatedAt, __v}>` | 201 |
| | | | | | | `{message:'Valid weight in kg is required'}` | 400 |
| GET | /api/weights/latest | weights.js:40 | ✅ | — | — | `<WeightLog doc>` (sort createdAt desc) | 200 |
| | | | | | | `{message:'No weight logs found'}` | 404 |
| GET | /api/weights | weights.js:51 | ✅ | clamp limit ≤ 100 | `?limit=30` | `[<WeightLog doc>, ...]` — **mảng trần, không bọc object** | 200 |
| DELETE | /api/weights/:id | weights.js:62 | ✅ (lọc theo user) | — | — | `{message:'Deleted'}` + rollback `currentStats` về log mới nhất, hoặc `$unset` nếu hết log | 200 |
| | | | | | | `{message:'Weight log not found'}` | 404 |

### /api/meals (routes/meals.js) — `router.use(authenticate)` toàn bộ

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| GET | /api/meals/search | meals.js:40 | ✅ | có (q) | `?q=` | `{results:[{name, brand, calories, protein, carbs, fat, servingSize, servingQty}]}` — nếu USDA lỗi thì trả FALLBACK_FOODS (5 món cứng, shape có thêm `type:'common'`) | 200 |
| | | | | | | `{message:'Query param q is required'}` | 400 |
| POST | /api/meals/search/nutrients | meals.js:107 | ✅ | có (foodName) | `{foodName, servingQty?}` | `{name, calories, protein, carbs, fat, servingQty, servingSize}` | 200 |
| | | | | | | `{message:'foodName is required'}` / `{message:'Food not found'}` | 400 / 404 |
| | | | | | | thực tế luôn ném lỗi → errorHandler `{message:'Nutritionix nutrients API error'}` vì thiếu env | 500 |
| POST | /api/meals/parse-text | meals.js:144 | ✅ | có (text) | `{text, date?}` | `{items:[{name, calories, protein, carbs, fat, servingSize, nutritionNote}], totalCalories, text, date}` | 200 |
| | | | | | | `{message:'text is required'}` | 400 |
| | | | | | | `{message:'AI parsing failed'}` / `{message:'Failed to parse AI response'}` | 500 |
| POST | /api/meals | meals.js:188 | ✅ | có (date, mealType enum, items không rỗng) | `{date, mealType, items[], notes?}` | `<MealLog doc: {_id, user, date, mealType, items[], totals{calories,protein,carbs,fat}, notes, createdAt, updatedAt}>` | 201 |
| | | | | | | `{message:'date is required (YYYY-MM-DD)'}` / `{message:'mealType must be ...'}` / `{message:'items array is required and must not be empty'}` | 400 |
| GET | /api/meals | meals.js:210 | ✅ | có (date) | `?date=YYYY-MM-DD` | `[<MealLog doc>, ...]` — **mảng trần** | 200 |
| | | | | | | `{message:'Query param date is required (YYYY-MM-DD)'}` | 400 |
| PUT | /api/meals/:id | meals.js:223 | ✅ (lọc theo user) | có (updateItem.itemId) | `{updateItem:{itemId, name?, calories?}}` — **chỉ sửa được name + calories** | `<MealLog doc đã cập nhật + totals tính lại>` | 200 |
| | | | | | | `{message:'updateItem.itemId is required'}` / `{message:'Meal not found'}` / `{message:'Item not found'}` | 400 / 404 / 404 |
| DELETE | /api/meals/:id | meals.js:248 | ✅ (lọc theo user) | — | — | `{message:'Deleted'}` / `{message:'Meal not found'}` | 200 / 404 |
| DELETE | /api/meals/:mealId/items/:itemId | meals.js:259 | ✅ (lọc theo user) | — | — | `<MealLog doc còn lại>` / `{message:'Meal not found'}` / `{message:'Item not found'}` | 200 / 404 |

### /api/activities (routes/activities.js) — `router.use(authenticate)` toàn bộ

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| POST | /api/activities/parse-text | activities.js:17 | ✅ | có (text) | `{text, date?}` | `{entries:[{name, type, durationMinutes, caloriesBurned, intensity, note}], totalCaloriesBurned, text, date}` | 200 |
| | | | | | | `{message:'text is required'}` / `{message:'AI parsing failed'}` / `{message:'Failed to parse AI response'}` | 400 / 500 / 500 |
| POST | /api/activities | activities.js:60 | ✅ | có (date, entries, mỗi entry: name + durationMinutes number ≥0 + caloriesBurned number ≥0) | `{date, entries[]}` | `<ActivityLog doc: {_id, user, date, entries[], summary{totalCaloriesBurned, totalActiveMinutes}, createdAt, updatedAt}>` | 201 |
| | | | | | | `{message:'date is required (YYYY-MM-DD)'}` / `{message:'entries array is required and must not be empty'}` / `{message:'Each entry requires a name'}` / `{message:'Each entry requires durationMinutes >= 0'}` / `{message:'Each entry requires caloriesBurned >= 0'}` | 400 |
| GET | /api/activities | activities.js:89 | ✅ | có (date) | `?date=YYYY-MM-DD` | `[<ActivityLog doc>, ...]` — **mảng trần** | 200 |
| | | | | | | `{message:'Query param date is required (YYYY-MM-DD)'}` | 400 |
| PUT | /api/activities/:id | activities.js:102 | ✅ (lọc theo user) | có (updateEntry.entryId) | `{updateEntry:{entryId, name?, caloriesBurned?, durationMinutes?}}` | `<ActivityLog doc + summary tính lại>` | 200 |
| | | | | | | `{message:'updateEntry.entryId is required'}` / `{message:'Activity log not found'}` / `{message:'Entry not found'}` | 400 / 404 / 404 |
| DELETE | /api/activities/:id | activities.js:128 | ✅ (lọc theo user) | — | — | `{message:'Deleted'}` / `{message:'Activity log not found'}` | 200 / 404 |

### /api/stats (routes/stats.js) — `router.use(authenticate)` toàn bộ

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| GET | /api/stats/daily | stats.js:45 | ✅ | — (thiếu date → mặc định hôm nay UTC) | `?date=YYYY-MM-DD` | `{date, caloriesConsumed, caloriesBurned, bmr, tdee, deficit, dailyTarget, meals:[<MealLog>], activities:[<ActivityLog>]}` | 200 |
| GET | /api/stats/weekly | stats.js:56 | ✅ | — | — | `{days:[<7 object giống /daily>], totals:{caloriesConsumed, caloriesBurned, avgDeficit}}` | 200 |

### /api/templates (routes/templates.js) — `router.use(authenticate)` toàn bộ

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| GET | /api/templates | templates.js:59 | ✅ | có (type enum) | `?type=meal\|activity&page=1&limit=20` | `{templates:[<Template doc>], pagination:{total, page, limit, totalPages}}` | 200 |
| | | | | | | `{message:'type must be meal or activity'}` | 400 |
| POST | /api/templates | templates.js:97 | ✅ | đầy đủ (name 1–100, type enum, meal: mealType+items, activity: activityName+duration>0+calories≥0) | `{type, name, mealType?, items?, activityName?, durationMinutes?, caloriesBurned?}` | `<Template doc>` | 201 |
| | | | | | | `{message:'name is required'}` / `'name must be 100 characters or fewer'` / `'type must be meal or activity'` / các message validate meal/activity | 400 |
| | | | | | | `{message:'Free plan is limited to 10 templates. Upgrade to premium for unlimited templates.'}` | 403 |
| PUT | /api/templates/:id | templates.js:154 | ✅ + ownership check tường minh | có (partial, theo type) | `{name?, mealType?, items?, activityName?, durationMinutes?, caloriesBurned?}` | `<Template doc>` | 200 |
| | | | | | | `{message:'Template not found'}` (id sai format hoặc không tồn tại) | 404 |
| | | | | | | `{message:'Access denied'}` | 403 |
| | | | | | | các message validate | 400 |
| DELETE | /api/templates/:id | templates.js:223 | ✅ + ownership check | — | — | `{message:'Deleted'}` / `{message:'Template not found'}` / `{message:'Access denied'}` | 200 / 404 / 403 |

### /api/patterns (routes/patterns.js) — `router.use(authenticate)` toàn bộ

| Method | Path | File:dòng | Auth | Validate | Body/query | Response (shape thật) | Status |
|---|---|---|---|---|---|---|---|
| GET | /api/patterns/today | patterns.js:72 | ✅ | — | — | Không đủ data: `{success:true, data:{pattern:null, dataPointCount}}` | 200 |
| | | | | | | Đủ data: `{success:true, data:{pattern:{dayOfWeek, dataPointCount, sourceDate, preview:{totalCaloriesConsumed, totalCaloriesBurned, estimatedTDEE, meals:[{mealType, items:[{name, calories, protein, carbs, fat, servingSize, servingQuantity}]}], activities:[{name, type, durationMinutes, caloriesBurned, intensity}]}}}}` | 200 |
| POST | /api/patterns/apply | patterns.js:185 | ✅ | đầy đủ (format YYYY-MM-DD, không phải hôm nay, phải nằm trong [today-7, today-14, today-21]) | `{sourceDate}` | `{success:true, data:{appliedDate, sourceDate, mealLogsCreated, activityLogsCreated, totalCaloriesConsumed, totalCaloriesBurned}}` | 200 |
| | | | | | | `{success:false, error:'sourceDate is required'}` / `'sourceDate must be in YYYY-MM-DD format'` / `'sourceDate cannot be today'` / `"sourceDate must be within the last 21 days and share today's day-of-week"` | 400 |
| | | | | | | `{success:false, error:'Today already has logs. Apply would overwrite.', conflictCount}` | 409 |

⚠️ **Chú ý shape không nhất quán:** `/api/patterns/*` là router DUY NHẤT dùng envelope `{success, data}` và trả lỗi ở key `error`. Mọi router khác trả doc trần / mảng trần và lỗi ở key `message`.

### Khác

| Method | Path | File:dòng | Auth | Response | Status |
|---|---|---|---|---|---|
| GET | /health | app.js:52 | ❌ | `{status:'OK', timestamp}` | 200 |
| ALL | `*` | app.js:56 | ❌ | `{message:'Route not found'}` | 404 |

---

## PART 7 — BACKEND: LOGIC TÍNH TOÁN

### 7.1 `src/utils/bmr.js` — nguyên văn

```js
// Mifflin-St Jeor BMR formula
const calculateBMR = (weight, height, age, gender) => {
  // weight in kg, height in cm, age in years
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === 'female') {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // For other genders, use average
    return (10 * weight + 6.25 * height - 5 * age) - 78;
  }
};

const calculateBMI = (weight, height) => {
  // weight in kg, height in cm
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
};

const calculateTDEE = (bmr, loggedBurned = 0) => {
  const baseline = Math.round(bmr * 0.2);
  return bmr + baseline + Math.round(loggedBurned);
};

const calculateDailyCalorieTarget = (tdee, weeklyRate) => {
  // weeklyRate in kg per week (negative for weight loss)
  // 7700 calories per kg of fat
  const dailyDeficit = (weeklyRate * 7700) / 7;
  return tdee - dailyDeficit;
};

const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};
```

| Hàm | Nhận vào (đơn vị) | Trả ra | Gọi ở đâu |
|---|---|---|---|
| `calculateBMR` | weight **kg**, height **cm**, age **năm**, gender string | Number (kcal, KHÔNG làm tròn) | `stats.js:23` |
| `calculateBMI` | weight **kg**, height **cm** | Number (KHÔNG làm tròn) | `weights.js:21` |
| `calculateTDEE` | bmr, loggedBurned (kcal) | Number | **KHÔNG AI GỌI — DEAD** |
| `calculateDailyCalorieTarget` | tdee, weeklyRate **kg/tuần** (comment ghi âm khi giảm cân) | Number | **KHÔNG AI GỌI — DEAD** |
| `calculateAge` | dateOfBirth (Date/string) | Number (năm, chính xác theo tháng/ngày) | `stats.js:22` |

**Hàm định nghĩa nhưng không ai gọi:** `calculateTDEE`, `calculateDailyCalorieTarget`.

### 7.2 Công thức TRÙNG LẶP inline (không dùng bmr.js)

Cùng một công thức BMR/TDEE được viết lại tay ở **4 chỗ nữa**, mỗi chỗ một kiểu tính tuổi:

**`users.js:74-87` (POST /me/complete-profile) — nguyên văn:**
```js
const dob = new Date(profile.dateOfBirth);
const age = Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
const base = 10 * weight + 6.25 * profile.height - 5 * age;
const bmr = profile.gender === 'male' ? Math.round(base + 5)
          : profile.gender === 'female' ? Math.round(base - 161)
          : Math.round(base - 78);

const baseline = Math.round(bmr * 0.2);
const tdee = bmr + baseline; // no logged activity on day 0
const weeklyDeficit = Math.round((goal.weeklyRate || 0) * 7700 / 7);
const dailyCalorieTarget =
  goal.type === 'lose'     ? tdee - weeklyDeficit
  : goal.type === 'gain'   ? tdee + weeklyDeficit
  : tdee;
```
BMI ở dòng 63: `parseFloat((weight / Math.pow(profile.height / 100, 2)).toFixed(1))`

**`users.js:130-143` (PUT /me/goal) — nguyên văn:** giống hệt trên, chỉ khác là đọc weight/height/dob từ `user` trong DB thay vì body; `dailyAdjustment` thay tên cho `weeklyDeficit`.

**`patterns.js:36-48` (computeBMR) — nguyên văn:**
```js
function computeBMR(user) {
  const weight = user.currentStats?.weight;
  const height = user.profile?.height;
  const dob    = user.profile?.dateOfBirth;
  const gender = user.profile?.gender;
  if (!weight || !height || !dob) return null;
  const ageMs = Date.now() - new Date(dob).getTime();
  const age   = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  const base  = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male')   return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78;
}
```
Gọi ở `patterns.js:152`. Nhưng TDEE ở `patterns.js:154` lại dùng hệ số khác: `Math.round(bmr * 1.2 + totalCaloriesBurned)` — trong khi mọi nơi khác dùng `bmr + Math.round(bmr*0.2)`. Với bmr lẻ, hai cách này ra số khác nhau tới 1 kcal; quan trọng hơn là **không cùng một hàm**.

**`stats.js:19-28` (buildDailyStats):**
```js
if (profile?.dateOfBirth && profile?.height && profile?.gender) {
  const age = calculateAge(profile.dateOfBirth);
  bmr = Math.round(calculateBMR(currentStats?.weight || 70, profile.height, age, profile.gender));
}
const baseline = Math.round(bmr * 0.2);
const tdee = bmr + baseline + Math.round(caloriesBurned);
const deficit = tdee - caloriesConsumed;
```
Đây là chỗ DUY NHẤT dùng `calculateAge` chính xác. Ba chỗ kia dùng `/365.25` — sai lệch tới 1 tuổi. Cũng lưu ý fallback `|| 70` khi thiếu cân nặng → BMR bịa.

**Tính BMI nằm ở 3 chỗ backend:** `bmr.js:14` (calculateBMI, dùng ở weights.js), `users.js:63` (inline), và không có ở đâu khác.

---

## PART 8 — BACKEND: MIDDLEWARE & SERVER

### 8.1 `src/middleware/auth.js`
- Đọc `req.headers.authorization`, bắt buộc prefix `Bearer ` (7 ký tự).
- `verifyAccessToken(token)` → payload `{userId}` (payload được ký ở `auth.js:29,60` là `{userId: user._id}`).
- `User.findById(decoded.userId)` — **query DB trên MỌI request đã auth**.
- **Gán `req.user = user` — đây là FULL Mongoose document, KHÔNG phải id.**
  → **Phase 1 phải dùng `req.user._id`.** Không có `req.userId`, không có `req.user.id` (thực ra `.id` virtual của Mongoose vẫn tồn tại và trả string, nhưng toàn bộ code hiện tại dùng `req.user._id`).
  → Ngoài `_id`, `req.user` còn có sẵn `.profile`, `.currentStats`, `.goals`, `.subscription` — routes đang tận dụng (`weights.js:20`, `templates.js:115`, `patterns.js:75`, `stats.js:48`).
- Lỗi: `TokenExpiredError` → 401 `{message:'Access token expired'}`; `JsonWebTokenError` → 401 `{message:'Invalid access token'}`; còn lại → 500 `{message:'Authentication error'}`. Không có header → 401 `{message:'Access token required'}`. User bị xoá → 401 `{message:'User not found'}`.

### 8.2 `src/middleware/errorHandler.js`
- Luôn `console.error(err.stack)` trước.
- `ValidationError` → 400 `{message:'Validation Error', errors:[...string]}` — **shape lỗi DUY NHẤT có key `errors`**.
- `err.code === 11000` → 400 `{message:'<Field> already exists'}`.
- `JsonWebTokenError` → 401 `{message:'Invalid token'}`; `TokenExpiredError` → 401 `{message:'Token expired'}`.
- Mặc định → `err.status || 500`, `{message: err.message || 'Internal Server Error'}`.
  → ⚠️ Lỗi nội bộ bất kỳ (kể cả lỗi từ Nutritionix/OpenAI) sẽ **rò message gốc ra client**.

### 8.3 `src/app.js` — thứ tự middleware
```
1. helmet()                                    (mặc định, không config)
2. cors({ origin: NODE_ENV==='production' ? FRONTEND_URL : true, credentials: true })
3. rateLimit  → app.use('/api/', ...)          windowMs 15p, max 100 (10000 khi test)
4. authLimiter→ app.use('/api/auth', ...)      windowMs 15p, max 5  (10000 khi test)
5. express.json({ limit: '10mb' })
6. express.urlencoded({ extended: true })
7. 8 router: /api/auth /api/users /api/weights /api/meals /api/activities /api/stats /api/templates /api/patterns
8. GET /health
9. app.use('*') → 404
10. errorHandler
```
- ⚠️ `/api/auth/*` đi qua **cả hai** limiter → hiệu lực thật là 5 request / 15 phút / IP cho auth.
- ⚠️ **KHÔNG có `app.set('trust proxy', ...)`** — chạy sau reverse proxy của Railway thì express-rate-limit sẽ đọc IP của proxy, tất cả user chung 1 quota.
- ⚠️ `express.json` giới hạn **10mb** — rất rộng cho app này.

### 8.4 `src/server.js`
```js
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
```
- **KHÔNG bind `0.0.0.0` tường minh.** (Node mặc định `::`/mọi interface khi bỏ trống host, nên LAN vẫn vào được — nhưng không được khai báo rõ.)
- `connectDB()` gọi trước `listen`, không await → server có thể listen trước khi DB kết nối xong.

---

## PART 9 — FRONTEND: TRẠNG THÁI THẬT

### 9.1 Navigation

```
NavigationContainer  (RootNavigator.js:44)
└── điều kiện tại RootNavigator.js:34-41
    ├── !token                      → OnboardingStack initialRoute="Welcome"
    ├── token && !onboardingCompleted → OnboardingStack initialRoute="AboutYou"
    └── token && onboardingCompleted  → MainTabs

OnboardingStack (native-stack, headerShown:false) — 10 screen
├── Welcome        → WelcomeScreen
├── Login          → LoginScreen
├── CreateAccount  → RegisterScreen      ← tên route KHÁC tên component
├── AboutYou       → AboutYouScreen
├── CurrentWeight  → CurrentWeightScreen
├── GoalType       → GoalTypeScreen
├── TargetSettings → TargetSettingsScreen
├── Summary        → SummaryScreen
├── FirstLogChoice → FirstLogChoiceScreen   [UNREACHABLE]
└── TemplateSetup  → TemplateSetupScreen    [UNREACHABLE]

MainTabs (bottom-tabs, headerShown:false)
├── Home    → HomeScreen
├── Log     → LogStack (native-stack)
│            ├── LogMain      → LogScreen
│            ├── ChatInput    → ChatInputScreen
│            └── ActivityChat → ActivityChatScreen
├── Stats   → StatsScreen
└── Profile → ProfileScreen
```

**Điều kiện chuyển:** biến `token` và `onboardingCompleted` từ `useAuth()` (Context ở `authStore.js`). Nguồn ban đầu: `RootNavigator.js:12-28` đọc SecureStore một lần lúc mount (`authToken`, `authUser`, `onboardingCompleted`). Sau đó `authStore.login()` / `completeOnboarding()` / `logout()` cập nhật state → RootNavigator tự đổi navigator.

⚠️ Vì việc chuyển stack là **thay cả navigator**, `SummaryScreen.handleNext()` gọi `completeOnboarding(true)` sẽ nhảy thẳng vào MainTabs — nên `FirstLogChoice` và `TemplateSetup` không bao giờ hiển thị (không có `navigate('FirstLogChoice')` ở bất kỳ file nào).

### 9.2 Screens

| Screen | File | Dòng | Implement thật? | Gọi API nào | State lấy từ đâu |
|---|---|---|---|---|---|
| Welcome | onboarding/WelcomeScreen.js | 327 | ✅ thật (animation + tagline) | — | local |
| Login | onboarding/LoginScreen.js | 375 | ✅ thật | `POST /auth/login` (qua services/auth) | local + `useAuth().login` |
| Register (route CreateAccount) | onboarding/RegisterScreen.js | 425 | ✅ thật | `POST /auth/register` (raw fetch) | local + `useAuth().login` |
| AboutYou | onboarding/AboutYouScreen.js | 308 | ✅ thật | — | `route.params.userData` + local |
| CurrentWeight | onboarding/CurrentWeightScreen.js | 158 | ✅ thật | — | `route.params.userData` + local |
| GoalType | onboarding/GoalTypeScreen.js | 161 | ✅ thật | — | `route.params.userData` + local |
| TargetSettings | onboarding/TargetSettingsScreen.js | 226 | ✅ thật | — | `route.params.userData` + local |
| Summary | onboarding/SummaryScreen.js | 232 | ✅ thật | `POST /users/me/complete-profile` | `route.params.userData` + `useAuth()` |
| FirstLogChoice | onboarding/FirstLogChoiceScreen.js | 156 | ✅ code thật nhưng **UNREACHABLE** | `POST /users/complete-onboarding` | `useAuth()` |
| TemplateSetup | onboarding/TemplateSetupScreen.js | 107 | ⚠️ code thật nhưng chỉ có 1 nút Continue, không setup gì; **UNREACHABLE** | `POST /users/complete-onboarding` | `useAuth()` |
| CreateAccountScreen | onboarding/CreateAccountScreen.js | 120 | 🗑️ **DEAD** — không import ở đâu | — | local |
| TargetRateScreen | onboarding/TargetRateScreen.js | 193 | 🗑️ **DEAD** — không import ở đâu | — | `route.params.userData` |
| Home | main/HomeScreen.js | 1208 | ✅ thật | `GET /stats/daily?date=`, `GET /users/me`, `GET /patterns/today`, `PUT /users/me/goal` (3 chỗ) | local `stats`+`profile` + `useAuth()` + AsyncStorage(`showZoneBar`, `smartCardDismissed:*`) |
| Log | main/LogScreen.js | 2761 | ✅ thật (3 tab trong 1 file) | meals: `GET/POST/PUT/DELETE /meals*`, `GET/POST/PUT/DELETE /templates*`; activity: `GET/POST/PUT/DELETE /activities*`; weight: `GET /weights?limit=30`, `POST /weights`, `DELETE /weights/:id`, `GET /users/me` | local per-tab + `route.params.initialTab` |
| ChatInput | main/ChatInputScreen.js | 654 | ✅ thật | `POST /meals/parse-text`, `GET /stats/daily`, `POST /meals` | local |
| ActivityChat | main/ActivityChatScreen.js | 528 | ✅ thật | `POST /activities/parse-text`, `GET /stats/daily`, `POST /activities` | local |
| Stats | main/StatsScreen.js | 311 | ✅ thật | `GET /stats/weekly`, `GET /weights?limit=7` | local + `useAuth().user` |
| Profile | main/ProfileScreen.js | 219 | ✅ thật | `GET /users/me` | local, seed từ `useAuth().user` |

### 9.3 API layer

**`src/services/api.js` (81 dòng)**
- `const BASE_URL = 'http://192.168.68.108:5000/api';` — **hardcode LAN IP, không đọc env, không có config theo môi trường.**
- `axios.create({ baseURL: BASE_URL, timeout: 10000, headers: {'Content-Type':'application/json'} })`
- **Request interceptor:** gắn `Authorization: Bearer ${_authToken}` nếu có. Token giữ trong biến module `_authToken` (set qua `setAuthToken`), không đọc SecureStore mỗi request.
- **Response interceptor (refresh flow — đã hoàn chỉnh):**
  - Bỏ qua nếu status ≠ 401 hoặc request đã `_retry`.
  - Nếu đang refresh → đẩy vào `_failedQueue`, resolve xong thì retry.
  - Đọc `refreshToken` từ SecureStore, gọi `axios.post(BASE_URL + '/auth/refresh')` **trực tiếp bằng axios gốc** để tránh đệ quy interceptor.
  - Lưu access token mới vào SecureStore + `setAuthToken`, flush queue, retry request gốc.
  - Thất bại → xoá `authToken`/`refreshToken`/`authUser` + gọi `_logoutCallback`.
- Export thêm 2 hàm domain: `getPatternToday()` (`GET /patterns/today`), `applyPattern(sourceDate)` (`POST /patterns/apply`).

**`src/services/auth.js` (47 dòng)** — **TRỘN LẪN fetch và axios:**
| Hàm | Endpoint | HTTP client | Trạng thái |
|---|---|---|---|
| `register(userData)` | `POST /auth/register` | **raw `fetch`, URL hardcode lần 2** (`http://192.168.68.108:5000/api/auth/register`) | dùng bởi RegisterScreen |
| `login(email, password)` | `POST /auth/login` | axios (`api`) | dùng bởi LoginScreen; tự ghi SecureStore `authToken` + `refreshToken` |
| `logout()` | — (không gọi API) | — | 🗑️ **DEAD** — không ai import; chỉ xoá `authToken`, quên `refreshToken` |
| `getStoredToken()` | — | — | 🗑️ **DEAD** — không ai import |

⚠️ `register` đi qua fetch nên **không qua interceptor** — đúng ý đồ (chưa có token), nhưng URL bị nhân đôi ở 2 file. Nếu đổi IP phải sửa 2 chỗ.
⚠️ **Không nơi nào gọi `POST /api/auth/logout`** → mảng `user.refreshTokens` phình lên mỗi lần login, chỉ tự dọn sau TTL 30 ngày.

### 9.4 State — `src/store/authStore.js` (80 dòng)

**Không phải Zustand/Redux — là React Context** (`createContext` + `AuthProvider` + hook `useAuth`).

Expose ra (`value` ở dòng 65-78):
`token`, `user`, `isLoading`, `onboardingCompleted`, `showWelcome`, `login`, `restoreSession`, `logout`, `completeOnboarding`, `clearWelcome`, `setLoading`, `isAuthenticated` (= `!!token`).

Ngoài ra export riêng: `getOnboardingCompleted()` (đọc SecureStore).

**Token lưu ở đâu:** `expo-secure-store` — 4 key: `authToken`, `refreshToken`, `authUser` (JSON string của user), `onboardingCompleted` (chuỗi `'true'`/`'false'`). ✅ Không dùng AsyncStorage cho token. (AsyncStorage chỉ dùng cho `showZoneBar` và `smartCardDismissed:YYYY-MM-DD` — dữ liệu không nhạy cảm.)

**Restore session hoạt động thế nào:** `RootNavigator.js:12-28` — `Promise.all` đọc 3 key SecureStore một lần lúc mount. Có `authToken` → `restoreSession(token, JSON.parse(authUser), onboardingDone)` (chỉ set state trong bộ nhớ + `setAuthToken`). Không có → `logout()`. `.catch(() => logout())`. Cờ `isCheckingToken` render `null` trong lúc chờ.
⚠️ **Không hề verify token với server lúc restore.** Access token hết hạn (15m) sẽ chỉ lộ ra ở request đầu tiên, rồi interceptor mới refresh.

### 9.5 Onboarding data flow

**Cách truyền dữ liệu:** hoàn toàn bằng **route params**, mỗi màn spread object `userData` rồi navigate tiếp. Không dùng Context, không có global state cho onboarding.

```
RegisterScreen.handleSubmit()
  → registerService({name, email, password})     // POST /api/auth/register
  → login(accessToken, refreshToken, user)        // ghi SecureStore, set Context
  → navigate('AboutYou', { userData: { name, email } })
       ↓  (password KHÔNG được truyền tiếp — đúng)
AboutYouScreen.handleNext()
  → { ...userData, dob: 'YYYY-MM-DD' (local), gender, height: <cm, ép về cm nếu nhập ft/in> }
  → navigate('CurrentWeight', { userData })
       ↓
CurrentWeightScreen.handleNext()
  → { ...userData, weight: parseFloat(weight) }   // kg
  → navigate('GoalType', { userData })
       ↓
GoalTypeScreen.handleNext()
  ├─ maintain → navigate('Summary',        { userData: {..., goalType:'maintain', goalWeight: userData.weight, targetRate: 0} })
  └─ khác     → navigate('TargetSettings', { userData: {..., goalType: selectedGoal} })
       ↓
TargetSettingsScreen.handleNext()
  → { ...userData, goalWeight: parseFloat(goalWeight), targetRate: 0.5 }   // ← HARDCODE 0.5
  → navigate('Summary', { userData })
       ↓
SummaryScreen.handleNext()
  → POST /api/users/me/complete-profile
  → completeOnboarding(true)   → SecureStore.onboardingCompleted='true' + showWelcome=true
  → RootNavigator đổi sang MainTabs   (KHÔNG qua FirstLogChoice)
```

**Body CHÍNH XÁC gửi lên `/api/users/me/complete-profile`** (`SummaryScreen.js:50-63`):
```json
{
  "profile": {
    "dateOfBirth": "<userData.dob, chuỗi YYYY-MM-DD>",
    "gender":      "<male|female|other>",
    "height":      "<number, cm>"
  },
  "weight": "<number, kg>",
  "goal": {
    "type":         "<lose|maintain|gain>",
    "targetWeight": "<number, kg>",
    "weeklyRate":   "<number, LUÔN DƯƠNG: 0.5 hoặc 0 cho maintain>",
    "startWeight":  "<number, kg — bằng đúng weight>"
  }
}
```

⚠️ **`POST /api/auth/register` KHÔNG nhận dữ liệu onboarding** — trái với mô tả trong đề bài. Body register chỉ có `{name, email, password}` (`RegisterScreen.js:110-113`). Đây là hành vi ĐÚNG theo "Common Mistakes to Avoid" trong CLAUDE.md (không tạo WeightLog trong register).

⚠️ `SummaryScreen` tính BMR/TDEE/dailyTarget/projectedDate **trên máy** bằng `src/utils/bmr.js` chỉ để HIỂN THỊ, rồi backend tính lại độc lập bằng công thức inline ở `users.js`. Hai bên tình cờ khớp nhau, nhưng `calcTDEE` của FE không nhận `loggedBurned` còn `calculateTDEE` của BE thì có — hai bản không tương đương về signature.

---

## PART 10 — ĐỐI CHIẾU FRONTEND ↔ BACKEND

| # | Endpoint | Backend trả về | Frontend đọc field gì | Khớp? |
|---|---|---|---|---|
| 1 | `POST /auth/register` | `{accessToken, refreshToken, user:{_id, name, email, onboardingCompleted}}` | `{accessToken, refreshToken, user}` rồi `userObj.onboardingCompleted` (authStore:23) | ✅ |
| 2 | `POST /auth/login` | `{accessToken, refreshToken, user:{_id, name, email, onboardingCompleted}}` | `{accessToken, refreshToken, user}` (auth.js:24) | ✅ |
| 3 | `POST /auth/refresh` | `{accessToken}` — **không trả refreshToken mới** | `data.accessToken` (api.js:67) | ✅ (nhưng refresh token không rotate) |
| 4 | `POST /auth/logout` | `{message}` | — | ⚠️ **FE không bao giờ gọi** |
| 5 | `GET /users/me` | `{user: <full doc>}` | `res.data.user` → `.goals`, `.currentStats.weight/.bmi`, `.profile.height/.dateOfBirth/.gender`, `.name`, `.email` (Home:330, Profile:40, LogScreen:2166) | ✅ |
| 6 | `POST /users/me/complete-profile` | `{success, bmr, baseline, tdee, dailyCalorieTarget}` | **không đọc gì cả** — chỉ `await` (Summary:50) | ⚠️ response bị vứt |
| 7 | `PUT /users/me/goal` | `{success, dailyCalorieTarget}` | **không đọc gì** — chỉ `await` rồi `load()` (Home:532,563,594) | ⚠️ response bị vứt |
| 8 | `POST /users/complete-onboarding` | `{success:true}` | không đọc | ✅ (nhưng gọi từ 2 screen unreachable) |
| 9 | `GET /stats/daily` (HomeScreen) | `{date, caloriesConsumed, caloriesBurned, bmr, tdee, deficit, dailyTarget, meals[], activities[]}` | `stats.caloriesConsumed`, `stats.caloriesBurned`, `stats.meals` (Home:419,420,459) | ✅ |
| 10 | `GET /stats/daily` (ChatInputScreen:123) | như trên — **flat**, không có key `calories` | `statsRes.data?.calories?.consumed` và `?.calories?.target` | 🔴 **KHÔNG KHỚP** → cả hai luôn `undefined` → `\|\| 0` → `target > 0` false → `remainingCalories = null` → **meal insight block không bao giờ hiện** |
| 11 | `GET /stats/daily` (ActivityChatScreen:108) | như trên | `statsRes.data?.calories?.consumed` / `?.calories?.target` | 🔴 **KHÔNG KHỚP** — cùng lỗi như trên |
| 12 | `GET /stats/weekly` | `{days:[{...., deficit, ...}], totals:{caloriesConsumed, caloriesBurned, avgDeficit}}` | `weekly.totals`, `weekly.days`, `d.deficit` (Stats:142-144) | ✅ |
| 13 | `GET /weights?limit=` | `[<WeightLog>]` — mảng trần | `weightsRes.data` rồi `.sort(...)`, `w._id`, `w.createdAt`, `w.weight`, `w.bmi` (LogScreen:2165, Stats:103) | ✅ |
| 14 | `POST /weights` | `<WeightLog doc>` (201) | không đọc — chỉ `.then(() => onSaved())` (LogScreen:2082) | ✅ |
| 15 | `POST /meals` | `<MealLog doc>` (201) | `res.data` chỉ đem log ra console (ChatInput:170) | ✅ |
| 16 | `GET /meals?date=` | `[<MealLog>]` mảng trần, mỗi doc có `totals.calories` | `meal._id`, `meal.totals`, `meal.items` | ✅ |
| 17 | `POST /meals/parse-text` | `{items:[{name, calories, protein, carbs, fat, servingSize, nutritionNote}], totalCalories, text, date}` | `res.data.items` (ChatInput:119) | ✅ |
| 18 | `POST /activities/parse-text` | `{entries:[...], totalCaloriesBurned, text, date}` | `res.data.entries` (ActivityChat:105) | ✅ |
| 19 | `POST /activities` | `<ActivityLog doc>` (201) | không đọc | ⚠️ FE gửi kèm `source:'ai_parsed'` trong mỗi entry — **schema không có field này**, bị bỏ im lặng |
| 20 | `GET /templates?type=` | `{templates:[...], pagination:{...}}` | `res.data.templates` (LogScreen:443,1601) | ✅ |
| 21 | `GET /patterns/today` | `{success, data:{pattern, dataPointCount}}` | `res.success`, `res.data.pattern` (Home:350-351) | ✅ |
| 22 | `POST /patterns/apply` | `{success, data:{appliedDate, sourceDate, mealLogsCreated, activityLogsCreated, ...}}`; lỗi `{success:false, error}` | `res?.data?.mealLogsCreated`, `.activityLogsCreated`; lỗi đọc `e.response.data.error` + status 409 (SmartDayCard:50-64) | ✅ |

### Đơn vị — KHỚP HOÀN TOÀN
- **Cân nặng:** FE luôn gửi **kg** (`CurrentWeightScreen:42` `parseFloat(weight)` từ input ghi rõ "kg"; `AddWeightModal` label "Weight (kg)"). BE coi là kg (`bmr.js:3` comment, công thức Mifflin). ✅
- **Chiều cao:** FE **luôn quy về cm** trước khi gửi (`AboutYouScreen.getHeightInCm()` chuyển ft/in → cm). BE coi là cm. ✅ Không có đường nào để lb hay inch lọt xuống backend.
- **weeklyRate:** FE luôn gửi **số dương** (0.5 hoặc 0). BE tự áp dấu theo `goal.type` (`users.js:85-87, 141-143`). ✅ — Nhưng lưu ý comment trong `bmr.js:26` nói "negative for weight loss", trái ngược với convention thực tế đang dùng. Hàm đó dead nên chưa gây hại.

### Tên field — có 1 chỗ đổi tên, đã xử lý đúng
| FE (route params) | BE (schema/body) | Xử lý |
|---|---|---|
| `userData.dob` | `profile.dateOfBirth` | ✅ ánh xạ tường minh tại `SummaryScreen:52` |
| `userData.height` | `profile.height` | ✅ cùng tên, cùng đơn vị cm |
| `userData.goalType` | `goal.type` | ✅ ánh xạ tại `SummaryScreen:58` |
| `userData.goalWeight` | `goal.targetWeight` | ✅ ánh xạ tại `SummaryScreen:59` |
| `userData.targetRate` | `goal.weeklyRate` | ✅ ánh xạ tại `SummaryScreen:60` |

### Lệch nghiêm trọng về LOGIC (không phải tên field)

**Daily calorie target được tính ở 3 nơi, ra 3 kết quả khác nhau:**

| Nơi | Công thức | Có cộng calo đốt? |
|---|---|---|
| BE lưu vào DB (`users.js:82-87`) | `tdee = bmr + bmr*0.2` rồi ± deficit | ❌ **KHÔNG** (comment: "no logged activity on day 0") |
| BE `/stats/daily` trả về `dailyTarget` (`stats.js:38`) | đọc thẳng `activeGoal.dailyCalorieTarget` từ DB | ❌ kế thừa giá trị tĩnh trên |
| FE HomeScreen (`HomeScreen.js:431-440`) | `tdee = bmr + baseline + loggedBurned` rồi ± dailyAdjustment | ✅ **CÓ** |

→ Ngày user log 400 kcal vận động: HomeScreen hiện target cao hơn StatsScreen/`dailyTarget` đúng 400 kcal. Đồng thời `activeGoal.dailyCalorieTarget` trong DB **chỉ được cập nhật khi user đổi goal**, nên nó đứng yên kể cả khi cân nặng thay đổi → càng lệch theo thời gian. Đây chính là bug `#7 Deficit không tính Burned calories` trong CLAUDE.md, và nó chưa được fix — chỉ là HomeScreen tự né bằng cách tính lại tại chỗ.

---

## PART 11 — VẤN ĐỀ PHÁT HIỆN ĐƯỢC

### 🔴 CHẶN PHASE 1

1. **`trim-backend/.env` đang bị git track** — `trim-backend/.env` (xác nhận `git ls-files` → TRACKED). File chứa `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY` và đã nằm trong commit `20f54b4`. `.gitignore` được thêm sau nên vô hiệu. `git status` hiện `M .env` → lần commit tới sẽ ghi thêm secret mới vào history. `node_modules/` cũng đang bị track. Chưa rò ra ngoài vì repo không có remote — nhưng lần đầu push là lộ vĩnh viễn.

2. **Code không nằm trên GitHub** — `app/` (root). Repo gốc track `trim-app` và `trim-backend` như **gitlink mà không có `.gitmodules`** (`git submodule status` → fatal). `trim-app` và `trim-backend` không có remote nào. Hệ quả: GitHub repo `tranbaokien2005/trim-app` chỉ chứa `.gitignore` + `CLAUDE.md`; toàn bộ Phase 0/1/2 chưa từng được backup. Mất máy = mất hết.

3. **Daily target lệch giữa Home và Stats** — `HomeScreen.js:431-440` vs `stats.js:38` vs `users.js:82-87`. HomeScreen cộng `loggedBurned` vào TDEE, backend không. Ngày có vận động, hai màn hình hiện hai con số target khác nhau; user không biết tin cái nào. Ngoài ra `goals[].dailyCalorieTarget` chỉ được ghi lại khi đổi goal → đứng yên khi cân nặng đổi.

4. **`currentStats.bmr` và `currentStats.baseline` không tồn tại trong schema** — `users.js:98-99` ghi hai key này, `models/User.js:34-38` chỉ khai báo `weight`, `bmi`, `weightUpdatedAt`. Mongoose strict mode bỏ im lặng. Bất kỳ code Phase 1 nào định đọc `user.currentStats.bmr` sẽ nhận `undefined`.

5. **`baseURL` hardcode LAN IP ở 2 file** — `services/api.js:22` và `services/auth.js:5` cùng chứa `http://192.168.68.108:5000`. Đổi mạng Wi-Fi hoặc deploy Railway là app chết, và phải sửa 2 chỗ. Không có cơ chế env/config.

6. **Smart Day Card hiện với 1 data point thay vì 3** — `patterns.js:78`: `THRESHOLD = process.env.NODE_ENV === 'production' ? 3 : 1`. `.env` **không có** `NODE_ENV`, nên threshold = 1 ở mọi môi trường local, và cả trên Railway nếu quên set biến. Trái Key Decision #6 ("Tier 1 never shows until ≥3 same-weekday data points").

### 🟡 NỢ KỸ THUẬT

7. **Meal/activity insight block chết** — `ChatInputScreen.js:123-124` và `ActivityChatScreen.js:108-109` đọc `data.calories.consumed` / `data.calories.target`; `/api/stats/daily` trả `caloriesConsumed` / `dailyTarget` phẳng. `remainingCalories` luôn `null` → khối "calorie budget awareness" (feature được liệt kê là DONE trong CLAUDE.md) không bao giờ render.

8. **`FirstLogChoiceScreen` + `TemplateSetupScreen` không tới được** — `SummaryScreen.js:64` gọi `completeOnboarding(true)` làm `RootNavigator.js:37` đổi navigator sang MainTabs ngay. Không file nào `navigate('FirstLogChoice')`. 263 dòng code chết, và CLAUDE.md vẫn ghi FirstLogChoice là Step 7.

9. **2 file screen dead hoàn toàn** — `CreateAccountScreen.js` (120 dòng, nền trắng, "Step 1 of 8", không gọi API) và `TargetRateScreen.js` (193 dòng, màn chọn pace 0.1–1.0 kg/tuần). Không được import ở đâu. `TargetRateScreen` chính là thứ `TargetSettingsScreen:119` thay thế bằng `targetRate: 0.5` hardcode → **user không có cách nào chọn pace trong onboarding**.

10. **Công thức BMR/TDEE bị copy-paste 5 bản** — `utils/bmr.js:2`, `users.js:76`, `users.js:132`, `patterns.js:44`, `HomeScreen.js:428`. Ba bản dùng `age = Math.floor(ms / 365.25 ngày)` (sai tới 1 tuổi), một bản dùng `calculateAge()` chính xác. `patterns.js:154` còn dùng hệ số `bmr * 1.2` thay vì `bmr + round(bmr*0.2)`. Sửa công thức ở một chỗ sẽ không lan ra 4 chỗ kia.

11. **`calculateTDEE` và `calculateDailyCalorieTarget` trong `utils/bmr.js` không ai gọi** — `bmr.js:20` và `bmr.js:25`. Là hai hàm "chuẩn" nhưng bị bỏ qua để viết inline. Comment ở dòng 26 ("negative for weight loss") còn mâu thuẫn với convention thực tế (weeklyRate luôn dương).

12. **Không nơi nào gọi `POST /api/auth/logout`** — `authStore.js:47-56` chỉ xoá SecureStore local. `user.refreshTokens[]` phình thêm 1 phần tử mỗi lần login, chỉ tự dọn sau TTL 30 ngày. Token cũ vẫn dùng refresh được sau khi user "đăng xuất".

13. **`services/auth.js` trộn fetch + axios và có 2 hàm dead** — `auth.js:5` dùng raw `fetch` với URL hardcode, `auth.js:23` dùng axios instance. `logout()` (dòng 35) và `getStoredToken()` (dòng 45) không được import ở đâu; `logout()` còn quên xoá `refreshToken`.

14. **Thiếu `trust proxy` cho rate limiter** — `app.js` không có `app.set('trust proxy', ...)`. Sau reverse proxy của Railway, `express-rate-limit` sẽ thấy mọi request đến từ cùng 1 IP → 5 lần login sai của một user khoá cả hệ thống trong 15 phút.

15. **`/api/auth/*` bị double rate limit** — `app.js:31` áp `limiter` cho `/api/`, `app.js:38` áp `authLimiter` cho `/api/auth`. Cả hai cùng chạy; giới hạn thực tế là 5 req/15p, bao gồm cả `/auth/refresh`. Access token hết hạn 15 phút cộng với quota 5 → user active có thể bị chặn refresh.

16. **`complete-profile` và `PUT /me/goal` không validate gì** — `users.js:47` và `users.js:122`. Thiếu `profile.dateOfBirth` → `new Date(undefined)` → BMR = `NaN` → ghi `NaN` vào DB. Thiếu `weight` → BMI = `NaN`. Không có 400 nào, chỉ lỗi im lặng hoặc 500 từ errorHandler.

17. **`errorHandler` rò message lỗi nội bộ ra client** — `errorHandler.js:31-33` trả `err.message` nguyên văn cho mọi lỗi không nhận dạng được, gồm cả message từ OpenAI/Nutritionix/Mongo.

18. **`POST /api/meals/search/nutrients` chắc chắn 500** — `meals.js:107`, dựa vào `NUTRITIONIX_APP_ID`/`NUTRITIONIX_APP_KEY` không có trong `.env` lẫn `.env.example`. Header rỗng → Nutritionix 401 → throw → 500. Frontend không gọi endpoint này (search đã bỏ khỏi UI theo Key Decision #9), nên nó chỉ là bề mặt tấn công thừa.

19. **`GET /api/meals/search` nuốt trọn mọi lỗi** — `meals.js:98` `catch (_) { return res.json({ results: FALLBACK_FOODS }); }`. USDA down, API key sai, JSON hỏng — tất cả đều trả 200 với 5 món cứng. Không phân biệt được. Endpoint này cũng không được frontend gọi.

20. **Model `date` không nhất quán** — `MealLog.date` và `ActivityLog.date` là **String** `YYYY-MM-DD`; `WeightLog.date` là **Date**. Mọi query weight lại `.sort({createdAt:-1})` chứ không dùng `date`, khiến index `{user:1, date:-1}` gần như vô dụng. Bất kỳ join/aggregate nào giữa 3 collection sẽ phải convert kiểu.

21. **`profile.timezone` chỉ đọc, không bao giờ ghi** — `patterns.js:75` và `:188` gọi `getTodayInTz(user.profile?.timezone)`, nhưng không route nào set `timezone`. Luôn fallback UTC. Ở Việt Nam (UTC+7), từ 00:00 đến 07:00 giờ địa phương, backend vẫn coi là "hôm qua" → Smart Day Card và `/patterns/apply` ghi log sai ngày.

22. **`profile.baseActivityLevel` là dead field** — `models/User.js:27` có enum + default `lightly_active`, nhưng không route nào ghi, không công thức nào đọc. Mọi nơi tính TDEE đều dùng `bmr * 0.2` cứng. AboutYouScreen có UI chọn activity level 4 mức nhưng giá trị đó **không được truyền vào body complete-profile** (`SummaryScreen:51-55` chỉ gửi `dateOfBirth`, `gender`, `height`). Trái với "Common Mistakes to Avoid: Do NOT hardcode lightly_active → use profile.baseActivityLevel".

23. **`ActivityChatScreen` gửi field không có trong schema** — `ActivityChatScreen.js:131` gửi `source: 'ai_parsed'` trong mỗi entry; `models/ActivityLog.js:3-9` không có `source`. Bị Mongoose bỏ im lặng → không phân biệt được entry do AI tạo hay nhập tay. (MealLog **có** field này, nên hành vi giữa meal và activity không đồng nhất.)

24. **`register` không validate phía server** — `auth.js:13` chỉ kiểm tra 3 field tồn tại. Không check định dạng email, không check độ dài password. Chỉ FE validate (`RegisterScreen.js:75-97`). Gọi API trực tiếp có thể tạo user với password 1 ký tự.

25. **11 `.catch(() => {})` / `catch (_) {}` nuốt lỗi im lặng** — `HomeScreen.js:332`, `ProfileScreen.js:41`, `LogScreen.js:251, 318, 437, 445, 1595, 1603, 2169`, `HomeScreen.js:539` (`// silent fail` khi đổi pace goal). Mạng lỗi → màn hình hiện data cũ hoặc rỗng, không báo gì. Riêng `HomeScreen:539` nuốt lỗi của một request **ghi** (`PUT /users/me/goal`) — user tưởng đã đổi pace mà thực ra chưa.

### ⚪ GHI CHÚ

26. **17 `console.log` còn sót** — `RegisterScreen.js` (3, gồm dòng 108 in ra `{name, email}` của user), `ChatInputScreen.js` (3, dòng 167 in nguyên body meal), `LogScreen.js` (2), `ActivityChatScreen.js` (1), `server.js` (1), `database.js` (1, in DB host), `patterns.test.js` (6). Không có `TODO`/`FIXME` nào trong `src/`.

27. **Index trùng ở 2 model** — `models/User.js:96` khai `index({email:1})` trong khi field email đã có `unique:true` (dòng 7). `models/Template.js:17` khai `index:true` cho `user` trong khi dòng 45 đã có compound `{user:1, type:1}`. Cả hai gây warning `Duplicate schema index` lúc khởi động.

28. **`useNewUrlParser` / `useUnifiedTopology` đã vô nghĩa** — `config/database.js:6-7`. Mongoose 7 bỏ hai option này; chúng chỉ là no-op.

29. **`connectDB()` không await** — `server.js:4-8`. Server `listen` ngay, không chờ Mongo. Request đến trong khoảnh khắc đó sẽ lỗi buffering.

30. **`express.json({limit:'10mb'})`** — `app.js:40`. Rất rộng cho một app chỉ gửi JSON vài KB.

31. **`helmet()` mặc định trên API JSON thuần** — `app.js:18`. Không sai, nhưng CSP/HSTS mặc định không có tác dụng gì với client React Native.

32. **Số test lệch với tài liệu** — thực tế **141** test (`patterns.test.js` 35, `phase1.test.js` 41, `templates.test.js` 65); CLAUDE.md ghi "145 tests (142 pass, 3 known failures)". **Audit này KHÔNG chạy test** (luật read-only), nên trạng thái pass/fail hiện tại là `UNKNOWN`.

33. **Tên route ≠ tên component** — `OnboardingStack.js:26` đăng ký `RegisterScreen` dưới tên route `"CreateAccount"`, trùng tên với file dead `CreateAccountScreen.js`. Dễ gây nhầm khi thêm screen mới.

34. **`store/authStore.js` không phải store** — là React Context, không phải Zustand/Redux. Tên file gây hiểu nhầm khi đọc lướt.

35. **`/api/patterns/*` dùng response envelope khác mọi router khác** — `{success, data}` + lỗi ở key `error`, trong khi 7 router kia trả doc trần + lỗi ở key `message`. Frontend phải nhớ hai kiểu xử lý lỗi (`SmartDayCard.js:64` đọc `e.response.data.error`, mọi chỗ khác đọc `.message`).

36. **`GET /weights/latest` không được frontend gọi** — `weights.js:40`. FE luôn dùng `GET /weights?limit=n` rồi lấy phần tử đầu.

37. **`PUT /api/users/me` không được frontend gọi** — `users.js:19`. Không có màn edit profile.

38. **`PUT /api/meals/:id` chỉ sửa được `name` và `calories`** — `meals.js:236-237`. Protein/carbs/fat không sửa được, nhưng `totals` vẫn được tính lại từ macro cũ → tổng macro có thể lệch khỏi calories sau khi user sửa.

---

*Báo cáo tạo tự động bằng audit read-only. Không có file nào bị sửa/xoá/tạo ngoài chính file này. Không có lệnh `npm install` hay `npm test` nào được chạy. Không có giá trị secret nào được in ra.*
