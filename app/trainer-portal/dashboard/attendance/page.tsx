'use client';

import { useEffect, useState, useCallback } from 'react';

interface AttendanceRecord {
  Id: number;
  Faculty_Id: number;
  Batch_Id: number | null;
  Attend_Date: string;
  Check_In: string | null;
  Check_Out: string | null;
  Status: string;
  Remarks: string | null;
  Batch_code: string | null;
}

interface AttendanceStats {
  total_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
}

export default function TrainerAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [stats, setStats] = useState<AttendanceStats>({ total_days: 0, present_days: 0, absent_days: 0, half_days: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trainer-portal/attendance?month=${selectedMonth}`);
      const data = await res.json();
      setRecords(data.records || []);
      setToday(data.today || null);
      setStats(data.stats || { total_days: 0, present_days: 0, absent_days: 0, half_days: 0 });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAction(action: 'check_in' | 'check_out') {
    setActionLoading(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/trainer-portal/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks: remarks || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(action === 'check_in' ? 'Checked in successfully!' : 'Checked out successfully!');
        setRemarks('');
        fetchData();
      } else {
        setActionMsg(data.error || 'Action failed');
      }
    } catch {
      setActionMsg('Network error');
    } finally {
      setActionLoading(false);
    }
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const canCheckIn = !today;
  const canCheckOut = today && !today.Check_Out;
  const alreadyDone = today && today.Check_Out;

  const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mark Attendance</h1>
        <p className="text-sm text-gray-500">Check in and check out for the day</p>
      </div>

      {/* Today's attendance card */}
      <div
        className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2E3093 0%, #2A6BB5 100%)' }}
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10" style={{ background: '#FAE452' }} />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-blue-200 text-sm mb-1">{dateStr}</p>
              <p className="text-4xl font-bold mb-4">{timeStr}</p>

              {/* Status */}
              {alreadyDone && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-sm">
                  <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Day complete — In: {today?.Check_In?.slice(0, 5)} | Out: {today?.Check_Out?.slice(0, 5)}</span>
                </div>
              )}
              {canCheckOut && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span>Checked in at {today?.Check_In?.slice(0, 5)} — Working</span>
                </div>
              )}
              {canCheckIn && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-sm">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span>Not checked in yet</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 min-w-[200px]">
              {canCheckIn && (
                <button
                  onClick={() => handleAction('check_in')}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 shadow-lg"
                  style={{ background: '#FAE452', color: '#2E3093' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  {actionLoading ? 'Checking in…' : 'Check In'}
                </button>
              )}
              {canCheckOut && (
                <button
                  onClick={() => handleAction('check_out')}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 shadow-lg bg-white/20 text-white border border-white/30"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {actionLoading ? 'Checking out…' : 'Check Out'}
                </button>
              )}
              {alreadyDone && (
                <div className="text-center text-blue-200 text-sm py-2">
                  Attendance marked for today
                </div>
              )}
            </div>
          </div>

          {/* Remarks input */}
          {(canCheckIn || canCheckOut) && (
            <div className="mt-4">
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Add remarks (optional)"
                className="w-full md:w-96 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            </div>
          )}

          {/* Action message */}
          {actionMsg && (
            <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium inline-block ${
              actionMsg.includes('success') ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'
            }`}>
              {actionMsg}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#2E3093' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total_days}</p>
              <p className="text-xs text-gray-500">Total Days</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.present_days}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-red-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.absent_days}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#FAE452' }}>
              <svg className="w-5 h-5" style={{ color: '#2E3093' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.half_days}</p>
              <p className="text-xs text-gray-500">Half Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Attendance History</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5] bg-white"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#2E3093' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 font-medium">No records for {monthLabel}</p>
            <p className="text-sm text-gray-400 mt-1">Attendance will appear here once you check in</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Day</th>
                  <th className="px-6 py-3">Check In</th>
                  <th className="px-6 py-3">Check Out</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(r => {
                  const d = new Date(r.Attend_Date);
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                  // Calculate duration
                  let durationStr = '—';
                  if (r.Check_In && r.Check_Out) {
                    const [ih, im] = r.Check_In.split(':').map(Number);
                    const [oh, om] = r.Check_Out.split(':').map(Number);
                    const mins = (oh * 60 + om) - (ih * 60 + im);
                    if (mins > 0) {
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      durationStr = `${h}h ${m}m`;
                    }
                  }

                  const statusColor = r.Status === 'Present'
                    ? 'bg-green-50 text-green-700'
                    : r.Status === 'Half Day'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-red-50 text-red-700';

                  return (
                    <tr key={r.Id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex flex-col items-center justify-center text-white text-xs"
                            style={{ background: '#2E3093' }}
                          >
                            <span className="font-bold leading-none">{d.getDate()}</span>
                            <span className="text-[10px] opacity-80">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                          </div>
                          <span className="text-sm text-gray-700">{dateLabel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{dayName}</td>
                      <td className="px-6 py-3 text-gray-700 font-medium">{r.Check_In?.slice(0, 5) || '—'}</td>
                      <td className="px-6 py-3 text-gray-700 font-medium">{r.Check_Out?.slice(0, 5) || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">{durationStr}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {r.Status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs max-w-[200px] truncate">{r.Remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
