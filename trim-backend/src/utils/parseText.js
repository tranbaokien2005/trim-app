/**
 * Gọi GPT-4o-mini để parse text thành mảng JSON.
 *
 * File này là kết quả TÁCH THUẦN logic đã có sẵn inline trong
 * routes/meals.js (POST /parse-text) và routes/activities.js (POST /parse-text).
 * Không đổi prompt, không đổi model, không đổi cách xử lý lỗi —
 * để cả route cũ lẫn /api/quicklog cùng gọi một chỗ.
 */
const OpenAI = require('openai').default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * stage = 'api'   → gọi OpenAI thất bại
 * stage = 'parse' → OpenAI trả về nhưng không rút được mảng JSON
 * Route tự quyết định trả status/message gì cho từng stage.
 */
class ParseTextError extends Error {
  constructor(stage) {
    super(`parse-text failed at stage: ${stage}`);
    this.name = 'ParseTextError';
    this.stage = stage;
  }
}

const MEAL_SYSTEM_PROMPT = `You are a nutrition parser. Parse meal descriptions into JSON. Return ONLY a valid JSON array, no explanation, no markdown:\n[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"servingSize":"...","nutritionNote":"One short sentence about nutrition profile, e.g. High in carbs, low protein"}]\nRules: Vietnamese portion sizes, 1 serving default, round to integers, [] if no food, ignore activities.`;

const ACTIVITY_SYSTEM_PROMPT = `You are an exercise parser. Parse activity descriptions into JSON. Return ONLY a valid JSON array, no explanation, no markdown:\n[{"name":"...","type":"cardio","durationMinutes":30,"caloriesBurned":200,"intensity":"medium","note":"One short sentence about the activity"}]\nRules: Vietnamese activity names OK, round all numbers to integers, [] if no activity found, ignore non-activity content.\nValid types: cardio, strength, daily_activity, sport, other\nValid intensities: low, medium, high\nEstimate realistic calorie burns for a 70kg adult based on activity, duration, and intensity.`;

// Vision-specific prompt: always give a best estimate for any food/drink visible (incl.
// multi-dish trays and screenshots of food orders/menus/receipts — read the item text).
// Only return [] when there is genuinely no food or drink at all.
const MEAL_PHOTO_SYSTEM_PROMPT = `You are a nutrition estimator that reads food photos. Return ONLY a valid JSON array, no explanation, no markdown:
[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"servingSize":"...","nutritionNote":"One short sentence about nutrition profile, e.g. High in carbs, low protein"}]
Rules:
- ALWAYS give your best estimate for ANY food or drink you can see, even if you are unsure. Never refuse or ask for a clearer photo.
- The image may be: a plate/tray with several dishes (return ONE item per distinct dish), a single dish, a packaged product, or a SCREENSHOT of a food order / menu / receipt (e.g. Uber Eats) — in that case READ the item names and quantities from the text and estimate nutrition for each line.
- Estimate realistic values for a normal single serving of what is shown. Round every number to integers.
- Return [] ONLY if the image truly contains no food or drink at all.`;

// Full gpt-4o for photos — noticeably stronger than mini at reading menu/receipt text and
// multi-dish trays. Text parsing stays on gpt-4o-mini. Change here to swap the photo model.
const PHOTO_VISION_MODEL = 'gpt-4o';

// raw model output → JSON array. Ném ParseTextError('parse') nếu không rút được mảng.
function extractArray(raw) {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    const arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) throw new Error('Not an array');
    return arr;
  } catch (parseErr) {
    console.error('Parse error:', parseErr, 'Raw:', raw);
    throw new ParseTextError('parse');
  }
}

async function callAndParse(systemPrompt, text) {
  let raw;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    });
    raw = response.choices[0].message.content.trim();
  } catch (apiErr) {
    console.error('OpenAI API error:', apiErr);
    throw new ParseTextError('api');
  }

  return extractArray(raw);
}

// Vision variant — same model (gpt-4o-mini supports images), same schema, same error
// handling. detail:'low' keeps the image at a flat ~85-token cost. `imageBase64` is the
// raw base64 (no data: prefix); we wrap it as a JPEG data URL for the API.
async function callAndParseImage(systemPrompt, imageBase64, { model = PHOTO_VISION_MODEL, detail = 'high' } = {}) {
  const b64len = imageBase64 ? imageBase64.length : 0;
  console.log(`[parse-photo] vision call: model=${model} detail=${detail} base64Len=${b64len} (~${Math.round((b64len * 0.75) / 1024)}KB)`);
  if (b64len < 100) {
    // Almost certainly a plumbing problem (empty/truncated upload), not a real photo.
    console.error('[parse-photo] image base64 is suspiciously short — likely empty/truncated upload');
  }

  let raw;
  try {
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify every food and drink in this image and estimate the nutrition. If it is a screenshot of an order, menu, or receipt, read the item names from the text.' },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail },
            },
          ],
        },
      ],
    });
    raw = response.choices[0].message.content.trim();
    console.log('[parse-photo] raw model output:', raw);
  } catch (apiErr) {
    // Log the REAL error so a failure is diagnosable (status + message + body), not swallowed.
    console.error('[parse-photo] OpenAI vision API error:', apiErr?.status, apiErr?.message, apiErr?.response?.data || '');
    throw new ParseTextError('api');
  }

  return extractArray(raw);
}

/** text đã trim → mảng item món ăn. Ném ParseTextError khi thất bại. */
const parseMealText = (text) => callAndParse(MEAL_SYSTEM_PROMPT, text);

/** text đã trim → mảng entry hoạt động. Ném ParseTextError khi thất bại. */
const parseActivityText = (text) => callAndParse(ACTIVITY_SYSTEM_PROMPT, text);

/** base64 ảnh món ăn → mảng item món ăn (CÙNG schema parseMealText). */
const parseMealPhoto = (imageBase64) => callAndParseImage(MEAL_PHOTO_SYSTEM_PROMPT, imageBase64);

module.exports = { parseMealText, parseActivityText, parseMealPhoto, ParseTextError };
