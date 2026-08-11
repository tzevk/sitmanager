// Shared WhatsApp Cloud API sending helpers, extracted from the
// notifications_sent_at welcome-message cron (app/api/cron/send-whatsapp/route.ts)
// so manual sends (e.g. the Meta Leads "Broadcast" tab) can reuse the same
// phone-normalization and Graph API call instead of duplicating it.

const GRAPH_VERSION = "v19.0";

const WHATSAPP_TOKEN =
  process.env.META_WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;

// Approved WhatsApp Business template names — must match exactly what's
// configured in Meta WhatsApp Manager, or the send is rejected outright.
// Both templates here take a single body variable named "name".
export const WHATSAPP_TEMPLATES = {
  template1: {
    label: "Welcome Message",
    name: "sit_welcome_message",
    language: "en",
  },
  template2: {
    // TODO: replace with the second approved template name from Meta
    // WhatsApp Manager before enabling this option for real sends.
    label: "Template 2 (not configured)",
    name: "PLACEHOLDER_TEMPLATE_2",
    language: "en",
  },
} as const;

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATES;

export function isWhatsAppTemplateConfigured(key: WhatsAppTemplateKey): boolean {
  return !WHATSAPP_TEMPLATES[key].name.startsWith("PLACEHOLDER_");
}

export function whatsAppConfigError(): string | null {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    return "WhatsApp configuration missing: WHATSAPP_TOKEN/META_ACCESS_TOKEN and PHONE_NUMBER_ID are required";
  }
  return null;
}

// Indian-number-oriented normalization matching the existing cron's
// convention: strips non-digits, drops a leading 0, and assumes a bare
// 10-digit number is Indian (prepends 91). Rejects anything that doesn't
// resolve to a 12-digit E.164-without-plus number.
export function normalizePhone(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  let digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length !== 12) return null;
  return digits;
}

let cachedPhoneNumberId: string | null = null;

export async function resolvePhoneNumberId(): Promise<string | null> {
  if (cachedPhoneNumberId) return cachedPhoneNumberId;
  if (!PHONE_NUMBER_ID) return null;
  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/phone_numbers?fields=id&limit=1`,
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
    if (!response.ok) return PHONE_NUMBER_ID;
    const data = await response.json();
    cachedPhoneNumberId = data?.data?.[0]?.id || PHONE_NUMBER_ID;
    return cachedPhoneNumberId;
  } catch {
    return PHONE_NUMBER_ID;
  }
}

// The approved template's static wording can't be changed per-send — only
// the "name" body variable is editable. `nameParamValue` is the resolved
// value to place there: either an admin-supplied override (same for every
// recipient in the broadcast) or, when not overridden, the recipient's own
// first name.
export async function sendWhatsAppTemplate(
  toPhone: string,
  templateKey: WhatsAppTemplateKey,
  nameParamValue: string,
  phoneNumberId: string
): Promise<unknown> {
  const template = WHATSAPP_TEMPLATES[templateKey];
  const payload = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "name", text: nameParamValue || "there" },
          ],
        },
      ],
    },
  };

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp API error");
  }
  return data;
}
