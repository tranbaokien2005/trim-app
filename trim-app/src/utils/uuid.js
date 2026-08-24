// UUID v4 dùng Math.random — CHỈ dùng làm khoá chống trùng (idempotency).
// KHÔNG dùng cho token, session, hay bất cứ thứ gì liên quan bảo mật.
// Va chạm không quan trọng ở đây: unique index là { user, clientId },
// nên trùng giữa hai user khác nhau là vô hại.

const HEX = '0123456789abcdef';

export function uuidv4() {
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += HEX[(Math.floor(Math.random() * 16) & 0x3) | 0x8];
    } else {
      out += HEX[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}

export default uuidv4;
