'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface CV {
  CV_Id: number;
  CV_Name: string;
  CV_Path: string;
  Is_Default: number;
  Upload_Date: string;
}

export default function MyCVPage() {
  const router = useRouter();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCVs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student-portal/cv');
      if (res.status === 401) { router.push('/student-portal/signin'); return; }
      const data = await res.json();
      setCvs(data.cvs ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchCVs(); }, [fetchCVs]);

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const handleUpload = async (file: File) => {
    setUploading(true); setError(''); setSuccess('');
    try {
      const formData = new FormData();
      formData.append('cv', file);
      formData.append('cv_name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('is_default', cvs.length === 0 ? '1' : '0');
      const res = await fetch('/api/student-portal/cv', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSuccess('CV uploaded successfully!');
      fetchCVs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (cvId: number) => {
    setDeletingId(cvId); setError('');
    try {
      const res = await fetch('/api/student-portal/cv', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_id: cvId }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setSuccess('CV deleted successfully');
      fetchCVs();
    } catch {
      setError('Failed to delete CV');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (cvId: number) => {
    setSettingDefaultId(cvId); setError('');
    try {
      const res = await fetch('/api/student-portal/cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_id: cvId }),
      });
      if (!res.ok) throw new Error('Failed to set default');
      setSuccess('Default CV updated');
      fetchCVs();
    } catch {
      setError('Failed to set default CV');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const defaultCV = cvs.find(c => c.Is_Default === 1);
  const fileExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

  const getFileIcon = (name: string) => {
    const ext = fileExt(name);
    if (ext === 'pdf') return { bg: 'bg-red-50', color: 'text-red-500', label: 'PDF' };
    if (['doc', 'docx'].includes(ext)) return { bg: 'bg-blue-50', color: 'text-blue-500', label: 'DOC' };
    return { bg: 'bg-gray-50', color: 'text-gray-500', label: 'FILE' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading your CVs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1a1d5e 0%, #2E3093 30%, #2A6BB5 70%, #3b82f6 100%)' }}
      >
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FAE452]/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 blur-2xl" />
        <div className="absolute top-6 right-8 w-16 h-16 border border-white/10 rounded-2xl rotate-12 hidden sm:block" />
        <div className="absolute bottom-4 right-32 w-10 h-10 border border-white/10 rounded-full hidden sm:block" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#FAE452]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">My CVs / Resumes</h1>
                <p className="text-white/50 text-sm mt-0.5">Upload, manage, and organize your resumes for job applications</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 sm:gap-6 shrink-0">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-1">
                <span className="text-2xl font-black text-white">{cvs.length}</span>
              </div>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Total CVs</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#FAE452]/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-1 border border-[#FAE452]/30">
                <svg className="w-6 h-6 text-[#FAE452]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Default</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-600 font-medium">{success}</p>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group
          ${dragActive
            ? 'border-[#2E3093] bg-[#2E3093]/5 scale-[1.01]'
            : 'border-gray-200 bg-white hover:border-[#2E3093]/40 hover:bg-gray-50/50'
          }`}
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#2E3093]/5 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FAE452]/5 to-transparent rounded-tr-full" />

        <div className="relative flex flex-col items-center justify-center py-10 sm:py-12 px-6">
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-[3px] border-[#2E3093] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-[#2E3093]">Uploading your CV...</p>
            </div>
          ) : (
            <>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300
                ${dragActive
                  ? 'bg-[#2E3093] scale-110'
                  : 'bg-gradient-to-br from-[#2E3093]/10 to-[#2A6BB5]/10 group-hover:scale-105'
                }`}>
                <svg className={`w-8 h-8 transition-colors ${dragActive ? 'text-white' : 'text-[#2E3093]/60 group-hover:text-[#2E3093]'}`}
                  fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-base font-bold text-gray-800">
                {dragActive ? 'Drop your file here' : 'Upload your CV'}
              </p>
              <p className="text-sm text-gray-400 mt-1">Drag & drop or click to browse</p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">PDF</span>
                <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">DOC</span>
                <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">DOCX</span>
                <span className="text-[11px] text-gray-300">&bull;</span>
                <span className="text-[11px] text-gray-400">Max 5 MB</span>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
        </div>
      </div>

      {/* Default CV Highlight */}
      {defaultCV && (
        <div className="relative overflow-hidden rounded-2xl border border-[#FAE452]/40 bg-gradient-to-r from-[#FAE452]/10 via-white to-[#FAE452]/5 p-5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FAE452]/10 rounded-bl-full" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FAE452] to-[#f0c030] flex items-center justify-center shrink-0 shadow-md shadow-[#FAE452]/20">
              <svg className="w-6 h-6 text-[#1a1d5e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-[#1a1d5e] uppercase tracking-wide">Default CV</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAE452]/30 text-[#1a1d5e]">Active</span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{defaultCV.CV_Name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                This CV will be used by default when applying for jobs
              </p>
            </div>
            <a href={defaultCV.CV_Path} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 bg-[#2E3093] hover:bg-[#1a1d5e] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shrink-0">
              View CV
            </a>
          </div>
        </div>
      )}

      {/* CV List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">All Documents</h2>
            <p className="text-xs text-gray-400 mt-0.5">{cvs.length} resume{cvs.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] hover:from-[#1a1d5e] hover:to-[#2E3093] text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            + Upload New
          </button>
        </div>

        {cvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-600">No resumes yet</p>
            <p className="text-sm text-gray-400 mt-1 text-center max-w-[280px]">
              Upload your first CV to get started with job applications
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 px-6 py-2.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              Upload CV
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {cvs.map((cv) => {
              const icon = getFileIcon(cv.CV_Name);
              const isDeleting = deletingId === cv.CV_Id;
              const isSettingDefault = settingDefaultId === cv.CV_Id;

              return (
                <div
                  key={cv.CV_Id}
                  className="group px-6 py-4 flex items-center gap-4 transition-all duration-200 hover:bg-gray-50/70"
                >
                  {/* File type icon */}
                  <div className={`w-12 h-12 rounded-xl ${icon.bg} flex flex-col items-center justify-center shrink-0 border border-gray-100`}>
                    <svg className={`w-5 h-5 ${icon.color}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className={`text-[9px] font-bold ${icon.color} uppercase mt-0.5`}>{icon.label}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{cv.CV_Name}</h3>
                      {cv.Is_Default === 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAE452]/20 text-[#1a1d5e] border border-[#FAE452]/30">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-gray-400">
                        Uploaded {new Date(cv.Upload_Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-[11px] text-gray-300">&bull;</span>
                      <span className={`text-[11px] font-medium ${icon.color}`}>{fileExt(cv.CV_Name).toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {cv.Is_Default !== 1 && (
                      <button
                        onClick={() => handleSetDefault(cv.CV_Id)}
                        disabled={isSettingDefault}
                        title="Set as default"
                        className="px-3 py-1.5 text-[11px] font-semibold text-[#1a1d5e] bg-[#FAE452]/10 hover:bg-[#FAE452]/25 border border-[#FAE452]/30 rounded-lg transition-all disabled:opacity-50"
                      >
                        {isSettingDefault ? (
                          <div className="w-3.5 h-3.5 border-2 border-[#1a1d5e] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Set Default'
                        )}
                      </button>
                    )}
                    <a
                      href={cv.CV_Path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-[11px] font-semibold text-[#2E3093] bg-[#2E3093]/5 hover:bg-[#2E3093]/15 rounded-lg transition-all"
                    >
                      View
                    </a>
                    <a
                      href={cv.CV_Path}
                      download
                      className="px-3 py-1.5 text-[11px] font-semibold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-all"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => handleDelete(cv.CV_Id)}
                      disabled={isDeleting}
                      title="Delete"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900">Keep it Updated</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">Regularly update your CV with latest skills, projects, and achievements.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900">Use PDF Format</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">PDF preserves formatting across devices. Recruiters prefer this format.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900">Set a Default</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">Mark your best CV as default &mdash; it&apos;ll be auto-selected when applying.</p>
        </div>
      </div>
    </div>
  );
}
