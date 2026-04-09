'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Consultancy {
  Const_Id: number;
  Comp_Name: string;
  Contact_Person?: string | null;
  Designation?: string | null;
  Mobile?: string | null;
  EMail?: string | null;
}

type Tab = 'details' | 'discussion';
type DiscussionSubTab = 'meeting' | 'discussion' | 'contacts';

type MeetingItem = {
  date: string;
  nextDate?: string;
  remark: string;
};

type CorporateFollowUpItem = {
  date: string;
  nextDate?: string;
  contactPerson: string;
  designation: string;
  mobile: string;
  email: string;
  purpose: string;
  course: string;
  directLine: string;
  remark: string;
};

type ContactDetailItem = {
  fullName: string;
  email: string;
  phoneNumber: string;
  alternateNumber: string;
  jobTitle: string;
  industry: string;
  discussion: string;
};

type FollowUpData = {
  meetingDate: string;
  attendeeClient: string;
  attendeeSIT: string;
  meetingAgenda: string;
  meetings: MeetingItem[];
  followUps: CorporateFollowUpItem[];
  contacts?: ContactDetailItem[];
};

type MeetingDetailsItem = {
  meetingDate: string;
  attendeeClient: string;
  attendeeSIT: string;
  meetingAgenda: string;
};

function toDateInputValue(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  // Accept yyyy-mm-dd or ISO datetime
  const parts = s.split('T');
  return parts[0] || '';
}

const splitList = (raw: string | null | undefined) => {
  const s = String(raw ?? '');
  return s
    .split(/\r?\n|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
};

const normalizeMultiValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .join('\n');
  }
  if (value === null || value === undefined) return '';
  return String(value);
};

