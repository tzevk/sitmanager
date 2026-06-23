// /api/webhook/whatsapp/route.ts
// Full conversation flow — SIT WhatsApp Automation
// 11 programs with batch subtypes, eligibility check, brochure, admission flow

import { NextRequest, NextResponse, after } from "next/server";
import { query } from "@/lib/db";

// --- Config ---
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

const ADMIN_NUMBER = "919167219404";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Program {
  label: string;
  batches: string[];
  autoAssign: string | null;
}

interface LeadRow {
  id: number;
  student_name: string | null;
  mobile: string | null;
  course_name: string | null;
  campaign_name: string | null;
  wa_stage: string | null;
  wa_data: string | null;
}

interface WaData {
  branch?: string;
  name?: string;
  course?: string;
  batch?: string;
  qualification?: string;
  stream?: string;
  passout?: string;
  career_stage?: string;
}

interface CompleteFlags {
  callback?: boolean;
  admissionLink?: boolean;
}

// ─────────────────────────────────────────────
// PROGRAMS — 11 courses with subtypes
// ─────────────────────────────────────────────

const PROGRAMS: Record<string, Program> = {
  piping: {
    label: "Piping Engineering",
    batches: ["Full Time", "Weekend", "Full Time (Pune)"],
    autoAssign: null,
  },
  piping_drafting: {
    label: "Piping Design & Drafting",
    batches: ["Weekend"],
    autoAssign: "Weekend",
  },
  edd: {
    label: "Engineering Design & Drafting",
    batches: ["Full Time"],
    autoAssign: "Full Time",
  },
  hvac: {
    label: "HVAC Engineering",
    batches: ["Full Time", "Weekend"],
    autoAssign: null,
  },
  rotating: {
    label: "Rotating Equipment",
    batches: ["Online"],
    autoAssign: "Online",
  },
  mep: {
    label: "MEP Engineering",
    batches: ["Full Time", "Weekend"],
    autoAssign: null,
  },
  mechanical_design: {
    label: "Mechanical Design of Process Equipment",
    batches: ["Full Time", "Weekend"],
    autoAssign: null,
  },
  pic: {
    label: "Process Instrumentation & Control",
    batches: ["Full Time", "Weekend"],
    autoAssign: null,
  },
  electrical: {
    label: "Electrical System Design",
    batches: ["Full Time", "Weekend"],
    autoAssign: null,
  },
  structural: {
    label: "Structural Engineering",
    batches: ["Full Time", "Weekend"],
    autoAssign: null,
  },
  process: {
    label: "Process Engineering",
    batches: ["Full Time", "Online"],
    autoAssign: null,
  },
};

// Numbered list for lead to pick from
const PROGRAM_KEYS = Object.keys(PROGRAMS); // index 0 = key for option 1

function programListMessage(): string {
  return PROGRAM_KEYS.map((key, i) => `*${i + 1}.* ${PROGRAMS[key].label}`).join("\n");
}

function parseProgramChoice(text: string): string | null {
  const t = text.toLowerCase().trim();

  // Try number first
  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= PROGRAM_KEYS.length) {
    return PROGRAM_KEYS[num - 1];
  }

  // Try name match
  if (t.includes("piping design") || t.includes("piping drafting")) return "piping_drafting";
  if (t.includes("piping")) return "piping";
  if (t.includes("edd") || t.includes("engineering design")) return "edd";
  if (t.includes("hvac")) return "hvac";
  if (t.includes("rotating")) return "rotating";
  if (t.includes("mep")) return "mep";
  if (t.includes("mechanical design")) return "mechanical_design";
  if (t.includes("instrumentation") || t.includes("pic")) return "pic";
  if (t.includes("electrical")) return "electrical";
  if (t.includes("structural")) return "structural";
  if (t.includes("process")) return "process";

  return null;
}

