/**
 * Email service — Resend HTTP API qua fetch (KHÔNG SDK, không dependency mới).
 *
 * DORMANT: nếu RESEND_API_KEY vắng → no-op (log "email not configured, skipping") và return.
 * → password reset ngủ cho tới khi Ken cấu hình email. KHÔNG in token/email ở production.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const isConfigured = () => !!process.env.RESEND_API_KEY;

/**
 * Gửi email reset password. Trả { sent: boolean, skipped?: boolean }.
 * @param {string} to        email người nhận
 * @param {string} rawToken  token thô (chỉ có ở thời điểm này, KHÔNG lưu thô)
 */
const sendPasswordResetEmail = async (to, rawToken) => {
  if (!isConfigured()) {
    console.log('[email] not configured (RESEND_API_KEY missing), skipping password reset email');
    return { sent: false, skipped: true };
  }

  const from = process.env.EMAIL_FROM || 'Trim <noreply@trim.app>';
  // Deep link để app mở màn ResetPassword. Web fallback nếu Ken host trang sau.
  const resetLink = `${process.env.PASSWORD_RESET_LINK_BASE || 'trim://reset'}?token=${rawToken}`;

  const body = {
    from,
    to: [to],
    subject: 'Reset your Trim password',
    text:
      'You requested a password reset for your Trim account.\n\n' +
      `Open this link to set a new password (valid for 15 minutes):\n${resetLink}\n\n` +
      'If you did not request this, you can safely ignore this email.',
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // KHÔNG log nội dung token/email; chỉ log status để chẩn đoán.
      console.error(`[email] Resend responded ${res.status}`);
      return { sent: false, skipped: false };
    }
    return { sent: true };
  } catch (err) {
    console.error('[email] send error:', err.message);
    return { sent: false, skipped: false };
  }
};

module.exports = { sendPasswordResetEmail, isConfigured };