function parseFollowUpJson(raw: string | null | undefined): FollowUpData {
  if (!raw)
    return {
      meetingDate: '',
      attendeeClient: '',
      attendeeSIT: '',
      meetingAgenda: '',
      meetings: [],
      followUps: [],
    };
  try {
    const parsed: unknown = JSON.parse(raw);
    const parsedObj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;

    const rawMeetings =
      parsedObj && Array.isArray(parsedObj.meetings)
        ? parsedObj.meetings
        : parsedObj && Array.isArray(parsedObj.followUps)
          ? parsedObj.followUps
          : parsedObj && Array.isArray(parsedObj.followup)
            ? parsedObj.followup
            : [];

    let meetings: MeetingItem[] = rawMeetings
      .map((it: unknown) => {
        const obj = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
        return {
          date: typeof obj.date === 'string' ? obj.date : '',
          nextDate:
            typeof obj.nextDate === 'string'
              ? obj.nextDate
              : typeof obj.nextFollowUpDate === 'string'
                ? obj.nextFollowUpDate
                : typeof obj.next_follow_up_date === 'string'
                  ? obj.next_follow_up_date
                  : '',
          remark: typeof obj.remark === 'string' ? obj.remark : '',
        };
      })
      .filter((it) => Boolean(it.date || it.nextDate || it.remark));

    const initialDate = parsedObj && typeof parsedObj.initialDate === 'string' ? parsedObj.initialDate : '';
    const meetingDate = parsedObj && typeof parsedObj.meetingDate === 'string' ? parsedObj.meetingDate : initialDate;
    const attendeeClient = parsedObj && typeof parsedObj.attendeeClient === 'string' ? parsedObj.attendeeClient : '';
    const attendeeSIT =
      parsedObj && (typeof parsedObj.attendeeSIT === 'string' || typeof parsedObj.attendeeSit === 'string')
        ? String((parsedObj.attendeeSIT ?? parsedObj.attendeeSit) as string)
        : '';
    const meetingAgenda =
      parsedObj && (typeof parsedObj.meetingAgenda === 'string' || typeof parsedObj.agenda === 'string')
        ? String((parsedObj.meetingAgenda ?? parsedObj.agenda) as string)
        : '';

    const rawFollowUps =
      parsedObj && Array.isArray(parsedObj.followUps)
        ? parsedObj.followUps
        : parsedObj && Array.isArray(parsedObj.followup)
          ? parsedObj.followup
          : parsedObj && Array.isArray(parsedObj.meetings)
            ? parsedObj.meetings
            : [];

    const followUps: CorporateFollowUpItem[] = rawFollowUps
      .map((it: unknown) => {
        const obj = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
        return {
          date:
            typeof obj.date === 'string'
              ? toDateInputValue(obj.date)
              : typeof obj.Date === 'string'
                ? toDateInputValue(obj.Date)
              : typeof obj.followupDate === 'string'
                ? toDateInputValue(obj.followupDate)
                : typeof obj.FollowUpDate === 'string'
                  ? toDateInputValue(obj.FollowUpDate)
                : '',
          nextDate:
            typeof obj.nextDate === 'string'
              ? toDateInputValue(obj.nextDate)
              : typeof obj.NextDate === 'string'
                ? toDateInputValue(obj.NextDate)
              : typeof obj.nextFollowUpDate === 'string'
                ? toDateInputValue(obj.nextFollowUpDate)
                : typeof obj.NextFollowUpDate === 'string'
                  ? toDateInputValue(obj.NextFollowUpDate)
                : '',
          contactPerson:
            typeof obj.contactPerson === 'string'
              ? obj.contactPerson
              : typeof obj.Contact_Person === 'string'
                ? obj.Contact_Person
                : typeof obj.ContactPerson === 'string'
                  ? obj.ContactPerson
              : typeof obj.fullName === 'string'
                ? obj.fullName
                : typeof obj.FullName === 'string'
                  ? obj.FullName
                : typeof obj.attendeeClient === 'string'
                  ? obj.attendeeClient
                  : typeof obj.CompanyAuthority === 'string'
                    ? obj.CompanyAuthority
                  : '',
          designation:
            typeof obj.designation === 'string'
              ? obj.designation
              : typeof obj.Designation === 'string'
                ? obj.Designation
              : typeof obj.jobTitle === 'string'
                ? obj.jobTitle
                : typeof obj.JobTitle === 'string'
                  ? obj.JobTitle
                : '',
          mobile:
            normalizeMultiValue(
              obj.mobile ?? obj.Mobile ?? obj.phoneNumber ?? obj.PhoneNumber ?? obj.phoneNumbers ?? obj.Phone ?? null,
            ),
          email: normalizeMultiValue(obj.email ?? obj.Email ?? obj.EMail ?? obj.emails ?? null),
          purpose:
            typeof obj.purpose === 'string'
              ? obj.purpose
              : typeof obj.Purpose === 'string'
                ? obj.Purpose
                : '',
          course:
            typeof obj.course === 'string'
              ? obj.course
              : typeof obj.Course === 'string'
                ? obj.Course
              : typeof obj.trainingProgramme === 'string'
                ? obj.trainingProgramme
                : '',
          directLine:
            normalizeMultiValue(
              obj.directLine ?? obj.Direct_Line ?? obj.DirectLine ?? obj.alternateNumber ?? obj.AlternateNumber ?? obj.alternateNumbers ?? null,
            ),
          remark:
            typeof obj.remark === 'string'
              ? obj.remark
              : typeof obj.Remark === 'string'
                ? obj.Remark
              : typeof obj.remarks === 'string'
                ? obj.remarks
                : typeof obj.meetingAgenda === 'string'
                  ? obj.meetingAgenda
                  : '',
        };
      })
      .filter((it) =>
        Boolean(
          it.date ||
          it.nextDate ||
          it.contactPerson ||
          it.designation ||
          it.mobile ||
          it.email ||
          it.purpose ||
          it.course ||
          it.directLine ||
          it.remark,
        ),
      );

    if (initialDate && !meetings.some((m) => toDateInputValue(m.date) === toDateInputValue(initialDate))) {
      meetings = [{ date: initialDate, remark: '' }, ...meetings];
    }

    const contacts: ContactDetailItem[] =
      parsedObj && Array.isArray(parsedObj.contacts)
        ? parsedObj.contacts
            .map((it: unknown) => {
              const obj = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
              return {
                fullName: typeof obj.fullName === 'string' ? obj.fullName : '',
                email: normalizeMultiValue(obj.email ?? obj.emails ?? null),
                phoneNumber: normalizeMultiValue(obj.phoneNumber ?? obj.phoneNumbers ?? null),
                alternateNumber: normalizeMultiValue(obj.alternateNumber ?? obj.alternateNumbers ?? null),
                jobTitle: typeof obj.jobTitle === 'string' ? obj.jobTitle : '',
                industry: typeof obj.industry === 'string' ? obj.industry : '',
                // Backward compatibility for older payloads that used `location`.
                discussion:
                  typeof obj.discussion === 'string'
                    ? obj.discussion
                    : typeof obj.location === 'string'
                      ? obj.location
                      : '',
              };
            })
            .filter((it) =>
              Boolean(
                it.fullName ||
                  it.email ||
                  it.phoneNumber ||
                  it.alternateNumber ||
                  it.jobTitle ||
                  it.industry ||
                  it.discussion,
              ),
            )
        : [];

    return {
      meetingDate: toDateInputValue(meetingDate),
      attendeeClient,
      attendeeSIT,
      meetingAgenda,
      meetings,
      followUps,
      contacts,
    };
  } catch {
    return {
      meetingDate: '',
      attendeeClient: '',
      attendeeSIT: '',
      meetingAgenda: '',
      meetings: [],
      followUps: [],
      contacts: [],
    };
  }
}

const FOLLOWUP_PURPOSES = ['Meeting', 'Seminar', 'Internship', 'Trainer', 'Placements', 'Placements Received', 'Training', 'Project', 'Others'] as const;