function parseBatchChoice(text: string, batches: string[]): string | null {
  const t = text.toLowerCase().trim();

  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= batches.length) {
    return batches[num - 1];
  }

  if (t.includes("full time") || t.includes("fulltime") || t.includes("full-time")) {
    if (t.includes("pune")) return batches.find(b => b.toLowerCase().includes("pune")) || null;
    return batches.find(b => b.toLowerCase() === "full time") || null;
  }
  if (t.includes("weekend")) return batches.find(b => b.toLowerCase().includes("weekend")) || null;
  if (t.includes("online")) return batches.find(b => b.toLowerCase().includes("online")) || null;
  if (t.includes("pune")) return batches.find(b => b.toLowerCase().includes("pune")) || null;

  return null;
}

function batchListMessage(batches: string[]): string {
  return batches.map((b, i) => `*${i + 1}.* ${b}`).join("\n");
}

// ─────────────────────────────────────────────
// BROCHURE LINKS — replace with actual Google Drive links
// ─────────────────────────────────────────────

const BROCHURES: Record<string, string> = {
  piping: "https://drive.google.com/PLACEHOLDER_PIPING",
  piping_drafting: "https://drive.google.com/PLACEHOLDER_PIPING_DRAFTING",
  edd: "https://drive.google.com/PLACEHOLDER_EDD",
  hvac: "https://drive.google.com/PLACEHOLDER_HVAC",
  rotating: "https://drive.google.com/PLACEHOLDER_ROTATING",
  mep: "https://drive.google.com/PLACEHOLDER_MEP",
  mechanical_design: "https://drive.google.com/PLACEHOLDER_MECHANICAL_DESIGN",
  pic: "https://drive.google.com/PLACEHOLDER_PIC",
  electrical: "https://drive.google.com/PLACEHOLDER_ELECTRICAL",
  structural: "https://drive.google.com/PLACEHOLDER_STRUCTURAL",
  process: "https://drive.google.com/PLACEHOLDER_PROCESS",
};

// ─────────────────────────────────────────────
// ELIGIBILITY CHECK
// ─────────────────────────────────────────────

function checkEligibility(
  course: string,
  qualification: string | null | undefined,
  stream: string | null | undefined
): boolean {
  const qual = (qualification || "").toLowerCase();
  const str = (stream || "").toLowerCase();

  const hasDiplomaOrDegree =
    qual.includes("diploma") || qual.includes("degree") ||
    qual.includes("b.tech") || qual.includes("btech") ||
    qual.includes("b.e") || qual.includes("be");

  if (course === "piping") {
    return hasDiplomaOrDegree &&
      (str.includes("mechanical") || str.includes("chemical") || str.includes("production"));
  }

  if (course === "piping_drafting") {
    const validQual = hasDiplomaOrDegree || qual.includes("iti");
    return validQual &&
      (str.includes("mechanical") || str.includes("draughtsman") || str.includes("draftsman"));
  }

  if (course === "edd") {
    return qual.includes("hsc") || qual.includes("12th") || qual.includes("12") ||
      qual.includes("mcvc") || hasDiplomaOrDegree;
  }

  if (course === "hvac") {
    return hasDiplomaOrDegree &&
      (str.includes("mechanical") || str.includes("production"));
  }

  if (course === "rotating") {
    return hasDiplomaOrDegree &&
      (str.includes("mechanical") || str.includes("production"));
  }

  if (course === "mep") {
    return hasDiplomaOrDegree &&
      (str.includes("mechanical") || str.includes("production") || str.includes("electrical"));
  }

  if (course === "mechanical_design") {
    return hasDiplomaOrDegree &&
      (str.includes("mechanical") || str.includes("production"));
  }

  if (course === "pic") {
    return hasDiplomaOrDegree && str.includes("instrumentation");
  }

  if (course === "electrical") {
    return hasDiplomaOrDegree && str.includes("electrical");
  }

  if (course === "structural") {
    return hasDiplomaOrDegree &&
      (str.includes("civil") || str.includes("structural"));
  }

  if (course === "process") {
    return hasDiplomaOrDegree && str.includes("chemical");
  }

  return true;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function sendMessage(toPhone: string, text: string): Promise<unknown> {
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
  return data;
}

async function notifyAdmin(
  name: string,
  phone: string,
  course: string,
  batch: string | null,
  reason: string
): Promise<void> {
  const courseLabel = PROGRAMS[course]?.label || course;
  const batchLabel = batch ? ` (${batch})` : "";
  const message =
    `🔔 *SIT Lead Alert*\n\n` +
    `*Reason:* ${reason}\n` +
    `*Name:* ${name}\n` +
    `*Phone:* ${phone}\n` +
    `*Course:* ${courseLabel}${batchLabel}\n\n` +
    `Please follow up at the earliest.`;
  await sendMessage(ADMIN_NUMBER, message);
}

function isYes(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "yes" || t === "y" || t === "yeah" || t === "haan" ||
    t === "ha" || t === "हाँ" || t === "हां" || t.startsWith("yes ");
}

function isNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "no" || t === "n" || t === "nope" || t === "nahi" ||
    t === "नहीं" || t === "nhi" || t.startsWith("no ");
}

