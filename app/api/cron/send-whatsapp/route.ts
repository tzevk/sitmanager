// @
// /api/cron/send-whatsapp/route.ts
// Runs every 2 mins via Vercel cron
// Picks uncontacted leads and sends first WhatsApp template message

import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface MetaAdsLeadRow extends RowDataPacket {
  id: number;
  student_name: string | null;
  mobile: string | null;
  course_name: string | null;
  campaign_name: string | null;
}

interface SendResult {
  id: number;
  phone: string;
  course: string;
}

interface FailedResult {
  id: number;
  reason: string;
}

const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Template name — must match exactly what you created in Meta WhatsApp Manager
const WELCOME_TEMPLATE = "sit_welcome_message";

function errorMessage(error: unknown, fallback = "Unknown error") {
  return error instanceof Error ? error.message : fallback;
}

function normalizePhone(mobile: string | null) {
  if (!mobile) return null;
  let digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length !== 12) return null;
  return digits;
}

function validateWhatsAppConfig() {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    return NextResponse.json(
      { error: "WhatsApp configuration missing: WHATSAPP_TOKEN and PHONE_NUMBER_ID are required" },
      { status: 500 }
    );
  }
  return null;
}

function getCourse(courseName: string | null, campaignName: string | null) {
  const raw = (courseName || campaignName || "").toLowerCase();
  if (raw.includes("piping drafting") || raw.includes("piping design")) return "piping_drafting";
  if (raw.includes("piping")) return "piping";
  if (raw.includes("edd") || raw.includes("engineering design")) return "edd";
  if (raw.includes("hvac")) return "hvac";
  if (raw.includes("rotating")) return "rotating";
  if (raw.includes("mep")) return "mep";
  if (raw.includes("mechanical design")) return "mechanical_design";
  if (raw.includes("instrumentation")) return "pic";
  if (raw.includes("electrical")) return "electrical";
  if (raw.includes("structural")) return "structural";
  if (raw.includes("process")) return "process";
  return "general";
}

async function sendWelcomeTemplate(toPhone: string, studentName: string | null) {
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
            {
              type: "text",
              parameter_name: "name",
              text: studentName?.split(" ")[0] || "there",
            },
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
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configError = validateWhatsAppConfig();
  if (configError) return configError;

  const { searchParams } = new URL(req.url);
  const testPhone = normalizePhone(searchParams.get("testPhone"));
  if (testPhone) {
    try {
      const data = await sendWelcomeTemplate(testPhone, searchParams.get("name") || "Test");
      return NextResponse.json({ success: true, test: true, phone: testPhone, data });
    } catch (err) {
      return NextResponse.json(
        { success: false, test: true, phone: testPhone, error: errorMessage(err, "WhatsApp test failed") },
        { status: 502 }
      );
    }
  }

  if (searchParams.has("testPhone")) {
    return NextResponse.json({ error: "Invalid testPhone. Use country code format, e.g. 918879997431" }, { status: 400 });
  }

  let db;
  try {
    db = await mysql.createConnection(DB_CONFIG);

    const [leads] = await db.execute<MetaAdsLeadRow[]>(`
      SELECT id, student_name, mobile, course_name, campaign_name
      FROM meta_ads_lead_sync
      WHERE notifications_sent_at IS NULL
        AND mobile IS NOT NULL
        AND mobile != ''
        AND (wa_stage IS NULL OR wa_stage NOT IN ('opted_out', 'completed'))
      ORDER BY id ASC
      LIMIT 50
    `);

    if (leads.length === 0) {
      return NextResponse.json({ message: "No new leads to contact" });
    }

    const results: { sent: SendResult[]; failed: FailedResult[] } = { sent: [], failed: [] };

    for (const lead of leads) {
      const phone = normalizePhone(lead.mobile);

      if (!phone) {
        results.failed.push({ id: lead.id, reason: "Invalid phone number" });
        await db.execute(
          `UPDATE meta_ads_lead_sync SET last_error = ? WHERE id = ?`,
          ["Invalid phone number format", lead.id]
        );
        continue;
      }

      const course = getCourse(lead.course_name, lead.campaign_name);

      try {
        await sendWelcomeTemplate(phone, lead.student_name);

        await db.execute(
          `UPDATE meta_ads_lead_sync
           SET notifications_sent_at = NOW(),
               wa_stage = 'awaiting_choice',
               wa_data = ?
           WHERE id = ?`,
          [JSON.stringify({ course }), lead.id]
        );

        results.sent.push({ id: lead.id, phone, course });
      } catch (err) {
        const reason = errorMessage(err, "WhatsApp API error");
        await db.execute(
          `UPDATE meta_ads_lead_sync SET last_error = ? WHERE id = ?`,
          [reason, lead.id]
        );
        results.failed.push({ id: lead.id, reason });
      }
    }

    return NextResponse.json({
      processed: leads.length,
      sent: results.sent.length,
      failed: results.failed.length,
      details: results,
    });
  } catch (err) {
    console.error("Cron job error:", err);
    return NextResponse.json({ error: errorMessage(err, "Cron job failed") }, { status: 500 });
  } finally {
    if (db) await db.end();
  }
}