export default function EditCorporateInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [consultancies, setConsultancies] = useState<Consultancy[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(() => (searchParams.get('tab') === 'discussion' ? 'discussion' : 'details'));
  const [discussionSubTab, setDiscussionSubTab] = useState<DiscussionSubTab>(() => {
    const dtab = searchParams.get('dtab');
    return dtab === 'meeting' || dtab === 'discussion' || dtab === 'contacts' ? dtab : 'meeting';
  });
  const [companyMode, setCompanyMode] = useState<'master' | 'manual'>('master');
  const [discussionOutcome, setDiscussionOutcome] = useState<'' | 'Awarded' | 'Regretted' | 'On Hold'>('');
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsItem[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDetailsItem>({
    meetingDate: '',
    attendeeClient: '',
    attendeeSIT: '',
    meetingAgenda: '',
  });
  const [editingMeetingIndex, setEditingMeetingIndex] = useState<number | null>(null);
  const [followUps, setFollowUps] = useState<CorporateFollowUpItem[]>([]);
  const [followUpDraft, setFollowUpDraft] = useState<CorporateFollowUpItem>({
    date: '',
    nextDate: '',
    contactPerson: '',
    designation: '',
    mobile: '',
    email: '',
    purpose: '',
    course: '',
    directLine: '',
    remark: '',
  });
  const [editingFollowUpIndex, setEditingFollowUpIndex] = useState<number | null>(null);
  const [form, setForm] = useState({
    Id: 0,
    Idate: '',
    Course_Id: '',
    Consultancy_Id: '',
    CompanyName: '',
    Place: '',
    CompanyType: '' as '' | 'Local' | 'International',
    CompanyAuthority: '',
    FullName: '',
    Designation: '',
    Phone: '',
    Mobile: '',
    Email: '',
    TrainingMode: 'offline' as 'online' | 'offline' | 'both online and offline',
    Participants_Fresher: '',
    Participants_Experienced: '',
    TrainingLocation: '',
    TrainingDates: '',
    business: '',
    Remark: '',

    InquiryStatus: '',
    TrainingNumber: '',
    TrainingDate: '',
    TrainerName: '',
    NumberOfDays: '',
    TotalStudents: '',
    TrainingCoordinator: '',

    Discussion: '',
  });

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        const [metaRes, inquiryRes] = await Promise.all([
          fetch('/api/admission-activity/corporate-inquiry/meta', { method: 'GET' }),
          fetch(`/api/admission-activity/corporate-inquiry/${id}`, { method: 'GET' }),
        ]);

        const meta = await metaRes.json().catch(() => ({}));
        const inquiryData = await inquiryRes.json().catch(() => ({}));

        if (!alive) return;

        if (metaRes.ok) {
          setCourses(Array.isArray(meta?.courses) ? meta.courses : []);
          setConsultancies(Array.isArray(meta?.consultancies) ? meta.consultancies : []);
        }

        const inq = inquiryData?.inquiry;
        if (inq) {
          const fullName = String(inq?.FullName || inq?.Fname || '').trim();
          const discussion = String(inq?.Discussion ?? inq?.Remark ?? '').trim();
          const remark = String(inq?.Remark ?? '').trim();
          const consultancyId = String(inq?.Consultancy_Id ?? '').trim();
          const companyName = String(inq?.CompanyName ?? '').trim();
          const rawCompanyType = String(inq?.CompanyType ?? '').trim();
          const companyType: '' | 'Local' | 'International' =
            rawCompanyType === 'Local' || rawCompanyType === 'International' ? rawCompanyType : '';

          setForm((prev) => {
            const next = {
              ...prev,
              Id: Number(inq?.Id) || 0,
              Idate: toDateInputValue(inq?.Idate),
              Course_Id: String(inq?.Course_Id ?? ''),
              Consultancy_Id: consultancyId,
              CompanyName: companyName,
              Place: String(inq?.Place ?? '').trim(),
              CompanyType: companyType,
              CompanyAuthority: String(inq?.CompanyAuthority ?? '').trim(),
              FullName: fullName,
              Designation: String(inq?.Designation ?? '').trim(),
              Phone: String(inq?.Phone ?? '').trim(),
              Mobile: String(inq?.Mobile ?? '').trim(),
              Email: String(inq?.Email ?? '').trim(),
              TrainingMode: (() => {
                const mode = String(inq?.TrainingMode ?? 'offline').trim().toLowerCase();
                if (mode === 'online') return 'online' as const;
                if (mode === 'both online and offline' || mode === 'both') return 'both online and offline' as const;
                return 'offline' as const;
              })(),
              Participants_Fresher: String(inq?.Participants_Fresher ?? ''),
              Participants_Experienced: String(inq?.Participants_Experienced ?? ''),
              TrainingLocation: String(inq?.TrainingLocation ?? '').trim(),
              TrainingDates: String(inq?.TrainingDates ?? '').trim(),
              business: String(inq?.business ?? '').trim(),
              Remark: remark,

              InquiryStatus: String(inq?.InquiryStatus ?? '').trim(),
              TrainingNumber: String(inq?.TrainingNumber ?? '').trim(),
              TrainingDate: toDateInputValue(inq?.TrainingDate),
              TrainerName: String(inq?.TrainerName ?? '').trim(),
              NumberOfDays: String(inq?.NumberOfDays ?? ''),
              TotalStudents: String(inq?.TotalStudents ?? ''),
              TrainingCoordinator: String(inq?.TrainingCoordinator ?? '').trim(),

              Discussion: discussion,
            };
            return next;
          });

          const parsedFollowUp = parseFollowUpJson(String(inq?.FollowUp ?? ''));
          const legacyContacts = parsedFollowUp.contacts || [];
          const combinedFollowUps: CorporateFollowUpItem[] = [];

          combinedFollowUps.push(
            ...parsedFollowUp.followUps.map((f, idx) => {
              const contact = legacyContacts[idx] || legacyContacts[0];
              return {
                ...f,
                contactPerson: f.contactPerson || contact?.fullName || parsedFollowUp.attendeeClient || '',
                designation: f.designation || contact?.jobTitle || '',
                mobile: f.mobile || contact?.phoneNumber || '',
                email: f.email || contact?.email || '',
                directLine: f.directLine || contact?.alternateNumber || '',
                remark: f.remark || contact?.discussion || parsedFollowUp.meetingAgenda || '',
              };
            }),
          );

          combinedFollowUps.push(
            ...legacyContacts.map((c) => ({
              date: '',
              nextDate: '',
              contactPerson: c.fullName || '',
              designation: c.jobTitle || '',
              mobile: c.phoneNumber || '',
              email: c.email || '',
              purpose: '',
              course: '',
              directLine: c.alternateNumber || '',
              remark: c.discussion || '',
            })),
          );

          combinedFollowUps.push(
            ...parsedFollowUp.meetings.map((m, idx) => {
              const contact = legacyContacts[idx] || legacyContacts[0];
              return {
              date: m.date || '',
              nextDate: m.nextDate || '',
              contactPerson: contact?.fullName || parsedFollowUp.attendeeClient || '',
              designation: contact?.jobTitle || '',
              mobile: contact?.phoneNumber || '',
              email: contact?.email || '',
              purpose: 'Meeting',
              course: '',
              directLine: contact?.alternateNumber || '',
              remark: m.remark || contact?.discussion || parsedFollowUp.meetingAgenda || '',
            };
            }),
          );

          const toFollowUpKey = (f: CorporateFollowUpItem) =>
            [
              toDateInputValue(f.date),
              toDateInputValue(f.nextDate || ''),
              f.contactPerson.trim().toLowerCase(),
              f.designation.trim().toLowerCase(),
              splitList(f.mobile).join('|').toLowerCase(),
              splitList(f.email).join('|').toLowerCase(),
              f.purpose.trim().toLowerCase(),
              f.course.trim().toLowerCase(),
              splitList(f.directLine).join('|').toLowerCase(),
              f.remark.trim().toLowerCase(),
            ].join('::');

          let baseFollowUps = Array.from(
            new Map(
              combinedFollowUps
                .filter((f) =>
                  Boolean(
                    f.date ||
                      f.nextDate ||
                      f.contactPerson ||
                      f.designation ||
                      f.mobile ||
                      f.email ||
                      f.purpose ||
                      f.course ||
                      f.directLine ||
                      f.remark,
                  ),
                )
                .map((f) => [toFollowUpKey(f), f] as const),
            ).values(),
          );

          if (baseFollowUps.length === 0) {
            const fallbackFollowUp: CorporateFollowUpItem = {
              date: toDateInputValue(inq?.InitialFollowUpDate) || toDateInputValue(inq?.Idate),
              nextDate: toDateInputValue(inq?.NextFollowUpDate),
              contactPerson: String(inq?.CompanyAuthority ?? inq?.FullName ?? inq?.Fname ?? '').trim(),
              designation: String(inq?.Designation ?? '').trim(),
              mobile: normalizeMultiValue(inq?.Mobile ?? inq?.Phone ?? null),
              email: normalizeMultiValue(inq?.Email ?? null),
              purpose: '',
              course: '',
              directLine: '',
              remark: String(inq?.Discussion ?? inq?.Remark ?? '').trim(),
            };
            const hasFallback = Boolean(
              fallbackFollowUp.date ||
              fallbackFollowUp.nextDate ||
              fallbackFollowUp.contactPerson ||
              fallbackFollowUp.designation ||
              fallbackFollowUp.mobile ||
              fallbackFollowUp.email ||
              fallbackFollowUp.remark,
            );
            baseFollowUps = hasFallback ? [fallbackFollowUp] : [];
          }

          if (consultancyId) {
            try {
              const params = new URLSearchParams({ constId: consultancyId });
              const consultancyFollowupRes = await fetch(`/api/masters/consultancy/followups?${params.toString()}`, { method: 'GET' });
              const consultancyFollowupData = await consultancyFollowupRes.json().catch(() => ({}));
              const masterRows = Array.isArray(consultancyFollowupData?.rows) ? consultancyFollowupData.rows : [];
              const mappedMasterFollowUps: CorporateFollowUpItem[] = masterRows.map((r: unknown) => {
                const rec = typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {};
                return {
                date: toDateInputValue(rec.Followup_Date),
                nextDate: '',
                contactPerson: String(rec.Contact_Person ?? '').trim(),
                designation: String(rec.Designation ?? '').trim(),
                mobile: normalizeMultiValue(rec.Mobile ?? null),
                email: normalizeMultiValue(rec.email ?? null),
                purpose: String(rec.Purpose ?? '').trim(),
                course: String(rec.Course ?? '').trim(),
                directLine: normalizeMultiValue(rec.Direct_Line ?? null),
                remark: String(rec.Remarks ?? '').trim(),
              };
              });

              baseFollowUps = Array.from(
                new Map([...baseFollowUps, ...mappedMasterFollowUps].map((f) => [toFollowUpKey(f), f] as const)).values(),
              );
            } catch {
              // Non-blocking: keep local follow-up payload data even if master fetch fails.
            }
          }

          setFollowUps(baseFollowUps);

          let loadedMeetingDetails: MeetingDetailsItem[] = [];
          try {
            const parsed: unknown = inq?.FollowUp ? JSON.parse(String(inq.FollowUp)) : null;
            const obj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
            const rawMeetingDetails = obj && Array.isArray(obj.meetingDetails) ? obj.meetingDetails : [];
            loadedMeetingDetails = rawMeetingDetails
              .map((it: unknown) => {
                const rec = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
                return {
                  meetingDate: typeof rec.meetingDate === 'string' ? toDateInputValue(rec.meetingDate) : '',
                  attendeeClient: typeof rec.attendeeClient === 'string' ? rec.attendeeClient : '',
                  attendeeSIT:
                    typeof rec.attendeeSIT === 'string'
                      ? rec.attendeeSIT
                      : typeof rec.attendeeSit === 'string'
                        ? (rec.attendeeSit as string)
                        : '',
                  meetingAgenda:
                    typeof rec.meetingAgenda === 'string'
                      ? rec.meetingAgenda
                      : typeof rec.agenda === 'string'
                        ? (rec.agenda as string)
                        : '',
                };
              })
              .filter((x) => Boolean(x.meetingDate || x.attendeeClient || x.attendeeSIT || x.meetingAgenda));
          } catch {
            // ignore malformed old follow-up payload
          }

          if (loadedMeetingDetails.length === 0 && (parsedFollowUp.meetingDate || parsedFollowUp.attendeeClient || parsedFollowUp.attendeeSIT || parsedFollowUp.meetingAgenda)) {
            loadedMeetingDetails = [
              {
                meetingDate: parsedFollowUp.meetingDate,
                attendeeClient: parsedFollowUp.attendeeClient,
                attendeeSIT: parsedFollowUp.attendeeSIT,
                meetingAgenda: parsedFollowUp.meetingAgenda,
              },
            ];
          }
          setMeetingDetails(loadedMeetingDetails);
          setMeetingDraft({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
          setEditingMeetingIndex(null);
          setFollowUpDraft({
            date: '',
            nextDate: '',
            contactPerson: '',
            designation: '',
            mobile: '',
            email: '',
            purpose: '',
            course: '',
            directLine: '',
            remark: '',
          });
          setEditingFollowUpIndex(null);
          const outcome = String(inq?.DiscussionOutcome ?? '').trim();
          setDiscussionOutcome(outcome === 'Awarded' || outcome === 'Regretted' || outcome === 'On Hold' ? outcome : '');

          setCompanyMode(consultancyId ? 'master' : 'manual');

          // If we don't have a consultancy id but we have a company name, try to map it.
          if (!consultancyId && companyName) {
            // We'll map after consultancies load via memo below; no-op here.
          }
        }
      } catch (err) {
        console.error(err);
        alert('Failed to load inquiry');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const companyOptions = useMemo(() => {
    return consultancies
      .slice()
      .sort((a, b) => String(a.Comp_Name || '').localeCompare(String(b.Comp_Name || '')));
  }, [consultancies]);

  useEffect(() => {
    // Backfill consultancy selection by company name if possible.
    if (companyMode === 'manual') return;
    if (form.Consultancy_Id || !form.CompanyName || companyOptions.length === 0) return;
    const match = companyOptions.find((c) => String(c.Comp_Name || '').trim() === String(form.CompanyName || '').trim());
    if (!match) return;
    setForm((prev) => ({ ...prev, Consultancy_Id: String(match.Const_Id) }));
  }, [companyMode, companyOptions, form.CompanyName, form.Consultancy_Id]);

  useEffect(() => {
    // If an old Consultancy_Id no longer exists in master, fall back to manual mode.
    if (companyMode === 'manual') return;
    if (!form.Consultancy_Id || companyOptions.length === 0) return;
    const hasMatch = companyOptions.some((c) => String(c.Const_Id) === String(form.Consultancy_Id));
    if (hasMatch) return;
    setCompanyMode('manual');
    setForm((prev) => ({ ...prev, Consultancy_Id: '' }));
  }, [companyMode, companyOptions, form.Consultancy_Id]);

  const buildFollowUpJson = () =>
    JSON.stringify({
      initialDate: (meetingDetails[meetingDetails.length - 1]?.meetingDate || '') as string,
      meetingDate: (meetingDetails[meetingDetails.length - 1]?.meetingDate || '') as string,
      attendeeClient: (meetingDetails[meetingDetails.length - 1]?.attendeeClient || '') as string,
      attendeeSIT: (meetingDetails[meetingDetails.length - 1]?.attendeeSIT || '') as string,
      meetingAgenda: (meetingDetails[meetingDetails.length - 1]?.meetingAgenda || '') as string,
      meetingDetails,
      meetings: followUps.map((f) => ({
        date: f.date,
        nextDate: f.nextDate,
        remark: f.remark,
      })),
      followUps: followUps.map((f) => ({
        ...f,
        email: splitList(f.email).join(', '),
        emails: splitList(f.email),
        mobile: splitList(f.mobile).join(', '),
        phoneNumbers: splitList(f.mobile),
        directLine: splitList(f.directLine).join(', '),
        alternateNumbers: splitList(f.directLine),
      })),
      contacts: followUps.map((f) => ({
        fullName: f.contactPerson,
        email: splitList(f.email).join(', '),
        emails: splitList(f.email),
        phoneNumber: splitList(f.mobile).join(', '),
        phoneNumbers: splitList(f.mobile),
        alternateNumber: splitList(f.directLine).join(', '),
        alternateNumbers: splitList(f.directLine),
        jobTitle: f.designation,
        industry: '',
        discussion: f.remark,
      })),
    });

  function handleCompanyChange(constId: string) {
    const idNum = Number(constId);
    const selected = companyOptions.find((c) => Number(c.Const_Id) === idNum);
    setForm((prev) => {
      const next: typeof prev = {
        ...prev,
        Consultancy_Id: constId,
        CompanyName: selected?.Comp_Name || '',
      };
      if (!prev.CompanyAuthority?.trim() && selected?.Contact_Person) {
        next.CompanyAuthority = selected.Contact_Person;
      }
      return next;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        FollowUp: buildFollowUpJson(),
        InitialFollowUpDate: followUps[0]?.date || null,
        NextFollowUpDate: followUps[followUps.length - 1]?.nextDate || null,
        DiscussionOutcome: discussionOutcome || null,
      };
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/corporate-inquiry');
      } else {
        alert(data.error || 'Failed to update inquiry');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';
  const labelClass = 'block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1';
  const textareaClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';

  const tabBtn = (isActive: boolean) =>
    isActive
      ? 'px-4 py-2 rounded-lg bg-[#2E3093] text-white text-sm font-semibold shadow-sm'
      : 'px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 shadow-sm';

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit corporate inquiries." />;

  if (loading) {
    return (
      <div className="space-y-4 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Edit Corporate Inquiry</h2>
              <p className="text-sm text-gray-400">Update inquiry details below</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                form="edit-corporate-inquiry-form"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2A6BB5] hover:bg-[#2360A0] text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
              >
                <FaSave className="w-4 h-4" /> {saving ? 'Saving...' : 'Update Inquiry'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard/corporate-inquiry')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-sm shadow-sm transition"
              >
                <FaTimes className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form id="edit-corporate-inquiry-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={tabBtn(activeTab === 'details')} onClick={() => setActiveTab('details')}>
                Inquiry Details
              </button>
              <button type="button" className={tabBtn(activeTab === 'discussion')} onClick={() => setActiveTab('discussion')}>
                Requirements
              </button>
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'details' && (
              <>
                <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Inquiry Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Status</label>
                    <select name="InquiryStatus" value={form.InquiryStatus} onChange={handleChange} className={inputClass}>
                      <option value="">—</option>
                      <option value="UnderDiscussion">Under Discussion</option>
                      <option value="Rejected">Cancelled</option>
                      <option value="Final">Final</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Inquiry Date</label>
                    <input type="date" name="Idate" value={form.Idate} onChange={handleChange} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Training Programme</label>
                    <select name="Course_Id" value={form.Course_Id} onChange={handleChange} className={inputClass}>
                      <option value="">Select Programme</option>
                      {courses.map((c) => (
                        <option key={c.Course_Id} value={String(c.Course_Id)}>
                          {c.Course_Name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Company Name</label>
                    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Consultancy List</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyMode('manual');
                            setForm((prev) => ({ ...prev, Consultancy_Id: '', CompanyName: '' }));
                          }}
                          className="text-[11px] font-semibold text-[#2A6BB5] hover:underline"
                        >
                          Other / Not in list
                        </button>
                      </div>
                      <select
                        name="Consultancy_Id"
                        value={form.Consultancy_Id}
                        size={8}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setCompanyMode('master');
                          handleCompanyChange(v);
                        }}
                        className="w-full rounded-md border border-gray-200 bg-white p-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      >
                        {companyOptions.map((c) => (
                          <option key={c.Const_Id} value={String(c.Const_Id)}>
                            {c.Comp_Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {companyMode === 'manual' && (
                    <div>
                      <label className={labelClass}>Company Name (Manual)</label>
                      <input
                        type="text"
                        name="CompanyName"
                        value={form.CompanyName}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="Enter company name"
                      />
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Company Location</label>
                    <input
                      type="text"
                      name="Place"
                      value={form.Place}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="City / location"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Company Type</label>
                    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                      {(['Local', 'International'] as const).map((opt) => {
                        const active = form.CompanyType === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, CompanyType: opt }))}
                            className={`px-4 py-2 text-sm font-semibold transition-colors ${
                              active ? 'bg-[#2A6BB5] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <div className="pt-2 mt-1 border-t border-gray-100">
                      <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Company Authority</div>
                    </div>
                    <input type="hidden" name="CompanyAuthority" value={form.CompanyAuthority} />
                  </div>

                  <div>
                    <label className={labelClass}>Full Name</label>
                    <input type="text" name="FullName" value={form.FullName} onChange={handleChange} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Position</label>
                    <input
                      type="text"
                      name="Designation"
                      value={form.Designation}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Designation"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" name="Email" value={form.Email} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Mobile</label>
                    <input type="text" name="Mobile" value={form.Mobile} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input type="text" name="Phone" value={form.Phone} onChange={handleChange} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Training Mode</label>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="radio"
                          name="TrainingMode"
                          value="online"
                          checked={form.TrainingMode === 'online'}
                          onChange={handleChange}
                        />
                        Online
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="radio"
                          name="TrainingMode"
                          value="offline"
                          checked={form.TrainingMode === 'offline'}
                          onChange={handleChange}
                        />
                        Offline
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="radio"
                          name="TrainingMode"
                          value="both online and offline"
                          checked={form.TrainingMode === 'both online and offline'}
                          onChange={handleChange}
                        />
                        Both Online and Offline
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Total Participants</label>
                    <input type="number" name="TotalStudents" value={form.TotalStudents} onChange={handleChange} className={inputClass} min={0} />
                  </div>

                  <div>
                    <label className={labelClass}>Participants (Fresher)</label>
                    <input
                      type="number"
                      name="Participants_Fresher"
                      value={form.Participants_Fresher}
                      onChange={handleChange}
                      className={inputClass}
                      min={0}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Participants (Experienced)</label>
                    <input
                      type="number"
                      name="Participants_Experienced"
                      value={form.Participants_Experienced}
                      onChange={handleChange}
                      className={inputClass}
                      min={0}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Training Location</label>
                    <input
                      type="text"
                      name="TrainingLocation"
                      value={form.TrainingLocation}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Location"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'discussion' && (
              <>
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="text-sm font-bold text-[#2A6BB5] uppercase">Training Requirements</h2>
                  <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                    {([
                      { key: 'meeting', label: 'Meeting Details' },
                      { key: 'discussion', label: 'Requirements' },
                      { key: 'contacts', label: 'Follow Up' },
                    ] as const).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setDiscussionSubTab(t.key)}
                        className={`px-3 py-2 text-xs font-semibold transition-colors border-r border-gray-200 last:border-r-0 ${
                          discussionSubTab === t.key ? 'bg-[#2A6BB5] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {discussionSubTab === 'meeting' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Meeting Date</label>
                        <input
                          type="date"
                          className={inputClass}
                          value={meetingDraft.meetingDate}
                          onChange={(e) => setMeetingDraft((d) => ({ ...d, meetingDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Meeting Agenda</label>
                        <input
                          className={inputClass}
                          value={meetingDraft.meetingAgenda}
                          onChange={(e) => setMeetingDraft((d) => ({ ...d, meetingAgenda: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Attendee (Client)</label>
                        <textarea
                          className={textareaClass}
                          rows={3}
                          value={meetingDraft.attendeeClient}
                          onChange={(e) => setMeetingDraft((d) => ({ ...d, attendeeClient: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Attendee (SIT)</label>
                        <textarea
                          className={textareaClass}
                          rows={3}
                          value={meetingDraft.attendeeSIT}
                          onChange={(e) => setMeetingDraft((d) => ({ ...d, attendeeSIT: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-[#2A6BB5] text-white text-sm font-semibold"
                        onClick={() => {
                          const hasAny = Boolean(meetingDraft.meetingDate || meetingDraft.meetingAgenda || meetingDraft.attendeeClient || meetingDraft.attendeeSIT);
                          if (!hasAny) return;
                          setMeetingDetails((prev) => (editingMeetingIndex === null ? [...prev, meetingDraft] : prev.map((m, i) => (i === editingMeetingIndex ? meetingDraft : m))));
                          setMeetingDraft({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
                          setEditingMeetingIndex(null);
                        }}
                      >
                        {editingMeetingIndex === null ? 'Add Meeting' : 'Update Meeting'}
                      </button>
                      {editingMeetingIndex !== null && (
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold"
                          onClick={() => {
                            setMeetingDraft({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
                            setEditingMeetingIndex(null);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Client</th>
                            <th className="px-3 py-2 text-left">SIT</th>
                            <th className="px-3 py-2 text-left">Agenda</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meetingDetails.length === 0 ? (
                            <tr><td colSpan={5} className="px-3 py-3 text-gray-500">No meeting details yet</td></tr>
                          ) : (
                            meetingDetails.map((m, idx) => (
                              <tr key={`${m.meetingDate}-${idx}`} className="border-t border-gray-100">
                                <td className="px-3 py-2">{toDateInputValue(m.meetingDate) || '—'}</td>
                                <td className="px-3 py-2">{splitList(m.attendeeClient).join(', ') || '—'}</td>
                                <td className="px-3 py-2">{splitList(m.attendeeSIT).join(', ') || '—'}</td>
                                <td className="px-3 py-2">{m.meetingAgenda || '—'}</td>
                                <td className="px-3 py-2 text-right">
                                  <button type="button" className="text-[#2A6BB5] mr-2" onClick={() => { setEditingMeetingIndex(idx); setMeetingDraft({ ...m }); }}>Edit</button>
                                  <button type="button" className="text-red-600" onClick={() => setMeetingDetails((prev) => prev.filter((_, i) => i !== idx))}>Delete</button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {discussionSubTab === 'discussion' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Requirement Notes</label>
                      <textarea
                        name="Discussion"
                        value={form.Discussion}
                        onChange={handleChange}
                        className={textareaClass}
                        rows={8}
                        placeholder="Enter requirement details"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Requirement Disciplines</label>
                        <input
                          type="text"
                          name="business"
                          value={form.business}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. Piping, Mechanical, Process"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Preferred Training Dates</label>
                        <input
                          type="text"
                          name="TrainingDates"
                          value={form.TrainingDates}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="e.g. 15-20 May / Next month"
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Requirement Details Shared by Company</label>
                      <textarea
                        name="Remark"
                        value={form.Remark}
                        onChange={handleChange}
                        className={textareaClass}
                        rows={5}
                        placeholder="Enter requirement details shared by company"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Discussion Outcome</label>
                      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                        {(['Awarded', 'Regretted', 'On Hold'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setDiscussionOutcome(opt)}
                            className={`px-4 py-2 text-sm font-semibold ${discussionOutcome === opt ? 'bg-[#2A6BB5] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {discussionSubTab === 'contacts' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className={labelClass}>Date</label><input type="date" className={inputClass} value={followUpDraft.date} onChange={(e) => setFollowUpDraft((d) => ({ ...d, date: e.target.value }))} /></div>
                      <div><label className={labelClass}>Next Date</label><input type="date" className={inputClass} value={followUpDraft.nextDate || ''} onChange={(e) => setFollowUpDraft((d) => ({ ...d, nextDate: e.target.value }))} /></div>
                      <div><label className={labelClass}>Contact Person</label><input className={inputClass} value={followUpDraft.contactPerson} onChange={(e) => setFollowUpDraft((d) => ({ ...d, contactPerson: e.target.value }))} /></div>
                      <div><label className={labelClass}>Designation</label><input className={inputClass} value={followUpDraft.designation} onChange={(e) => setFollowUpDraft((d) => ({ ...d, designation: e.target.value }))} /></div>
                      <div>
                        <label className={labelClass}>Mobile</label>
                        <textarea
                          className={textareaClass}
                          rows={2}
                          value={followUpDraft.mobile}
                          onChange={(e) => setFollowUpDraft((d) => ({ ...d, mobile: e.target.value }))}
                          placeholder="Multiple numbers: comma or new line"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email</label>
                        <textarea
                          className={textareaClass}
                          rows={2}
                          value={followUpDraft.email}
                          onChange={(e) => setFollowUpDraft((d) => ({ ...d, email: e.target.value }))}
                          placeholder="Multiple emails: comma or new line"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Purpose</label>
                        <select className={inputClass} value={followUpDraft.purpose} onChange={(e) => setFollowUpDraft((d) => ({ ...d, purpose: e.target.value }))}>
                          <option value="">--Select Purpose--</option>
                          {FOLLOWUP_PURPOSES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Course</label>
                        <select className={inputClass} value={followUpDraft.course} onChange={(e) => setFollowUpDraft((d) => ({ ...d, course: e.target.value }))}>
                          <option value="">--Select Course--</option>
                          {courses.map((c) => (
                            <option key={c.Course_Id} value={c.Course_Name}>{c.Course_Name}</option>
                          ))}
                        </select>
                      </div>
                      <div><label className={labelClass}>Direct Line</label><input className={inputClass} value={followUpDraft.directLine} onChange={(e) => setFollowUpDraft((d) => ({ ...d, directLine: e.target.value }))} /></div>
                      <div className="md:col-span-3"><label className={labelClass}>Remarks</label><input className={inputClass} value={followUpDraft.remark} onChange={(e) => setFollowUpDraft((d) => ({ ...d, remark: e.target.value }))} /></div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-[#2A6BB5] text-white text-sm font-semibold"
                        onClick={() => {
                          const hasAny = Boolean(followUpDraft.date || followUpDraft.contactPerson?.trim() || followUpDraft.email?.trim() || followUpDraft.remark?.trim());
                          if (!hasAny) return;
                          setFollowUps((prev) => (editingFollowUpIndex === null ? [...prev, followUpDraft] : prev.map((m, i) => (i === editingFollowUpIndex ? followUpDraft : m))));
                          setFollowUpDraft({ date: '', nextDate: '', contactPerson: '', designation: '', mobile: '', email: '', purpose: '', course: '', directLine: '', remark: '' });
                          setEditingFollowUpIndex(null);
                        }}
                      >
                        {editingFollowUpIndex === null ? 'Add Follow Up' : 'Update Follow Up'}
                      </button>
                      {editingFollowUpIndex !== null && (
                        <button type="button" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold" onClick={() => { setFollowUpDraft({ date: '', nextDate: '', contactPerson: '', designation: '', mobile: '', email: '', purpose: '', course: '', directLine: '', remark: '' }); setEditingFollowUpIndex(null); }}>Cancel</button>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Contact</th><th className="px-3 py-2 text-left">Designation</th><th className="px-3 py-2 text-left">Mobile / Email</th><th className="px-3 py-2 text-left">Purpose / Course</th><th className="px-3 py-2 text-left">Direct Line</th><th className="px-3 py-2 text-left">Remarks</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                        <tbody>
                          {followUps.length === 0 ? (
                            <tr><td colSpan={8} className="px-3 py-3 text-gray-500">No follow-ups added yet</td></tr>
                          ) : followUps.map((c, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="px-3 py-2">{toDateInputValue(c.date) || '—'}</td>
                              <td className="px-3 py-2">{c.contactPerson || '—'}</td>
                              <td className="px-3 py-2">{c.designation || '—'}</td>
                              <td className="px-3 py-2">{splitList(c.mobile).join(', ') || '—'} / {splitList(c.email).join(', ') || '—'}</td>
                              <td className="px-3 py-2">{c.purpose || '—'} / {c.course || '—'}</td>
                              <td className="px-3 py-2">{c.directLine || '—'}</td>
                              <td className="px-3 py-2">{c.remark || '—'}</td>
                              <td className="px-3 py-2 text-right">
                                <button type="button" className="text-[#2A6BB5] mr-2" onClick={() => { setEditingFollowUpIndex(idx); setFollowUpDraft({ ...c }); }}>Edit</button>
                                <button type="button" className="text-red-600" onClick={() => setFollowUps((prev) => prev.filter((_, i) => i !== idx))}>Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </form>
    </div>
  );
}