function isStop(text: string): boolean {
  const t = text.toLowerCase().trim();
  return t === "stop" || t === "unsubscribe" || t === "cancel" || t === "quit";
}

function isValidPassout(text: string): boolean {
  const t = text.trim();
  return /^20\d{2}-\d{2,4}$/.test(t) || /^20\d{2}$/.test(t);
}

function parseQualification(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (t === "1" || t.includes("degree") || t.includes("b.tech") || t.includes("btech") || t.includes("b.e")) return "Degree";
  if (t === "2" || t.includes("diploma")) return "Diploma";
  if (t === "3" || t.includes("hsc") || t.includes("12")) return "HSC";
  if (t === "4" || t.includes("iti")) return "ITI";
  if (t === "5" || t.includes("other")) return "Other";
  return null;
}

function parseCareerStage(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (t === "1" || t.includes("final")) return "Final Year Student";
  if (t === "2" || t.includes("fresher") || t.includes("fresh")) return "Fresher Graduate";
  if (t === "3" || t.includes("working") || t.includes("professional") || t.includes("experienced")) return "Working Professional";
  return null;
}

// ─────────────────────────────────────────────
// MAIN CONVERSATION FLOW
// ─────────────────────────────────────────────

async function handleFlow(lead: LeadRow, from: string, messageText: string): Promise<void> {
  const stage = lead.wa_stage;
  const waData: WaData = lead.wa_data ? JSON.parse(lead.wa_data) : {};
  const text = messageText.trim();

  if (stage === "completed" || stage === "opted_out") return;

  // STOP at any stage
  if (isStop(text)) {
    await query(
      `UPDATE meta_ads_lead_sync SET wa_stage = 'opted_out' WHERE id = ?`,
      [lead.id]
    );
    await sendMessage(from,
      `You have been unsubscribed. We will not contact you again. If you change your mind, feel free to reach out to us directly. Thank you!`
    );
    return;
  }

  async function updateStage(newStage: string, newData?: WaData): Promise<void> {
    await query(
      `UPDATE meta_ads_lead_sync SET wa_stage = ?, wa_data = ? WHERE id = ?`,
      [newStage, JSON.stringify(newData || waData), lead.id]
    );
  }

  async function complete(flags: CompleteFlags = {}): Promise<void> {
    const sets = ["wa_stage = 'completed'"];
    if (flags.callback) { sets.push("wa_callback_requested = 1"); }
    if (flags.admissionLink) { sets.push("wa_admission_link_requested = 1"); }
    await query(
      `UPDATE meta_ads_lead_sync SET ${sets.join(", ")} WHERE id = ?`,
      [lead.id]
    );
  }

  // ── awaiting_choice ──
  if (stage === "awaiting_choice") {
    const t = text.toLowerCase().trim();
    if (t === "1" || t.includes("call")) {
      await updateStage("call_awaiting_name", { ...waData, branch: "call" });
      await sendMessage(from, `Thank you! 😊\n\nPlease share your *Full Name* so our Career Counsellor can reach out to you.`);
      return;
    }
    if (t === "2" || t.includes("chat")) {
      await updateStage("chat_awaiting_name", { ...waData, branch: "chat" });
      await sendMessage(from, `Great! Let's get started. 😊\n\nPlease share your *Full Name*.`);
      return;
    }
    await sendMessage(from, `Please reply with:\n*1* — Request a Call from our Career Counsellor\n*2* — Chat with us on WhatsApp`);
    return;
  }

  // ══════════════════════════════════════
  // BRANCH 1 — CALL REQUEST
  // ══════════════════════════════════════

  if (stage === "call_awaiting_name") {
    if (text.length < 2) { await sendMessage(from, `Please share your full name to continue.`); return; }
    await updateStage("call_awaiting_course", { ...waData, name: text });
    await sendMessage(from,
      `Thank you, ${text}! 😊\n\nWhich Training Program are you interested in?\n\n${programListMessage()}\n\nReply with the *number* or *name* of the program.`
    );
    return;
  }

  if (stage === "call_awaiting_course") {
    const course = parseProgramChoice(text);
    if (!course) {
      await sendMessage(from, `Please choose a valid program:\n\n${programListMessage()}`);
      return;
    }
    await complete({ callback: true });
    await notifyAdmin(waData.name || "Unknown", from, course, null, "Callback Requested");
    await sendMessage(from,
      `✅ Thank you, ${waData.name}!\n\nOur Career Counsellor will contact you shortly regarding the *${PROGRAMS[course].label}* program.\n\nWe look forward to speaking with you! 😊`
    );
    return;
  }

  // ══════════════════════════════════════
  // BRANCH 2 — CHAT FLOW
  // ══════════════════════════════════════

  if (stage === "chat_awaiting_name") {
    if (text.length < 2) { await sendMessage(from, `Please share your full name to continue.`); return; }
    await updateStage("chat_awaiting_qualification", { ...waData, name: text });
    await sendMessage(from,
      `Thank you, ${text}! 📋\n\nWhat is your highest qualification?\n\n*1.* Degree (B.Tech / B.E)\n*2.* Diploma\n*3.* HSC (12th Pass)\n*4.* ITI\n*5.* Other\n\nReply with the *number* or *name*.`
    );
    return;
  }

  if (stage === "chat_awaiting_qualification") {
    const qualification = parseQualification(text);
    if (!qualification) {
      await sendMessage(from, `Please choose your qualification:\n\n*1.* Degree (B.Tech / B.E)\n*2.* Diploma\n*3.* HSC (12th Pass)\n*4.* ITI\n*5.* Other`);
      return;
    }
    await updateStage("chat_awaiting_stream", { ...waData, qualification });
    await sendMessage(from,
      `Got it! What was your stream / branch of study?\n\n_(e.g. Mechanical, Chemical, Civil, Electrical, Instrumentation, Production, Computer, Science, Commerce, Arts, MCVC)_\n\nPlease type your stream.`
    );
    return;
  }

  if (stage === "chat_awaiting_stream") {
    if (text.length < 2) { await sendMessage(from, `Please share your stream or branch of study.`); return; }
    await updateStage("chat_awaiting_passout", { ...waData, stream: text });
    await sendMessage(from, `Got it! 📅\n\nWhat is your year of passing?\n\nPlease reply in format: *20XX-XX*\n_(e.g. 2022-23)_`);
    return;
  }

  if (stage === "chat_awaiting_passout") {
    if (!isValidPassout(text)) {
      await sendMessage(from, `Please share your year of passing in the correct format.\n\nExample: *2022-23*`);
      return;
    }
    await updateStage("chat_awaiting_career_stage", { ...waData, passout: text });
    await sendMessage(from,
      `Which of the following best describes you?\n\n*1.* Final Year Student\n*2.* Fresher Graduate\n*3.* Working Professional\n\nReply with *1*, *2*, or *3*.`
    );
    return;
  }

  if (stage === "chat_awaiting_career_stage") {
    const careerStage = parseCareerStage(text);
    if (!careerStage) {
      await sendMessage(from, `Please choose one:\n\n*1.* Final Year Student\n*2.* Fresher Graduate\n*3.* Working Professional`);
      return;
    }
    await updateStage("chat_awaiting_course", { ...waData, career_stage: careerStage });
    await sendMessage(from,
      `Which training program would you like to explore? 🎓\n\n${programListMessage()}\n\nReply with the *number* or *name* of the program.`
    );
    return;
  }

  if (stage === "chat_awaiting_course") {
    const course = parseProgramChoice(text);
    if (!course) {
      await sendMessage(from, `Please choose a valid program:\n\n${programListMessage()}`);
      return;
    }

    const program = PROGRAMS[course];
    const updatedData: WaData = { ...waData, course };

    // Auto-assign batch if only one option
    if (program.autoAssign) {
      updatedData.batch = program.autoAssign;
      await updateStage("chat_checking_eligibility", updatedData);
      await handleEligibility(lead, from, updatedData);
      return;
    }

    // Multiple batches — ask which one
    await updateStage("chat_awaiting_batch", updatedData);
    await sendMessage(from,
      `Which batch type would you prefer for *${program.label}*?\n\n${batchListMessage(program.batches)}\n\nReply with the *number* or *name*.`
    );
    return;
  }

  if (stage === "chat_awaiting_batch") {
    const course = waData.course;
    if (!course) {
      await sendMessage(from, `Please choose a valid program:\n\n${programListMessage()}`);
      return;
    }
    const program = PROGRAMS[course];
    const batch = parseBatchChoice(text, program.batches);

    if (!batch) {
      await sendMessage(from,
        `Please choose a valid batch type:\n\n${batchListMessage(program.batches)}`
      );
      return;
    }

    const updatedData: WaData = { ...waData, batch };
    await updateStage("chat_checking_eligibility", updatedData);
    await handleEligibility(lead, from, updatedData);
    return;
  }

  // ── Post-eligibility stages ──

  if (stage === "not_eligible_awaiting_response") {
    if (isYes(text)) {
      await complete({ callback: true });
      await notifyAdmin(waData.name || "Unknown", from, waData.course || "", waData.batch || null, "Callback Requested — Not Eligible Lead");
      await sendMessage(from, `Thank you, ${waData.name}! Our Career Counsellor will reach out to you shortly. 😊`);
      return;
    }
    if (isNo(text)) {
      await complete();
      await sendMessage(from, `Thank you for your time, ${waData.name}! If you ever want to explore our programs in the future, feel free to reach out. Wishing you all the best! 👍`);
      return;
    }
    await sendMessage(from, `Please reply *YES* or *NO* — would you like us to arrange a counsellor call?`);
    return;
  }

  if (stage === "chat_awaiting_brochure_response") {
    const course = waData.course || "";
    const t = text.toLowerCase().trim();
    if (t === "1" || t.includes("more info") || t.includes("information")) {
      await updateStage("chat_awaiting_more_info_choice", waData);
      await sendMessage(from,
        `No problem! A Career Counsellor can help answer your questions. 😊\n\nWould you like:\n*1.* A Call Back\n*2.* Continue chatting on WhatsApp\n\nReply with *1* or *2*.`
      );
      return;
    }
    if (t === "2" || t.includes("reviewed") || t.includes("done") || t.includes("seen")) {
      await updateStage("chat_awaiting_interest", waData);
      await sendMessage(from,
        `Are you interested in joining the *${PROGRAMS[course]?.label || course}* Training Program?\n\n*1.* Yes\n*2.* Not Yet\n\nReply with *1* or *2*.`
      );
      return;
    }
    await sendMessage(from, `Please reply with:\n*1* — I need more information\n*2* — I have reviewed the brochure`);
    return;
  }

  if (stage === "chat_awaiting_more_info_choice") {
    const course = waData.course || "";
    const t = text.toLowerCase().trim();
    if (t === "1" || t.includes("call")) {
      await complete({ callback: true });
      await notifyAdmin(waData.name || "Unknown", from, course, waData.batch || null, "Callback Requested — Needs More Info");
      await sendMessage(from, `✅ Our Career Counsellor will call you shortly, ${waData.name}! 😊\n\nThank you for your interest in SIT.`);
      return;
    }
    if (t === "2" || t.includes("chat") || t.includes("continue")) {
      await updateStage("chat_awaiting_interest", waData);
      await sendMessage(from,
        `Are you interested in joining the *${PROGRAMS[course]?.label || course}* Training Program?\n\n*1.* Yes\n*2.* Not Yet\n\nReply with *1* or *2*.`
      );
      return;
    }
    await sendMessage(from, `Please reply with:\n*1* — A Call Back\n*2* — Continue chatting on WhatsApp`);
    return;
  }

  if (stage === "chat_awaiting_interest") {
    const t = text.toLowerCase().trim();
    if (t === "1" || isYes(text)) {
      await updateStage("chat_awaiting_admission_choice", waData);
      await sendMessage(from,
        `Excellent, ${waData.name}! 🎉\n\nYou may now proceed with the admission process.\n\nWould you like the Admission Registration Link?\n\n*1.* Yes, send me the link\n*2.* I'd like to speak to a Counsellor first\n\nReply with *1* or *2*.`
      );
      return;
    }
    if (t === "2" || isNo(text) || t.includes("not yet")) {
      await updateStage("chat_awaiting_not_yet_choice", waData);
      await sendMessage(from,
        `No problem at all! How can we help you? 😊\n\n*1.* Schedule a Counselling Call\n*2.* Chat with a Counsellor on WhatsApp\n*3.* Explore Another Training Program\n\nReply with *1*, *2*, or *3*.`
      );
      return;
    }
    await sendMessage(from, `Please reply with:\n*1* — Yes, I'm interested\n*2* — Not Yet`);
    return;
  }

  if (stage === "chat_awaiting_admission_choice") {
    const course = waData.course || "";
    const t = text.toLowerCase().trim();
    if (t === "1" || t.includes("yes") || t.includes("link")) {
      await complete({ admissionLink: true });
      await notifyAdmin(waData.name || "Unknown", from, course, waData.batch || null, "Admission Registration Link Requested");
      await sendMessage(from,
        `✅ Thank you, ${waData.name}!\n\nYour personal Admission Registration Link will be sent to you within 24 hours.\n\nThank you for choosing SIT. We look forward to helping you build a successful engineering career! 🎓`
      );
      return;
    }
    if (t === "2" || t.includes("counsellor") || t.includes("speak")) {
      await complete({ callback: true });
      await notifyAdmin(waData.name || "Unknown", from, course, waData.batch || null, "Callback Requested — Before Admission");
      await sendMessage(from, `Our Career Counsellor will reach out to you shortly, ${waData.name}! 😊\n\nThank you for your interest in SIT.`);
      return;
    }
    await sendMessage(from, `Please reply with:\n*1* — Yes, send me the Admission Registration Link\n*2* — I'd like to speak to a Counsellor first`);
    return;
  }

  if (stage === "chat_awaiting_not_yet_choice") {
    const course = waData.course || "";
    const t = text.toLowerCase().trim();
    if (t === "1" || t.includes("call") || t.includes("counselling")) {
      await complete({ callback: true });
      await notifyAdmin(waData.name || "Unknown", from, course, waData.batch || null, "Counselling Call Requested");
      await sendMessage(from, `✅ Our Career Counsellor will call you shortly, ${waData.name}! 😊\n\nThank you for your interest in SIT.`);
      return;
    }
    if (t === "2" || t.includes("chat") || t.includes("whatsapp")) {
      await complete({ callback: true });
      await notifyAdmin(waData.name || "Unknown", from, course, waData.batch || null, "Chat with Counsellor Requested");
      await sendMessage(from, `Our Career Counsellor will connect with you on WhatsApp shortly, ${waData.name}! 😊`);
      return;
    }
    if (t === "3" || t.includes("explore") || t.includes("another") || t.includes("other")) {
      await updateStage("chat_awaiting_course", waData);
      await sendMessage(from,
        `Sure! Which other training program would you like to explore? 🎓\n\n${programListMessage()}\n\nReply with the *number* or *name* of the program.`
      );
      return;
    }
    await sendMessage(from, `Please reply with:\n*1* — Schedule a Counselling Call\n*2* — Chat with a Counsellor on WhatsApp\n*3* — Explore Another Training Program`);
    return;
  }
}

