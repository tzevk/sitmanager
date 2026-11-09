import { NextRequest, NextResponse } from 'next/server';
import { publicFormRateLimiter } from '@/lib/rate-limit';
import { createCorporateInquiry } from '@/lib/services/corporate-inquiry.service';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Public endpoint — no auth. Receives the enquiry form on /public/corporate-training
 * and files it as a Corporate Inquiry (same service the staff screen uses, so the
 * duplicate guard and consultancy linking apply).
 */
const AREAS = ['Engineering', 'Design & Drafting', 'Software', 'Operation & Maintenance', 'Specialised / Other'];
const MODES: Record<string, string> = { site: 'Offline', sit: 'Offline', online: 'Online' };

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const count = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.trunc(n) : null;
};

export async function POST(req: NextRequest) {
  try {
    const limited = await publicFormRateLimiter(req);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    // Honeypot: real visitors never fill this hidden field.
    if (clean(body.website, 200)) return NextResponse.json({ ok: true });

    const company = clean(body.company, 200);
    const name = clean(body.name, 150);
    const email = clean(body.email, 255).toLowerCase();
    const phone = clean(body.phone, 30);
    const designation = clean(body.designation, 150);
    const city = clean(body.city, 100);
    const area = AREAS.includes(body.area) ? body.area : 'Specialised / Other';
    const modeKey = typeof body.mode === 'string' && body.mode in MODES ? body.mode : 'site';
    const message = String(body.message ?? '').trim().slice(0, 2000);

    if (!company || !name || !email || !phone) {
      return NextResponse.json({ error: 'Please fill in company, name, email and phone.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (phone.replace(/\D/g, '').length < 8) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    const where = modeKey === 'site' ? "At company's site" : modeKey === 'sit' ? 'At SIT' : 'Online';
    const location = modeKey === 'site' && city ? `${where} – ${city}` : where;
    // The staff form picks a course; website enquiries use "Others" + the chosen area as free text.
    const [oc] = await getPool().query("SELECT Course_Id FROM course_mst WHERE LOWER(TRIM(Course_Name)) = 'others' AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1");
    const othersCourseId = (oc as Array<{ Course_Id?: unknown }>)[0]?.Course_Id;
    const remark = [
      'Enquiry from the public Corporate Training page.',
      `Training area: ${area}`,
      `Where: ${where}`,
      message ? `Requirements: ${message}` : '',
    ].filter(Boolean).join('\n');

    const result = await createCorporateInquiry({
      FullName: name,
      CompanyAuthority: name,
      CompanyName: company,
      Designation: designation || undefined,
      City: city || undefined,
      Mobile: phone,
      Email: email,
      Course_Id: othersCourseId != null ? String(othersCourseId) : undefined,
      CourseOther: area,
      TrainingMode: MODES[modeKey],
      TrainingLocation: location,
      Participants_Fresher: count(body.freshers),
      Participants_Experienced: count(body.experienced),
      business: area,
      Remark: remark,
    });

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (error: unknown) {
    console.error('public corporate-inquiry error:', error);
    return NextResponse.json({ error: 'We could not send your enquiry. Please call +91 91672 19401.' }, { status: 500 });
  }
}
