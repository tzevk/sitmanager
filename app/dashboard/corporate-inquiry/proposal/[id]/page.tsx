'use client';

import React, { useEffect, useMemo, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaTrash, FaSave, FaFileWord } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type Attachment = {
  name: string;
  mime: string;
  dataUrl: string;
};

type TrainingSubRow = {
  topic: string;
  assessment: string;
  trainer: string;
};

type TrainingDay = {
  label: string;
  date: string;
  dayName: string;
  time: string;
  mainTopic: string;
  subRows: TrainingSubRow[];
};

type TrainingData = {
  title: string;
  venue: string;
  participantsDesc: string;
  days: TrainingDay[];
  pleaseNote: string[];
};

type QuotationItem = {
  description: string;
  branch?: string;
  days: string;
  perDay: string;
  total: string;
};

type QuotationSection = {
  label: string;
  title: string;
  items: QuotationItem[];
};

type QuotationData = {
  recipientCompany: string;
  recipientAddress: string;
  proformaInvoiceNo: string;
  companyAuthority: string;
  participantsDetails: string;
  participants: string;
  clientRef: string;
  trainingMode: string;
  enquiryDate: string;
  invoiceDate: string;
  trainingLocation: string;
  department: string;
  sections: QuotationSection[];
  gstPercent: string;
  bankDetails: string;
  coordinator: string;
  notes: string;
};

async function readFileAsAttachment(file: File): Promise<Attachment> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return { name: file.name, mime: file.type || 'application/octet-stream', dataUrl };
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } catch {
    return null;
  }
}

const DEFAULT_ABOUT_ORGANISATION = `1. Introduction
"Suvidya Institute of Technology Pvt. Ltd." is a Training organization formed to "Make Everyone Eligible for Working in Global Industry" by enhancing skills as per the industrial project activities. SIT training is supported by an EPC company "Ms. Accent Techno Solutions Pvt. Ltd." by providing working professionals as a Trainer and Providing project case studies for making training Rehearsal of actual working.

Training Program is designed for each engineering discipline like Process, Equipment, Piping, HVAC, Civil, Structural, Electrical, Instrumentation, MEP etc. with relevant software's like PDMS, E-3D, Cadmatic, Solidworks 3D, PV Elite, Caesar-II, AutoCAD etc.

Main aim of the SIT is to make training "Rehearsal of Actual Working" for providing ready to work highly skilled manpower for Engineering Design, Procurement, Planning, Project Management, Construction, Inspection, Testing, Operating and Maintenance. Trained manpower is useful for Offshore, Refinery, Petrochemical, Chemical, Power, Steel, FMCG, Pharmaceutical plants, useful for EPC companies and Engineering Workshop.

2. Vision
Making everyone eligible for strengthening companies to contribute in making nation technologically self-reliant.

3. Mission
To develop trusted business professionals with real working skills like Innovative design, product optimization, problem Solving, Interface management to cater need of every sector of industry by helping in choosing right career.

4. In-House Training Program
In House Training programs are designed to enhance skills as per current trends of industry to make ENGINEERS and DRAUGHTSMAN work in the industry like Engineering Design, 3D modelling, Procurement, Construction, along with knowledge of project management, Inspection, Testing, Commissioning, Operating and Maintenance. Soft Skill are included in every Training program to understand importance of work ethics.

5. Corporate Training Program - "Employability Skill Enhancing Training Program"
a. For newly recruited Graduate Trainee Engineers to bring in to working in shortest time and making them productive, it is very much necessary to go through the case study based training where they will be trained, guided for doing various project activities which are done regularly from concept to commissioning.
b. For Employee who are working on project activities from many years, need to sharpen skill on new technologies, concept, Codes and Standards implementation, Statutory Requirements etc., to improve productivity by giving most appropriate solution. These Custom-Made Training is based on Project to minimise mistakes. List of topics are collected from working team which will be converted in to training program for making training rehearsal of actual working.

6. Credential of SIT
a. Partner of National Skill Development Corporation of India
b. Registered under Ministry of Micro, Small, Medium Enterprises
c. Quality Management System - ISO 9001-2015 certified by BIS-Bureau of Indian Standards
d. Member of Maharashtra Chamber of Commerce, Industry & Agriculture
e. Member of CII - Confederation of Indian Industry
f. Affiliated to ECITB - Engineering Construction Industry Training Board United Kingdom
g. Conducted more than 500 Seminar to College Students on Future Trends of Industry
h. Conducted Faculty Development Program on Interfaces in Engineering Discipline for more than 200 Engineering College Professors.
i. Conducted more than 250 Corporate Training to various EPC Companies, Refineries, Chemical Pant and Government Organisation like Naval Dockyard.
j. Trained to 39 Nationalities more than 21000 Engineers and Draughtsman`;

const DEFAULT_PLEASE_NOTE = [
  'Share training location accordingly SIT trainer will be finalised.',
  'Training duration will be fixed after training contents are finalised.',
  'Recording of training is strictly prohibited.',
  'Break time of training - 1 hour - Lunch break - Morning & Evening 15 minutes each.',
  'Software any training is not included.',
];

const DEFAULT_TRAINING_DATA: TrainingData = {
  title: 'Corporate Training Contents',
  venue: '',
  participantsDesc: '',
  days: [
    {
      label: 'Day 1',
      date: '',
      dayName: 'Monday',
      time: '9:00am to 5:00pm',
      mainTopic: '',
      subRows: [{ topic: '', assessment: 'PRE-TEST', trainer: '' }],
    },
  ],
  pleaseNote: [...DEFAULT_PLEASE_NOTE],
};

const DEFAULT_QUOTATION_DATA: QuotationData = {
  recipientCompany: '',
  recipientAddress: '',
  proformaInvoiceNo: 'CT-001',
  companyAuthority: '',
  participantsDetails: '',
  participants: '',
  clientRef: 'Email',
  trainingMode: 'Offline',
  enquiryDate: '',
  invoiceDate: '',
  trainingLocation: 'Company location',
  department: '',
  sections: [
    {
      label: 'A',
      title: 'Training Execution',
      items: [{ description: 'Corporate Training', days: '', perDay: '', total: '' }],
    },
    {
      label: 'B',
      title: 'Other Expenses',
      items: [
        { description: 'Training Preparation', days: '', perDay: '', total: '' },
        { description: 'Assessment Preparation', days: '', perDay: '', total: '' },
        { description: 'SIT Participation Certificate', days: '', perDay: '', total: '' },
      ],
    },
  ],
  gstPercent: '18',
  bankDetails: `Payment To: Suvidya Institute of Technology Pvt. Ltd.
Bank Name:
Branch:
Account No:
IFSC Code:
Swift Code: `,
  coordinator: '',
  notes: '',
};

