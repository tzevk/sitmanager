import React from 'react';

function isYes(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'yes' || text === 'true' || text === '1';
}

export function StudentTransferBadge({
  transferred,
  movedToCourseName,
  movedToBatchCode,
  className = '',
}: {
  transferred?: string | null;
  movedToCourseName?: string | null;
  movedToBatchCode?: string | null;
  className?: string;
}) {
  const isTransferred = isYes(transferred);
  const destination = [movedToCourseName, movedToBatchCode].filter(Boolean).join(' · ');

  if (!isTransferred && !destination) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        isTransferred
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-sky-200 bg-sky-50 text-sky-700'
      } ${className}`}
    >
      {isTransferred ? 'Transferred' : 'Moved'}
      {destination ? <span className="font-medium opacity-90">({destination})</span> : null}
    </span>
  );
}
