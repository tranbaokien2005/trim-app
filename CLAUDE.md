# CLAUDE.md — Trim App

> Auto-read by Claude Code on every session start.
> Update this file whenever project status changes.

---

## Project Overview

**App name:** Trim  
**Tagline:** "Less logging. More results."  
**Type:** Weight management mobile app (iOS first, Android later)  
**Core concept:** AI-assisted calorie tracking with 3-tier logging system

---

## Tech Stack

### Frontend
- React Native + Expo (Managed Workflow + EAS)
- React Navigation v6
- expo-secure-store (JWT token storage)
- expo-datetimepicker (DOB picker)
- react-native-svg (calorie ring)
- Folder: `trim-app/`

### Backend
- Node.js + Express + MongoDB Atlas
- JWT auth (access token + refresh token)
- Deployed on Railway (local dev: port 5000)
- Folder: `trim-backend/`

### External Services
- OpenAI API (GPT-4o-mini) — AI food parsing, requires OPENAI_API_KEY in trim-backend/.env
- RevenueCat — in-app subscription (NOT Stripe)
- USDA FoodData Central API — food search (removed from active use, kept in backend)

---

## Design System
Background:     #0F0F0F
Primary green:  #2ECC71
Card bg:        rgba(255,255,255,0.05)
Card border:    rgba(255,255,255,0.08)
Border radius:  28 (cards)
Error red:      #FF4444
Surplus red:    #FF6B6B
Warning orange: #FFB74D

UI: Glassmorphism cards, top green glow,
entrance animation fade+translateY 500ms.
Principle: Progressive Disclosure.

---

## Project Status

### Phase 0 — ✅ DONE
- Auth flow (register/login/logout/refresh)
- Onboarding 7 screens
- Navigation structure

### Phase 1 — ✅ DONE

#### Backend ✅ COMPLETE
- /api/auth — register, login, refresh, logout
- /api/users/me — profile, complete-profile
- /api/meals — CRUD + parse-text (GPT-4o-mini) + search (USDA, kept)
- /api/activities — CRUD
- /api/weights — CRUD + delete rollback to latest
- /api/stats — daily, weekly

#### Frontend ✅ COMPLETE

Onboarding:
- LoginScreen (glassmorphism reference)
- RegisterScreen (4 fields, validation, animation)
- AboutYouScreen (DOB picker, gender 3 colors,
  height cm/ft toggle, activity level 4 options)
- CurrentWeightScreen (BMI realtime)
- GoalTypeScreen (lose/maintain/gain,
  maintain skips TargetSettings)
- TargetSettingsScreen (smart default,
  cross-goal validation alert)
- SummaryScreen (BMR/TDEE calc, tips for maintain)
- FirstLogChoiceScreen (Start Fresh / Template)

MainTabs:
- HomeScreen: calorie ring (SVG, goal color logic),
  macro cards, goal card + progress circle + Edit goal,
  activity card (BMR/Baseline/Burned/TDEE),
  weight card (BMI colored + delta),
  Change Goal bottom sheet,
  Goal Complete card (when target reached),
  Almost There strip (≤1kg remaining)
- LogScreen (3 tabs):
    Meals: manual log, delete (no confirm dialog), Total today
    Activity: manual log, delete
    Weight: log, history (newest first, show more),
             BMI color, delta chip, delete + currentStats rollback
- StatsScreen: bar chart + weight history
- ProfileScreen: body stats + active goal + logout
- ChatInputScreen (Tier 3 AI Food Log):
    Quick Add form (food + stepper + unit picker)
    Free text input (any language)
    GPT-4o-mini parsing via /api/meals/parse-text
    Serving multiplier picker (0.5x / 1x / 1.5x / 2x)
    Meal insight block (calorie budget awareness)
    Edit panel + delete per parsed item
    Success screen with calorie summary

### Phase 2 — ⬜ NOT STARTED

---

## Current Task: Phase 1.5 — Small Improvements

1. Remove meal search → manual log only
2. Activity AI Chat (clone of ChatInputScreen for activities)
3. Save Template (Tier 2 Quick-select) — meal + activity

---

## Known Bugs (to fix)

