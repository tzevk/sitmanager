'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

type BatchOption = {
  id: number;
  code: string;
  course: string;
  studentCount: number;
};

type ProgramOption = {
  id: number;
  name: string;
  batchCount: number;
  studentCount: number;
};

type StudentOption = {
  id: number;
  name: string;
  mobile: string;
  email: string;
};

type DocumentSlot = {
  key: string;
  label: string;
  group: string;
  hint: string;
};

type DocumentDraft = DocumentSlot & {
  file: File | null;
};

const documentSlots: DocumentSlot[] = [
  { key: 'id_aadhar', label: 'Aadhar Card', group: 'Identity Proof', hint: 'PDF, JPG, PNG, or WebP' },
  { key: 'id_pan', label: 'PAN Card', group: 'Identity Proof', hint: 'Optional if not available' },
  { key: 'ssc_marksheet', label: 'SSC Marksheet / Certificate', group: 'Academic Documents', hint: '10th standard proof' },
  { key: 'hsc_marksheet', label: 'HSC Marksheet / Certificate', group: 'Academic Documents', hint: '12th standard proof' },
  { key: 'diploma_marksheet', label: 'Diploma Marksheet / Certificate', group: 'Academic Documents', hint: 'Diploma / ITI proof' },
  { key: 'graduation_marksheet', label: 'Graduation Marksheet / Certificate', group: 'Academic Documents', hint: 'Degree marksheet or certificate' },
  { key: 'postgraduation_marksheet', label: 'Post-Graduation Marksheet / Certificate', group: 'Academic Documents', hint: 'PG marksheet or certificate' },
  { key: 'kt_marksheet', label: 'KT / Backlog Marksheet', group: 'KT Documents', hint: 'Upload only if applicable' },
  { key: 'leaving_certificate', label: 'Leaving Certificate', group: 'Supporting Documents', hint: 'Optional supporting proof' },
  { key: 'other_document', label: 'Other Document', group: 'Supporting Documents', hint: 'Any extra required document' },
];

const groupedSlots = documentSlots.reduce<Record<string, DocumentSlot[]>>((acc, slot) => {
  acc[slot.group] = [...(acc[slot.group] || []), slot];
  return acc;
}, {});

function fileSizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function makeEmptyDocuments(): DocumentDraft[] {
  return documentSlots.map((slot) => ({ ...slot, file: null }));
}

