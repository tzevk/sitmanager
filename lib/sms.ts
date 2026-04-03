function toE164(mobile10: string): string {
  const cc = (process.env.TWILIO_DEFAULT_COUNTRY_CODE || '+91').trim();
  if (mobile10.startsWith('+')) return mobile10;
  return `${cc}${mobile10}`;
}

async function sendViaTwilio(toMobile10Digits: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    throw new Error(
      'Twilio is selected but credentials are incomplete. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID'
    );
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams({
    To: toE164(toMobile10Digits),
    Body: message,
  });

  if (messagingServiceSid) {
    params.set('MessagingServiceSid', messagingServiceSid);
  } else if (fromNumber) {
    params.set('From', fromNumber);
  }

  const body = params.toString();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Twilio send failed: ${res.status} ${text}`);
  }
}

export async function sendSms(toMobile10Digits: string, message: string): Promise<void> {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase();

  // Prefer Twilio when explicitly selected, or when Twilio credentials are present.
  if (
    provider === 'twilio' ||
    (
      !!process.env.TWILIO_ACCOUNT_SID &&
      !!process.env.TWILIO_AUTH_TOKEN &&
      (!!process.env.TWILIO_FROM_NUMBER || !!process.env.TWILIO_MESSAGING_SERVICE_SID)
    )
  ) {
    await sendViaTwilio(toMobile10Digits, message);
    return;
  }

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

  if (webhookUrl.includes('/api/sms/realtime-delivery')) {
    throw new Error('SMS_WEBHOOK_URL is misconfigured. Use provider send API, not /api/sms/realtime-delivery');
  }

  const authHeader = process.env.SMS_WEBHOOK_AUTH;
  const authHeaderName = (process.env.SMS_WEBHOOK_AUTH_HEADER || 'Authorization').trim();
  const contentType = (process.env.SMS_WEBHOOK_CONTENT_TYPE || 'json').toLowerCase();
  const toKey = process.env.SMS_WEBHOOK_TO_KEY || 'to';
  const messageKey = process.env.SMS_WEBHOOK_MESSAGE_KEY || 'message';
  const senderId = process.env.SMS_WEBHOOK_SENDER_ID;

  const payload: Record<string, string> = {
    [toKey]: toMobile10Digits,
    [messageKey]: message,
  };

  if (senderId) {
    payload.sender = senderId;
  }

  const headers: Record<string, string> = {};
  if (authHeader) {
    headers[authHeaderName] = authHeader;
  }

  let body: string;
  if (contentType === 'form') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(payload).toString();
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SMS webhook failed: ${res.status} ${text}`);
  }
}