// ─────────────────────────────────────────────
// ELIGIBILITY HANDLER — called after batch is known
// ─────────────────────────────────────────────

async function handleEligibility(lead: LeadRow, from: string, waData: WaData): Promise<void> {
  const { course, qualification, stream, name, batch } = waData;
  if (!course) return;
  const program = PROGRAMS[course];
  const eligible = checkEligibility(course, qualification, stream);

  async function updateStage(newStage: string, newData?: WaData): Promise<void> {
    await query(
      `UPDATE meta_ads_lead_sync SET wa_stage = ?, wa_data = ? WHERE id = ?`,
      [newStage, JSON.stringify(newData || waData), lead.id]
    );
  }

  if (!eligible) {
    await updateStage("not_eligible_awaiting_response", waData);
    await sendMessage(from,
      `Thank you for your interest in the *${program.label}* program, ${name}.\n\nBased on the details you shared, you may not meet the current eligibility criteria for this program.\n\nOur Career Counsellor can guide you better. Would you like us to arrange a call?\n\nReply *YES* or *NO*.`
    );
    return;
  }

  // Eligible — send brochure
  const batchLabel = batch ? ` (${batch})` : "";
  await updateStage("chat_awaiting_brochure_response", waData);
  await sendMessage(from,
    `✅ Great news, ${name}!\n\nYou are eligible for our *${program.label}${batchLabel}* Training Program.\n\nHere is your course brochure:\n📄 ${BROCHURES[course]}\n\nPlease review the brochure and let us know:\n\n*1.* I need more information\n*2.* I have reviewed the brochure\n\nReply with *1* or *2*.`
  );
}

// ─────────────────────────────────────────────
// MAIN WEBHOOK HANDLER
// ─────────────────────────────────────────────

async function processMessage(from: string, messageText: string): Promise<void> {
  const localNumber = from.startsWith("91") ? from.slice(2) : from;

  const rows = await query<LeadRow>(
    `SELECT id, student_name, mobile, course_name, campaign_name, wa_stage, wa_data
     FROM meta_ads_lead_sync
     WHERE mobile LIKE ?
     LIMIT 1`,
    [`%${localNumber}%`]
  );

  if (rows.length === 0) return;

  await handleFlow(rows[0], from, messageText);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = body?.entry?.[0]?.changes?.[0]?.value;

    // Delivery/read status callbacks — nothing to process
    if (value?.statuses) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const message = value?.messages?.[0];
    if (!message || message.type !== "text") {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const from: string = message.from;
    const messageText: string = message.text?.body || "";

    // Ack WhatsApp immediately, then run the conversation flow in the background.
    // Meta retries (causing duplicate replies) if the webhook is slow to respond.
    after(async () => {
      try {
        await processMessage(from, messageText);
      } catch (err) {
        console.error("WhatsApp webhook processing error:", err);
      }
    });
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
