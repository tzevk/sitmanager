'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

type BatchOption = {
  id: number;
  code: string;
  course: string;
  studentCount: number;
};

type StudentOption = {
  id: number;
  name: string;
  mobile: string;
  email: string;
};

type DocumentDraft = {
  id: string;
  file: File;
  name: string;
};

const documentLabels = [
  'Aadhar Card',
  'PAN Card',
  'SSC Marksheet',
  'HSC Marksheet',
  'Diploma Marksheet',
  'Graduation Marksheet',
  'Post Graduation Marksheet',
  'Leaving Certificate',
  'Other Document',
];

function fileSizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function StudentCapturePage() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [batchId, setBatchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === studentId) || null,
    [students, studentId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingBatches(true);
    fetch('/api/public/student-capture/options')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBatches(Array.isArray(data?.batches) ? data.batches : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load batches. Please refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingBatches(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const addDocuments = (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    setDocuments((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: documentLabels.includes(file.name) ? file.name : file.name.replace(/\.[^.]+$/, '') || 'Document',
      })),
    ]);
  };

  const updateDocumentName = (id: string, name: string) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, name } : doc)));
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const resetUploads = () => {
    setPhotoFile(null);
    setDocuments([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!batchId || !studentId) {
      setError('Select batch and student first.');
      return;
    }
    if (!photoFile) {
      setError('Take or upload the student photo.');
      return;
    }
    if (documents.length === 0) {
      setError('Add at least one student document.');
      return;
    }

    const body = new FormData();
    body.append('batchId', batchId);
    body.append('studentId', studentId);
    body.append('photo', photoFile);
    for (const doc of documents) {
      body.append('documents', doc.file);
      body.append('docNames', doc.name.trim() || doc.file.name.replace(/\.[^.]+$/, '') || 'Document');
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
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7fbff_0%,#eef5f3_48%,#fff8ed_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <Image src="/sit.png" alt="SIT" width={48} height={48} className="h-12 w-12 rounded-xl bg-white object-contain p-1 shadow-sm" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2E3093]/70">Suvidya Institute</p>
              <h1 className="text-lg font-black tracking-tight text-[#2E3093] sm:text-2xl">Student Photo & Documents</h1>
            </div>
          </div>
          <div className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 sm:block">
            Public Upload Link
          </div>
        </header>

        <form onSubmit={handleSubmit} className="grid flex-1 gap-4 lg:grid-cols-[1fr_340px]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Select Student</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Choose the batch first, then select the student details.</p>
                </div>
                <span className="rounded-full bg-[#2E3093]/8 px-3 py-1 text-[11px] font-bold text-[#2E3093]">Step 1</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Batch</span>
                  <select
                    value={batchId}
                    onChange={(event) => setBatchId(event.target.value)}
                    disabled={loadingBatches}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-[#2E3093]/15 transition focus:border-[#2E3093] focus:ring-4 disabled:bg-slate-50"
                    required
                  >
                    <option value="">{loadingBatches ? 'Loading batches...' : 'Select batch'}</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.code} {batch.course ? `- ${batch.course}` : ''} ({batch.studentCount})
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-[#2E3093]/15 transition focus:border-[#2E3093] focus:ring-4 disabled:bg-slate-50"
                    required
                  >
                    <option value="">{loadingStudents ? 'Loading students...' : 'Select student'}</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>{student.name || `Student ${student.id}`}</option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedStudent && (
                <div className="mt-4 rounded-xl border border-[#2E3093]/10 bg-[#2E3093]/5 p-3">
                  <p className="text-sm font-black text-[#2E3093]">{selectedStudent.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                    <span>ID: {selectedStudent.id}</span>
                    {selectedStudent.mobile && <span>Mobile: {selectedStudent.mobile}</span>}
                    {selectedStudent.email && <span>Email: {selectedStudent.email}</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Take Student Photo</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Use the phone camera or upload a JPG, PNG, or WebP photo.</p>
                </div>
                <span className="rounded-full bg-[#2E3093]/8 px-3 py-1 text-[11px] font-bold text-[#2E3093]">Step 2</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div className="flex h-48 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                  {photoFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={URL.createObjectURL(photoFile)} alt="Student preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">+</div>
                      <p className="text-xs font-bold">No photo</p>
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
                  {photoFile && (
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                      <span className="truncate">{photoFile.name} · {fileSizeLabel(photoFile.size)}</span>
                      <button type="button" onClick={() => setPhotoFile(null)} className="ml-3 text-red-600">Remove</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Upload Documents</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Add ID proof, marksheets, or certificates. PDF and images are accepted.</p>
                </div>
                <span className="rounded-full bg-[#2E3093]/8 px-3 py-1 text-[11px] font-bold text-[#2E3093]">Step 3</span>
              </div>

              <input
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => addDocuments(event.target.files)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#2E3093]/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#2E3093]"
              />

              <div className="mt-3 space-y-2">
                {documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs font-semibold text-slate-500">
                    No documents selected yet.
                  </div>
                ) : documents.map((doc, index) => (
                  <div key={doc.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[180px_1fr_auto] sm:items-center">
                    <select
                      value={documentLabels.includes(doc.name) ? doc.name : 'Other Document'}
                      onChange={(event) => updateDocumentName(doc.id, event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#2E3093]"
                    >
                      {documentLabels.map((label) => <option key={label} value={label}>{label}</option>)}
                    </select>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-800">{index + 1}. {doc.file.name}</p>
                      <p className="text-[11px] font-semibold text-slate-500">{doc.file.type || 'File'} · {fileSizeLabel(doc.file.size)}</p>
                    </div>
                    <button type="button" onClick={() => removeDocument(doc.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 ring-1 ring-red-100">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-sm font-black text-slate-900">Ready to Save</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Photo and documents will be saved directly to the selected student profile.</p>

            <div className="mt-4 space-y-2 text-xs font-bold">
              <div className={`rounded-xl px-3 py-2 ${batchId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Batch selected</div>
              <div className={`rounded-xl px-3 py-2 ${studentId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Student selected</div>
              <div className={`rounded-xl px-3 py-2 ${photoFile ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>Photo captured</div>
              <div className={`rounded-xl px-3 py-2 ${documents.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>{documents.length} document{documents.length === 1 ? '' : 's'} selected</div>
            </div>

            {error && <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100">{error}</div>}
            {success && <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">{success}</div>}

            <button
              type="submit"
              disabled={submitting || !batchId || !studentId || !photoFile || documents.length === 0}
              className="mt-4 w-full rounded-xl bg-[#2E3093] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#252780] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? 'Uploading...' : 'Save Photo & Documents'}
            </button>

            <button
              type="button"
              onClick={resetUploads}
              disabled={submitting || (!photoFile && documents.length === 0)}
              className="mt-2 w-full rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear Selected Files
            </button>
          </aside>
        </form>
      </div>
    </main>
  );
}
