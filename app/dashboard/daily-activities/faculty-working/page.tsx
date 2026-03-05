'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface FacultyWorking {
  id: number;
  date: string;
  course: string; // ID
  Course_Name?: string;
  batch: string; // ID
  Batch_Code?: string;
  faculty: string;
  Employee_Name?: string;
  facultytime: string; // From
  to: string; // To
  work: string;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function FacultyWorkingPage() {
  return (
    <PermissionGate resource="faculty_working_hours" deniedMessage="You do not have permission to view faculty working hours.">
      {(perms) => <FacultyWorkingContent {...perms} />}
    </PermissionGate>
  );
}

function FacultyWorkingContent({ canCreate, canUpdate, canDelete }: { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canExport: boolean }) {
  const router = useRouter();

  const [rows, setRows] = useState<FacultyWorking[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  /* ---- Fetch ---- */
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily-activities/faculty-working');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ---- Handlers ---- */
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/daily-activities/faculty-working?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchData();
    } catch {
      alert('Failed to delete record');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Faculty Working Hours</h1>
          <p className="text-sm text-gray-500">Manage faculty daily working reports</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={() => router.push('/dashboard/daily-activities/faculty-working/add')}
              className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#232470] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase text-xs">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Work</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No records found.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400">{r.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.date}</td>
                    <td className="px-4 py-3 text-gray-700">{r.Employee_Name || r.faculty}</td>
                    <td className="px-4 py-3 text-gray-600">{r.Course_Name || r.course}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {r.Batch_Code || r.batch}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {r.facultytime} - {r.to}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.work}>{r.work}</td>
                    <td className="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-gray-50">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/daily-activities/faculty-working/add?id=${r.id}`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleting === r.id}
                            className={`p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors ${deleting === r.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Delete"
                          >
                            {deleting === r.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
