/**
 * Gate consent AI (guideline 5.1.2(i)). Áp cho MỌI endpoint gọi OpenAI.
 * Chưa đồng ý → 403 { code: 'AI_CONSENT_REQUIRED' }, KHÔNG cho request chạm OpenAI.
 * (Log tay không dùng middleware này nên không bị ảnh hưởng.)
 */
const requireAiConsent = (req, res, next) => {
  if (!req.user?.aiConsent?.granted) {
    return res.status(403).json({
      code: 'AI_CONSENT_REQUIRED',
      message: 'AI analysis requires your consent to send data to OpenAI.',
    });
  }
  next();
};

module.exports = requireAiConsent;
