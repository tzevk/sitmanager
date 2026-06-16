'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface StudentRow {
  Student_Id: number;
  Student_Name: string;
  Course_Name: string | null;
  Batch_code: string | null;
  Present_Mobile: string | null;
  Email: string | null;
}

interface Bank {
  Id: number;
  Bank_Name: string;
}

interface Particular {
  label: string;
  amount: number | null;
  fixed: boolean;
}

interface FeeDetailsData {
  student: {
    Student_Id: number;
    Student_Name: string;
    Course_Name: string | null;
    Batch_Code: string | null;
    Present_Mobile: string | null;
    Email: string | null;
  };
  banks: Bank[];
  particulars: Particular[];
  nextReceiptNo: string;
}

const PAYMENT_TYPES = ['Cash', 'Cheque', 'DD', 'Online', 'NEFT', 'PDC'];
const TAX_TYPES = ['CGST', 'SGST', 'IGST'];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddFeeDetailsPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('finance');
  const router = useRouter();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [data, setData] = useState<FeeDetailsData | null>(null);

  const [type, setType] = useState<'Credit' | 'Debit'>('Credit');
  const [paymentType, setPaymentType] = useState('Cash');
  const [bank, setBank] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [branch, setBranch] = useState('');
  const [amount, setAmount] = useState('');
  const [particular, setParticular] = useState('');
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [taxType, setTaxType] = useState('');

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const res = await fetch('/api/fee-details?mode=students');
        const d = await res.json();
        const rows = d.rows ?? [];
        setStudents(rows);
        if (rows.length) {
          setStudentId(String(rows[0].Student_Id));
        }
      } finally {
        setLoadingStudents(false);
      }
    };
    loadStudents();
  }, []);

  useEffect(() => {
    const loadFormData = async () => {
      if (!studentId) {
        setData(null);
        return;
      }
      setLoadingForm(true);
      setError('');
      setData(null);
      setAmount('');
      setTaxType('');
      setChequeNo('');
      setChequeDate('');
      setBranch('');
      setBank('');
      setType('Credit');
      setPaymentType('Cash');
      setReceiptDate(todayISO());

      try {
        const res = await fetch(`/api/fee-details/${studentId}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to load form details');
        setData(d);
        setParticular(d.particulars?.[0]?.label ?? '');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load form details');
      } finally {
        setLoadingForm(false);
      }
    };
    loadFormData();
  }, [studentId]);

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.Student_Id).includes(q) ||
      (s.Student_Name || '').toLowerCase().includes(q) ||
      (s.Batch_code || '').toLowerCase().includes(q)
    );
  });

  const handleParticularChange = (val: string) => {
    setParticular(val);
    const p = data?.particulars.find((x) => x.label === val);
    if (p?.fixed && p.amount != null) setAmount(String(p.amount));
  };

  const handleSave = async () => {
    if (!studentId) {
      setError('Select a student first.');
      return;
    }
    if (!amount || !receiptDate) {
      setError('Amount and receipt date are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        Type: type,
        Payment_Type: paymentType,
        Cheque_Bank: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? bank : null,
        Cheque_No: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? chequeNo : null,
        Cheque_Date: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? chequeDate : null,
        Cheque_Branch: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? branch : null,
        Amount: amount,
        Particular: particular,
        RDate: receiptDate,
        TaxType: taxType,
      };

      const res = await fetch(`/api/fee-details/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save receipt');

      router.push(`/dashboard/fee-details/${studentId}?feesId=${d.Fees_Id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;

  const ctrl = 'h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 disabled:opacity-50 w-full';
  const label = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider';
  const showChequeFields = ['Cheque', 'DD', 'PDC'].includes(paymentType);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Add Fees Details</h2>
          <p className="text-[11px] text-white/60 mt-0.5">Direct add form. No filter screen.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-1">
            <label className={label}>Find Student</label>
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Type name, Student ID or batch code"
              className={ctrl}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-1">
            <label className={label}>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={loadingStudents || !filteredStudents.length} className={ctrl}>
              <option value="">{loadingStudents ? 'Loading students…' : 'Select Student'}</option>
              {filteredStudents.map((s) => (
                <option key={s.Student_Id} value={s.Student_Id}>
                  {s.Student_Name} ({s.Student_Id}){s.Batch_code ? ` - ${s.Batch_code}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingForm && <div className="mb-4 text-xs text-slate-500">Loading form…</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className={label}>Student Name</label>
            <input value={data?.student.Student_Name || ''} readOnly className={`${ctrl} bg-slate-100`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Course</label>
            <input value={data?.student.Course_Name || ''} readOnly className={`${ctrl} bg-slate-100`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Batch</label>
            <input value={data?.student.Batch_Code || ''} readOnly className={`${ctrl} bg-slate-100`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Contact</label>
            <input value={data?.student.Present_Mobile || data?.student.Email || ''} readOnly className={`${ctrl} bg-slate-100`} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={label}>Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'Credit' | 'Debit')} className={ctrl} disabled={!studentId}>
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Receipt No.</label>
            <input value={data?.nextReceiptNo || ''} readOnly className={`${ctrl} bg-slate-100 font-mono text-[#2E3093]`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Payment Type</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={ctrl} disabled={!studentId}>
              {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Receipt Date *</label>
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className={ctrl} disabled={!studentId} />
          </div>

          {showChequeFields && (
            <>
              <div className="flex flex-col gap-1">
                <label className={label}>Bank</label>
                <select value={bank} onChange={(e) => setBank(e.target.value)} className={ctrl} disabled={!studentId}>
                  <option value="">Select Bank Name</option>
                  {(data?.banks || []).map((b) => <option key={b.Id} value={b.Bank_Name}>{b.Bank_Name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Cheque/DD No.</label>
                <input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} className={ctrl} disabled={!studentId} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Cheque Date</label>
                <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} className={ctrl} disabled={!studentId} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Branch</label>
                <input value={branch} onChange={(e) => setBranch(e.target.value)} className={ctrl} disabled={!studentId} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className={label}>Amount (Rs.) *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={ctrl} disabled={!studentId} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
            <label className={label}>Particular</label>
            <select value={particular} onChange={(e) => handleParticularChange(e.target.value)} className={ctrl} disabled={!studentId}>
              <option value="">Select Particular Type</option>
              {(data?.particulars || []).map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}{p.fixed && p.amount != null ? ` (Rs. ${p.amount})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label className={label}>Tax Type</label>
            <div className="h-9 px-2 rounded-lg border border-slate-300 bg-white flex items-center gap-3">
              {TAX_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input type="radio" name="taxType" checked={taxType === t} onChange={() => setTaxType(t)} disabled={!studentId} />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canUpdate || !studentId || saving}
            className="h-9 px-4 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252875] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Receipt'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/fee-details')}
            className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
