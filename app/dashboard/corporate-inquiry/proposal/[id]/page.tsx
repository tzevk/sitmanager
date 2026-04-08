'use client';

import React, { useEffect, useMemo, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaDownload, FaPlus, FaTrash } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type QuotationRow = {
  particulars: string;
  duration: string;
  fee: string;
};

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

function todayDisplay(): string {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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
  const [trainingContents, setTrainingContents] = useState('');

  const [aboutOrganisation, setAboutOrganisation] = useState(DEFAULT_ABOUT_ORGANISATION);

  const [quotationRows, setQuotationRows] = useState<QuotationRow[]>([
    { particulars: '', duration: '', fee: '' },
  ]);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadInquiry() {
      try {
        const res = await fetch(`/api/admission-activity/corporate-inquiry/${id}`, { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !alive) return;

        const inq = data?.inquiry || {};
        const inqCompany = String(inq.CompanyName || '').trim();
        const inqVenue = String(inq.Place || '').trim();
        const inqCourse = String(inq.Course_Id || '').trim();
        const inqReq = String(inq.Discussion || inq.Remark || '').trim();

        setCompanyName(inqCompany);
        setVenue(inqVenue);
        setClientName(inqCompany);
        setProposalTitle(inqCourse || 'Corporate Training Program');
        setTrainingContents(inqReq);
      } catch {
        // Ignore and allow manual form filling.
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadInquiry();
    return () => {
      alive = false;
    };
  }, [id]);

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';
  const labelClass = 'block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1';
  const textareaClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';

  const previewHtml = useMemo(() => {
    const esc = (v: string) =>
      v
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const quotationRowsHtml = quotationRows
      .map(
        (row, idx) =>
          `<tr><td style="border:1px solid #ccc;padding:6px;">${idx + 1}</td><td style="border:1px solid #ccc;padding:6px;">${esc(row.particulars || '-')}</td><td style="border:1px solid #ccc;padding:6px;">${esc(row.duration || '-')}</td><td style="border:1px solid #ccc;padding:6px;">${esc(row.fee || '-')}</td></tr>`
      )
      .join('');

    const trainingLines = (trainingContents || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<li>${esc(line)}</li>`)
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Corporate Training Proposal</title>
        </head>
        <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.45; padding: 22px;">
          <div style="display:flex; justify-content:space-between; font-size: 14px; margin-bottom: 16px;">
            <div><b>Ref. No.</b> ${esc(proposalRefNo || '-')}</div>
            <div><b>Date</b> ${esc(proposalDate || '-')}</div>
          </div>

          <h1 style="text-align:center; margin:0; letter-spacing:1px;">PROPOSAL</h1>
          <h2 style="text-align:center; margin:8px 0 0; font-size:18px;">Corporate Training</h2>
          <div style="text-align:center; margin-top:4px;">on</div>
          <h3 style="text-align:center; margin:8px 0 18px; font-size:20px;">${esc(proposalTitle || '-')}</h3>

          <div style="text-align:center; margin-bottom:4px;"><b>Client</b></div>
          <div style="text-align:center; margin-bottom:10px;">${esc(clientName || companyName || '-')}</div>

          <div style="text-align:center; margin-bottom:4px;"><b>Venue</b></div>
          <div style="text-align:center; margin-bottom:18px;">${esc(venue || '-')}</div>

          <h3>About Our Organisation</h3>
          <div style="white-space: pre-line; margin-bottom: 12px;">${esc(aboutOrganisation || '-')}</div>

          <h3 style="margin-top:22px;">TRAINING CONTENTS:</h3>
          <ul>${trainingLines || '<li>-</li>'}</ul>

          <h3 style="margin-top:22px;">QUOTATION:</h3>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="border:1px solid #ccc;padding:6px; text-align:left;">Sr.</th>
                <th style="border:1px solid #ccc;padding:6px; text-align:left;">Particulars</th>
                <th style="border:1px solid #ccc;padding:6px; text-align:left;">Duration</th>
                <th style="border:1px solid #ccc;padding:6px; text-align:left;">Fees</th>
              </tr>
            </thead>
            <tbody>${quotationRowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;
  }, [proposalRefNo, proposalDate, proposalTitle, clientName, companyName, venue, aboutOrganisation, trainingContents, quotationRows]);

  const generatePreview = () => {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const downloadPreviewDocx = async () => {
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalRefNo,
          proposalDate,
          proposalTitle,
          clientName,
          venue,
          trainingContents,
          quotationRows,
          aboutOrganisation,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate DOCX preview');
      }

      const blob = await res.blob();
      const safeClient = (clientName || companyName || 'client').replace(/[^a-zA-Z0-9]+/g, '-');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `corporate-training-preview-${safeClient}.docx`;
      link.click();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download DOCX preview');
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to make corporate training proposals." />;

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
              onClick={generatePreview}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2A6BB5] hover:bg-[#2360A0] text-white font-semibold text-sm"
            >
              Generate Preview
            </button>
            <button
              onClick={downloadPreviewDocx}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f8f4e] hover:bg-[#18703d] text-white font-semibold text-sm"
            >
              <FaDownload className="w-4 h-4" /> Download Preview DOCX
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

          <div>
            <label className={labelClass}>About Our Organisation</label>
            <textarea className={textareaClass} rows={18} value={aboutOrganisation} onChange={(e) => setAboutOrganisation(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Training Contents (one item per line)</label>
            <textarea className={textareaClass} rows={6} value={trainingContents} onChange={(e) => setTrainingContents(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Quotation</label>
              <button
                type="button"
                onClick={() => setQuotationRows((prev) => [...prev, { particulars: '', duration: '', fee: '' }])}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              >
                <FaPlus className="w-3 h-3" /> Add Row
              </button>
            </div>
            <div className="space-y-2">
              {quotationRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input
                      className={inputClass}
                      placeholder="Particulars"
                      value={row.particulars}
                      onChange={(e) =>
                        setQuotationRows((prev) => prev.map((r, i) => (i === idx ? { ...r, particulars: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      className={inputClass}
                      placeholder="Duration"
                      value={row.duration}
                      onChange={(e) =>
                        setQuotationRows((prev) => prev.map((r, i) => (i === idx ? { ...r, duration: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      className={inputClass}
                      placeholder="Fees"
                      value={row.fee}
                      onChange={(e) =>
                        setQuotationRows((prev) => prev.map((r, i) => (i === idx ? { ...r, fee: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setQuotationRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 rounded border border-gray-200 hover:bg-red-50 text-red-500"
                      title="Delete row"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div ref={previewRef} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Live Preview</div>
          <iframe title="Proposal Preview" className="w-full h-[900px] border border-gray-200 rounded-lg" srcDoc={previewHtml} />
        </div>
      </div>
    </div>
  );
}
