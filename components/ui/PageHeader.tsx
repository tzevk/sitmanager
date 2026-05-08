'use client';

import Link from 'next/link';

export interface Crumb { label: string; href?: string }

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Crumb[];
  /** Small text shown next to the title — record counts, year labels, etc. */
  meta?: React.ReactNode;
  /** Buttons / links rendered on the right side */
  action?: React.ReactNode;
}

/** Rigid 3-zone page header: breadcrumbs left, title + meta, primary action right. */
export function PageHeader({ title, breadcrumbs = [], meta, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-200">
      <div className="min-w-0">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 text-[11px] font-medium">
                {i > 0 && <span className="text-zinc-300 select-none">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-[#2A6BB5]/70 hover:text-[#2E3093] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[#1a1f3c]/50">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold text-[#2E3093] tracking-tight leading-none">{title}</h1>
          {meta && <span className="text-[11px] text-[#2A6BB5]/70 font-medium tabular-nums">{meta}</span>}
        </div>
      </div>

      {action && (
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {action}
        </div>
      )}
    </div>
  );
}

/** Zinc-50 filter strip — wraps search inputs, selects, date pickers. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
      {children}
    </div>
  );
}

/** Primary indigo action button. */
export function PrimaryBtn({
  children, onClick, type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#24267A] transition-colors"
    >
      {children}
    </button>
  );
}

/** Ghost secondary action button — for secondary CTAs like "Public Form". */
export function GhostBtn({
  children, onClick, href, target, rel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
}) {
  const cls = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2A6BB5] border border-[#2E3093]/15 hover:bg-[#2E3093]/5 transition-colors';
  if (href) return <a href={href} target={target} rel={rel} className={cls}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}
