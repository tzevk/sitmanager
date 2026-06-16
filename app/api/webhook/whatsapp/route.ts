// /api/webhook/whatsapp.js
// Receives all incoming WhatsApp messages from leads
// Manages full conversation flow using wa_stage in MariaDB
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
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// ─────────────────────────────────────────────
// SEND HELPER
// ─────────────────────────────────────────────

async function sendMessage(toPhone, text) {
  const payload = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "text",
    text: { body: text },
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
    throw new Error(data?.error?.message || "WhatsApp send error");
  }
  return data;
}

// ─────────────────────────────────────────────
// SLOT DATE HELPER
// Returns { label, date } for today / tomorrow / day after
// ─────────────────────────────────────────────

function getSlotDates() {
  const today = new Date();

  const format = (d) => {
    // Returns YYYY-MM-DD for MariaDB DATE column
    return d.toISOString().split("T")[0];
  };

  const labelFormat = (d) => {
    // Returns "Tuesday, 17 June" for the confirmation message
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  return {
    1: { label: `Today (${labelFormat(today)})`, date: format(today) },
    2: { label: `Tomorrow (${labelFormat(tomorrow)})`, date: format(tomorrow) },
    3: { label: `Day after tomorrow (${labelFormat(dayAfter)})`, date: format(dayAfter) },
  };
}

// ─────────────────────────────────────────────
// COURSE DISPLAY NAME HELPER
// ─────────────────────────────────────────────

function courseLabel(course) {
  if (course === "piping") return "Piping Engineering";
  if (course === "edd") return "Engineering Design & Drafting (EDD)";
  return "our program";
}

function otherCourse(course) {
  if (course === "piping") return "edd";
  if (course === "edd") return "piping";
  return null;
}

// ─────────────────────────────────────────────
// YES / NO DETECTOR
// Handles English + common Hindi responses
// ─────────────────────────────────────────────

function isYes(text) {
  const t = text.toLowerCase().trim();
  return (
    t === "yes" || t === "y" || t === "yeah" || t === "yep" ||
    t === "haan" || t === "ha" || t === "हाँ" || t === "हां" ||
    t.startsWith("yes") // "yes please", "yes i am" etc
  );
}

function isNo(text) {
  const t = text.toLowerCase().trim();
  return (
    t === "no" || t === "n" || t === "nope" || t === "nahi" ||
    t === "नहीं" || t === "nhi" ||
    t.startsWith("no ")
  );
}

function isStop(text) {
  const t = text.toLowerCase().trim();
  return t === "stop" || t === "unsubscribe" || t === "cancel" || t === "quit";
}

// ─────────────────────────────────────────────
// YEAR OF PASSOUT VALIDATOR
// Accepts formats like 2021-22, 2021-2022, 2023
// ─────────────────────────────────────────────

function isValidPassout(text) {
  const t = text.trim();
  return (
    /^20\d{2}-\d{2,4}$/.test(t) || // 2021-22 or 2021-2022
    /^20\d{2}$/.test(t)             // 2023
  );
}

// ─────────────────────────────────────────────
// CONVERSATION FLOW HANDLER
// Core logic — reads wa_stage, replies, updates stage
// ─────────────────────────────────────────────

async function handleFlow(db, lead, from, messageText) {
  const stage = lead.wa_stage;
  const waData = lead.wa_data ? JSON.parse(lead.wa_data) : {};
  const text = messageText.trim();

  // ── OPTED OUT — never reply ──
  if (stage === "opted_out" || stage === "completed") {
    return; // silently ignore, conversation is over
  }

  // ── STOP at any stage ──
  if (isStop(text)) {
    await db.execute(
      `UPDATE meta_ads_lead_sync SET wa_stage = 'opted_out' WHERE id = ?`,
      [lead.id]
    );
    await sendMessage(
      from,
      "You have been unsubscribed. We won't contact you again. If you change your mind, please reach out to us directly. Thank you!"
    );
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_name
  // Lead just received the template message, we asked for their name
  // ─────────────────────────
  if (stage === "awaiting_name") {
    // Accept anything with at least 2 characters as a name
    if (text.length < 2) {
      await sendMessage(from, "Please share your full name to continue.");
      return;
    }

    const updatedData = { ...waData, name: text };
    await db.execute(
      `UPDATE meta_ads_lead_sync 
       SET wa_stage = 'awaiting_qualification', wa_data = ?
       WHERE id = ?`,
      [JSON.stringify(updatedData), lead.id]
    );

    await sendMessage(
      from,
      `Thank you, ${text}! 😊\n\nWhat is your highest qualification?\n(e.g. Diploma, B.Tech, B.E, ITI, 12th Pass)`
    );
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_qualification
  // ─────────────────────────
  if (stage === "awaiting_qualification") {
    if (text.length < 2) {
      await sendMessage(from, "Please share your qualification to continue. (e.g. Diploma, B.Tech, B.E)");
      return;
    }

    const updatedData = { ...waData, qualification: text };
    await db.execute(
      `UPDATE meta_ads_lead_sync
       SET wa_stage = 'awaiting_passout', wa_data = ?
       WHERE id = ?`,
      [JSON.stringify(updatedData), lead.id]
    );

    await sendMessage(
      from,
      `Got it! 📋\n\nWhat is your year of passout?\n(Please reply in format: 20XX-XX, e.g. 2022-23)`
    );
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_passout
  // ─────────────────────────
  if (stage === "awaiting_passout") {
    if (!isValidPassout(text)) {
      await sendMessage(
        from,
        "Please share your year of passout in the correct format.\nExample: *2022-23* or *2023*"
      );
      return;
    }

    const course = waData.course || "default";
    const updatedData = { ...waData, passout: text };

    await db.execute(
      `UPDATE meta_ads_lead_sync
       SET wa_stage = 'awaiting_interest', wa_data = ?
       WHERE id = ?`,
      [JSON.stringify(updatedData), lead.id]
    );

    await sendMessage(
      from,
      `Great! 🎓\n\nAre you interested in our *${courseLabel(course)}* program?\n\nReply *YES* or *NO*`
    );
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_interest
  // Are they interested in the course from their ad?
  // ─────────────────────────
  if (stage === "awaiting_interest") {
    const course = waData.course || "default";

    if (isYes(text)) {
      await db.execute(
        `UPDATE meta_ads_lead_sync
         SET wa_stage = 'awaiting_booking', wa_data = ?
         WHERE id = ?`,
        [JSON.stringify({ ...waData, interested_course: course }), lead.id]
      );

      await sendMessage(
        from,
        `Wonderful! 🙌\n\nWould you like to book a free counselling call with our team to learn more about the *${courseLabel(course)}* program, fees, and placement support?\n\nReply *YES* or *NO*`
      );
      return;
    }

    if (isNo(text)) {
      const other = otherCourse(course);

      if (other) {
        await db.execute(
          `UPDATE meta_ads_lead_sync
           SET wa_stage = 'awaiting_other_interest', wa_data = ?
           WHERE id = ?`,
          [JSON.stringify({ ...waData, declined_course: course }), lead.id]
        );

        await sendMessage(
          from,
          `No problem! Are you interested in our *${courseLabel(other)}* program instead?\n\nReply *YES* or *NO*`
        );
      } else {
        // No other course to offer
        await db.execute(
          `UPDATE meta_ads_lead_sync SET wa_stage = 'completed' WHERE id = ?`,
          [lead.id]
        );
        await sendMessage(
          from,
          `Thank you for your time, ${waData.name || ""}! If you ever want to explore our programs in the future, feel free to reach out. Wishing you all the best! 👍`
        );
      }
      return;
    }

    // Didn't say yes or no
    await sendMessage(from, `Please reply with *YES* or *NO* — are you interested in our *${courseLabel(course)}* program?`);
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_other_interest
  // Are they interested in the OTHER course?
  // ─────────────────────────
  if (stage === "awaiting_other_interest") {
    const course = waData.course || "default";
    const other = otherCourse(course);

    if (isYes(text)) {
      await db.execute(
        `UPDATE meta_ads_lead_sync
         SET wa_stage = 'awaiting_booking', wa_data = ?
         WHERE id = ?`,
        [JSON.stringify({ ...waData, interested_course: other }), lead.id]
      );

      await sendMessage(
        from,
        `Great! 🙌\n\nWould you like to book a free counselling call with our team to learn more about the *${courseLabel(other)}* program?\n\nReply *YES* or *NO*`
      );
      return;
    }

    if (isNo(text)) {
      await db.execute(
        `UPDATE meta_ads_lead_sync SET wa_stage = 'completed' WHERE id = ?`,
        [lead.id]
      );
      await sendMessage(
        from,
        `Thank you for your time, ${waData.name || ""}! If you ever change your mind, feel free to reach out to us. Wishing you all the best! 👍`
      );
      return;
    }

    await sendMessage(from, `Please reply with *YES* or *NO* — are you interested in our *${courseLabel(other)}* program?`);
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_booking
  // Do they want to book a call?
  // ─────────────────────────
  if (stage === "awaiting_booking") {
    if (isYes(text)) {
      const slots = getSlotDates();

      await db.execute(
        `UPDATE meta_ads_lead_sync SET wa_stage = 'awaiting_slot' WHERE id = ?`,
        [lead.id]
      );

      await sendMessage(
        from,
        `Please choose a slot for your counselling call:\n\n*1.* ${slots[1].label}\n*2.* ${slots[2].label}\n*3.* ${slots[3].label}\n\nReply with *1*, *2*, or *3*`
      );
      return;
    }

    if (isNo(text)) {
      await db.execute(
        `UPDATE meta_ads_lead_sync SET wa_stage = 'completed' WHERE id = ?`,
        [lead.id]
      );
      await sendMessage(
        from,
        `No problem, ${waData.name || ""}! Thank you for your time. If you ever want to learn more, feel free to reach out. Wishing you all the best! 👍`
      );
      return;
    }

    await sendMessage(from, `Please reply with *YES* or *NO* — would you like to book a free counselling call?`);
    return;
  }

  // ─────────────────────────
  // STAGE: awaiting_slot
  // Which day do they want?
  // ─────────────────────────
  if (stage === "awaiting_slot") {
    const slots = getSlotDates();
    const choice = text.trim();

    if (!["1", "2", "3"].includes(choice)) {
      await sendMessage(
        from,
        `Please reply with *1*, *2*, or *3* to choose your slot:\n\n*1.* ${slots[1].label}\n*2.* ${slots[2].label}\n*3.* ${slots[3].label}`
      );
      return;
    }

    const selectedSlot = slots[parseInt(choice)];
    const interestedCourse = waData.interested_course || waData.course || "default";

    // Save slot booking to wa_booked_slots table
    await db.execute(
      `INSERT INTO wa_booked_slots 
       (lead_id, student_name, mobile, course, slot_date, slot_label)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        lead.id,
        waData.name || lead.student_name || "",
        from,
        courseLabel(interestedCourse),
        selectedSlot.date,
        selectedSlot.label,
      ]
    );

    // Mark lead as completed
    await db.execute(
      `UPDATE meta_ads_lead_sync SET wa_stage = 'completed' WHERE id = ?`,
      [lead.id]
    );

    await sendMessage(
      from,
      `✅ Your slot is confirmed!\n\nOur counsellor will call you on *${selectedSlot.label}*.\n\nThank you, ${waData.name || ""}! We look forward to speaking with you. 😊`
    );
    return;
  }
}

// ─────────────────────────────────────────────
// MAIN WEBHOOK HANDLER
// ─────────────────────────────────────────────

export default async function handler(req, res) {

  // ── GET: One-time Meta webhook verification ──
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified by Meta");
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verification failed" });
  }

  // ── POST: Incoming messages ──
  if (req.method === "POST") {
    // Always return 200 immediately — Meta retries if you don't respond fast
    res.status(200).json({ status: "ok" });

    try {
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;

      // Ignore delivery/read receipts — not a message
      if (value?.statuses) return;

      const message = value?.messages?.[0];
      if (!message) return;

      // Only handle text messages
      if (message.type !== "text") return;

      const from = message.from;             // "919XXXXXXXXX"
      const messageText = message.text?.body || "";

      // Look up lead in MariaDB by phone number
      let db;
      try {
        db = await mysql.createConnection(DB_CONFIG);

        // Strip country code to match how numbers may be stored
        const localNumber = from.startsWith("91") ? from.slice(2) : from;

        const [rows] = await db.execute(
          `SELECT id, student_name, mobile, course_name, campaign_name, wa_stage, wa_data
           FROM meta_ads_lead_sync
           WHERE mobile LIKE ?
           LIMIT 1`,
          [`%${localNumber}%`]
        );

        if (rows.length === 0) {
          // Unknown number — ignore
          return;
        }

        const lead = rows[0];
        await handleFlow(db, lead, from, messageText);

      } finally {
        if (db) await db.end();
      }

    } catch (err) {
      console.error("Webhook error:", err);
    }

    return;
  }

  return res.status(405).json({ error: "Method not allowed" });
}