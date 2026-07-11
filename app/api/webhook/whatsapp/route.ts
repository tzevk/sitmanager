// /api/webhook/whatsapp/route.ts
// SIT WhatsApp Automation — Simplified Flow
// Qualification → Course → Brochure → Note interest → Done

import mysql from "mysql2/promise";
import { NextRequest, NextResponse } from "next/server";

// --- Config ---
const DB_CONFIG = {
  host: process.env.DB_HOST as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME as string,
};

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN as string;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID as string;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN as string;
const ADMIN_NUMBER = "919167219404";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface QualificationEntry {
  label: string;
  courses: string[];
  other?: boolean;
}

interface WaData {
  branch?: string;
  name?: string;
  qualification_num?: number;
  qualification_label?: string;
  course?: string;
  [key: string]: any;
}

interface Lead {
  id: number;
  student_name: string;
  mobile: string;
  course_name: string;
  campaign_name: string;
  wa_stage: string;
  wa_data: string | null;
}

// ─────────────────────────────────────────────
// QUALIFICATION → COURSES MAP
// ─────────────────────────────────────────────

const QUALIFICATION_MAP: Record<number, QualificationEntry> = {
  1: {
    label: "Mechanical / Production Engineer",
    courses: [
      "Piping Engineering",
      "Mechanical Design of Process Equipment",
      "Air Conditioning System Design (HVAC)",
      "MEP (Mechanical Electrical and Plumbing)",
      "Rotating Equipment",
      "Offshore Engineering",
      "Advance Pipe Stress Analysis",
    ],
  },
  2: {
    label: "Chemical / Petrochemical Engineer",
    courses: [
      "Process Engineering",
      "Piping Engineering",
      "Offshore Engineering",
    ],
  },
  3: {
    label: "Electrical Engineer",
    courses: [
      "Electrical System Design",
      "MEP (Mechanical Electrical and Plumbing)",
    ],
  },
  4: {
    label: "Civil Engineer",
    courses: ["Structural Engineering"],
  },
  5: {
    label: "Instrumentation / ENTC Engineer",
    courses: ["Process Instrumentation and Control"],
  },
  6: {
    label: "ITI / Mechanical Draftsman",
    courses: [
      "Piping Design and Drafting",
      "HVAC Design and Drafting",
      "Engineering Design and Drafting",
    ],
  },
  7: {
    label: "HSC Student (Arts / Commerce / Science)",
    courses: ["Engineering Design and Drafting"],
  },
  8: {
    label: "Other",
    courses: [],
    other: true,
  },
};

// ─────────────────────────────────────────────
// BROCHURE LINKS
// Replace PLACEHOLDER values with actual Google Drive links
// ─────────────────────────────────────────────

const BROCHURES: Record<string, string> = {
  "Piping Engineering": "https://drive.google.com/PLACEHOLDER_PIPING",
  "Mechanical Design of Process Equipment": "https://drive.google.com/PLACEHOLDER_MECHANICAL_DESIGN",
  "Air Conditioning System Design (HVAC)": "https://drive.google.com/PLACEHOLDER_HVAC",
  "MEP (Mechanical Electrical and Plumbing)": "https://drive.google.com/PLACEHOLDER_MEP",
  "Rotating Equipment": "https://drive.google.com/PLACEHOLDER_ROTATING",
  "Offshore Engineering": "https://drive.google.com/PLACEHOLDER_OFFSHORE",
  "Advance Pipe Stress Analysis": "https://drive.google.com/PLACEHOLDER_PIPE_STRESS",
  "Process Engineering": "https://drive.google.com/PLACEHOLDER_PROCESS",
  "Electrical System Design": "https://drive.google.com/PLACEHOLDER_ELECTRICAL",
  "Structural Engineering": "https://drive.google.com/PLACEHOLDER_STRUCTURAL",
  "Process Instrumentation and Control": "https://drive.google.com/PLACEHOLDER_PIC",
  "Piping Design and Drafting": "https://drive.google.com/PLACEHOLDER_PIPING_DRAFTING",
  "HVAC Design and Drafting": "https://drive.google.com/PLACEHOLDER_HVAC_DRAFTING",
  "Engineering Design and Drafting": "https://drive.google.com/PLACEHOLDER_EDD",
};

// ─────────────────────────────────────────────
// SEND HELPER
// ─────────────────────────────────────────────

async function sendMessage(toPhone: string, text: string): Promise<void> {
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
  if (!response.ok) throw new Error(data?.error?.message || "WhatsApp send error");
}

