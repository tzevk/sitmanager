export async function sendSms(toMobile10Digits: string, message: string): Promise<void> {
  const webhookUrl = process.env.SMS_WEBHOOK_URL;
  if (!webhookUrl) {
    // Optional (insecure) fallback for environments without an SMS provider.
    // Keep it opt-in via env var so production defaults remain safe.
    if (process.env.OTP_RETURN_IN_RESPONSE === '1') {
      console.warn(
        '[WARN] SMS_WEBHOOK_URL is missing; OTP_RETURN_IN_RESPONSE=1 is enabled. ' +
          'No SMS will be sent.'
      );
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] SMS to ${toMobile10Digits}: ${message}`);
      return;
    }
    throw new Error('SMS provider not configured (missing SMS_WEBHOOK_URL)');
  }

  const authHeader = process.env.SMS_WEBHOOK_AUTH;

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ to: toMobile10Digits, message }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SMS webhook failed: ${res.status} ${text}`);
  }
}
