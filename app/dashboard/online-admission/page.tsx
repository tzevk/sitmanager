'use client';

import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusTab = '' | 'open' | 'accepted' | 'closed';

interface AdmissionRow {
  Inquiry_Id: number;
  Admission_Id: number;
  Student_Name: string | null;
  Email: string | null;
  Present_Mobile: string | null;
  Batch_code: string | null;
  Admission_Date: string | null;
  PayloadUpdatedAt: string | null;
  Status_id: number | null;
  StatusLabel: string;
  StatusCategory: 'open' | 'accepted' | 'closed';
}

interface KTDetail {
  subjectName?: string;
  year?: string;
  semester?: string;
  clearedYear?: string;
  marks?: string;
}

interface DetailData {
  inquiryId: number;
  studentId: number | null;
  statusLabel: string;
  statusCategory: string;
  // personal
  firstName: string; middleName: string; lastName: string; shortName: string;
  dob: string; gender: string; nationality: string;
  email: string; mobile: string; telephone: string; familyContact: string;
  // present address
  presentFlat: string; presentBuilding: string; presentStreet: string;
  presentArea: string; presentLandmark: string; presentAddress: string;
  presentCity: string; presentDistrict: string; presentState: string;
  presentPin: string; presentCountry: string;
  // permanent address
  permanentFlat: string; permanentBuilding: string; permanentStreet: string;
  permanentArea: string; permanentLandmark: string; permanentAddress: string;
  permanentCity: string; permanentDistrict: string; permanentState: string;
  permanentPin: string; permanentCountry: string; sameAsPresent: boolean;
  // education — SSC
  ssc_board: string; ssc_schoolName: string; ssc_yearOfPassing: string; ssc_percentage: string;
  ssc_ktCount: string; ssc_ktDetails: KTDetail[];
  // education — HSC
  hsc_board: string; hsc_collegeName: string; hsc_stream: string;
  hsc_yearOfPassing: string; hsc_percentage: string;
  hsc_ktCount: string; hsc_ktDetails: KTDetail[];
  // education — Diploma
  diploma_degree: string; diploma_specialization: string; diploma_institute: string;
  diploma_yearOfPassing: string; diploma_percentage: string;
  diploma_ktCount: string; diploma_ktDetails: KTDetail[];
  // education — Graduation
  grad_degree: string; grad_specialization: string; grad_university: string;
  grad_yearOfPassing: string; grad_percentage: string;
  grad_ktCount: string; grad_ktDetails: KTDetail[];
  // education — Post-Graduation
  postgrad_degree: string; postgrad_specialization: string; postgrad_university: string;
  postgrad_yearOfPassing: string; postgrad_percentage: string;
  postgrad_ktCount: string; postgrad_ktDetails: KTDetail[];
  // education summary
  qualification: string; discipline: string; percentage: string; educationRemark: string;
  // occupational
  occupationalStatus: string; jobOrganisation: string; jobDesignation: string;
  totalOccupationYears: string; jobDescription: string;
  workingFromYears: string; workingFromMonths: string; selfEmploymentDetails: string;
  // training
  trainingProgrammeId: string; trainingProgrammeName: string; trainingCategory: string; batchCode: string;
  // payment
  modeOfPayment: string; razorpayPaid: boolean; razorpayPaymentId: string;
  razorpayOrderId: string; razorpayAmount: number | null; idProofType: string;
  // consent
  termsAgreed: boolean; consentAcknowledged: boolean; experiencedConsentAcknowledged: boolean;
  consentData: { eligibility: string; qualification: string; candidateRemark: string };
  payAtOfficeAudit: { enabledAt?: string; enabledByName?: string; enabledByEmail?: string } | null;
  draftMeta: { currentStep?: number; autosavedAt?: string } | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number }

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'closed', label: 'Rejected' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: unknown): string {
  if (v == null || v === '' || v === false) return '';
  if (v === true) return 'Yes';
  return String(v);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: unknown }) {
  const v = fmt(value);
  if (!v) return null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</span>
      <span className="text-[11px] text-slate-700 break-words leading-snug">{v}</span>
    </div>
  );
}

