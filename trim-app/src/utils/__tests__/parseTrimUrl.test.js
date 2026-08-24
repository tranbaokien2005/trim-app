const { parseTrimUrl } = require('../parseTrimUrl');

describe('parseTrimUrl', () => {
  test('trim://log?text=pho%20bo (đã encode) -> meal', () => {
    expect(parseTrimUrl('trim://log?text=pho%20bo')).toEqual({ kind: 'meal', text: 'pho bo' });
  });

  test('trim://log?text=phở bò (KHÔNG encode, có dấu cách + dấu tiếng Việt) -> meal', () => {
    // iOS Shortcuts không tự encode biến trong "Open URLs" — case này là đường chính, không phải rìa.
    expect(parseTrimUrl('trim://log?text=phở bò')).toEqual({ kind: 'meal', text: 'phở bò' });
  });

  test('trim://weight?value=71.2 -> weight', () => {
    expect(parseTrimUrl('trim://weight?value=71.2')).toEqual({ kind: 'weight', value: 71.2 });
  });

  test('trim://weight?value=abc -> null', () => {
    expect(parseTrimUrl('trim://weight?value=abc')).toBeNull();
  });

  test('trim://log thiếu text -> null', () => {
    expect(parseTrimUrl('trim://log')).toBeNull();
  });

  test('https://example.com/log?text=x -> null', () => {
    expect(parseTrimUrl('https://example.com/log?text=x')).toBeNull();
  });

  test('trim:// -> null', () => {
    expect(parseTrimUrl('trim://')).toBeNull();
  });

  test('trim://activity?text=chạy bộ 30 phút -> activity', () => {
    expect(parseTrimUrl('trim://activity?text=chạy bộ 30 phút'))
      .toEqual({ kind: 'activity', text: 'chạy bộ 30 phút' });
  });

  test('% lạc lõng không làm hỏng text (decode ném lỗi -> dùng chuỗi gốc)', () => {
    expect(parseTrimUrl('trim://log?text=sữa 50% đường'))
      .toEqual({ kind: 'meal', text: 'sữa 50% đường' });
  });

  test('mealType hợp lệ được giữ, không hợp lệ thì bỏ qua', () => {
    expect(parseTrimUrl('trim://log?text=xoi&mealType=breakfast'))
      .toEqual({ kind: 'meal', text: 'xoi', mealType: 'breakfast' });
    expect(parseTrimUrl('trim://log?text=xoi&mealType=brunch'))
      .toEqual({ kind: 'meal', text: 'xoi' });
  });

  test('host lạ, text rỗng, weight <= 0, đầu vào không phải chuỗi -> null', () => {
    expect(parseTrimUrl('trim://mood?text=vui')).toBeNull();
    expect(parseTrimUrl('trim://log?text=   ')).toBeNull();
    expect(parseTrimUrl('trim://weight?value=0')).toBeNull();
    expect(parseTrimUrl('trim://weight?value=-5')).toBeNull();
    expect(parseTrimUrl('trim://weight')).toBeNull();
    expect(parseTrimUrl(null)).toBeNull();
    expect(parseTrimUrl(undefined)).toBeNull();
  });

  test('TRIM://LOG/?text=x — scheme hoa và dấu / thừa vẫn nhận', () => {
    expect(parseTrimUrl('TRIM://LOG/?text=x')).toEqual({ kind: 'meal', text: 'x' });
  });
});
