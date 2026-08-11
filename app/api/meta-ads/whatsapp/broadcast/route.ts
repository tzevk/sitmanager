import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import {
  isWhatsAppTemplateConfigured,
  normalizePhone,
  resolvePhoneNumberId,
  sendWhatsAppTemplate,
  whatsAppConfigError,
  WHATSAPP_TEMPLATES,
  type WhatsAppTemplateKey,
} from '@/lib/services/whatsapp.service';

interface Recipient {
  metaLeadId?: number | null;
  name?: string | null;
  phone: string;
}

interface SendOutcome {
  phone: string;
  name: string | null;
  status: 'sent' | 'failed';
  reason?: string;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view', 'meta_lead.view']);
  if (auth instanceof NextResponse) return auth;

  const templates = (Object.keys(WHATSAPP_TEMPLATES) as WhatsAppTemplateKey[]).map((key) => ({
    key,
    label: WHATSAPP_TEMPLATES[key].label,
    configured: isWhatsAppTemplateConfigured(key),
    // The only thing a broadcast can customize per-send — the approved
    // template's surrounding wording is fixed by Meta and can't be edited.
    editableVariable: 'name',
  }));
  return NextResponse.json({ templates });
}

// Manual, click-to-send broadcast: the caller supplies the exact recipient
// list already selected in the UI (Training Program / Custom CSV / Meta /
// More Filters tabs all resolve to this same shape client-side) — nothing
// here re-queries "who hasn't been contacted yet" the way the welcome-message
// cron does. A message only ever goes out because someone hit Send.
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.update', 'meta_lead.update']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const templateKey = body?.templateKey as WhatsAppTemplateKey;
    const recipients = Array.isArray(body?.recipients) ? (body.recipients as Recipient[]) : [];
    // Optional override for the template's editable "name" variable — applied
    // to every recipient in this broadcast. Empty/omitted falls back to each
    // recipient's own first name (the previous, per-recipient default).
    const nameParamOverride = typeof body?.nameParamOverride === 'string' ? body.nameParamOverride.trim().slice(0, 60) : '';

    if (!templateKey || !WHATSAPP_TEMPLATES[templateKey]) {
      return NextResponse.json({ error: 'Invalid or missing templateKey' }, { status: 400 });
    }
    if (!isWhatsAppTemplateConfigured(templateKey)) {
      return NextResponse.json(
        { error: `${WHATSAPP_TEMPLATES[templateKey].label} is not configured with a real approved template name yet` },
        { status: 400 }
      );
    }
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 });
    }
    if (recipients.length > 250) {
      return NextResponse.json({ error: 'Too many recipients in one broadcast (max 250) — split into batches' }, { status: 400 });
    }

    const configError = whatsAppConfigError();
    if (configError) return NextResponse.json({ error: configError }, { status: 500 });

    const phoneNumberId = await resolvePhoneNumberId();
    if (!phoneNumberId) {
      return NextResponse.json({ error: 'WhatsApp phone number ID is required' }, { status: 500 });
    }

    const pool = getPool();
    const sent: SendOutcome[] = [];
    const failed: SendOutcome[] = [];

    for (const recipient of recipients) {
      const phone = normalizePhone(recipient.phone);
      const name = recipient.name?.trim() || null;

      if (!phone) {
        failed.push({ phone: recipient.phone, name, status: 'failed', reason: 'Invalid phone number format' });
        continue;
      }

      try {
        const nameParamValue = nameParamOverride || name?.split(' ')[0] || 'there';
        await sendWhatsAppTemplate(phone, templateKey, nameParamValue, phoneNumberId);
        sent.push({ phone, name, status: 'sent' });

        if (recipient.metaLeadId) {
          await pool.query(
            `UPDATE meta_ads_lead_sync
             SET notifications_sent_at = NOW(), wa_stage = COALESCE(wa_stage, 'awaiting_choice'), last_error = NULL
             WHERE id = ?`,
            [recipient.metaLeadId]
          );
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'WhatsApp API error';
        failed.push({ phone, name, status: 'failed', reason });
        if (recipient.metaLeadId) {
          await pool.query(`UPDATE meta_ads_lead_sync SET last_error = ? WHERE id = ?`, [reason, recipient.metaLeadId]);
        }
      }
    }

    return NextResponse.json({
      template: WHATSAPP_TEMPLATES[templateKey].label,
      processed: recipients.length,
      sentCount: sent.length,
      failedCount: failed.length,
      sent,
      failed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Broadcast failed';
    console.error('WhatsApp broadcast error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
