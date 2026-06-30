'use client';

import React, { useState, useCallback } from 'react';
import { FaIdCard, FaPlus, FaTrashAlt, FaUpload, FaFileWord, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface IdCard {
  id: string;
  name: string;
  course: string;
  batchNo: string;
  contactNo: string;
  validUpto: string;
  photo: string | null; // data URL
}

const blankCard = (): IdCard => ({
  id: Math.random().toString(36).slice(2),
  name: '', course: '', batchNo: '', contactNo: '', validUpto: '', photo: null,
});

const field = 'w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400';
const lbl = 'block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5';

export default function IdCardGeneratorPage() {
  const { canView, loading } = useResourcePermissions('student');
  const [cards, setCards] = useState<IdCard[]>([blankCard()]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const update = useCallback((id: string, patch: Partial<IdCard>) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const addCard = () => setCards(prev => [...prev, blankCard()]);
  const removeCard = (id: string) => setCards(prev => (prev.length > 1 ? prev.filter(c => c.id !== id) : prev));

  const onPhoto = (id: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => update(id, { photo: typeof reader.result === 'string' ? reader.result : null });
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    const valid = cards.filter(c => c.name.trim());
    if (valid.length === 0) { setError('Add at least one card with a name.'); return; }
    setError('');
    setGenerating(true);
    try {
      const res = await fetch('/api/id-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: valid.map(c => ({
            name: c.name, course: c.course, batchNo: c.batchNo,
            contactNo: c.contactNo, validUpto: c.validUpto, photo: c.photo,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'id-cards.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to generate ID cards." />;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2E3093]/10 flex items-center justify-center">
            <FaIdCard className="w-5 h-5 text-[#2E3093]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">ID Card Generator</h1>
            <p className="text-xs text-slate-400">Build a list of ID cards and export an editable Word (.docx) file.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addCard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <FaPlus className="w-3.5 h-3.5" /> Add Card
          </button>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-bold transition-colors disabled:opacity-60">
            {generating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <FaFileWord className="w-4 h-4" />}
            {generating ? 'Generating…' : 'Generate DOCX'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><FaTimes className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {cards.map((card, idx) => (
          <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#2E3093]">Card #{idx + 1}</span>
              <button onClick={() => removeCard(card.id)} disabled={cards.length === 1}
                title="Remove card"
                className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <FaTrashAlt className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-4">
              {/* Photo */}
              <div className="shrink-0 w-28">
                <label className={lbl}>Photo</label>
                <div className="relative w-28 h-32 rounded-lg border-2 border-dashed border-slate-300 overflow-hidden bg-slate-50 flex items-center justify-center">
                  {card.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.photo} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center px-2">No photo</span>
                  )}
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity">
                    <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                      <FaUpload className="w-3 h-3" /> Upload
                    </span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => onPhoto(card.id, e.target.files?.[0])} />
                  </label>
                </div>
                {card.photo && (
                  <button onClick={() => update(card.id, { photo: null })}
                    className="mt-1 w-full text-[10px] text-slate-400 hover:text-red-500">Remove photo</button>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="col-span-2">
                  <label className={lbl}>Name</label>
                  <input value={card.name} onChange={(e) => update(card.id, { name: e.target.value })} placeholder="Full name" className={field} />
                </div>
                <div>
                  <label className={lbl}>Course</label>
                  <input value={card.course} onChange={(e) => update(card.id, { course: e.target.value })} placeholder="e.g. Piping Engineering" className={field} />
                </div>
                <div>
                  <label className={lbl}>Batch No.</label>
                  <input value={card.batchNo} onChange={(e) => update(card.id, { batchNo: e.target.value })} placeholder="e.g. 01166" className={field} />
                </div>
                <div>
                  <label className={lbl}>Contact No</label>
                  <input value={card.contactNo} onChange={(e) => update(card.id, { contactNo: e.target.value })} placeholder="Mobile number" className={field} />
                </div>
                <div>
                  <label className={lbl}>Valid Upto</label>
                  <input value={card.validUpto} onChange={(e) => update(card.id, { validUpto: e.target.value })} placeholder="DD-MM-YYYY" className={field} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 px-1">
        The generated .docx mirrors the SIT ID card layout (large name on the left, details + photo on the right) and is fully editable in Word.
      </p>
    </div>
  );
}