function todayDisplay(): string {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toNum(v: string): number {
  const n = Number(String(v || '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function fmtINR(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function CorporateProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [venue, setVenue] = useState('');

  const [proposalRefNo, setProposalRefNo] = useState(`SITPL/CT/P/${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  const [proposalDate, setProposalDate] = useState(todayDisplay());
  const [proposalTitle, setProposalTitle] = useState('');
  const [clientName, setClientName] = useState('');

  const [aboutOrganisation, setAboutOrganisation] = useState(DEFAULT_ABOUT_ORGANISATION);
  const [trainingData, setTrainingData] = useState<TrainingData>(DEFAULT_TRAINING_DATA);
  const [quotationData, setQuotationData] = useState<QuotationData>(DEFAULT_QUOTATION_DATA);

  const [trainingAttachments, setTrainingAttachments] = useState<Attachment[]>([]);
  const [quotationAttachments, setQuotationAttachments] = useState<Attachment[]>([]);
  const [trainerCvAttachments, setTrainerCvAttachments] = useState<Attachment[]>([]);
  const trainingFileInputRef = useRef<HTMLInputElement | null>(null);
  const quotationFileInputRef = useRef<HTMLInputElement | null>(null);
  const trainerCvFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'about' | 'training' | 'quotation'>('about');
  const [saving, setSaving] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const handleAttachmentUpload = async (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<Attachment[]>>
  ) => {
    if (!files || files.length === 0) return;
    const incoming = await Promise.all(Array.from(files).map(readFileAsAttachment));
    setter((prev) => [...prev, ...incoming]);
  };

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        const [inqRes, propRes] = await Promise.all([
          fetch(`/api/admission-activity/corporate-inquiry/${id}`, { method: 'GET' }),
          fetch(`/api/admission-activity/corporate-inquiry/proposal/${id}`, { method: 'GET' }),
        ]);
        const inqData = await inqRes.json().catch(() => ({}));
        const propData = await propRes.json().catch(() => ({}));
        if (!alive) return;

        const inq = inqData?.inquiry || {};
        const inqCompany = String(inq.CompanyName || '').trim();
        const inqVenue = String(inq.Place || '').trim();
        const inqCourse = String(inq.Course_Id || '').trim();

        setCompanyName(inqCompany);
        setVenue(inqVenue);
        setClientName(inqCompany);
        setProposalTitle(inqCourse || 'Corporate Training Program');

        setTrainingData((prev) => ({
          ...prev,
          title: inqCourse ? `${inqCourse} Training Contents` : prev.title,
          venue: inqVenue || prev.venue,
        }));
        setQuotationData((prev) => ({
          ...prev,
          recipientCompany: inqCompany || prev.recipientCompany,
          invoiceDate: todayDisplay(),
        }));

        const saved = propData?.proposal;
        if (saved) {
          if (saved.ProposalRefNo) setProposalRefNo(String(saved.ProposalRefNo));
          if (saved.ProposalDate) setProposalDate(String(saved.ProposalDate));
          if (saved.ProposalTitle) setProposalTitle(String(saved.ProposalTitle));
          if (saved.ClientName) setClientName(String(saved.ClientName));
          if (saved.Venue) setVenue(String(saved.Venue));
          if (saved.AboutOrganisation) setAboutOrganisation(String(saved.AboutOrganisation));
          if (saved.TrainingData && typeof saved.TrainingData === 'object') {
            setTrainingData({ ...DEFAULT_TRAINING_DATA, ...saved.TrainingData });
          }
          if (saved.QuotationData && typeof saved.QuotationData === 'object') {
            setQuotationData({ ...DEFAULT_QUOTATION_DATA, ...saved.QuotationData });
          }
          if (Array.isArray(saved.TrainingAttachments)) setTrainingAttachments(saved.TrainingAttachments);
          if (Array.isArray(saved.QuotationAttachments)) setQuotationAttachments(saved.QuotationAttachments);
          if (Array.isArray(saved.TrainerCvAttachments)) setTrainerCvAttachments(saved.TrainerCvAttachments);
        }
      } catch {
        // Ignore and allow manual form filling.
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [id]);

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';
  const labelClass = 'block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1';
  const textareaClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';

  const quotationTotals = useMemo(() => {
    let subtotal = 0;
    for (const section of quotationData.sections) {
      for (const item of section.items) {
        const t = toNum(item.total);
        subtotal += t > 0 ? t : toNum(item.days) * toNum(item.perDay);
      }
    }
    const gstPct = toNum(quotationData.gstPercent);
    const gst = (subtotal * gstPct) / 100;
    const grand = subtotal + gst;
    return { subtotal, gst, grand };
  }, [quotationData]);

  const previewHtml = useMemo(() => {
    const esc = (v: string) =>
      v
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderAttachments = (items: Attachment[]) => {
      if (items.length === 0) return '';
      const images = items.filter((a) => a.mime.startsWith('image/'));
      const files = items.filter((a) => !a.mime.startsWith('image/'));
      const imageHtml = images
        .map(
          (att) =>
            `<div style="margin:8px 0;"><img src="${att.dataUrl}" alt="${esc(att.name)}" style="max-width:100%;height:auto;border:1px solid #eee;"/><div style="font-size:12px;color:#555;margin-top:2px;">${esc(att.name)}</div></div>`
        )
        .join('');
      const filesHtml = files.length
        ? `<ul style="margin:4px 0 0;padding-left:18px;">${files
            .map(
              (att) =>
                `<li><a href="${att.dataUrl}" download="${esc(att.name)}">${esc(att.name)}</a></li>`
            )
            .join('')}</ul>`
        : '';
      return `<div style="margin-top:10px;"><div style="font-weight:bold;margin-bottom:4px;">Attachments:</div>${imageHtml}${filesHtml}</div>`;
    };

    const trainingRowsHtml = trainingData.days
      .map((day) => {
        const subRows = day.subRows.length > 0 ? day.subRows : [{ topic: '', assessment: '', trainer: '' }];
        return subRows
          .map((sr, srIdx) => {
            const firstCell = srIdx === 0;
            const rowspan = subRows.length;
            return `<tr>
              ${firstCell ? `<td rowspan="${rowspan}" style="border:1px solid #bbb;padding:6px;vertical-align:top;"><b>${esc(day.label)}</b></td>` : ''}
              ${firstCell ? `<td rowspan="${rowspan}" style="border:1px solid #bbb;padding:6px;vertical-align:top;">${esc(day.date || '-')}</td>` : ''}
              ${firstCell ? `<td rowspan="${rowspan}" style="border:1px solid #bbb;padding:6px;vertical-align:top;">${esc(day.dayName || '-')}</td>` : ''}
              ${firstCell ? `<td rowspan="${rowspan}" style="border:1px solid #bbb;padding:6px;vertical-align:top;">${esc(day.time || '-')}</td>` : ''}
              ${firstCell ? `<td rowspan="${rowspan}" style="border:1px solid #bbb;padding:6px;vertical-align:top;"><b>${esc(day.mainTopic || '-')}</b></td>` : ''}
              <td style="border:1px solid #bbb;padding:6px;">${esc(sr.topic || '-')}</td>
              <td style="border:1px solid #bbb;padding:6px;color:#cc0000;text-align:center;">${esc(sr.assessment || '')}</td>
              <td style="border:1px solid #bbb;padding:6px;">${esc(sr.trainer || '')}</td>
            </tr>`;
          })
          .join('');
      })
      .join('');

    const pleaseNoteHtml = trainingData.pleaseNote
      .map((n, i) => `<div style="margin:2px 0;"><b>${i + 1})</b> ${esc(n)}</div>`)
      .join('');

    const showBranchCol = quotationData.sections.some((s) =>
      s.items.some((it) => (it.branch || '').trim().length > 0)
    );
    const quoteColSpan = showBranchCol ? 5 : 4;

    const quotationSectionsHtml = quotationData.sections
      .map((section) => {
        const itemRows = section.items
          .map((item) => {
            const t = toNum(item.total) > 0 ? toNum(item.total) : toNum(item.days) * toNum(item.perDay);
            const branchCell = showBranchCol
              ? `<td style="border:1px solid #c9c9c9;padding:6px;">${esc(item.branch || '-')}</td>`
              : '';
            return `<tr>
              <td style="border:1px solid #c9c9c9;padding:6px;"></td>
              <td style="border:1px solid #c9c9c9;padding:6px;">${esc(item.description || '-')}</td>
              ${branchCell}
              <td style="border:1px solid #c9c9c9;padding:6px;text-align:center;">${esc(item.days || '-')}</td>
              <td style="border:1px solid #c9c9c9;padding:6px;text-align:right;">${item.perDay ? fmtINR(toNum(item.perDay)) : '-'}</td>
              <td style="border:1px solid #c9c9c9;padding:6px;text-align:right;">${t > 0 ? fmtINR(t) : '-'}</td>
            </tr>`;
          })
          .join('');
        return `<tr style="background:#e8f0fa;"><td style="border:1px solid #c9c9c9;padding:6px;font-weight:bold;">${esc(section.label)}</td><td style="border:1px solid #c9c9c9;padding:6px;font-weight:bold;" colspan="${quoteColSpan}">${esc(section.title)}</td></tr>${itemRows}`;
      })
      .join('');

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const watermarkUrl = `${origin}/sit.png`;

    const pageStyle = `min-height: 100vh; padding: 32px; position: relative; page-break-after: always; break-after: page; mso-page-break-after: always;`;

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Corporate Training Proposal</title>
          <style>
            html, body { margin: 0; padding: 0; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              color: #1a1a1a;
              line-height: 1.45;
              background-image: url('${watermarkUrl}');
              background-repeat: no-repeat;
              background-position: center 42%;
              background-attachment: fixed;
              background-size: 52% auto;
            }
            body::before {
              content: "";
              position: fixed;
              inset: 0;
              background: rgba(255, 255, 255, 0.9);
              z-index: -1;
              pointer-events: none;
            }
            .page { ${pageStyle} }
            .page > * { page-break-inside: avoid; }
            .page + .page { border-top: 2px dashed #d6d6d6; margin-top: 32px; }
            h1, h2, h3 { margin: 0; color: #1a1a1a; }
            h1 { font-size: 28px; }
            h2 { font-size: 18px; }
            h3 { font-size: 15px; }
            table.schedule, table.quote { width: 100%; border-collapse: collapse; font-size: 13px; }
            table.schedule th { background: #f2b860; border: 1px solid #c9c9c9; padding: 8px; text-align: left; font-weight: 600; }
            table.schedule td { vertical-align: top; }
            table.quote th { background: #f4b55e; border: 1px solid #c9c9c9; padding: 8px; text-align: left; font-weight: 600; }
            .section-title { background: #2e3093; color: #fff; text-align: center; padding: 10px; font-weight: bold; font-size: 16px; letter-spacing: 0.5px; }
            .section-sub { background: #f2b860; text-align: center; padding: 8px; font-weight: bold; font-size: 14px; border: 1px solid #c9c9c9; border-top: 0; }
            .info-band { background: #fff4e0; border: 1px solid #c9c9c9; border-top: 0; padding: 10px 14px; font-size: 13px; }
            .please-note { margin-top: 16px; font-size: 13px; border: 1px solid #d9d9d9; padding: 12px 14px; background: #fafafa; border-radius: 4px; }
            .invoice-header { display: flex; align-items: center; gap: 14px; border: 1px solid #c9c9c9; padding: 12px 14px; background: #f9f9f9; }
            .info-grid td { border: 1px solid #c9c9c9; padding: 8px 10px; font-size: 13px; }
            .kv-block { margin-top: 14px; font-size: 13px; border: 1px solid #d9d9d9; padding: 12px 14px; background: #fafafa; border-radius: 4px; }
            .kv-block .kv-title { font-weight: 600; margin-bottom: 6px; color: #2e3093; }
            .content-block { border: 1px solid #d9d9d9; border-radius: 4px; background: #fcfcfc; padding: 12px 14px; }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .page {
                min-height: auto;
                margin: 0;
                border-top: none !important;
                page-break-after: always;
                break-after: page;
              }
              .page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
            }
          </style>
        </head>
        <body>

          <section class="page">
            <div style="display:flex; justify-content:space-between; font-size: 14px; margin-bottom: 16px;">
              <div><b>Ref. No.</b> ${esc(proposalRefNo || '-')}</div>
              <div><b>Date</b> ${esc(proposalDate || '-')}</div>
            </div>

            <h1 style="text-align:center; letter-spacing:1px;">PROPOSAL</h1>
            <h2 style="text-align:center; margin:8px 0 0; font-size:18px;">Corporate Training</h2>
            <div style="text-align:center; margin-top:4px;">on</div>
            <h3 style="text-align:center; margin:8px 0 18px; font-size:20px;">${esc(proposalTitle || '-')}</h3>

            <div style="text-align:center; margin-bottom:4px;"><b>Client</b></div>
            <div style="text-align:center; margin-bottom:10px;">${esc(clientName || companyName || '-')}</div>

            <div style="text-align:center; margin-bottom:4px;"><b>Venue</b></div>
            <div style="text-align:center; margin-bottom:18px;">${esc(venue || '-')}</div>

            <h3 style="margin-top:18px;">About Our Organisation</h3>
            <div class="content-block" style="white-space: pre-line; margin-top: 8px;">${esc(aboutOrganisation || '-')}</div>
          </section>

          <section class="page" style="page-break-before:always; break-before:page; mso-page-break-before:always;">
            <div class="section-title">SUVIDYA INSTITUTE OF TECHNOLOGY PVT. LTD.</div>
            <div class="section-sub">${esc(trainingData.title || 'Training Contents')}</div>

            <div class="info-band" style="page-break-inside:avoid;">
              <div style="margin-bottom:6px;"><b>Training Venue :</b> ${esc(trainingData.venue || '-')}</div>
              <div>${esc(trainingData.participantsDesc || '-')}</div>
            </div>

            <table class="schedule" style="margin-top:0; page-break-inside:auto;">
              <thead>
                <tr>
                  <th>Sr No.</th>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Main Topic</th>
                  <th>Sub Topics</th>
                  <th>Assessment Test</th>
                  <th>Trainer</th>
                </tr>
              </thead>
              <tbody>${trainingRowsHtml}</tbody>
            </table>

            <div class="please-note" style="page-break-inside:avoid;">
              <div style="font-weight:bold;margin-bottom:6px;color:#2e3093;">Please Note</div>
              ${pleaseNoteHtml}
            </div>

            ${renderAttachments(trainingAttachments)}
          </section>

          <section class="page" style="page-break-before:always; break-before:page; mso-page-break-before:always;">
            <div class="invoice-header" style="page-break-inside:avoid;">
              <img src="${watermarkUrl}" alt="SIT" style="width:72px;height:auto;" />
              <div>
                <div style="font-size:20px;font-weight:bold;color:#2e3093;">${esc(quotationData.recipientCompany || '-')}</div>
                <div style="font-size:12px;color:#555;margin-top:2px;">${esc(quotationData.recipientAddress || '')}</div>
              </div>
            </div>
            <div style="background:#fff28a;border:1px solid #c9c9c9;border-top:0;text-align:center;padding:10px;font-weight:bold;font-size:17px;letter-spacing:0.5px;">Proforma Invoice</div>

            <table class="info-grid" style="width:100%;border-collapse:collapse;margin-top:0; page-break-inside:avoid;">
              <tr>
                <td style="background:#f4b55e;vertical-align:top;width:55%;">
                  <div style="font-weight:600;">Company Authority</div>
                  <div style="white-space:pre-line;margin-top:2px;">${esc(quotationData.companyAuthority || '-')}</div>
                </td>
                <td style="background:#e6f2e6;width:22%;font-weight:600;">Pro. Invoice No.</td>
                <td style="background:#e6f2e6;">${esc(quotationData.proformaInvoiceNo || '-')}</td>
              </tr>
              <tr>
                <td style="background:#e6f2e6;vertical-align:top;" rowspan="2">
                  <div style="font-weight:600;">Participants Details</div>
                  <div style="white-space:pre-line;margin-top:2px;">${esc(quotationData.participantsDetails || '-')}</div>
                </td>
                <td style="background:#e6f2e6;font-weight:600;">Date</td>
                <td style="background:#e6f2e6;">${esc(quotationData.invoiceDate || '-')}</td>
              </tr>
              <tr>
                <td style="background:#e6f2e6;font-weight:600;">Participants</td>
                <td style="background:#e6f2e6;">${esc(quotationData.participants || '-')}</td>
              </tr>
              <tr>
                <td style="background:#e6f2e6;font-weight:600;">Client Ref.</td>
                <td style="background:#e6f2e6;">${esc(quotationData.clientRef || '-')}</td>
                <td style="background:#e6f2e6;font-weight:600;">Enquiry Date</td>
                <td style="background:#e6f2e6;">${esc(quotationData.enquiryDate || '-')}</td>
              </tr>
              <tr>
                <td style="background:#e6f2e6;font-weight:600;">Training Mode</td>
                <td style="background:#e6f2e6;">${esc(quotationData.trainingMode || '-')}</td>
                <td style="background:#e6f2e6;font-weight:600;">Department</td>
                <td style="background:#e6f2e6;">${esc(quotationData.department || '-')}</td>
              </tr>
              <tr>
                <td style="background:#e6f2e6;font-weight:600;">Training Location</td>
                <td style="background:#e6f2e6;" colspan="3">${esc(quotationData.trainingLocation || '-')}</td>
              </tr>
            </table>

            <table class="quote" style="margin-top:10px; page-break-inside:auto;">
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Description</th>
                  ${showBranchCol ? '<th>Branch</th>' : ''}
                  <th style="width:90px;text-align:center;">Total Days</th>
                  <th style="width:130px;text-align:right;">Per Day Cost (Rs.)</th>
                  <th style="width:130px;text-align:right;">Total Cost (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                ${quotationSectionsHtml}
                <tr>
                  <td colspan="${quoteColSpan}" style="border:1px solid #c9c9c9;padding:8px;text-align:right;font-weight:bold;">Subtotal</td>
                  <td style="border:1px solid #c9c9c9;padding:8px;text-align:right;">${fmtINR(quotationTotals.subtotal)}</td>
                </tr>
                <tr>
                  <td colspan="${quoteColSpan}" style="border:1px solid #c9c9c9;padding:8px;text-align:right;font-weight:bold;">GST @ ${esc(quotationData.gstPercent || '0')}%</td>
                  <td style="border:1px solid #c9c9c9;padding:8px;text-align:right;">${fmtINR(quotationTotals.gst)}</td>
                </tr>
                <tr style="background:#fff5b0;">
                  <td colspan="${quoteColSpan}" style="border:1px solid #c9c9c9;padding:10px;text-align:right;font-weight:bold;font-size:14px;">Grand Total (Rs.)</td>
                  <td style="border:1px solid #c9c9c9;padding:10px;text-align:right;font-weight:bold;font-size:14px;">${fmtINR(quotationTotals.grand)}</td>
                </tr>
              </tbody>
            </table>

            ${quotationData.bankDetails ? `<div class="kv-block" style="page-break-inside:avoid;"><div class="kv-title">Bank details for Payment to SIT</div><div style="white-space:pre-line;">${esc(quotationData.bankDetails)}</div></div>` : ''}
            ${quotationData.coordinator ? `<div class="kv-block" style="page-break-inside:avoid;"><div class="kv-title">SIT Coordinator Team</div><div style="white-space:pre-line;">${esc(quotationData.coordinator)}</div></div>` : ''}
            ${quotationData.notes ? `<div class="kv-block" style="page-break-inside:avoid;"><div style="white-space:pre-line;">${esc(quotationData.notes)}</div></div>` : ''}

            ${renderAttachments(quotationAttachments)}
            ${trainerCvAttachments.length > 0 ? `<div style="margin-top:18px;"><h3>TRAINER'S CV</h3>${renderAttachments(trainerCvAttachments)}</div>` : ''}
          </section>

        </body>
      </html>
    `;
  }, [proposalRefNo, proposalDate, proposalTitle, clientName, companyName, venue, aboutOrganisation, trainingData, quotationData, quotationTotals, trainingAttachments, quotationAttachments, trainerCvAttachments]);

  const saveProposal = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admission-activity/corporate-inquiry/proposal/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalRefNo,
          proposalDate,
          proposalTitle,
          clientName,
          venue,
          aboutOrganisation,
          trainingData,
          quotationData,
          trainingAttachments,
          quotationAttachments,
          trainerCvAttachments,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save proposal');
      }
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save proposal');
    } finally {
      setSaving(false);
    }
  };

  const downloadWordProposal = async () => {
    if (downloadingWord) return;
    setDownloadingWord(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const logoDataUrl = await urlToDataUrl(`${origin}/sit.png`);

      const e = (v: unknown) =>
        String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      /* ── Training rows ── */
      const trainingRowsHtml = trainingData.days.map(day => {
        const subs = day.subRows.length ? day.subRows : [{ topic: '', assessment: '', trainer: '' }];
        const rs = subs.length;
        return subs.map((sr, si) => `<tr>
          ${si === 0 ? `<td rowspan="${rs}" style="border:1pt solid #999;padding:4pt 5pt;vertical-align:top;">${e(day.date || day.label || '')}</td>` : ''}
          ${si === 0 ? `<td rowspan="${rs}" style="border:1pt solid #999;padding:4pt 5pt;vertical-align:top;">${e(day.time || '')}</td>` : ''}
          ${si === 0 ? `<td rowspan="${rs}" style="border:1pt solid #999;padding:4pt 5pt;vertical-align:top;font-weight:bold;">${e(day.mainTopic || '')}</td>` : ''}
          <td style="border:1pt solid #999;padding:4pt 5pt;">${e(sr.topic || '')}</td>
          <td style="border:1pt solid #999;padding:4pt 5pt;text-align:center;font-weight:bold;color:#CC0000;">${e(sr.assessment || '')}</td>
          <td style="border:1pt solid #999;padding:4pt 5pt;">${e(sr.trainer || '')}</td>
        </tr>`).join('');
      }).join('');

      /* ── Quotation rows ── */
      const quoteBody = quotationData.sections.map(sec => {
        const items = sec.items.map((item, iIdx) => {
          const t = toNum(item.total) > 0 ? toNum(item.total) : toNum(item.days) * toNum(item.perDay);
          return `<tr>
            <td style="border:1pt solid #999;padding:4pt 5pt;text-align:center;">${iIdx + 1}</td>
            <td style="border:1pt solid #999;padding:4pt 5pt;">${e(item.description || '')}${item.branch ? ` <b>(${e(item.branch)})</b>` : ''}</td>
            <td style="border:1pt solid #999;padding:4pt 5pt;text-align:center;">${e(item.days || 'NA')}</td>
            <td style="border:1pt solid #999;padding:4pt 5pt;text-align:right;">${item.perDay ? fmtINR(toNum(item.perDay)) : 'NA'}</td>
            <td style="border:1pt solid #999;padding:4pt 5pt;text-align:right;">${t > 0 ? fmtINR(t) : 'NA'}</td>
          </tr>`;
        }).join('');
        return `<tr style="background:#F2B860;">
          <td style="border:1pt solid #999;padding:5pt;font-weight:bold;text-align:center;">${e(sec.label)}</td>
          <td colspan="4" style="border:1pt solid #999;padding:5pt;font-weight:bold;">${e(sec.title)}</td>
        </tr>${items}`;
      }).join('');

      const headerWatermarkVml = logoDataUrl
        ? `<!--[if gte vml 1]><v:shape id="WM" type="#_x0000_t75"
  style="position:absolute;left:0;top:0;
         width:300pt;height:180pt;z-index:-251658240;
         mso-position-horizontal:center;mso-position-horizontal-relative:margin;
         mso-position-vertical:center;mso-position-vertical-relative:margin;"
  stroked="f" filled="f">
  <v:imagedata src="${logoDataUrl}" o:title="" gain="19661" blacklevel="23000"/>
  <w10:wrap type="none"/>
  <w10:anchorlock/>
</v:shape><![endif]-->`
        : '';

      const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:w10="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
@page Section1 {
  size:595.3pt 841.9pt;
  margin:80pt 50pt 70pt 50pt;
  mso-header:h1;
  mso-footer:f1;
  mso-header-margin:10pt;
  mso-footer-margin:10pt;
  mso-paper-source:0;
}
div.Section1 { page:Section1; }
body,p,td,th,li { font-family:Calibri,sans-serif; font-size:11pt; color:#1A1A1A; }
body { margin:0; padding:0; line-height:1.45; }
p { margin:0 0 3pt 0; }
table { border-collapse:collapse; }
.pgbrk { page-break-before:always; mso-break-type:section-break; }
.pgbrk { display:block; clear:both; height:0; margin:0; padding:0; page-break-before:always; break-before:page; mso-page-break-before:always; mso-break-type:section-break; }
</style>
</head>
<body>

<!-- ═══ HEADER ═══ -->
<div style="mso-element:header" id="h1">
${headerWatermarkVml}
<table style="width:100%;border:none;border-collapse:collapse;">
  <tr>
    <td style="border:none;padding:1pt 3pt;text-align:center;width:22%;">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="SIT" style="height:34pt;width:auto;"/>` : '<div style="height:34pt;"></div>'}
    </td>
    <td style="border:none;padding:1pt 3pt;text-align:center;width:18%;">
      <p style="font-size:14pt;font-weight:bold;color:#2E3093;margin:0;line-height:1;">EC</p>
      <p style="font-size:10pt;font-weight:bold;color:#2E3093;margin:0;">ITB</p>
    </td>
    <td style="border:none;padding:1pt 3pt;text-align:center;width:20%;">
      <p style="font-size:9pt;font-weight:bold;margin:0;">Skill India</p>
      <p style="font-size:7pt;color:#555;margin:0;">&#2360;&#2381;&#2325;&#2367;&#2354; &#2311;&#2306;&#2337;&#2367;&#2351;&#2366;</p>
    </td>
    <td style="border:none;padding:1pt 3pt;text-align:center;width:20%;">
      <p style="font-size:9pt;font-weight:bold;margin:0;">N&middot;S&middot;D&middot;C</p>
      <p style="font-size:7pt;color:#555;margin:0;">National Skill Development Corporation</p>
    </td>
    <td style="border:none;width:20%;"></td>
  </tr>
</table>
<p style="font-size:14pt;font-weight:bold;text-align:center;margin:0;padding:3pt 6pt;border-top:2.25pt solid #2E3093;border-bottom:0.75pt solid #AAAAAA;font-family:Calibri,sans-serif;">Suvidya Institute of Technology Pvt. Ltd.</p>
<p style="font-size:8.5pt;font-weight:bold;text-align:center;margin:0;padding:2pt 6pt;border-bottom:2.25pt solid #2E3093;background:#F0F0F0;font-family:Calibri,sans-serif;">Making Everyone Eligible For Strengthening Companies To Contribute In Making Nation Technologically Self-Reliant.</p>
</div>

<!-- ═══ FOOTER ═══ -->
<div style="mso-element:footer" id="f1">
<table style="width:100%;border:none;border-collapse:collapse;border-top:0.75pt solid #AAAAAA;">
  <tr>
    <td style="border:none;border-right:0.75pt solid #AAAAAA;padding:2pt 4pt;width:52%;vertical-align:top;">
      <p style="font-size:7.5pt;font-weight:bold;margin:0;">M/s.Suvidya Institute of Technology Pvt. Ltd.</p>
      <p style="font-size:7pt;margin:0;color:#444;">18/140, Anand Nagar, Near Vakola Police Station, Santacruz (East), Mumbai-400055, Maharashtra, <b>INDIA</b>.</p>
      <p style="font-size:7pt;margin:0;color:#444;">P:0091-22-26682290&nbsp;&nbsp;M:0091-9167219403&nbsp;&nbsp;Web:www.suvidya.ac.in</p>
    </td>
    <td style="border:none;border-right:0.75pt solid #AAAAAA;padding:2pt 5pt;width:12%;text-align:center;vertical-align:middle;">
      <p style="font-size:9pt;font-weight:bold;margin:0;">Page&nbsp;<!--[if supportFields]><span style="mso-element:field-begin"></span>PAGE<span style="mso-element:field-separator"></span><![endif]-->1<!--[if supportFields]><span style="mso-element:field-end"></span><![endif]-->&nbsp;of&nbsp;<!--[if supportFields]><span style="mso-element:field-begin"></span>NUMPAGES<span style="mso-element:field-separator"></span><![endif]-->3<!--[if supportFields]><span style="mso-element:field-end"></span><![endif]--></p>
    </td>
    <td style="border:none;padding:2pt 4pt;width:36%;vertical-align:top;">
      <p style="font-size:7pt;margin:0;color:#444;">This Training Proposal is sole property of <b>Suvidya Institute of Technology Pvt. Ltd.</b>, prepared to enhance skills of actual working. Printing and/or copying invalidate the proposal.</p>
    </td>
  </tr>
</table>
<p style="font-size:8pt;margin:1pt 0 0 0;font-family:Calibri,sans-serif;">(F/CT/03/00)</p>
</div>

<div class="Section1">

<!-- ════ PAGE 1 : ABOUT ORGANISATION ════ -->
<table style="width:100%;border:none;border-collapse:collapse;margin-bottom:10pt;">
  <tr>
    <td style="border:none;padding:0;"><b>Ref. No.</b>&nbsp;&nbsp;${e(proposalRefNo || '')}</td>
    <td style="border:none;padding:0;text-align:right;"><b>Date :</b>&nbsp;&nbsp;${e(proposalDate || '')}</td>
  </tr>
</table>

<p style="text-align:center;font-size:36pt;font-weight:bold;letter-spacing:5pt;margin:28pt 0 10pt 0;font-family:Calibri,sans-serif;">PROPOSAL</p>
<p style="text-align:center;font-size:13pt;font-weight:bold;margin:0 0 2pt 0;font-family:Calibri,sans-serif;">Corporate Training</p>
<p style="text-align:center;font-size:11pt;color:#555;margin:0 0 2pt 0;font-family:Calibri,sans-serif;">on</p>
<p style="text-align:center;font-size:16pt;font-weight:bold;margin:0 0 28pt 0;font-family:Calibri,sans-serif;">${e(proposalTitle || '')}</p>

<p style="text-align:center;margin:30pt 0 30pt 0;">
  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="SIT" style="width:160pt;height:auto;opacity:0.035;filter:alpha(opacity=4);"/>` : ''}
</p>

<table align="center" style="width:60%;border:none;border-collapse:collapse;margin:0 auto;">
  <tr>
    <td style="border:none;padding:8pt 10pt;text-align:center;border-bottom:0.75pt solid #EEEEEE;">
      <p style="font-size:11pt;font-weight:bold;margin:0 0 3pt 0;color:#555;font-family:Calibri,sans-serif;">Client</p>
      <p style="font-size:13pt;font-weight:bold;margin:0;font-family:Calibri,sans-serif;">${e(clientName || companyName || '')}</p>
    </td>
  </tr>
  <tr>
    <td style="border:none;padding:8pt 10pt;text-align:center;">
      <p style="font-size:11pt;font-weight:bold;margin:0 0 3pt 0;color:#555;font-family:Calibri,sans-serif;">Venue</p>
      <p style="font-size:12pt;margin:0;font-family:Calibri,sans-serif;">${e(venue || '')}</p>
    </td>
  </tr>
</table>

<p style="font-size:14pt;font-weight:bold;text-align:center;margin:0 0 10pt 0;padding-bottom:4pt;border-bottom:1pt solid #AAAAAA;font-family:Calibri,sans-serif;">About Our Organisation</p>
<div style="white-space:pre-wrap;font-size:11pt;line-height:1.5;text-align:justify;font-family:Calibri,sans-serif;">${e(aboutOrganisation || '')}</div>

<div class="pgbrk"></div>

<!-- ════ PAGE 2 : TRAINING CONTENTS ════ -->
<p style="background:#FFD700;text-align:center;padding:5pt 8pt;font-weight:bold;font-size:13pt;margin:0;border:0.75pt solid #999;font-family:Calibri,sans-serif;">${e((quotationData.recipientCompany || clientName || companyName || '') + (trainingData.venue || venue ? ' – ' + (trainingData.venue || venue) : ''))}</p>
<p style="background:#F5F5DC;text-align:center;padding:4pt 8pt;font-weight:bold;font-size:11pt;margin:0;border:0.75pt solid #999;border-top:none;font-family:Calibri,sans-serif;">${e(trainingData.title || proposalTitle || '')}</p>
${trainingData.participantsDesc ? `<p style="padding:4pt 8pt;font-size:11pt;margin:0;border:0.75pt solid #999;border-top:none;background:#FFFEF0;font-family:Calibri,sans-serif;"><b>Participants –</b> ${e(trainingData.participantsDesc)}</p>` : ''}

<table style="width:100%;border-collapse:collapse;font-size:11pt;margin-top:0;">
  <thead>
    <tr style="background:#F2F2F2;">
      <th style="border:0.75pt solid #999;padding:4pt 5pt;text-align:left;width:52pt;font-family:Calibri,sans-serif;">Date</th>
      <th style="border:0.75pt solid #999;padding:4pt 5pt;text-align:left;width:64pt;font-family:Calibri,sans-serif;">Time</th>
      <th style="border:0.75pt solid #999;padding:4pt 5pt;text-align:left;width:90pt;font-family:Calibri,sans-serif;">Main Topic</th>
      <th style="border:0.75pt solid #999;padding:4pt 5pt;text-align:left;font-family:Calibri,sans-serif;">Sub Topics</th>
      <th style="border:0.75pt solid #999;padding:4pt 5pt;text-align:center;width:56pt;font-family:Calibri,sans-serif;">Assessment Test</th>
      <th style="border:0.75pt solid #999;padding:4pt 5pt;text-align:left;width:65pt;font-family:Calibri,sans-serif;">Trainer</th>
    </tr>
  </thead>
  <tbody>${trainingRowsHtml}</tbody>
</table>

${trainingData.pleaseNote.length ? `<table style="width:100%;border:0.75pt solid #999;margin-top:6pt;border-collapse:collapse;">
  <tr>
    <td style="border:none;padding:5pt 8pt;font-weight:bold;vertical-align:top;width:80pt;font-family:Calibri,sans-serif;font-size:11pt;">Please Note :</td>
    <td style="border:none;padding:5pt 8pt;font-family:Calibri,sans-serif;font-size:11pt;">
      ${trainingData.pleaseNote.map((n, i) => `<p style="margin:1pt 0;">${i + 1}) ${e(n)}</p>`).join('')}
    </td>
  </tr>
</table>` : ''}

<div class="pgbrk"></div>

<!-- ════ PAGE 3 : PROFORMA INVOICE ════ -->
<table style="width:100%;border:0.75pt solid #AAAAAA;border-collapse:collapse;background:#F9F9F9;">
  <tr>
    <td style="border:none;padding:6pt 8pt;width:44pt;vertical-align:middle;">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="SIT" style="width:34pt;height:auto;"/>` : ''}
    </td>
    <td style="border:none;padding:6pt 8pt;vertical-align:middle;">
      <p style="font-size:13pt;font-weight:bold;margin:0;font-family:Calibri,sans-serif;">${e(quotationData.recipientCompany || clientName || companyName || '')}</p>
      ${quotationData.recipientAddress ? `<p style="font-size:9pt;color:#555;margin:0;font-family:Calibri,sans-serif;">${e(quotationData.recipientAddress)}</p>` : ''}
    </td>
  </tr>
</table>
<p style="background:#FFFF99;border:0.75pt solid #AAAAAA;border-top:none;text-align:center;padding:5pt;font-weight:bold;font-size:13pt;margin:0;letter-spacing:0.5pt;font-family:Calibri,sans-serif;">Proforma Invoice</p>

<table style="width:100%;border-collapse:collapse;font-size:11pt;">
  <tr>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;width:30%;vertical-align:top;">Company Authority :<br/><span style="font-weight:normal;white-space:pre-wrap;">${e(quotationData.companyAuthority || '')}</span></td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;width:20%;">Pro. Invoice No.</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;" colspan="2">${e(quotationData.proformaInvoiceNo || '')}</td>
  </tr>
  <tr>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;vertical-align:top;white-space:pre-wrap;"><b>Participants Details :</b> ${e(quotationData.participantsDetails || '')}</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;">Date</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;" colspan="2">${e(quotationData.invoiceDate || '')}</td>
  </tr>
  <tr>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;"><b>Participants :</b> ${e(quotationData.participants || '')}</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;">Client Ref.</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;">${e(quotationData.clientRef || '')}</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;"><b>Enquiry Date :</b> ${e(quotationData.enquiryDate || '')}</td>
  </tr>
  <tr>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;"><b>Training Mode :</b> ${e(quotationData.trainingMode || '')}</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;">Training Location</td>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;" colspan="2">${e(quotationData.trainingLocation || '')}</td>
  </tr>
  <tr>
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;"><b>Department :</b> ${e(quotationData.department || '')}</td>
    <td colspan="3" style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;"></td>
  </tr>
</table>

<p style="font-weight:bold;margin:5pt 0 0 0;border:0.75pt solid #AAAAAA;border-bottom:none;padding:4pt 6pt;background:#F2B860;font-family:Calibri,sans-serif;font-size:11pt;">DISCRIPTION</p>
<table style="width:100%;border-collapse:collapse;font-size:11pt;">
  <thead>
    <tr style="background:#F2B860;">
      <th style="border:0.75pt solid #AAAAAA;padding:4pt 5pt;text-align:center;width:26pt;font-family:Calibri,sans-serif;">&nbsp;</th>
      <th style="border:0.75pt solid #AAAAAA;padding:4pt 5pt;text-align:left;font-family:Calibri,sans-serif;">Description</th>
      <th style="border:0.75pt solid #AAAAAA;padding:4pt 5pt;text-align:center;width:58pt;font-family:Calibri,sans-serif;">Total Days</th>
      <th style="border:0.75pt solid #AAAAAA;padding:4pt 5pt;text-align:right;width:78pt;font-family:Calibri,sans-serif;">Per Day Cost (Rs.)</th>
      <th style="border:0.75pt solid #AAAAAA;padding:4pt 5pt;text-align:right;width:78pt;font-family:Calibri,sans-serif;">Total Cost (Rs.)</th>
    </tr>
  </thead>
  <tbody>
    ${quoteBody}
    <tr>
      <td colspan="4" style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;font-family:Calibri,sans-serif;">Training &amp; Expenses Cost Before GST</td>
      <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;text-align:right;font-weight:bold;font-family:Calibri,sans-serif;">${fmtINR(quotationTotals.subtotal)}</td>
    </tr>
    <tr>
      <td colspan="4" style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-family:Calibri,sans-serif;">Add : GST @ ${e(quotationData.gstPercent || '18')}%</td>
      <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;text-align:right;font-family:Calibri,sans-serif;">${fmtINR(quotationTotals.gst)}</td>
    </tr>
    <tr style="background:#FFFF99;">
      <td colspan="4" style="border:0.75pt solid #AAAAAA;padding:5pt 6pt;font-weight:bold;font-family:Calibri,sans-serif;">Training &amp; Expenses Cost After GST</td>
      <td style="border:0.75pt solid #AAAAAA;padding:5pt 6pt;text-align:right;font-weight:bold;font-size:12pt;font-family:Calibri,sans-serif;">${fmtINR(quotationTotals.grand)}</td>
    </tr>
  </tbody>
</table>

${`${quotationData.bankDetails ? `<table style="width:100%;border-collapse:collapse;font-size:11pt;margin-top:0;">
  <tr style="background:#F2B860;">
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;width:18pt;font-family:Calibri,sans-serif;">C</td>
    <td colspan="4" style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;font-family:Calibri,sans-serif;">Bank details for Payment &amp; Terms :</td>
  </tr>
  <tr>
    <td colspan="5" style="border:0.75pt solid #AAAAAA;padding:5pt 8pt;">
      <div style="white-space:pre-wrap;font-family:Calibri,sans-serif;font-size:11pt;">${e(quotationData.bankDetails)}</div>
    </td>
  </tr>
</table>` : ''}`}

${`${quotationData.coordinator ? `<table style="width:100%;border-collapse:collapse;font-size:11pt;margin-top:0;">
  <tr style="background:#F2B860;">
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;width:18pt;font-family:Calibri,sans-serif;">D</td>
    <td colspan="4" style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;font-family:Calibri,sans-serif;">SIT Coordinator Team :</td>
  </tr>
  <tr>
    <td colspan="5" style="border:0.75pt solid #AAAAAA;padding:5pt 8pt;">
      <div style="white-space:pre-wrap;font-family:Calibri,sans-serif;font-size:11pt;">${e(quotationData.coordinator)}</div>
    </td>
  </tr>
</table>` : ''}`}

${`${quotationData.notes ? `<table style="width:100%;border-collapse:collapse;font-size:11pt;margin-top:0;">
  <tr style="background:#F2B860;">
    <td style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;width:18pt;font-family:Calibri,sans-serif;">E</td>
    <td colspan="4" style="border:0.75pt solid #AAAAAA;padding:4pt 6pt;font-weight:bold;font-family:Calibri,sans-serif;">If Training at Company Premises, required following :</td>
  </tr>
  <tr>
    <td colspan="5" style="border:0.75pt solid #AAAAAA;padding:5pt 8pt;">
      <div style="white-space:pre-wrap;font-family:Calibri,sans-serif;font-size:11pt;">${e(quotationData.notes)}</div>
    </td>
  </tr>
</table>` : ''}`}

<table style="width:100%;border:none;border-collapse:collapse;margin-top:16pt;">
  <tr>
    <td style="border:none;width:50%;"></td>
    <td style="border:none;text-align:center;width:50%;">
      <div style="height:44pt;border-bottom:0.75pt solid #AAAAAA;width:78%;margin:0 auto;"></div>
      <p style="font-size:11pt;font-weight:bold;text-align:center;margin:3pt 0 0 0;font-family:Calibri,sans-serif;">Authorised Signatory</p>
      <p style="font-size:9pt;text-align:center;margin:1pt 0 0 0;font-family:Calibri,sans-serif;">For Suvidya Institute of Technology Pvt. Ltd.</p>
    </td>
  </tr>
</table>

</div>
</body>
</html>`;

      const blob = new Blob(['﻿', wordHtml], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeRef = (proposalRefNo || `proposal-${id}`).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
      a.href = url;
      a.download = `${safeRef || `proposal-${id}`}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download Word file');
    } finally {
      setDownloadingWord(false);
    }
  };


  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to make corporate training proposals." />;

  const tabBtn = (tab: 'about' | 'training' | 'quotation', label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-semibold rounded-t-lg border border-b-0 ${
        activeTab === tab
          ? 'bg-white text-[#2E3093] border-gray-200'
          : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Corporate Training Proposal</h2>
            <p className="text-sm text-gray-400">Create proposal as per approved format</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm"
            >
              <FaArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={downloadWordProposal}
              disabled={downloadingWord}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252778] disabled:opacity-60 text-white font-semibold text-sm"
            >
              <FaFileWord className="w-4 h-4" /> {downloadingWord ? 'Preparing...' : 'Download Word'}
            </button>
            <button
              onClick={saveProposal}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f8f4e] hover:bg-[#18703d] disabled:opacity-60 text-white font-semibold text-sm"
            >
              <FaSave className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
          {loading ? <div className="text-sm text-gray-500">Loading inquiry data...</div> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Reference No</label>
              <input className={inputClass} value={proposalRefNo} onChange={(e) => setProposalRefNo(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input className={inputClass} value={proposalDate} onChange={(e) => setProposalDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Proposal Title (On)</label>
            <input className={inputClass} value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} placeholder="Program title" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Client</label>
              <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Venue</label>
              <input className={inputClass} value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
          </div>

          <div className="border-b border-gray-200 flex gap-1 px-1">
            {tabBtn('about', 'About Organisation')}
            {tabBtn('training', 'Training Contents')}
            {tabBtn('quotation', 'Quotation')}
          </div>

          {activeTab === 'about' && (
            <div>
              <label className={labelClass}>About Our Organisation</label>
              <textarea
                className={textareaClass}
                rows={22}
                value={aboutOrganisation}
                onChange={(e) => setAboutOrganisation(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'training' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Section Title</label>
                  <input
                    className={inputClass}
                    value={trainingData.title}
                    onChange={(e) => setTrainingData((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Training Venue</label>
                  <input
                    className={inputClass}
                    value={trainingData.venue}
                    onChange={(e) => setTrainingData((p) => ({ ...p, venue: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Participants Description</label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  placeholder="e.g., 10 to 20 years experience from mix business unit - Total 20 to 25 Nos."
                  value={trainingData.participantsDesc}
                  onChange={(e) => setTrainingData((p) => ({ ...p, participantsDesc: e.target.value }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Training Schedule</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => trainingFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <FaPlus className="w-3 h-3" /> Attach
                    </button>
                    <input
                      ref={trainingFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        await handleAttachmentUpload(e.target.files, setTrainingAttachments);
                        if (e.target) e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTrainingData((p) => ({
                          ...p,
                          days: [
                            ...p.days,
                            {
                              label: `Day ${p.days.length + 1}`,
                              date: '',
                              dayName: '',
                              time: '9:00am to 5:00pm',
                              mainTopic: '',
                              subRows: [{ topic: '', assessment: '', trainer: '' }],
                            },
                          ],
                        }))
                      }
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <FaPlus className="w-3 h-3" /> Add Day
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {trainingData.days.map((day, dIdx) => (
                    <div key={dIdx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <input
                          className={inputClass}
                          placeholder="Day Label"
                          value={day.label}
                          onChange={(e) =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.map((d, i) => (i === dIdx ? { ...d, label: e.target.value } : d)),
                            }))
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder="Date"
                          value={day.date}
                          onChange={(e) =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.map((d, i) => (i === dIdx ? { ...d, date: e.target.value } : d)),
                            }))
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder="Day Name"
                          value={day.dayName}
                          onChange={(e) =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.map((d, i) => (i === dIdx ? { ...d, dayName: e.target.value } : d)),
                            }))
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder="Time"
                          value={day.time}
                          onChange={(e) =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.map((d, i) => (i === dIdx ? { ...d, time: e.target.value } : d)),
                            }))
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder="Main Topic"
                          value={day.mainTopic}
                          onChange={(e) =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.map((d, i) => (i === dIdx ? { ...d, mainTopic: e.target.value } : d)),
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        {day.subRows.map((sr, srIdx) => (
                          <div key={srIdx} className="grid grid-cols-12 gap-2">
                            <input
                              className={`${inputClass} col-span-6`}
                              placeholder="Sub Topic"
                              value={sr.topic}
                              onChange={(e) =>
                                setTrainingData((p) => ({
                                  ...p,
                                  days: p.days.map((d, i) =>
                                    i === dIdx
                                      ? {
                                          ...d,
                                          subRows: d.subRows.map((s, j) =>
                                            j === srIdx ? { ...s, topic: e.target.value } : s
                                          ),
                                        }
                                      : d
                                  ),
                                }))
                              }
                            />
                            <input
                              className={`${inputClass} col-span-2`}
                              placeholder="Assessment"
                              value={sr.assessment}
                              onChange={(e) =>
                                setTrainingData((p) => ({
                                  ...p,
                                  days: p.days.map((d, i) =>
                                    i === dIdx
                                      ? {
                                          ...d,
                                          subRows: d.subRows.map((s, j) =>
                                            j === srIdx ? { ...s, assessment: e.target.value } : s
                                          ),
                                        }
                                      : d
                                  ),
                                }))
                              }
                            />
                            <input
                              className={`${inputClass} col-span-3`}
                              placeholder="Trainer"
                              value={sr.trainer}
                              onChange={(e) =>
                                setTrainingData((p) => ({
                                  ...p,
                                  days: p.days.map((d, i) =>
                                    i === dIdx
                                      ? {
                                          ...d,
                                          subRows: d.subRows.map((s, j) =>
                                            j === srIdx ? { ...s, trainer: e.target.value } : s
                                          ),
                                        }
                                      : d
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setTrainingData((p) => ({
                                  ...p,
                                  days: p.days.map((d, i) =>
                                    i === dIdx
                                      ? { ...d, subRows: d.subRows.filter((_, j) => j !== srIdx) }
                                      : d
                                  ),
                                }))
                              }
                              className="col-span-1 p-2 rounded border border-gray-200 hover:bg-red-50 text-red-500 flex justify-center"
                              title="Delete sub-topic"
                            >
                              <FaTrash className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.map((d, i) =>
                                i === dIdx
                                  ? { ...d, subRows: [...d.subRows, { topic: '', assessment: '', trainer: '' }] }
                                  : d
                              ),
                            }))
                          }
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                        >
                          <FaPlus className="w-3 h-3" /> Add Sub-topic
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTrainingData((p) => ({
                              ...p,
                              days: p.days.filter((_, i) => i !== dIdx),
                            }))
                          }
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 text-red-500"
                        >
                          <FaTrash className="w-3 h-3" /> Remove Day
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Please Note</label>
                  <button
                    type="button"
                    onClick={() =>
                      setTrainingData((p) => ({ ...p, pleaseNote: [...p.pleaseNote, ''] }))
                    }
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    <FaPlus className="w-3 h-3" /> Add Note
                  </button>
                </div>
                <div className="space-y-2">
                  {trainingData.pleaseNote.map((note, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs text-gray-400 pt-2">{i + 1})</span>
                      <input
                        className={inputClass}
                        value={note}
                        onChange={(e) =>
                          setTrainingData((p) => ({
                            ...p,
                            pleaseNote: p.pleaseNote.map((n, j) => (j === i ? e.target.value : n)),
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTrainingData((p) => ({
                            ...p,
                            pleaseNote: p.pleaseNote.filter((_, j) => j !== i),
                          }))
                        }
                        className="p-2 rounded border border-gray-200 hover:bg-red-50 text-red-500"
                        title="Remove note"
                      >
                        <FaTrash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {trainingAttachments.length > 0 && (
                <div>
                  <label className={labelClass}>Attachments</label>
                  <ul className="space-y-1">
                    {trainingAttachments.map((att, idx) => (
                      <li key={idx} className="flex items-center justify-between text-xs border border-gray-200 rounded px-2 py-1">
                        <span className="truncate">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setTrainingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title="Remove attachment"
                        >
                          <FaTrash className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quotation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Recipient Company</label>
                  <input
                    className={inputClass}
                    value={quotationData.recipientCompany}
                    onChange={(e) => setQuotationData((p) => ({ ...p, recipientCompany: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Pro. Invoice No.</label>
                  <input
                    className={inputClass}
                    value={quotationData.proformaInvoiceNo}
                    onChange={(e) => setQuotationData((p) => ({ ...p, proformaInvoiceNo: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Recipient Address</label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={quotationData.recipientAddress}
                  onChange={(e) => setQuotationData((p) => ({ ...p, recipientAddress: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>Company Authority (To:)</label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  placeholder="To : Mr. Name (Designation)"
                  value={quotationData.companyAuthority}
                  onChange={(e) => setQuotationData((p) => ({ ...p, companyAuthority: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>Participants Details</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={quotationData.participantsDetails}
                  onChange={(e) => setQuotationData((p) => ({ ...p, participantsDetails: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    className={inputClass}
                    value={quotationData.invoiceDate}
                    onChange={(e) => setQuotationData((p) => ({ ...p, invoiceDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Enquiry Date</label>
                  <input
                    className={inputClass}
                    value={quotationData.enquiryDate}
                    onChange={(e) => setQuotationData((p) => ({ ...p, enquiryDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Participants</label>
                  <input
                    className={inputClass}
                    value={quotationData.participants}
                    onChange={(e) => setQuotationData((p) => ({ ...p, participants: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Client Ref.</label>
                  <input
                    className={inputClass}
                    value={quotationData.clientRef}
                    onChange={(e) => setQuotationData((p) => ({ ...p, clientRef: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Training Mode</label>
                  <input
                    className={inputClass}
                    value={quotationData.trainingMode}
                    onChange={(e) => setQuotationData((p) => ({ ...p, trainingMode: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Department</label>
                  <input
                    className={inputClass}
                    value={quotationData.department}
                    onChange={(e) => setQuotationData((p) => ({ ...p, department: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Training Location</label>
                <input
                  className={inputClass}
                  value={quotationData.trainingLocation}
                  onChange={(e) => setQuotationData((p) => ({ ...p, trainingLocation: e.target.value }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Quotation Sections</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => quotationFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <FaPlus className="w-3 h-3" /> Attach
                    </button>
                    <input
                      ref={quotationFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        await handleAttachmentUpload(e.target.files, setQuotationAttachments);
                        if (e.target) e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setQuotationData((p) => {
                          const nextLabel = String.fromCharCode(65 + p.sections.length);
                          return {
                            ...p,
                            sections: [
                              ...p.sections,
                              { label: nextLabel, title: 'New Section', items: [{ description: '', days: '', perDay: '', total: '' }] },
                            ],
                          };
                        });
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <FaPlus className="w-3 h-3" /> Add Section
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {quotationData.sections.map((section, sIdx) => (
                    <div key={sIdx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input
                          className={`${inputClass} col-span-1`}
                          value={section.label}
                          onChange={(e) =>
                            setQuotationData((p) => ({
                              ...p,
                              sections: p.sections.map((s, i) => (i === sIdx ? { ...s, label: e.target.value } : s)),
                            }))
                          }
                        />
                        <input
                          className={`${inputClass} col-span-10`}
                          placeholder="Section Title"
                          value={section.title}
                          onChange={(e) =>
                            setQuotationData((p) => ({
                              ...p,
                              sections: p.sections.map((s, i) => (i === sIdx ? { ...s, title: e.target.value } : s)),
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQuotationData((p) => ({
                              ...p,
                              sections: p.sections.filter((_, i) => i !== sIdx),
                            }))
                          }
                          className="col-span-1 p-2 rounded border border-gray-200 hover:bg-red-50 text-red-500 flex justify-center"
                          title="Remove section"
                        >
                          <FaTrash className="w-3 h-3" />
                        </button>
                      </div>

                      {section.items.map((item, iIdx) => {
                        const computedTotal = toNum(item.total) > 0 ? toNum(item.total) : toNum(item.days) * toNum(item.perDay);
                        return (
                          <div key={iIdx} className="grid grid-cols-12 gap-2">
                            <input
                              className={`${inputClass} col-span-4`}
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) =>
                                setQuotationData((p) => ({
                                  ...p,
                                  sections: p.sections.map((s, i) =>
                                    i === sIdx
                                      ? {
                                          ...s,
                                          items: s.items.map((it, j) => (j === iIdx ? { ...it, description: e.target.value } : it)),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <input
                              className={`${inputClass} col-span-2`}
                              placeholder="Branch (optional)"
                              value={item.branch || ''}
                              onChange={(e) =>
                                setQuotationData((p) => ({
                                  ...p,
                                  sections: p.sections.map((s, i) =>
                                    i === sIdx
                                      ? {
                                          ...s,
                                          items: s.items.map((it, j) => (j === iIdx ? { ...it, branch: e.target.value } : it)),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <input
                              className={`${inputClass} col-span-1`}
                              placeholder="Days"
                              value={item.days}
                              onChange={(e) =>
                                setQuotationData((p) => ({
                                  ...p,
                                  sections: p.sections.map((s, i) =>
                                    i === sIdx
                                      ? {
                                          ...s,
                                          items: s.items.map((it, j) => (j === iIdx ? { ...it, days: e.target.value } : it)),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <input
                              className={`${inputClass} col-span-2`}
                              placeholder="Per Day"
                              value={item.perDay}
                              onChange={(e) =>
                                setQuotationData((p) => ({
                                  ...p,
                                  sections: p.sections.map((s, i) =>
                                    i === sIdx
                                      ? {
                                          ...s,
                                          items: s.items.map((it, j) => (j === iIdx ? { ...it, perDay: e.target.value } : it)),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <input
                              className={`${inputClass} col-span-2`}
                              placeholder={computedTotal ? fmtINR(computedTotal) : 'Total'}
                              value={item.total}
                              onChange={(e) =>
                                setQuotationData((p) => ({
                                  ...p,
                                  sections: p.sections.map((s, i) =>
                                    i === sIdx
                                      ? {
                                          ...s,
                                          items: s.items.map((it, j) => (j === iIdx ? { ...it, total: e.target.value } : it)),
                                        }
                                      : s
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setQuotationData((p) => ({
                                  ...p,
                                  sections: p.sections.map((s, i) =>
                                    i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s
                                  ),
                                }))
                              }
                              className="col-span-1 p-2 rounded border border-gray-200 hover:bg-red-50 text-red-500 flex justify-center"
                              title="Remove item"
                            >
                              <FaTrash className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setQuotationData((p) => ({
                              ...p,
                              sections: p.sections.map((s, i) =>
                                i === sIdx
                                  ? { ...s, items: [...s.items, { description: '', days: '', perDay: '', total: '', branch: '' }] }
                                  : s
                              ),
                            }))
                          }
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                        >
                          <FaPlus className="w-3 h-3" /> Add Item
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const raw = window.prompt('Enter branch names separated by commas (one line item will be added per branch):');
                            if (!raw) return;
                            const branches = raw
                              .split(',')
                              .map((b) => b.trim())
                              .filter((b) => b.length > 0);
                            if (branches.length === 0) return;
                            setQuotationData((p) => ({
                              ...p,
                              sections: p.sections.map((s, i) => {
                                if (i !== sIdx) return s;
                                const template = s.items[s.items.length - 1] || { description: '', days: '', perDay: '', total: '', branch: '' };
                                const newItems = branches.map((b) => ({
                                  description: template.description || '',
                                  days: template.days || '',
                                  perDay: template.perDay || '',
                                  total: '',
                                  branch: b,
                                }));
                                return { ...s, items: [...s.items, ...newItems] };
                              }),
                            }));
                          }}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#1f8f4e] text-[#1f8f4e] hover:bg-green-50"
                        >
                          <FaPlus className="w-3 h-3" /> Add by Branches
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="text-gray-500">Subtotal</div>
                    <div className="text-lg font-bold">₹ {fmtINR(quotationTotals.subtotal)}</div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <label className={labelClass}>GST %</label>
                    <input
                      className={inputClass}
                      value={quotationData.gstPercent}
                      onChange={(e) => setQuotationData((p) => ({ ...p, gstPercent: e.target.value }))}
                    />
                    <div className="text-xs text-gray-500 mt-1">GST Amount: ₹ {fmtINR(quotationTotals.gst)}</div>
                  </div>
                  <div className="border border-[#1f8f4e] bg-green-50 rounded-lg p-3">
                    <div className="text-gray-500">Grand Total</div>
                    <div className="text-lg font-bold text-[#1f8f4e]">₹ {fmtINR(quotationTotals.grand)}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Bank Details</label>
                <textarea
                  className={textareaClass}
                  rows={5}
                  value={quotationData.bankDetails}
                  onChange={(e) => setQuotationData((p) => ({ ...p, bankDetails: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>SIT Coordinator Team</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  placeholder="Name | Mobile | Email"
                  value={quotationData.coordinator}
                  onChange={(e) => setQuotationData((p) => ({ ...p, coordinator: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>Additional Notes</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={quotationData.notes}
                  onChange={(e) => setQuotationData((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {quotationAttachments.length > 0 && (
                <div>
                  <label className={labelClass}>Attachments</label>
                  <ul className="space-y-1">
                    {quotationAttachments.map((att, idx) => (
                      <li key={idx} className="flex items-center justify-between text-xs border border-gray-200 rounded px-2 py-1">
                        <span className="truncate">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setQuotationAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title="Remove attachment"
                        >
                          <FaTrash className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Trainer&apos;s CV</label>
                  <button
                    type="button"
                    onClick={() => trainerCvFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    <FaPlus className="w-3 h-3" /> Attach
                  </button>
                  <input
                    ref={trainerCvFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      await handleAttachmentUpload(e.target.files, setTrainerCvAttachments);
                      if (e.target) e.target.value = '';
                    }}
                  />
                </div>
                {trainerCvAttachments.length === 0 ? (
                  <div className="text-xs text-gray-400">No CV attached yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {trainerCvAttachments.map((att, idx) => (
                      <li key={idx} className="flex items-center justify-between text-xs border border-gray-200 rounded px-2 py-1">
                        <span className="truncate">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setTrainerCvAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title="Remove attachment"
                        >
                          <FaTrash className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={previewRef} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Live Preview</div>
          <iframe title="Proposal Preview" className="w-full h-[900px] border border-gray-200 rounded-lg" srcDoc={previewHtml} />
        </div>
      </div>
    </div>
  );
}