- [x] Alert không dismiss sau 1 lần bấm (#3) — fixed: removed Alert confirm on delete
- [ ] Deficit không tính Burned calories (#7)
- [x] Weight card lấy weight cũ, không phải latest (#9) — fixed: sort by createdAt
- [ ] Keyboard black screen intermittent (#2)
- [ ] Height toggle chưa auto-convert (#height)

---

## Navigation Structure
```
RootNavigator
├── OnboardingStack ← no JWT or onboardingCompleted=false
│   ├── Welcome
│   ├── Register
│   ├── AboutYou (Step 2)
│   ├── CurrentWeight (Step 3)
│   ├── GoalType (Step 4)
│   ├── TargetSettings (Step 5) ← skip if maintain
│   ├── Summary (Step 6)
│   ├── FirstLogChoice (Step 7)
│   └── TemplateSetup ← placeholder "coming soon"
└── MainTabs ← JWT + onboardingCompleted=true
    ├── HomeTab
    ├── LogTab (Meals / Activity / Weight)
    ├── StatsTab
    └── ProfileTab
```

---

## Onboarding Data Flow
```
AboutYou → CurrentWeight → GoalType →
TargetSettings → Summary
SummaryScreen "Let's Go" button calls:
POST /api/users/me/complete-profile
{
  profile: { dob, gender, height, activityLevel },
  weight: currentWeight,
  goal: { type, targetWeight, weeklyRate }
}
→ sets onboardingCompleted: true
→ navigate MainTabs with showWelcome: true
```

---

## Goal Logic

| Goal | TargetSettings | Daily Target |
|------|----------------|--------------|
| lose | show (default BMI 22) | TDEE - deficit |
| gain | show (default +10%) | TDEE + surplus |
| maintain | SKIP | TDEE |

Cross-validation:
- Lose goal + target > current → alert "Switch to Gain?"
- Gain goal + target < current → alert "Switch to Lose?"
- Reset → restore default recommendation

---

## Calorie Ring Color Logic

| Goal | Condition | Color |
|------|-----------|-------|
| lose | surplus | 🔴 red |
| lose | deficit | 🟢 green |
| gain | surplus | 🟢 green |
| gain | deficit | 🔴 red |
| maintain | ±100 cal | 🟢 green |
| maintain | over | 🟠 orange |

Deficit formula: target + burned - consumed

---

## BMR / TDEE (Mifflin-St Jeor)

```js
base = 10*weight + 6.25*height - 5*age
BMR = base + 5 (male) | base - 161 (female) | base - 78 (other)

MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725
}

TDEE = BMR × multiplier (fallback if no activity logged)
TDEE = BMR + logged_activity_calories (preferred)
dailyTarget = TDEE - weeklyRate*7700/7 (lose)
dailyTarget = TDEE + weeklyRate*7700/7 (gain)
dailyTarget = TDEE (maintain)
```

---

## 3-Tier Logging System

| Tier | Name | Status |
|------|------|--------|
| 3 | AI Chat Input | ✅ Phase 1 DONE |
| 2 | Quick-select Templates | ⬜ Phase 2 |
| 1 | Smart Day Card | ⬜ Phase 2 |

Cold start → Tier 3 only.
Tier 1 requires ≥3 data points same day of week.

---

## Freemium Model

| Feature | Free | Premium |
|---------|------|---------|
| Manual logging | ✅ | ✅ |
| AI Chat Tier 3 | 30/month | ✅ |
| Food photo scan | 10/month | ✅ |
| Quick Templates | 10 | ✅ |
| Smart Day Card | ❌ | ✅ |
| Apple Health | ❌ | ✅ |
| Stats history | 30 days | ✅ |
| PDF export | ❌ | ✅ |

Pricing: $6.99/month or $49.99/year
Payment: RevenueCat (Apple IAP + Google Play)

---

## Future Ideas (do not implement yet)

### Home Warning System (Phase 2)
Show warning when weight trend goes against goal.
Thresholds (validate after having real data):
- Lose: weight ↑ > 0.5kg vs last week → orange warning
- Gain: weight ↓ > 0.5kg vs last week → orange warning
- Maintain: weight changes > 2kg from start → yellow
UI: small banner below Goal card, dismissible 3 days.
Implement after: Phase 1 done + 2 weeks user data.

### Barcode Scanner (Phase 2)
Camera scan → exact product nutrition.
Use expo-camera + Open Food Facts barcode API.
Better than text search for packaged foods.

### Tip of the Day (Phase 2)
For maintain goal users: rotate daily tip on Home.

---

## Key Decisions (do not revisit)

1. No Stripe in iOS — RevenueCat only
2. Expo Managed + EAS — not bare workflow
3. UX > Accuracy — 85% daily use beats 100%
4. Home = display only, logging in Log tab
5. BMR formula: Mifflin-St Jeor
6. Tier 1 never shows until ≥3 same-weekday data points
7. TDEE = BMR + logged burned (not multiplier) when data exists
8. No WeightLog during /auth/register
9. Food search removed from UI — AI Chat (Tier 3) is primary input
10. Deficit = target + burned - consumed
11. Food parsing: GPT-4o-mini (not Claude — cheaper, faster)
12. Delete meal/weight: no confirmation dialog (Alert was broken)

---

## Common Mistakes to Avoid

- Do NOT create WeightLog in /auth/register
- Do NOT use localStorage/sessionStorage → expo-secure-store
- Do NOT calculate stats on-the-fly → use daily_stats collection
- Do NOT show Tier 1 until dataPointCount >= 3
- Do NOT add Stripe to iOS app
- Do NOT hardcode lightly_active → use profile.baseActivityLevel
- Do NOT forget to update currentStats.weight after POST /weights

---

## API Base URL
```
http://192.168.68.108:5000/api
```
Configured in `src/api/api.js`

---

## Running the Project

```bash
# Backend
cd trim-backend && npm run dev   # port 5000

# Frontend
cd trim-app && npx expo start --clear

# Tests
cd trim-backend && npm test      # 41 tests
```

---

*Last updated: Phase 1 complete, Phase 1.5 in progress*
*Next: Activity AI Chat, Remove meal search, Save Template (Tier 2)*
*Design reference: Trim_Design_Doc_v1.4.pdf*
