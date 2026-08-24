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

  let arr;
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) throw new Error('Not an array');
  } catch (parseErr) {
    console.error('Parse error:', parseErr, 'Raw:', raw);
    throw new ParseTextError('parse');
  }

  return arr;
}

/** text đã trim → mảng item món ăn. Ném ParseTextError khi thất bại. */
const parseMealText = (text) => callAndParse(MEAL_SYSTEM_PROMPT, text);

/** text đã trim → mảng entry hoạt động. Ném ParseTextError khi thất bại. */
const parseActivityText = (text) => callAndParse(ACTIVITY_SYSTEM_PROMPT, text);

module.exports = { parseMealText, parseActivityText, ParseTextError };