export default function StudentCapturePage() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentDraft[]>(makeEmptyDocuments);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === studentId) || null,
    [students, studentId]
  );
  const selectedDocs = documents.filter((doc) => doc.file);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrograms(true);
    fetch('/api/public/student-capture/options')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPrograms(Array.isArray(data?.programs) ? data.programs : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load training programs. Please refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPrograms(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!programId) {
      setBatches([]);
      setBatchId('');
      setStudents([]);
      setStudentId('');
      return;
    }

    let cancelled = false;
    setLoadingBatches(true);
    setBatchId('');
    setStudents([]);
    setStudentId('');
    fetch(`/api/public/student-capture/options?courseId=${encodeURIComponent(programId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBatches(Array.isArray(data?.batches) ? data.batches : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load batches for this training program.');
      })
      .finally(() => {
        if (!cancelled) setLoadingBatches(false);
      });

    return () => {
      cancelled = true;
    };
  }, [programId]);

  useEffect(() => {
    if (!batchId) {
      setStudents([]);
      setStudentId('');
      return;
    }

    let cancelled = false;
    setLoadingStudents(true);
    setStudentId('');
    fetch(`/api/public/student-capture/options?batchId=${encodeURIComponent(batchId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStudents(Array.isArray(data?.students) ? data.students : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load students for this batch.');
      })
      .finally(() => {
        if (!cancelled) setLoadingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const updateDocumentFile = (key: string, file: File | null) => {
    setError('');
    setDocuments((prev) => prev.map((doc) => (doc.key === key ? { ...doc, file } : doc)));
  };

  const resetUploads = () => {
    setPhotoFile(null);
    setDocuments(makeEmptyDocuments());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!programId || !batchId || !studentId) {
      setError('Select a training program, batch code, and student first.');
      return;
    }
    if (!photoFile) {
      setError('Take or upload the student photo.');
      return;
    }
    if (selectedDocs.length === 0) {
      setError('Upload at least one student document.');
      return;
    }

    const body = new FormData();
    body.append('batchId', batchId);
    body.append('studentId', studentId);
    body.append('photo', photoFile);
    for (const doc of selectedDocs) {
      if (!doc.file) continue;
      body.append('documents', doc.file);
      body.append('docNames', doc.label);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/student-capture/upload', {
        method: 'POST',
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Upload failed');
      setSuccess(data?.message || 'Uploaded successfully.');
      resetUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="border-b border-[#2E3093]/10 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/sit.png" alt="SIT" width={52} height={52} className="rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-slate-100" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2E3093]/65">Student capture</p>
              <h1 className="text-xl font-black tracking-tight text-[#2E3093] sm:text-3xl">Photo & Documents Upload</h1>
            </div>
          </div>
          <div className="hidden rounded-xl bg-emerald-50 px-4 py-2 text-right text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 sm:block">
            All batches
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2E3093]/60">Step 1</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Select Student Details</h2>
                <p className="mt-1 text-sm text-slate-500">Select a training program, batch code, and student from all available batches.</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Training Program</span>
                <select
                  value={programId}
                  onChange={(event) => setProgramId(event.target.value)}
                  disabled={loadingPrograms}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none ring-[#2E3093]/15 transition focus:border-[#2E3093] focus:ring-4 disabled:bg-slate-50"
                  required
                >
                  <option value="">{loadingPrograms ? 'Loading programs...' : 'Select training program'}</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name} ({program.batchCount} batches, {program.studentCount} students)
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Batch Code</span>
                <select
                  value={batchId}
                  onChange={(event) => setBatchId(event.target.value)}
                  disabled={!programId || loadingBatches}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none ring-[#2E3093]/15 transition focus:border-[#2E3093] focus:ring-4 disabled:bg-slate-50"
                  required
                >
                  <option value="">{loadingBatches ? 'Loading batches...' : 'Select batch code'}</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.code} ({batch.studentCount} students)
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Student</span>
                <select
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  disabled={!batchId || loadingStudents}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none ring-[#2E3093]/15 transition focus:border-[#2E3093] focus:ring-4 disabled:bg-slate-50"
                  required
                >
                  <option value="">{loadingStudents ? 'Loading students...' : 'Select student'}</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name || `Student ${student.id}`} {student.mobile ? `- ${student.mobile}` : ''} (ID: {student.id})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedStudent && (
              <div className="mt-4 rounded-2xl border border-[#2E3093]/10 bg-[#2E3093]/5 p-4">
                <p className="text-base font-black text-[#2E3093]">{selectedStudent.name}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-slate-600">
                  <span>Student ID: {selectedStudent.id}</span>
                  {selectedStudent.mobile && <span>Mobile: {selectedStudent.mobile}</span>}
                  {selectedStudent.email && <span>Email: {selectedStudent.email}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2E3093]/60">Step 2</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Student Photo</h2>
              <p className="mt-1 text-sm text-slate-500">Open this link on a phone to take a fresh ID-card photo.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                {photoFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(photoFile)} alt="Student preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center text-slate-400">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">+</div>
                    <p className="text-xs font-bold">Photo required</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center gap-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#2E3093]/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#2E3093]"
                  required
                />
                <p className="text-xs text-slate-500">Accepted formats: JPG, PNG, WebP. Maximum 5 MB.</p>
                {photoFile && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                    <span className="truncate">{photoFile.name} - {fileSizeLabel(photoFile.size)}</span>
                    <button type="button" onClick={() => setPhotoFile(null)} className="ml-3 text-red-600">Remove</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2E3093]/60">Step 3</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Admission Documents</h2>
              <p className="mt-1 text-sm text-slate-500">Documents are grouped like the online admission form and saved to the selected student Documents tab.</p>
            </div>

            <div className="space-y-5">
              {Object.entries(groupedSlots).map(([group, slots]) => (
                <div key={group} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <h3 className="mb-3 text-sm font-black text-slate-800">{group}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {slots.map((slot) => {
                      const draft = documents.find((doc) => doc.key === slot.key);
                      return (
                        <div key={slot.key} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-slate-800">{slot.label}</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{slot.hint}</p>
                            </div>
                            {draft?.file && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Selected</span>}
                          </div>
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            capture="environment"
                            onChange={(event) => updateDocumentFile(slot.key, event.target.files?.[0] || null)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[#2E3093]/10 file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-[#2E3093]"
                          />
                          {draft?.file && (
                            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                              <span className="truncate">{draft.file.name} - {fileSizeLabel(draft.file.size)}</span>
                              <button type="button" onClick={() => updateDocumentFile(slot.key, null)} className="text-red-600">Remove</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-base font-black text-slate-950">Submission Status</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">These files will reflect in the student profile and the saved photo will be used by ID-card import.</p>

          <div className="mt-4 space-y-2 text-xs font-bold">
            <div className={`rounded-xl px-3 py-2 ${programId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Training program selected</div>
            <div className={`rounded-xl px-3 py-2 ${batchId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Batch selected</div>
            <div className={`rounded-xl px-3 py-2 ${studentId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Student selected</div>
            <div className={`rounded-xl px-3 py-2 ${photoFile ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Photo captured</div>
            <div className={`rounded-xl px-3 py-2 ${selectedDocs.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>{selectedDocs.length} document{selectedDocs.length === 1 ? '' : 's'} selected</div>
          </div>

          {error && <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100">{error}</div>}
          {success && <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">{success}</div>}

          <button
            type="submit"
            disabled={submitting || !programId || !batchId || !studentId || !photoFile || selectedDocs.length === 0}
            className="mt-4 w-full rounded-xl bg-[#2E3093] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#252780] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? 'Uploading...' : 'Save to Student Profile'}
          </button>

          <button
            type="button"
            onClick={resetUploads}
            disabled={submitting || (!photoFile && selectedDocs.length === 0)}
            className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear Selected Files
          </button>
        </aside>
      </form>
    </main>
  );
}
