// /api/cron/send-whatsapp/route.ts
// Runs via Vercel cron
// Picks uncontacted leads and sends first WhatsApp template message

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Template names — must match exactly what you create in Meta WhatsApp Manager
// One single template for all leads regardless of course
const WELCOME_TEMPLATE = "sit_welcome_message";

interface Lead {
  id: number;
  student_name: string | null;
  mobile: string | null;
  course_name: string | null;
  campaign_name: string | null;
}

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() || "";
  const querySecret = req.nextUrl.searchParams.get("secret")?.trim() || "";

  return bearer === secret || headerSecret === secret || querySecret === secret;
}

function normalizePhone(mobile: string | null): string | null {
  if (!mobile) return null;
  let digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length !== 12) return null;
  return digits;
}

function getCourse(courseName: string | null, campaignName: string | null): string {
  const raw = (courseName || campaignName || "").toLowerCase();
  if (raw.includes("piping")) return "piping";
  if (raw.includes("edd") || raw.includes("engineering design")) return "edd";
  if (raw.includes("hvac")) return "hvac";
  if (raw.includes("mep")) return "mep";
  if (raw.includes("process")) return "process";
  if (raw.includes("structural")) return "structural";
  if (raw.includes("mechanical design")) return "mechanical_design";
  return "general";
}

async function sendWelcomeTemplate(toPhone: string, studentName: string | null): Promise<unknown> {
  const payload = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: {
      name: WELCOME_TEMPLATE,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: studentName?.split(" ")[0] || "there" },
          ],
        },
      ],
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp API error");
  }
  return data;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    return NextResponse.json(
      { error: "WhatsApp credentials are not configured" },
      { status: 500 }
    );
  }

  try {
    const leads = await query<Lead>(`
      SELECT id, student_name, mobile, course_name, campaign_name
      FROM meta_ads_lead_sync
      WHERE notifications_sent_at IS NULL
        AND mobile IS NOT NULL
        AND mobile != ''
        AND (wa_stage IS NULL OR wa_stage NOT IN ('opted_out', 'completed'))
      LIMIT 50
    `);

    if (leads.length === 0) {
      return NextResponse.json({ message: "No new leads to contact" });
    }

    const results: {
      sent: { id: number; phone: string; course: string }[];
      failed: { id: number; reason: string }[];
    } = { sent: [], failed: [] };

    for (const lead of leads) {
      const phone = normalizePhone(lead.mobile);

      if (!phone) {
        results.failed.push({ id: lead.id, reason: "Invalid phone number" });
        await query(
          `UPDATE meta_ads_lead_sync SET last_error = ? WHERE id = ?`,
          ["Invalid phone number format", lead.id]
        );
        continue;
      }

      const course = getCourse(lead.course_name, lead.campaign_name);

      try {
        await sendWelcomeTemplate(phone, lead.student_name);

        // Mark as contacted, set first stage, store course in wa_data
        await query(
          `UPDATE meta_ads_lead_sync
           SET notifications_sent_at = NOW(),
               wa_stage = 'awaiting_choice',
               wa_data = ?
           WHERE id = ?`,
          [JSON.stringify({ course }), lead.id]
        );

        results.sent.push({ id: lead.id, phone, course });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "WhatsApp send failed";
        await query(
          `UPDATE meta_ads_lead_sync SET last_error = ? WHERE id = ?`,
          [message, lead.id]
        );
        results.failed.push({ id: lead.id, reason: message });
      }
    }

    return NextResponse.json({
      processed: leads.length,
      sent: results.sent.length,
      failed: results.failed.length,
      details: results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cron job failed";
    console.error("Cron job error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
