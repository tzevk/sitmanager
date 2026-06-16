// /api/cron/send-whatsapp.js
// Runs every 2 mins via Vercel cron
// Picks uncontacted leads from MariaDB and sends first WhatsApp template message
//@ts-nocheck
import mysql from "mysql2/promise";

// --- Config ---
const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// --- Template names — must match exactly what you submit to Meta for approval ---
const TEMPLATES = {
  piping: "admission_inquiry_piping",
  edd: "admission_inquiry_edd",
  default: "admission_inquiry_general",
};

// --- Normalize phone number to WhatsApp format ---
// WhatsApp expects: 91XXXXXXXXXX (country code + number, no + no spaces)
function normalizePhone(mobile) {
  if (!mobile) return null;

  let digits = mobile.replace(/\D/g, "");

  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length !== 12) return null;

  return digits;
}

// --- Determine course from course_name or fallback to campaign_name ---
function getCourse(courseName, campaignName) {
  const raw = (courseName || campaignName || "").toLowerCase();
  if (raw.includes("piping")) return "piping";
  if (raw.includes("edd") || raw.includes("engineering design")) return "edd";
  return "default";
}

// --- Send WhatsApp template message (first outbound message) ---
async function sendTemplateMessage(toPhone, studentName, course) {
  const templateName = TEMPLATES[course];

  const payload = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            // {{1}} in your Meta template = student's first name
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

// --- Main cron handler ---
export default async function handler(req, res) {
  // Protect this route — Vercel cron sends this header automatically
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let db;

  try {
    db = await mysql.createConnection(DB_CONFIG);

    // Fetch leads that:
    // 1. Have never been sent a WhatsApp message (notifications_sent_at IS NULL)
    // 2. Have a mobile number
    // 3. Have not opted out
    const [leads] = await db.execute(`
      SELECT id, student_name, mobile, course_name, campaign_name
      FROM meta_ads_lead_sync
      WHERE notifications_sent_at IS NULL
        AND mobile IS NOT NULL
        AND mobile != ''
        AND (wa_stage IS NULL OR wa_stage != 'opted_out')
      LIMIT 50
    `);

    if (leads.length === 0) {
      return res.status(200).json({ message: "No new leads to contact" });
    }

    const results = { sent: [], failed: [] };

    for (const lead of leads) {
      const phone = normalizePhone(lead.mobile);

      // Invalid number — log and skip
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
        await sendTemplateMessage(phone, lead.student_name, course);

        // Mark as contacted + set first stage of conversation
        // wa_data stores course so webhook knows it throughout the conversation
        await db.execute(
          `UPDATE meta_ads_lead_sync 
           SET notifications_sent_at = NOW(),
               wa_stage = 'awaiting_name',
               wa_data = ?
           WHERE id = ?`,
          [JSON.stringify({ course }), lead.id]
        );

        results.sent.push({ id: lead.id, phone, course });
      } catch (err) {
        await db.execute(
          `UPDATE meta_ads_lead_sync SET last_error = ? WHERE id = ?`,
          [err.message, lead.id]
        );
        results.failed.push({ id: lead.id, reason: err.message });
      }
    }

    return res.status(200).json({
      processed: leads.length,
      sent: results.sent.length,
      failed: results.failed.length,
      details: results,
    });
  } catch (err) {
    console.error("Cron job error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (db) await db.end();
  }
}