async function notifyAdmin(name: string, phone: string, course: string): Promise<void> {
  await sendMessage(
    ADMIN_NUMBER,
    `🔔 *SIT Lead Alert*\n\n*Name:* ${name}\n*Phone:* ${phone}\n*Course Interest:* ${course}\n\nPlease follow up at the earliest.`
  );
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function isStop(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "stop" || t === "unsubscribe" || t === "cancel" || t === "quit";
}

function qualificationListMessage(): string {
  return Object.entries(QUALIFICATION_MAP)
    .map(([num, q]) => `*${num}.* ${q.label}`)
    .join("\n");
}

function courseListMessage(courses: string[]): string {
  return courses.map((c, i) => `*${i + 1}.* ${c}`).join("\n");
}

function getAllCoursesUnique(): string[] {
  return Object.values(QUALIFICATION_MAP)
    .flatMap((q) => q.courses)
    .filter((v, i, a) => a.indexOf(v) === i);
}

// ─────────────────────────────────────────────
// SEND BROCHURE + END CONVERSATION
// ─────────────────────────────────────────────

async function sendCourseEndMessage(
  db: any,
  lead: Lead,
  from: string,
  waData: WaData
): Promise<void> {
  const { course, name } = waData;
  const brochureLink = course ? BROCHURES[course] : null;

  await db.execute(
    `UPDATE meta_ads_lead_sync
     SET wa_stage = 'completed', wa_callback_requested = 1, wa_data = ?
     WHERE id = ?`,
    [JSON.stringify(waData), lead.id]
  );

  await notifyAdmin(name || "Unknown", from, course || "Unknown");

  if (brochureLink && !brochureLink.includes("PLACEHOLDER")) {
    await sendMessage(from, `📄 Here is the brochure for *${course}*:\n${brochureLink}`);
  }

  await sendMessage(
    from,
    `✅ Thank you, ${name || "there"}!\n\nWe have noted your interest in *${course}*. Our team will be in touch with you shortly. 😊\n\nThank you for choosing SIT — Suvidya Institute of Technology!`
  );
}

// ─────────────────────────────────────────────
// MAIN CONVERSATION FLOW
// ─────────────────────────────────────────────

async function handleFlow(
  db: any,
  lead: Lead,
  from: string,
  messageText: string
): Promise<void> {
  const stage = lead.wa_stage;
  const waData: WaData = lead.wa_data ? JSON.parse(lead.wa_data) : {};
  const text = messageText.trim();

  if (stage === "completed" || stage === "opted_out") return;

  if (isStop(text)) {
    await db.execute(
      `UPDATE meta_ads_lead_sync SET wa_stage = 'opted_out' WHERE id = ?`,
      [lead.id]
    );
    await sendMessage(
      from,
      `You have been unsubscribed. We will not contact you again. If you change your mind, feel free to reach out directly. Thank you!`
    );
    return;
  }

  async function updateStage(newStage: string, newData: WaData): Promise<void> {
    await db.execute(
      `UPDATE meta_ads_lead_sync SET wa_stage = ?, wa_data = ? WHERE id = ?`,
      [newStage, JSON.stringify(newData), lead.id]
    );
  }

  // ── awaiting_choice ──
  if (stage === "awaiting_choice") {
    const t = text.toLowerCase().trim();

    if (t === "1" || t.includes("call")) {
      await updateStage("call_awaiting_name", { ...waData, branch: "call" });
      await sendMessage(from,
        `Thank you! 😊\n\nPlease share your *Full Name* so our Career Counsellor can reach out to you.`
      );
      return;
    }

    if (t === "2" || t.includes("chat")) {
      await updateStage("chat_awaiting_name", { ...waData, branch: "chat" });
      await sendMessage(from, `Great! Let's get started. 😊\n\nPlease share your *Full Name*.`);
      return;
    }

    await sendMessage(from,
      `Please reply with:\n*1* — Request a Call from our Career Counsellor\n*2* — Chat with us on WhatsApp`
    );
    return;
  }

  // ══════════════════════════════════════
  // BRANCH 1 — REQUEST A CALL
  // ══════════════════════════════════════

  if (stage === "call_awaiting_name") {
    if (text.length < 2) {
      await sendMessage(from, `Please share your full name to continue.`);
      return;
    }
    await updateStage("call_awaiting_course", { ...waData, name: text });
    const allCourses = getAllCoursesUnique();
    await sendMessage(from,
      `Thank you, ${text}! 😊\n\nWhich Training Program are you interested in?\n\n${courseListMessage(allCourses)}\n\nReply with the *number* or *name* of the program.`
    );
    return;
  }

  if (stage === "call_awaiting_course") {
    const allCourses = getAllCoursesUnique();
    const num = parseInt(text.trim());
    let course: string | null = null;

    if (!isNaN(num) && num >= 1 && num <= allCourses.length) {
      course = allCourses[num - 1];
    } else {
      course = allCourses.find((c) =>
        c.toLowerCase().includes(text.toLowerCase().trim())
      ) || null;
    }

    if (!course) {
      await sendMessage(from, `Please choose a valid program:\n\n${courseListMessage(allCourses)}`);
      return;
    }

    await db.execute(
      `UPDATE meta_ads_lead_sync SET wa_stage = 'completed', wa_callback_requested = 1, wa_data = ? WHERE id = ?`,
      [JSON.stringify({ ...waData, course }), lead.id]
    );
    await notifyAdmin(waData.name || "Unknown", from, course);
    await sendMessage(from,
      `✅ Thank you, ${waData.name}!\n\nWe have noted your interest in *${course}*. Our Career Counsellor will contact you shortly. 😊`
    );
    return;
  }

  // ══════════════════════════════════════
  // BRANCH 2 — CHAT FLOW
  // ══════════════════════════════════════

  if (stage === "chat_awaiting_name") {
    if (text.length < 2) {
      await sendMessage(from, `Please share your full name to continue.`);
      return;
    }
    await updateStage("chat_awaiting_qualification", { ...waData, name: text });
    await sendMessage(from,
      `Thank you, ${text}! 😊\n\nWhat is your current qualification?\n\n${qualificationListMessage()}\n\nReply with the *number* of your qualification.`
    );
    return;
  }

  if (stage === "chat_awaiting_qualification") {
    const num = parseInt(text.trim());

    if (isNaN(num) || !QUALIFICATION_MAP[num]) {
      await sendMessage(from,
        `Please reply with a number from the list:\n\n${qualificationListMessage()}`
      );
      return;
    }

    const qualification = QUALIFICATION_MAP[num];
    const updatedData: WaData = {
      ...waData,
      qualification_num: num,
      qualification_label: qualification.label,
    };

    // ── Option 8 — Other ──
    if (qualification.other) {
      await db.execute(
        `UPDATE meta_ads_lead_sync SET wa_stage = 'completed', wa_callback_requested = 1, wa_data = ? WHERE id = ?`,
        [JSON.stringify(updatedData), lead.id]
      );
      await notifyAdmin(waData.name || "Unknown", from, "Other (Qualification not listed)");
      await sendMessage(from,
        `Thank you, ${waData.name || "there"}! 😊\n\nWe have noted your interest and our team will be contacting you shortly.\n\nThank you for choosing SIT — Suvidya Institute of Technology!`
      );
      return;
    }

    await updateStage("chat_awaiting_course", updatedData);

    // Single course — skip list, just confirm
    if (qualification.courses.length === 1) {
      const course = qualification.courses[0];
      await sendMessage(from,
        `Got it! Based on your qualification, the recommended program for you is:\n\n*${course}*\n\nIs this the program you're interested in?\n\nReply *YES* to confirm or *NO* to go back.`
      );
      return;
    }

    await sendMessage(from,
      `Got it! Here are the training programs available for *${qualification.label}*:\n\n${courseListMessage(qualification.courses)}\n\nReply with the *number* of the program you're interested in.`
    );
    return;
  }

  if (stage === "chat_awaiting_course") {
    const qualNum = waData.qualification_num;
    const qualification = qualNum ? QUALIFICATION_MAP[qualNum] : null;

    if (!qualification) {
      await updateStage("chat_awaiting_qualification", waData);
      await sendMessage(from,
        `Something went wrong. Please choose your qualification again:\n\n${qualificationListMessage()}`
      );
      return;
    }

    // Single course — handle YES/NO confirmation
    if (qualification.courses.length === 1) {
      const course = qualification.courses[0];
      const t = text.toLowerCase().trim();

      if (t === "yes" || t === "y" || t === "haan") {
        await sendCourseEndMessage(db, lead, from, { ...waData, course });
        return;
      }

      if (t === "no" || t === "n" || t === "nahi") {
        await updateStage("chat_awaiting_qualification", waData);
        await sendMessage(from,
          `No problem! Please choose your qualification again:\n\n${qualificationListMessage()}\n\nReply with the *number* of your qualification.`
        );
        return;
      }

      await sendMessage(from,
        `Please reply *YES* to confirm *${course}* or *NO* to go back.`
      );
      return;
    }

    // Multiple courses — parse their choice
    const num = parseInt(text.trim());
    const courses = qualification.courses;
    let course: string | null = null;

    if (!isNaN(num) && num >= 1 && num <= courses.length) {
      course = courses[num - 1];
    } else {
      course = courses.find((c) =>
        c.toLowerCase().includes(text.toLowerCase().trim())
      ) || null;
    }

    if (!course) {
      await sendMessage(from,
        `Please choose a valid program:\n\n${courseListMessage(courses)}`
      );
      return;
    }

    await sendCourseEndMessage(db, lead, from, { ...waData, course });
    return;
  }
}

// ─────────────────────────────────────────────
// MAIN WEBHOOK HANDLER
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const responsePromise = NextResponse.json({ status: "ok" }, { status: 200 });

  try {
    const body = await req.json();
    const value = body?.entry?.[0]?.changes?.[0]?.value;

    if (value?.statuses) return responsePromise;

    const message = value?.messages?.[0];
    if (!message) return responsePromise;
    if (message.type !== "text") return responsePromise;

    const from: string = message.from;
    const messageText: string = message.text?.body || "";

    let db: any;
    try {
      db = await mysql.createConnection(DB_CONFIG);
      const localNumber = from.startsWith("91") ? from.slice(2) : from;

      const [rows]: any = await db.execute(
        `SELECT id, student_name, mobile, course_name, campaign_name, wa_stage, wa_data
         FROM meta_ads_lead_sync
         WHERE mobile LIKE ?
         LIMIT 1`,
        [`%${localNumber}%`]
      );

      if (rows.length === 0) return responsePromise;

      const lead: Lead = rows[0];
      await handleFlow(db, lead, from, messageText);
    } finally {
      if (db) await db.end();
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return responsePromise;
}