function Section({ title, color = 'blue', children }: { title: string; color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'slate'; children: React.ReactNode }) {
  const hdr: Record<string, string> = {
    blue:   'bg-[#2E3093]/8 border-[#2E3093]/20 text-[#2E3093]',
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose:   'bg-rose-50 border-rose-200 text-rose-700',
    slate:  'bg-slate-50 border-slate-200 text-slate-600',
  };
  // Check if any children would render (Field returns null for empty values)
  // We render the section unconditionally — caller is responsible for gating
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className={`border-b px-3 py-1.5 ${hdr[color]}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-3 py-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-2.5">
        {children}
      </div>
    </div>
  );
}

function KTBlock({ level, count, details }: { level: string; count: string; details: KTDetail[] }) {
  const n = Number(count || 0);
  if (!n || !details.length) return null;
  return (
    <div className="rounded border border-amber-200 bg-amber-50/60 px-3 py-2 mt-0.5">
      <p className="text-[10px] font-bold text-amber-700 mb-1.5">{level} — {n} KT/Backlog subject{n > 1 ? 's' : ''}</p>
      <div className="space-y-1">
        {details.map((d, i) => (
          <div key={i} className="flex flex-wrap gap-x-4 text-[10px] text-amber-800">
            {d.subjectName && <span>Subject: <b>{d.subjectName}</b></span>}
            {d.year && <span>Year: <b>{d.year}</b></span>}
            {d.semester && <span>Sem: <b>{d.semester}</b></span>}
            {d.clearedYear && <span>Cleared: <b>{d.clearedYear}</b></span>}
            {d.marks && <span>Marks: <b>{d.marks}</b></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ inquiryId }: { inquiryId: number }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setData(null);
    (async () => {
      try {
        const res = await fetch(`/api/online-admission/${inquiryId}`);
        const json = await res.json();
        if (!cancelled) {
          if (res.ok) setData(json);
          else setError(json.error || 'Failed to load details');
        }
      } catch {
        if (!cancelled) setError('Network error loading details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inquiryId]);

  if (loading) return (
    <div className="py-8 flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-slate-400">Loading all fields…</span>
    </div>
  );
  if (error) return <p className="py-4 text-center text-xs text-red-500">{error}</p>;
  if (!data) return null;

  const d = data;

  const hasSSC      = !!(d.ssc_board || d.ssc_schoolName || d.ssc_yearOfPassing || d.ssc_percentage);
  const hasHSC      = !!(d.hsc_board || d.hsc_collegeName || d.hsc_stream || d.hsc_yearOfPassing || d.hsc_percentage);
  const hasDiploma  = !!(d.diploma_degree || d.diploma_specialization || d.diploma_institute || d.diploma_yearOfPassing || d.diploma_percentage);
  const hasGrad     = !!(d.grad_degree || d.grad_specialization || d.grad_university || d.grad_yearOfPassing || d.grad_percentage);
  const hasPostgrad = !!(d.postgrad_degree || d.postgrad_specialization || d.postgrad_university || d.postgrad_yearOfPassing || d.postgrad_percentage);
  const hasEduSummary = !!(d.qualification || d.discipline || d.percentage || d.educationRemark);
  const hasOccupational = !!(d.occupationalStatus || d.jobOrganisation || d.jobDesignation || d.jobDescription);
  const hasPayment  = !!(d.modeOfPayment || d.razorpayPaid || d.razorpayPaymentId);
  const hasConsent  = !!(d.termsAgreed || d.consentAcknowledged || d.experiencedConsentAcknowledged);
  const hasPermanent = !d.sameAsPresent && !!(d.permanentCity || d.permanentState || d.permanentAddress);

  return (
    <div className="space-y-2 px-4 py-3 bg-slate-50/40">

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 pb-1 border-b border-slate-200">
        <span>Inquiry ID: <b className="text-slate-700">#{d.inquiryId}</b></span>
        {d.studentId ? <span>Student ID: <b className="text-emerald-700">#{d.studentId}</b></span> : <span className="text-amber-600">Not yet admitted</span>}
        <span>Status: <b className="text-slate-700">{d.statusLabel}</b></span>
        {d.draftMeta?.currentStep != null && (
          <span>Form Progress: <b className="text-slate-700">Step {d.draftMeta.currentStep}/6</b></span>
        )}
        {d.draftMeta?.autosavedAt && (
          <span>Last Saved: <b className="text-slate-700">{fmtDateTime(d.draftMeta.autosavedAt)}</b></span>
        )}
      </div>

      {/* ── Personal ── */}
      <Section title="Personal Information" color="blue">
        <Field label="First Name"      value={d.firstName} />
        <Field label="Middle Name"     value={d.middleName} />
        <Field label="Last Name"       value={d.lastName} />
        <Field label="Short Name"      value={d.shortName} />
        <Field label="Date of Birth"   value={fmtDate(d.dob)} />
        <Field label="Gender"          value={d.gender} />
        <Field label="Nationality"     value={d.nationality} />
        <Field label="Email"           value={d.email} />
        <Field label="Mobile"          value={d.mobile} />
        <Field label="Telephone"       value={d.telephone} />
        <Field label="Family Contact"  value={d.familyContact} />
        <Field label="ID Proof Type"   value={d.idProofType} />
      </Section>

      {/* ── Present Address ── */}
      <Section title="Present Address" color="green">
        <Field label="Flat / Room No."     value={d.presentFlat} />
        <Field label="Building / Society"  value={d.presentBuilding} />
        <Field label="Street"              value={d.presentStreet} />
        <Field label="Area / Colony"       value={d.presentArea} />
        <Field label="Landmark"            value={d.presentLandmark} />
        <Field label="City"                value={d.presentCity} />
        <Field label="District"            value={d.presentDistrict} />
        <Field label="State"               value={d.presentState} />
        <Field label="PIN Code"            value={d.presentPin} />
        <Field label="Country"             value={d.presentCountry} />
      </Section>

      {/* ── Permanent Address ── */}
      {d.sameAsPresent ? (
        <div className="rounded-lg border border-slate-200 px-3 py-2 bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Permanent Address</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Same as present address</p>
        </div>
      ) : hasPermanent ? (
        <Section title="Permanent / Native Address" color="green">
          <Field label="Flat / Room No."     value={d.permanentFlat} />
          <Field label="Building / Society"  value={d.permanentBuilding} />
          <Field label="Street"              value={d.permanentStreet} />
          <Field label="Area / Colony"       value={d.permanentArea} />
          <Field label="Landmark"            value={d.permanentLandmark} />
          <Field label="City"                value={d.permanentCity} />
          <Field label="District"            value={d.permanentDistrict} />
          <Field label="State"               value={d.permanentState} />
          <Field label="PIN Code"            value={d.permanentPin} />
          <Field label="Country"             value={d.permanentCountry} />
        </Section>
      ) : null}

      {/* ── Education ── */}
      {hasSSC && (
        <>
          <Section title="Education — SSC (10th Standard)" color="amber">
            <Field label="Board"            value={d.ssc_board} />
            <Field label="School Name"      value={d.ssc_schoolName} />
            <Field label="Year of Passing"  value={d.ssc_yearOfPassing} />
            <Field label="Percentage"       value={d.ssc_percentage} />
          </Section>
          <KTBlock level="SSC" count={d.ssc_ktCount} details={d.ssc_ktDetails} />
        </>
      )}

      {hasHSC && (
        <>
          <Section title="Education — HSC (12th Standard)" color="amber">
            <Field label="Board"            value={d.hsc_board} />
            <Field label="College"          value={d.hsc_collegeName} />
            <Field label="Stream"           value={d.hsc_stream} />
            <Field label="Year of Passing"  value={d.hsc_yearOfPassing} />
            <Field label="Percentage"       value={d.hsc_percentage} />
          </Section>
          <KTBlock level="HSC" count={d.hsc_ktCount} details={d.hsc_ktDetails} />
        </>
      )}

      {hasDiploma && (
        <>
          <Section title="Education — Diploma" color="amber">
            <Field label="Degree"           value={d.diploma_degree} />
            <Field label="Specialization"   value={d.diploma_specialization} />
            <Field label="Institute"        value={d.diploma_institute} />
            <Field label="Year of Passing"  value={d.diploma_yearOfPassing} />
            <Field label="Percentage"       value={d.diploma_percentage} />
          </Section>
          <KTBlock level="Diploma" count={d.diploma_ktCount} details={d.diploma_ktDetails} />
        </>
      )}

      {hasGrad && (
        <>
          <Section title="Education — Graduation" color="amber">
            <Field label="Degree"           value={d.grad_degree} />
            <Field label="Specialization"   value={d.grad_specialization} />
            <Field label="University"       value={d.grad_university} />
            <Field label="Year of Passing"  value={d.grad_yearOfPassing} />
            <Field label="Percentage"       value={d.grad_percentage} />
          </Section>
          <KTBlock level="Graduation" count={d.grad_ktCount} details={d.grad_ktDetails} />
        </>
      )}

      {hasPostgrad && (
        <>
          <Section title="Education — Post-Graduation" color="amber">
            <Field label="Degree"           value={d.postgrad_degree} />
            <Field label="Specialization"   value={d.postgrad_specialization} />
            <Field label="University"       value={d.postgrad_university} />
            <Field label="Year of Passing"  value={d.postgrad_yearOfPassing} />
            <Field label="Percentage"       value={d.postgrad_percentage} />
          </Section>
          <KTBlock level="Post-Graduation" count={d.postgrad_ktCount} details={d.postgrad_ktDetails} />
        </>
      )}

      {hasEduSummary && (
        <Section title="Education Summary (Synced to Student)" color="amber">
          <Field label="Highest Qualification"   value={d.qualification} />
          <Field label="Discipline / Stream"     value={d.discipline} />
          <Field label="Overall Percentage"      value={d.percentage} />
          <Field label="Education Remarks"       value={d.educationRemark} />
        </Section>
      )}

      {/* ── Occupational ── */}
      {hasOccupational && (
        <Section title="Occupational Information" color="purple">
          <Field label="Status"                    value={d.occupationalStatus} />
          <Field label="Organisation / Company"    value={d.jobOrganisation} />
          <Field label="Designation"               value={d.jobDesignation} />
          <Field label="Total Experience (Years)"  value={d.totalOccupationYears} />
          <Field label="Working Since — Year"      value={d.workingFromYears} />
          <Field label="Working Since — Month"     value={d.workingFromMonths} />
          <Field label="Job Description"           value={d.jobDescription} />
          <Field label="Self-Employment Details"   value={d.selfEmploymentDetails} />
        </Section>
      )}

      {/* ── Training ── */}
      {(d.trainingProgrammeName || d.batchCode || d.trainingCategory) && (
        <Section title="Training Programme" color="blue">
          <Field label="Programme"     value={d.trainingProgrammeName} />
          <Field label="Category"      value={d.trainingCategory} />
          <Field label="Batch Code"    value={d.batchCode} />
        </Section>
      )}

      {/* ── Payment ── */}
      {hasPayment && (
        <Section title="Payment Information" color="rose">
          <Field label="Mode of Payment"   value={d.modeOfPayment} />
          <Field label="Online Payment"    value={d.razorpayPaid ? 'Paid' : null} />
          <Field label="Payment ID"        value={d.razorpayPaymentId} />
          <Field label="Order ID"          value={d.razorpayOrderId} />
          <Field label="Amount Paid"       value={d.razorpayAmount != null ? `₹${Number(d.razorpayAmount).toLocaleString('en-IN')}` : null} />
          {d.payAtOfficeAudit && (
            <Field
              label="Pay-at-Office Auth"
              value={`${d.payAtOfficeAudit.enabledByName || ''} — ${fmtDateTime(d.payAtOfficeAudit.enabledAt)}`}
            />
          )}
        </Section>
      )}

      {/* ── Consent & Terms ── */}
      {hasConsent && (
        <Section title="Consent & Terms" color="slate">
          <Field label="Terms Agreed"              value={d.termsAgreed} />
          <Field label="Consent Acknowledged"      value={d.consentAcknowledged} />
          <Field label="Experienced Consent"       value={d.experiencedConsentAcknowledged} />
          <Field label="Eligibility Statement"     value={d.consentData?.eligibility} />
          <Field label="Candidate Remark"          value={d.consentData?.candidateRemark} />
        </Section>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OnlineAdmissionPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('online_admission');

  const [rows, setRows]             = useState<AdmissionRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId]         = useState<number | null>(null);

  // Filters
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [search, setSearch]       = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [page, setPage]           = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '25');
      if (search)    p.set('search', search);
      if (statusTab) p.set('statusCategory', statusTab);
      if (dateFrom)  p.set('dateFrom', dateFrom);
      if (dateTo)    p.set('dateTo', dateTo);
      const res  = await fetch(`/api/online-admission?${p}`, { signal: ctrl.signal });
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }, [page, fetchTrigger, search, statusTab, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = () => { setPage(1); setFetchTrigger(t => t + 1); };

  const handleTabChange = (tab: StatusTab) => {
    setStatusTab(tab);
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleAction = async (inquiryId: number, action: 'accept' | 'reject' | 'delete') => {
    const verb = action === 'accept' ? 'grant' : action === 'reject' ? 'reject' : 'delete';
    if (!confirm(`Are you sure you want to ${verb} this admission?`)) return;
    setBusyId(inquiryId);
    try {
      const res = await fetch(`/api/online-admission/${inquiryId}`, {
        method: action === 'delete' ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(action !== 'delete' && { body: JSON.stringify({ statusAction: action }) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `Failed to ${verb}`);
      }
      setExpandedId(null);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${verb}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    const headers = ['Inquiry Id', 'Name', 'Email', 'Mobile', 'Batch', 'Status', 'Last Updated'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        r.Inquiry_Id,
        `"${(r.Student_Name || '').replace(/"/g, '""')}"`,
        `"${(r.Email || '').replace(/"/g, '""')}"`,
        r.Present_Mobile || '',
        r.Batch_code || '',
        `"${r.StatusLabel}"`,
        r.PayloadUpdatedAt ? new Date(r.PayloadUpdatedAt).toLocaleDateString('en-IN') : '',
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `online-admissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Style helpers ──────────────────────────────────────────────────────────

  const statusBadgeCls = (cat: string) =>
    cat === 'accepted'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : cat === 'closed'
        ? 'bg-red-50 text-red-600 border-red-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';

  const inp = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? (
        <AccessDenied message="You do not have permission to view online admissions." />
      ) : (
        <>
          {/* ── Header ── */}
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 flex items-center justify-between relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
            <div className="relative z-10 flex items-center gap-3">
              <h2 className="text-sm font-black text-white tracking-tight">Online Admission</h2>
              <span className="text-[11px] text-white/60">{pagination.total.toLocaleString()} records</span>
            </div>
            <button
              onClick={handleExport}
              className="relative z-10 flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>

          {/* ── Tabs + Filters ── */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
            {/* Status tabs */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    statusTab === tab.id
                      ? 'bg-[#2E3093] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <input
              type="text" value={search}
              placeholder="Search name, email, mobile, id…"
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && refresh()}
              className={`${inp} flex-1 min-w-[180px]`}
            />
            <input type="date" value={dateFrom} title="From date" onChange={e => setDateFrom(e.target.value)} className={`${inp} w-[130px]`} />
            <input type="date" value={dateTo}   title="To date"   onChange={e => setDateTo(e.target.value)}   className={`${inp} w-[130px]`} />
            <button
              onClick={refresh}
              className="flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            <button
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); refresh(); }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-bold w-16">Id</th>
                    <th className="text-left py-2 px-3 font-bold">Name</th>
                    <th className="text-left py-2 px-3 font-bold">Email</th>
                    <th className="text-left py-2 px-3 font-bold">Mobile</th>
                    <th className="text-left py-2 px-3 font-bold">Batch</th>
                    <th className="text-left py-2 px-3 font-bold">Status</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Last Updated</th>
                    <th className="text-center py-2 px-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-slate-400">Loading…</span>
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-slate-400">No admissions found</td>
                    </tr>
                  ) : rows.map(r => {
                    const isExpanded = expandedId === r.Inquiry_Id;
                    const isPending  = r.StatusCategory === 'open';
                    const busy       = busyId === r.Inquiry_Id;
                    return (
                      <Fragment key={r.Inquiry_Id}>
                        <tr className={`border-b border-slate-100 transition-colors ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                          <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">{r.Inquiry_Id}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-700 max-w-[160px]">
                            <span className="truncate block">{r.Student_Name || '—'}</span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 max-w-[170px]">
                            <span className="truncate block">{r.Email || '—'}</span>
                          </td>
                          <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">{r.Present_Mobile || '—'}</td>
                          <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap font-semibold">{r.Batch_code || '—'}</td>
                          <td className="py-1.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeCls(r.StatusCategory)}`}>
                              {r.StatusLabel}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                            {fmtDateTime(r.PayloadUpdatedAt || r.Admission_Date)}
                          </td>
                          <td className="py-1.5 px-3">
                            <div className="flex items-center justify-center gap-0.5">

                              {/* View / expand details */}
                              <button
                                title={isExpanded ? 'Hide details' : 'View all fields'}
                                onClick={() => setExpandedId(isExpanded ? null : r.Inquiry_Id)}
                                className={`p-1 rounded transition-colors ${isExpanded ? 'bg-blue-100 text-[#2E3093]' : 'text-slate-400 hover:bg-blue-50 hover:text-[#2E3093]'}`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* Edit form */}
                              {canUpdate && (
                                <button
                                  title="Edit form data"
                                  onClick={() => router.push(`/dashboard/online-admission/edit/${r.Inquiry_Id}`)}
                                  className="p-1 rounded text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              )}

                              {/* Grant — pending only */}
                              {canUpdate && isPending && (
                                <button
                                  title="Grant admission → converts to student"
                                  disabled={busy}
                                  onClick={() => handleAction(r.Inquiry_Id, 'accept')}
                                  className="p-1 rounded text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-40"
                                >
                                  {busy ? (
                                    <div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              )}

                              {/* Reject — pending only */}
                              {canUpdate && isPending && (
                                <button
                                  title="Reject admission"
                                  disabled={busy}
                                  onClick={() => handleAction(r.Inquiry_Id, 'reject')}
                                  className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}

                              {/* Delete */}
                              {canDelete && (
                                <button
                                  title="Delete submission"
                                  disabled={busy}
                                  onClick={() => handleAction(r.Inquiry_Id, 'delete')}
                                  className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="border-b border-slate-200">
                            <td colSpan={8} className="p-0">
                              <DetailPanel inquiryId={r.Inquiry_Id} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[11px] text-slate-400">
                  {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={pagination.page <= 1}
                    className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">First</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1}
                    className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  {(() => {
                    const cur = pagination.page, tot = pagination.totalPages, pages: number[] = [];
                    for (let p = Math.max(1, cur - 2); p <= Math.min(tot, cur + 2); p++) pages.push(p);
                    return pages.map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-6 h-6 text-[11px] rounded border font-semibold ${p === cur ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-600'}`}>
                        {p}
                      </button>
                    ));
                  })()}
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages}
                    className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={() => setPage(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages}
                    className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Last</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
