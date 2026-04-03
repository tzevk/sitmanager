'use client';

import { useEffect, useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type DeliveryReport = {
  id: number;
  message_id: string | null;
  mobile: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
  error_code: string | null;
  source_ip: string | null;
  created_at: string;
};

function statusClass(value: string | null): string {
  const v = (value || '').toLowerCase();
  if (v.includes('deliver') || v.includes('success')) return 'bg-green-100 text-green-700';
  if (v.includes('fail') || v.includes('error') || v.includes('reject')) return 'bg-red-100 text-red-700';
  if (v.includes('pend') || v.includes('queue')) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-700';
}

export default function SmsDeliveryReportsPage() {
  const { canView, loading: permLoading } = useResourcePermissions('report_sms_email');
  const [reports, setReports] = useState<DeliveryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sms/realtime-delivery/reports?limit=100', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load reports');
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view SMS/Email reports." />;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">SMS Realtime Delivery Reports</h2>
            <p className="text-xs text-white/80">Recent callbacks from SMS provider webhook</p>
          </div>
          <button
            type="button"
            onClick={loadReports}
            className="px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Message ID</th>
                <th className="px-3 py-2 text-left">Mobile</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Delivered At</th>
                <th className="px-3 py-2 text-left">Error Code</th>
                <th className="px-3 py-2 text-left">Source IP</th>
                <th className="px-3 py-2 text-left">Received At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-400" colSpan={8}>Loading reports...</td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-400" colSpan={8}>No delivery reports received yet</td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{r.id}</td>
                    <td className="px-3 py-2 text-gray-700">{r.message_id || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.mobile || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${statusClass(r.delivery_status)}`}>
                        {r.delivery_status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.delivered_at || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.error_code || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.source_ip || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.created_at || '—'}</td>
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
