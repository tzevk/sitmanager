'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

/* ── Section definitions ─────────────────────────────────────────── */
interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const TECH_SECTIONS = [
  { id: 'tech-stack',     title: 'Tech Stack & Architecture' },
  { id: 'tech-env',       title: 'Environment Variables' },
  { id: 'tech-structure', title: 'Project Structure' },
  { id: 'tech-db',        title: 'Database Layer' },
  { id: 'tech-auth',      title: 'Authentication' },
  { id: 'tech-rbac',      title: 'Roles & Permissions (RBAC)' },
  { id: 'tech-api',       title: 'API Architecture' },
  { id: 'tech-finance',   title: 'Finance Resource Pattern' },
  { id: 'tech-cron',      title: 'Background Jobs & Cron' },
  { id: 'tech-cache',     title: 'Caching Layer' },
  { id: 'tech-ratelimit', title: 'Rate Limiting' },
  { id: 'tech-email',     title: 'Email System' },
  { id: 'tech-deploy',    title: 'Deployment' },
];

const SECTIONS: Section[] = [
  { id: 'overview',           title: 'Overview',                  icon: <IconHome /> },
  { id: 'getting-started',    title: 'Getting Started',           icon: <IconPlay /> },
  { id: 'inquiry',            title: 'Inquiry Management',        icon: <IconUsers /> },
  { id: 'online-admission',   title: 'Online Admission',          icon: <IconDoc /> },
  { id: 'student',            title: 'Student Management',        icon: <IconGrad /> },
  { id: 'daily-activities',   title: 'Daily Activities',          icon: <IconCalendar /> },
  { id: 'masters',            title: 'Masters',                   icon: <IconDatabase /> },
  { id: 'corporate-training', title: 'Corporate Training',        icon: <IconBuilding /> },
  { id: 'placement',          title: 'Placement',                 icon: <IconBriefcase /> },
  { id: 'finance',            title: 'Finance & Accounts',        icon: <IconWallet /> },
  { id: 'cbd-dashboard',      title: 'CBD Dashboard',             icon: <IconChart /> },
  { id: 'reports',            title: 'Reports',                   icon: <IconBarChart /> },
  { id: 'roles',              title: 'Roles & Permissions',       icon: <IconShield /> },
  { id: 'utility',            title: 'Utility',                   icon: <IconWrench /> },
];

/* ── Icons ───────────────────────────────────────────────────────── */
function IconHome()     { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>; }
function IconPlay()     { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function IconUsers()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function IconDoc()      { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function IconGrad()     { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>; }
function IconCalendar() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M8 4V2m8 2V2" /></svg>; }
function IconDatabase() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>; }
function IconBuilding() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>; }
function IconBriefcase(){ return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>; }
function IconWallet()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M7 14h.01M11 14h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /></svg>; }
function IconChart()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>; }
function IconBarChart() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>; }
function IconShield()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>; }
function IconWrench()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }

/* ── Shared primitives ───────────────────────────────────────────── */
function SectionHeading({ id, title, icon }: { id: string; title: string; icon: React.ReactNode }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-6 pt-2 scroll-mt-6">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[#2E3093]/15 to-[#2A6BB5]/10 text-[#2E3093]">
        {icon}
      </span>
      <div>
        <h2 className="text-xl font-bold text-gray-900 leading-tight">{title}</h2>
        <div className="mt-0.5 h-0.5 w-10 rounded-full bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]" />
      </div>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-gray-800 mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-gray-600 leading-relaxed mb-3">{children}</p>;
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[13px] text-gray-700">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#2E3093] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#2A6BB5] mt-2" />
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-5 rounded-xl border border-gray-200">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-[#2E3093]">
            {headers.map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-white uppercase tracking-wide border-r border-white/20 last:border-r-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-gray-700 border-r border-gray-100 last:border-r-0" dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-[12.5px] text-blue-800">
      <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4 text-[12.5px] text-emerald-800">
      <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function Divider() {
  return <hr className="my-8 border-gray-100" />;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-green-300 rounded-xl px-4 py-3 text-[11.5px] font-mono overflow-x-auto mb-4 leading-relaxed whitespace-pre-wrap break-all">
      <code>{children}</code>
    </pre>
  );
}

function TechHeading({ id, title }: { id: string; title: string }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-6 pt-2 scroll-mt-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 leading-tight">{title}</h2>
        <div className="mt-0.5 h-0.5 w-10 rounded-full bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]" />
      </div>
    </div>
  );
}

function EnvGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function EnvRow({ name, required, description }: { name: string; required?: boolean; description: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2 px-4 py-2.5 bg-white text-[12.5px]">
      <code className="font-mono text-[11.5px] bg-gray-100 px-2 py-0.5 rounded text-indigo-800 shrink-0">{name}</code>
      {required && <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">required</span>}
      <span className="text-gray-600 flex-1">{description}</span>
    </div>
  );
}

function downloadTechDoc() {
  const md = `# SIT Manager — Technical Documentation

Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}

---

## 1. Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router, React Server Components + Client Components)
- **Runtime**: Node.js (Vercel serverless functions / self-hosted)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: Custom Tailwind components; Lucide React icons; react-icons
- **Charts**: Recharts 3.8
- **Rich Text**: Tiptap 3 (editor for notes/discussions)

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^16.2.1 | App framework |
| react | 19.2.3 | UI library |
| mysql2 | ^3.16.3 | MySQL database driver (promise API) |
| jose | ^6.1.3 | JWT creation and verification (HS256) |
| ioredis | ^5.10.1 | Redis client (caching, rate limiting) |
| nodemailer | ^8.0.4 | SMTP email sending |
| @aws-sdk/client-ses | ^3.1025.0 | AWS SES email sending |
| exceljs | ^4.4.0 | Excel file generation and parsing |
| xlsx | ^0.18.5 | Excel read/write (legacy imports) |
| recharts | ^3.8.1 | Data visualisation charts |
| @tiptap/react | ^3.19.0 | Rich text editor |
| file-saver | ^2.0.5 | Client-side file download |
| jszip | ^3.10.1 | ZIP file creation |
| express | ^5.2.1 | Legacy backend proxy (appp-lite) |

---

## 2. Environment Variables

### Database (Primary — new MySQL DB)
- DB_HOST (required) — MySQL host
- DB_PORT — MySQL port (default: 3306)
- DB_NAME (required) — Database name
- DB_USER (required) — MySQL username
- DB_PASSWORD (required) — MySQL password

### Authentication
- JWT_SECRET (required) — HS256 signing secret for session JWTs

### Redis / Cache
- REDIS_URL — Redis connection URL (falls back to in-memory cache if absent)

### Cron Jobs
- CRON_SECRET — Bearer token required by all /api/cron/* endpoints

### Old Database (Legacy read-only sync source)
- OLD_DB_HOST — Legacy MySQL host
- OLD_DB_PORT — Legacy MySQL port
- OLD_DB_NAME — Legacy database name
- OLD_DB_USER — Legacy MySQL username
- OLD_DB_PASSWORD — Legacy MySQL password

### Email — Admission Flow (SMTP)
- ADMISSION_SMTP_HOST — SMTP server host
- ADMISSION_SMTP_PORT — SMTP port (e.g. 587)
- ADMISSION_SMTP_USER — SMTP username
- ADMISSION_SMTP_PASS — SMTP password
- ADMISSION_FROM_EMAIL — Sender address

### Email — Admission Flow (AWS SES fallback)
- ADMISSION_AWS_SES_ACCESS_KEY_ID — AWS access key
- ADMISSION_AWS_SES_SECRET_ACCESS_KEY — AWS secret
- ADMISSION_AWS_SES_REGION — AWS region (e.g. ap-south-1)

### Alumni Jobs Email
- ALUMNI_JOBS_SOURCE_EMAIL — From address for alumni job notifications

### Sync State Tracking
- SYNC_* — Various variables tracking last-synced primary key per cron job type

---

## 3. Project Structure

\`\`\`
sitmanager/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout (font, metadata)
│   ├── page.tsx                 # Login page (redirects to /dashboard if authed)
│   ├── dashboard/
│   │   ├── layout.tsx           # Dashboard shell: topbar + sidebar nav
│   │   ├── page.tsx             # Dashboard home (role-based widgets)
│   │   ├── inquiry/             # Inquiry management module
│   │   ├── admission/           # Online admission module
│   │   ├── student/             # Student management
│   │   ├── daily-activities/    # Attendance, lectures, exams, feedback
│   │   ├── masters/             # Reference data (courses, batches, trainers…)
│   │   ├── corporate/           # Corporate training inquiry & execution
│   │   ├── placement/           # Jobs, screening, mock interviews
│   │   ├── finance/             # Finance dashboard (tabs: Overview, Monthly…)
│   │   ├── cbd/                 # CBD dashboard (content calendar, planner…)
│   │   ├── reports/             # All report pages
│   │   ├── roles/               # Role & permission management
│   │   ├── manual/              # This documentation page
│   │   └── components/          # Shared dashboard UI widgets
│   └── api/                     # API route handlers
│       ├── auth/                 # login, logout, reset-password, session
│       ├── inquiry/              # CRUD + options + cron sync
│       ├── finance/              # Finance CRUD (collectionHandlers / idHandlers)
│       ├── cron/                 # Background sync jobs
│       └── …                    # Other module APIs
├── lib/
│   ├── db.ts                    # MySQL pool, query helpers, cached()
│   ├── auth.ts                  # JWT creation, cookie management, session verify
│   ├── permissions.ts           # RBAC — hasPermission(), getPermissions()
│   ├── finance-resource.ts      # ResourceConfig factory (collectionHandlers / idHandlers)
│   ├── mailer.ts                # Dual SMTP/SES email sender
│   ├── rate-limit.ts            # Redis Lua rate limiter
│   └── cache.ts                 # Two-tier cache (Redis + in-memory fallback)
├── scripts/
│   ├── cron/                    # Node.js cron runner scripts
│   └── db/                      # One-off DB import/migration scripts
└── public/                      # Static assets
\`\`\`

---

## 4. Database Layer

### Connection Pool (lib/db.ts)

A single MySQL2 connection pool is created once per process and reused across all requests. A global variable prevents re-creation during Next.js hot-reload in development.

\`\`\`ts
// lib/db.ts (pattern)
let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) {
    pool = createPool({ host, port, database, user, password, ... });
  }
  return pool;
}
\`\`\`

### Query Helpers

\`\`\`ts
query<T>(sql, params)       // returns T[] (first element of mysql2 result tuple)
queryOne<T>(sql, params)    // returns T | null (first row or null)
cached<T>(key, ttl, fn)     // Redis/memory-cached async function
\`\`\`

### Table Initialisation

Finance and other modules use an \`ensureOnce(key, fn)\` helper that runs a CREATE TABLE IF NOT EXISTS migration exactly once per process startup, preventing repeated schema checks on every request.

---

## 5. Authentication

### Login Flow

1. Client POSTs \`{ email, password }\` to \`/api/auth/login\`
2. Rate limiter checks IP: 5 attempts / 60 s (Redis Lua script)
3. DB query fetches user record by email
4. Password is compared using **MD5** hash (legacy) or plain comparison
5. On success, a JWT is signed with HS256 using \`JWT_SECRET\`
6. JWT payload: \`{ userId, name, email, roleId, department }\`
7. JWT is set as an **httpOnly, Secure, SameSite=Strict** cookie named \`sit_session\`
8. Response returns the user profile (no token in body)

### Session Verification

Every protected API route calls \`verifySession(req)\` from \`lib/auth.ts\`, which:
- Reads the \`sit_session\` cookie
- Verifies the JWT signature and expiry (jose \`jwtVerify\`)
- Returns the decoded payload or throws 401

### Password Reset

Authenticated users can reset their own password via \`/api/auth/reset-password\`. The endpoint verifies the current password, then updates the DB hash and clears the session cookie to force re-login.

---

## 6. Role-Based Access Control (RBAC)

### Data Model

\`\`\`sql
users            (id, email, password_hash, name, department, role_id)
roles            (id, title)
role_permissions (role_id, permission_key)
\`\`\`

### Permission Keys

Permission keys follow the pattern \`<module>.<action>\`, e.g.:
- \`inquiry.view\`, \`inquiry.add\`, \`inquiry.edit\`
- \`finance.view\`, \`finance.edit\`
- \`placement.view\`, \`placement.add\`

### Super Admin

A user is a Super Admin if their \`role_id === 1\` OR their role title matches "Super Admin" (case-insensitive). Super Admins bypass all permission checks and see all modules.

### Caching

Permission lookups are cached for **5 minutes** per role ID (Redis key: \`role-perms:{roleId}\`) to avoid repeated DB queries on every API request.

\`\`\`ts
// lib/permissions.ts (pattern)
export async function hasPermission(roleId: number, key: string): Promise<boolean> {
  const perms = await cached(\`role-perms:\${roleId}\`, 300, () => fetchPerms(roleId));
  return perms.includes(key);
}
\`\`\`

---

## 7. API Architecture

### Route Conventions

All API routes live under \`app/api/\`. Each module follows Next.js App Router conventions:

\`\`\`
app/api/<module>/
  route.ts           # Collection: GET (list), POST (create)
  [id]/
    route.ts         # Item: GET (single), PUT (update), DELETE
  options/
    route.ts         # Form dropdown data (cached)
\`\`\`

### Request / Response Pattern

\`\`\`ts
export async function GET(req: Request) {
  const session = await verifySession(req);       // 401 if unauthenticated
  if (!await hasPermission(session.roleId, 'module.view')) return forbidden();
  const rows = await query('SELECT …');
  return NextResponse.json(rows);
}
\`\`\`

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation failure |
| 401 | Not authenticated |
| 403 | Authenticated but lacks permission |
| 429 | Rate limit exceeded |
| 500 | Internal server error (logged, generic message to client) |

---

## 8. Finance Resource Pattern

Finance module uses a factory pattern defined in \`lib/finance-resource.ts\` to avoid duplicating CRUD boilerplate across 10+ finance sub-modules.

\`\`\`ts
// Define a resource
const config: ResourceConfig<MyRow> = {
  table: 'finance_my_table',
  columns: ['month', 'year', 'amount', 'notes'],
  idColumn: 'id',
};

// Generate route handlers automatically
export const { GET, POST } = collectionHandlers(config);  // app/api/finance/my-table/route.ts
export const { GET, PUT, DELETE } = idHandlers(config);   // app/api/finance/my-table/[id]/route.ts
\`\`\`

Each handler automatically:
- Verifies the session (401 if missing)
- Checks \`finance.view\` / \`finance.edit\` permissions
- Validates required columns
- Returns typed JSON responses

---

## 9. Background Jobs & Cron

### Endpoint Security

All cron routes live at \`/api/cron/<job-name>\` and require:
\`\`\`
Authorization: Bearer <CRON_SECRET>
\`\`\`
Requests without a valid bearer token receive 401.

### Registered Cron Jobs

| Job | Endpoint | What it syncs |
|-----|----------|---------------|
| sync-courses | /api/cron/sync-courses | Course master from legacy DB |
| sync-batch | /api/cron/sync-batch | Batch records from legacy DB |
| sync-inquiry | /api/cron/sync-inquiry | Inquiry/lead records from legacy DB |
| sync-alumni-jobs | /api/cron/sync-alumni-jobs | Alumni job postings from legacy DB |
| sync-consultancy | /api/cron/sync-consultancy | Consultancy/deputation records |
| sync-all | /api/cron/sync-all | Chains all sync jobs |
| migrate-roll-numbers | /api/cron/migrate-roll-numbers | Roll number assignment migration |

### Incremental Sync

Each sync job tracks the last-synced primary key (stored in a state table or env var). On each run it fetches only rows with \`id > lastSyncedId\`, updates records in the new DB, then saves the new high-water mark. This keeps sync jobs fast even on large tables.

### Running Locally

\`\`\`bash
npm run cron:sync-courses
npm run cron:sync-batch
npm run cron:sync-all
\`\`\`

---

## 10. Caching Layer

### Two-Tier Architecture

\`\`\`
Request
  → Redis (REDIS_URL configured)    TTL: as specified
  → In-memory Map (fallback)        TTL: as specified
  → DB query (cache miss)
\`\`\`

If \`REDIS_URL\` is not set, the system falls back to an in-process Map automatically. This means the app runs without Redis but caching does not persist across serverless function instances.

### Common TTL Values

| Data | TTL |
|------|-----|
| Role permissions | 300 s (5 min) |
| Inquiry form options | 300 s (5 min) |
| Finance dropdown options | 600 s (10 min) |
| Dashboard summary stats | 30–120 s |
| Session data | JWT expiry (not cached) |

### Cache API

\`\`\`ts
import { cached } from '@/lib/db';
const data = await cached('cache-key', 300, async () => {
  return await pool.query('SELECT …');
});
\`\`\`

---

## 11. Rate Limiting

Rate limiting uses a **Redis Lua script** (atomic sliding window) to count requests per IP per window.

### Configured Limiters

| Endpoint / Type | Max Requests | Window |
|-----------------|-------------|--------|
| POST /api/auth/login | 5 | 60 s |
| GET /api/* (general) | 100 | 60 s |
| GET /dashboard/* | 60 | 60 s |

When the limit is exceeded, the API returns:
\`\`\`json
{ "error": "Too many requests. Please try again shortly." }
\`\`\`
with HTTP status **429**.

If Redis is unavailable, rate limiting silently degrades (requests are allowed through) to prevent false 429s.

---

## 12. Email System

### Dual Provider

\`lib/mailer.ts\` tries **SMTP (nodemailer)** first; if SMTP fails or is not configured, it falls back to **AWS SES**.

\`\`\`ts
await sendMail({
  to: 'student@example.com',
  subject: 'Your Admission Form',
  html: '...',
});
\`\`\`

### Use Cases

| Trigger | Provider | Template |
|---------|---------|---------|
| Send admission form link to student | SMTP / SES | HTML with personalised token URL |
| Send shortlisted CVs to company recruiter | SMTP / SES | HTML with student profiles attached |
| Alumni job notification | SMTP / SES | Job detail email |
| Student feedback form link | SMTP / SES | HTML with feedback token URL |

---

## 13. Deployment

### Minimum Required Services

- **MySQL 8+** (primary DB — all SIT Manager data)
- **Legacy MySQL** (read-only source for cron sync jobs)
- **Redis** (optional but recommended — caching and rate limiting)
- **SMTP server or AWS SES** (email sending)

### Required Environment Variables for Production

DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET

### Recommended Additional Variables

REDIS_URL, CRON_SECRET, OLD_DB_HOST, OLD_DB_NAME, OLD_DB_USER, OLD_DB_PASSWORD,
ADMISSION_SMTP_HOST, ADMISSION_SMTP_PORT, ADMISSION_SMTP_USER, ADMISSION_SMTP_PASS

### Vercel Deployment

1. Connect the GitHub repo to a Vercel project
2. Set all required environment variables in Vercel project settings
3. Configure cron jobs in vercel.json or via Vercel Cron (call /api/cron/* with CRON_SECRET header)
4. Set NODE_ENV=production

### Self-Hosted (PM2 / Docker)

\`\`\`bash
npm run build
npm start              # Next.js production server (port 3000)
\`\`\`

For the legacy backend proxy:
\`\`\`bash
npm run backend:appp-lite
\`\`\`

---

*SIT Manager — Internal Operations Platform*
*Suvidya Institute of Technology*
`;

  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SIT-Manager-Technical-Documentation.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function ManualPage() {
  const [activeTab, setActiveTab] = useState<'guide' | 'tech'>('guide');
  const [activeSection, setActiveSection] = useState('overview');
  const [activeTechSection, setActiveTechSection] = useState('tech-stack');
  const contentRef = useRef<HTMLDivElement>(null);
  const techContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== 'guide') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    );
    const els = contentRef.current?.querySelectorAll('[id]') ?? [];
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'tech') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveTechSection(entry.target.id);
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    );
    const els = techContentRef.current?.querySelectorAll('[id]') ?? [];
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [activeTab]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-[#2E3093] via-[#2A6BB5] to-[#1a4f8a] text-white px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/15 px-3 py-1 rounded-full">Official Documentation</span>
            <span className="text-[10px] text-white/50">v1.0</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">
            SIT Manager — {activeTab === 'guide' ? 'User Manual' : 'Technical Documentation'}
          </h1>
          <p className="text-white/70 text-sm max-w-xl">
            {activeTab === 'guide'
              ? 'Complete reference guide for the Suvidya Institute of Technology management platform. Covers every module, workflow, and configuration option.'
              : 'Architecture, environment variables, database patterns, authentication, RBAC, cron jobs, caching, and deployment reference for developers.'}
          </p>
          {activeTab === 'guide' && (
            <div className="flex flex-wrap gap-2 mt-5">
              {SECTIONS.slice(0, 6).map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {s.icon}<span>{s.title}</span>
                </button>
              ))}
            </div>
          )}
          {/* Tab switcher */}
          <div className="flex gap-1 mt-6 bg-white/10 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === 'guide' ? 'bg-white text-[#2E3093] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              User Guide
            </button>
            <button
              onClick={() => setActiveTab('tech')}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === 'tech' ? 'bg-white text-[#2E3093] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              Technical Documentation
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {activeTab === 'guide' && (
      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-2">Contents</p>
            <nav className="space-y-0.5">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] font-medium transition-colors ${
                    activeSection === s.id
                      ? 'bg-[#2E3093] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={activeSection === s.id ? 'text-white' : 'text-gray-400'}>{s.icon}</span>
                  {s.title}
                </button>
              ))}
            </nav>
            <div className="mt-6 px-2">
              <Link href="/dashboard" className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2E3093] hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main ref={contentRef} className="flex-1 min-w-0 space-y-2">

          {/* ── 1. Overview ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="overview" title="Overview" icon={<IconHome />} />
            <P>
              <strong>SIT Manager</strong> is the internal operations platform for Suvidya Institute of Technology. It centralises admissions, academics, placement, finance, corporate training, and content marketing into a single role-based system. Every team member sees only the modules relevant to their department.
            </P>
            <Table
              headers={['Department', 'Primary Modules']}
              rows={[
                ['Admissions / CBD', 'Inquiry, Online Admission, Student, CBD Dashboard, Batch Marketing'],
                ['Academics / Training', 'Daily Activities, Masters, Attendance, Exams, Feedback'],
                ['Placement', 'Jobs, Screening, Mock Interviews, Placement Reports'],
                ['Finance / Admin', 'Finance Dashboard, Cashflow, Debt, Pending Invoices, Accounts'],
                ['Corporate Training', 'Corporate Inquiry, Execution, CT Finance'],
                ['Management / Admin', 'All modules + Role & Permissions management'],
              ]}
            />
            <Note>Access to each module is controlled by the <strong>Role & Permissions</strong> system. Contact your Super Admin if a module is not visible.</Note>
          </section>

          <Divider />

          {/* ── 2. Getting Started ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="getting-started" title="Getting Started" icon={<IconPlay />} />

            <H3>Logging In</H3>
            <Steps items={[
              'Open SIT Manager in your browser.',
              'Enter your <strong>Email</strong> and <strong>Password</strong> and click <em>Sign In</em>.',
              'On first login you will be prompted to change your temporary password.',
            ]} />

            <H3>Navigation</H3>
            <P>The top bar contains two rows:</P>
            <Bullets items={[
              '<strong>Top strip</strong> — your name, department, notifications, reset password, sign out.',
              '<strong>Nav bar</strong> — main module menus. Hover or click to open sub-menus. The currently active section is highlighted.',
            ]} />

            <H3>Resetting Your Password</H3>
            <Steps items={[
              'Click <strong>Reset Password</strong> in the top bar.',
              'Enter your current password, then your new password twice.',
              'Click Save. You will remain logged in.',
            ]} />

            <H3>Role-Based Views</H3>
            <P>Your dashboard home page shows widgets specific to your department. A Finance user sees cashflow charts; a CBD user sees the lead funnel; a Placement user sees job pipeline stats. The widgets are automatically determined by your assigned role.</P>
          </section>

          <Divider />

          {/* ── 3. Inquiry Management ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="inquiry" title="Inquiry Management" icon={<IconUsers />} />
            <P>The Inquiry module is the first step in the student admissions funnel. Every prospective student contact is recorded here before being converted into an admission.</P>

            <H3>Adding a New Inquiry</H3>
            <Steps items={[
              'Go to <strong>Admission Activity → Inquiry</strong>.',
              'Click <strong>Add New Inquiry</strong> in the top-right.',
              'Fill in: Student name, contact details, training programme of interest, lead source, contact source.',
              'Set the <strong>Status</strong> (e.g., New, Contacted, Interested) and assign a <strong>Next Follow-up Date</strong>.',
              'Click <strong>Save</strong>.',
            ]} />

            <H3>Key Fields</H3>
            <Table
              headers={['Field', 'Description']}
              rows={[
                ['Lead Source', 'How the student found out about Suvidya — Reference, Meta Ads, Google Ads, College Seminar, Exhibition, Website / Google Search, Social Media Posts, Newspaper / Poster'],
                ['Contact Source', 'How the student contacted us — Call, WhatsApp, Website Form, Walk-In, Social Media DM, Email, Seminar / Event, Portals'],
                ['Status', 'Current stage of the inquiry (New → Contacted → Interested → Converted / Lost)'],
                ['Next Follow-up', 'Scheduled date for next contact attempt'],
                ['Batch', 'Preferred batch linked to the chosen training programme'],
              ]}
            />

            <H3>Following Up</H3>
            <P>Open any inquiry and use the <strong>Discussions</strong> tab to log every call, WhatsApp message, or visit. Each note is time-stamped with the user who added it.</P>

            <H3>Sending an Admission Form</H3>
            <P>Once a student is ready to proceed, click <strong>Send Admission Form</strong> on the inquiry detail page. This sends the student a personalised link to complete their online admission.</P>

            <Tip>Use the <strong>Reports → Inquiry</strong> page to analyse lead sources, conversion rates, and monthly trends.</Tip>
          </section>

          <Divider />

          {/* ── 4. Online Admission ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="online-admission" title="Online Admission" icon={<IconDoc />} />
            <P>When a student completes the online admission form via their personalised link, the submission appears here for review and approval.</P>

            <H3>Reviewing a Submission</H3>
            <Steps items={[
              'Go to <strong>Admission Activity → Online Admission</strong>.',
              'Locate the submission by student name or date.',
              'Click <strong>Edit</strong> to verify and complete any missing fields.',
              'Assign a <strong>Batch</strong> and set the student\'s status to <em>Admitted</em>.',
              'Save. The student record is now created in <strong>Student Management</strong>.',
            ]} />

            <H3>Documents</H3>
            <P>Upload the student's qualifying documents (mark sheets, certificates, ID proof) directly from the student profile page under the <strong>Documents</strong> tab.</P>
          </section>

          <Divider />

          {/* ── 5. Student Management ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="student" title="Student Management" icon={<IconGrad />} />
            <P>The Student list is a live record of all admitted students across all batches and programmes.</P>
            <Bullets items={[
              'Search by name, batch, course, or roll number.',
              'View and edit personal details, contact info, qualification, and batch assignment.',
              'Track pending fee balances from the student profile.',
              'Access the student\'s <strong>Discussions</strong> log for internal notes.',
              'Print or download the <strong>Admission Form</strong> from the student\'s profile.',
            ]} />

            <H3>Roll Number Assignment</H3>
            <P>Go to <strong>Daily Activities → Allot Roll Number</strong>. Select the batch and assign roll numbers sequentially or manually. Roll numbers appear on attendance sheets and result reports.</P>
          </section>

          <Divider />

          {/* ── 6. Daily Activities ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="daily-activities" title="Daily Activities" icon={<IconCalendar />} />
            <P>All day-to-day academic tracking is managed here. Each sub-module is independent and date-driven.</P>

            <H3>Attendance</H3>
            <Steps items={[
              'Go to <strong>Daily Activities → Attendance</strong>.',
              'Select the <strong>Batch</strong> and <strong>Date</strong>.',
              'Mark each student Present / Absent / Late.',
              'Click <strong>Save Attendance</strong>.',
            ]} />

            <H3>Lecture Taken</H3>
            <P>Record each lecture delivered — topic covered, trainer, duration, and batch. Use <strong>Add Lecture</strong> to log a new session. This feeds into the Reports → Attendance module.</P>

            <H3>Assignments, Unit Tests, Viva / Mock Exams, Final Exams</H3>
            <P>Each follows the same pattern: select the batch, enter the assessment details, and log individual student marks. The <strong>Generate Final Result</strong> module aggregates all marks to produce the final grade sheet.</P>

            <H3>Feedback</H3>
            <P>Student feedback is collected via a personalised token link sent to each student. Submitted feedback appears in the Feedback list and can be reviewed and filtered by batch or trainer.</P>

            <H3>Site Visit</H3>
            <P>Log industry or field visits here — date, location, participating students, and observations.</P>

            <H3>Faculty Working Hours</H3>
            <P>Track the number of hours each trainer/faculty member worked per day. Go to <strong>Daily Activities → Faculty Working</strong> and add an entry per faculty per date.</P>
          </section>

          <Divider />

          {/* ── 7. Masters ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="masters" title="Masters" icon={<IconDatabase />} />
            <P>Masters hold the reference data that all other modules depend on. Changes here propagate across the system immediately.</P>

            <Table
              headers={['Master', 'What it controls']}
              rows={[
                ['Training Programs (Course)', 'List of all programmes offered — name, duration, category'],
                ['Annual Batch', 'Yearly schedule of batches tied to a course — start date, max seats, category'],
                ['Batch Category', 'Groupings like Full Time, Part Time, Weekend, Online, Corporate Training'],
                ['Batch', 'Individual batch records with enrolled students'],
                ['Status', 'Configurable status codes used across inquiry, admissions, and placements'],
                ['Holiday', 'Institute holiday calendar — affects attendance calculations'],
                ['Employee', 'Administrative staff records'],
                ['Trainer / Faculty', 'Trainer profiles linked to courses and batches'],
                ['College', 'Partner colleges for seminar and placement drives'],
                ['Library Book', 'Book inventory with title, author, and availability'],
                ['Book Code', 'Classification codes for the library'],
                ['Consultancy', 'Companies tied to deputation and corporate training'],
              ]}
            />

            <Note>Always add a <strong>Training Program</strong> and an <strong>Annual Batch</strong> before adding students or recording daily activities for a new batch.</Note>
          </section>

          <Divider />

          {/* ── 8. Corporate Training ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="corporate-training" title="Corporate Training" icon={<IconBuilding />} />
            <P>The Corporate Training workflow manages end-to-end delivery of training programmes to external companies.</P>

            <H3>Inquiry → Proposal → Execution</H3>
            <Steps items={[
              '<strong>Corporate Inquiry</strong> — log the initial contact from a company: company name, requirement, contact person.',
              '<strong>Proposal</strong> — generate a formal proposal PDF with programme details and cost from the inquiry record.',
              '<strong>Convert</strong> — once the company confirms, convert the inquiry into an active training engagement.',
              '<strong>Execution</strong> — track batch dates, trainer, participants, and session progress during the training.',
              '<strong>Final</strong> — record the completion, invoice, and any follow-up actions.',
            ]} />

            <H3>Finance Tracking</H3>
            <P>Revenue from corporate training is tracked in the <strong>Finance → Corporate Training tab</strong>. Enter the cost from the company, trainer cost, and travel expenses to see the rough profit per engagement.</P>
          </section>

          <Divider />

          {/* ── 9. Placement ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="placement" title="Placement" icon={<IconBriefcase />} />
            <P>The Placement module manages the full placement lifecycle from job posting to final selection.</P>

            <H3>Job Postings</H3>
            <Steps items={[
              'Go to <strong>Placement → Jobs</strong>.',
              'Click <strong>Add Job</strong> — enter company, role, CTC, location, and eligibility criteria.',
              'The job description is automatically sent to eligible students via a token link.',
              'Students confirm interest through the link. Confirmed candidates appear under <strong>Screening</strong>.',
            ]} />

            <H3>Screening & Shortlisting</H3>
            <P>From the Job detail page → <strong>Screening</strong>, review interested candidates. Mark each as <em>Shortlisted by Company</em>, <em>Shortlisted by SIT</em>, <em>Selected</em>, or <em>Rejected</em>.</P>

            <H3>Mock Interviews</H3>
            <P>Schedule and record mock interview sessions with dates, interviewers, and feedback. This helps students prepare for actual company interviews.</P>

            <H3>Email to Company</H3>
            <P>Send shortlisted candidate profiles directly to the company recruiter using the <strong>Email Company</strong> feature from the job detail page.</P>

            <H3>CV Shortlisted</H3>
            <P>Maintain a separate list of students whose CVs have been shortlisted by external recruiters outside the normal job posting flow.</P>
          </section>

          <Divider />

          {/* ── 10. Finance ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="finance" title="Finance & Accounts" icon={<IconWallet />} />
            <P>The Finance Dashboard is accessible from <strong>Admin/Accounts → Finance Dashboard</strong>. It is organised into tabs.</P>

            <Table
              headers={['Tab', 'What it shows']}
              rows={[
                ['Overview', 'Revenue by department, cashflow summary, month comparison'],
                ['Monthly', 'Monthly performance for the main training division — target vs actual revenue'],
                ['Deputation (Accent)', 'Deputation revenue tracking month-by-month with pending invoices'],
                ['Corporate Training (CT)', 'Revenue per training engagement, trainer cost, profit per session, monthly target vs actual'],
                ['CBD', 'CBD department revenue tracking'],
                ['Cashflow', 'All payment transactions — filter by department, month, type'],
                ['Debt', 'Bank loans and EMI schedules with outstanding principal tracking'],
              ]}
            />

            <H3>Pending Invoices</H3>
            <P>Each department tab (Monthly, Deputation, Corporate Training) includes a <strong>Pending Invoices</strong> section. Add invoices with client name, invoice number, amount, due date, and status (Pending / Paid / Overdue).</P>

            <H3>Cashflow Entries</H3>
            <Steps items={[
              'Go to the <strong>Cashflow</strong> tab.',
              'Click <strong>Add</strong> to record a transaction.',
              'Select <strong>Type</strong> (Payment received / Expense), <strong>Department</strong>, <strong>Category</strong>, amount, and date.',
              'Cashflow payments to a department are automatically reflected in that department\'s <em>Actual</em> column in the Monthly Performance tables.',
            ]} />

            <H3>Accounts</H3>
            <Bullets items={[
              '<strong>Employee Profession Tax</strong> — track monthly PT deductions per employee.',
              '<strong>Account Head</strong> — chart of accounts categories.',
              '<strong>Assets</strong> — fixed asset register with depreciation.',
            ]} />
          </section>

          <Divider />

          {/* ── 11. CBD Dashboard ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="cbd-dashboard" title="CBD Dashboard" icon={<IconChart />} />
            <P>The Corporate Business Development dashboard is the command centre for marketing, outreach, and admissions tracking.</P>

            <H3>Lead Funnel Summary</H3>
            <P>Displays Total Enquiries → Contacted → Interested → Converted for any selected month or year. Use the <strong>By Month / By Year</strong> toggle and the year/month selectors to filter.</P>

            <H3>Batch Marketing Tracker</H3>
            <P>Shows upcoming batches (next 3 months) and tracks three marketing tasks per batch:</P>
            <Table
              headers={['Task', 'Due']}
              rows={[
                ['Announcement', '3 months before batch start'],
                ['Meta Ads', '1 month before batch start'],
                ['Flyer', '6 weeks before batch start'],
              ]}
            />
            <P>Each task has a status dropdown (Pending / In Progress / Done). Colour-coded urgency dots warn when a deadline is approaching. Lock a row to prevent further edits once a batch is fully marketed. Add <strong>Platform</strong> selections (Instagram, Facebook, etc.) and content tracking numbers (Planned / Target / Done) per batch.</P>

            <H3>Content Calendar</H3>
            <P>Plan and track social media content month by month. Switch between <strong>Calendar</strong> view (colour-coded day tiles) and <strong>Planner</strong> view (list). Add content items with type (Reel, Post, Story, etc.), planned date, platform, responsible person, and status. Use the <strong>Tracker</strong> sidebar tab to see planned vs target vs completed counts per content type.</P>

            <H3>Annual Targets Widget</H3>
            <P>Upload the annual targets Excel file to populate department-wise revenue and admission targets. The widget shows progress bars for each department against its yearly goal.</P>

            <H3>Seminar Schedule Planner</H3>
            <P>Add seminar slots with date, month, college name, topic, speaker, and status (Not Started / Confirmed / Completed / Cancelled / Under Discussion).</P>

            <H3>Exhibition Planner</H3>
            <P>Track upcoming exhibitions with event name, date, location, and status.</P>
          </section>

          <Divider />

          {/* ── 12. Reports ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="reports" title="Reports" icon={<IconBarChart />} />
            <P>All reports are generated live from the database and can be filtered by date range, batch, or department.</P>

            <Table
              headers={['Report', 'Key filters', 'What it shows']}
              rows={[
                ['Inquiry', 'Month, Year, Source, Status', 'Lead volume, conversion rates, source-wise breakdown, counsellor performance'],
                ['Online Student', 'Course, Batch, Date range', 'Students who completed the online admission form'],
                ['Attendance', 'Batch, Month', 'Per-student attendance percentage, absentee report'],
                ['Final Exam', 'Batch, Exam', 'Marks sheet, pass/fail summary, rank list'],
                ['Consultancy', 'Company, Period', 'Deputation revenue and placement figures by company'],
                ['Placement', 'Year, Course', 'Placed students, companies, CTC summary'],
                ['SMS Delivery', 'Date', 'Delivery status of bulk SMS campaigns sent from the system'],
              ]}
            />

            <Tip>Most report pages have an <strong>Export</strong> or <strong>Print</strong> button in the top-right corner for offline sharing.</Tip>
          </section>

          <Divider />

          {/* ── 13. Roles & Permissions ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="roles" title="Roles & Permissions" icon={<IconShield />} />
            <P>Access control is managed through a role-based permission system. Only Super Admins can create or modify roles.</P>

            <H3>Creating a Role</H3>
            <Steps items={[
              'Go to <strong>Role Right → Roles</strong>.',
              'Click <strong>Add Role</strong> and enter a role name (e.g., "Admissions Counsellor").',
              'In the <strong>Permissions</strong> tab, toggle on/off each module permission (e.g., <code>inquiry.view</code>, <code>inquiry.add</code>).',
              'Save the role.',
            ]} />

            <H3>Assigning a Role to a User</H3>
            <Steps items={[
              'Go to <strong>Role Right → Users</strong>.',
              'Find the user and click Edit.',
              'Select their <strong>Department</strong> and <strong>Role</strong> from the dropdowns.',
              'Save. The user sees the new menu structure on their next page load.',
            ]} />

            <H3>Portal Accounts</H3>
            <P>External portal accounts for students, faculty, and trainers are managed under <strong>Role Right → Portal Accounts</strong>. Send login credentials to students or faculty directly from this page.</P>

            <Note>Permission changes take effect immediately. The user does not need to re-login.</Note>
          </section>

          <Divider />

          {/* ── 14. Utility ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <SectionHeading id="utility" title="Utility" icon={<IconWrench />} />

            <H3>Festival Photo Upload</H3>
            <P>Upload festival/event greeting photos that can be shared or displayed. Go to <strong>Utility → Festival Photo Upload</strong>, select the festival, and upload the image file.</P>
          </section>

          <Divider />

          {/* Footer */}
          <div className="bg-gradient-to-br from-[#2E3093]/5 to-[#2A6BB5]/5 border border-[#2E3093]/10 rounded-2xl px-8 py-6 text-center">
            <p className="text-sm font-bold text-gray-800 mb-1">Suvidya Institute of Technology</p>
            <p className="text-[12px] text-gray-500">SIT Manager — Internal Operations Platform</p>
            <p className="text-[11px] text-gray-400 mt-2">For support, contact your system administrator.</p>
          </div>

        </main>
      </div>
      )}

      {/* ── Technical Documentation ── */}
      {activeTab === 'tech' && (
      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-8">
        {/* Tech Sidebar TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-2">Sections</p>
            <nav className="space-y-0.5">
              {TECH_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] font-medium transition-colors ${
                    activeTechSection === s.id
                      ? 'bg-[#2E3093] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </nav>
            <div className="mt-5 px-2 space-y-2">
              <button
                onClick={downloadTechDoc}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#2E3093] text-white text-[12px] font-semibold rounded-lg hover:bg-[#252880] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download .md
              </button>
              <Link href="/dashboard" className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2E3093] hover:underline">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </aside>

        {/* Tech Content */}
        <main ref={techContentRef} className="flex-1 min-w-0 space-y-2">

          {/* Download button — mobile */}
          <div className="lg:hidden flex justify-end mb-2">
            <button
              onClick={downloadTechDoc}
              className="flex items-center gap-2 px-4 py-2 bg-[#2E3093] text-white text-[12px] font-semibold rounded-lg hover:bg-[#252880] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Documentation
            </button>
          </div>

          {/* ── 1. Tech Stack ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-stack" title="Tech Stack & Architecture" />
            <P>SIT Manager is a full-stack Next.js application using the App Router with a MySQL primary database, Redis caching, and a dual SMTP/SES email system.</P>
            <Table
              headers={['Package', 'Version', 'Purpose']}
              rows={[
                ['next', '^16.2.1', 'App framework (App Router, RSC + Client Components)'],
                ['react', '19.2.3', 'UI library'],
                ['typescript', '^5', 'Type system'],
                ['tailwindcss', '^4', 'Utility-first CSS framework'],
                ['mysql2', '^3.16.3', 'MySQL driver — promise API, connection pooling'],
                ['jose', '^6.1.3', 'JWT creation and verification (HS256)'],
                ['ioredis', '^5.10.1', 'Redis client for caching and rate limiting'],
                ['nodemailer', '^8.0.4', 'SMTP email sending'],
                ['@aws-sdk/client-ses', '^3.1025.0', 'AWS SES email fallback'],
                ['exceljs', '^4.4.0', 'Excel file generation and parsing'],
                ['xlsx', '^0.18.5', 'Legacy Excel import support'],
                ['recharts', '^3.8.1', 'Chart components (bar, line, pie)'],
                ['@tiptap/react', '^3.19.0', 'Rich text editor (discussions, notes)'],
                ['lucide-react', '^0.564.0', 'Icon library'],
                ['file-saver', '^2.0.5', 'Client-side file download'],
                ['jszip', '^3.10.1', 'ZIP archive creation'],
                ['express', '^5.2.1', 'Legacy backend proxy server (appp-lite)'],
              ]}
            />
          </section>

          <Divider />

          {/* ── 2. Environment Variables ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-env" title="Environment Variables" />
            <Note>All variables are read at server startup. Client-side code cannot access any of these.</Note>

            <EnvGroup title="Primary Database — Required">
              <EnvRow name="DB_HOST" required description="MySQL hostname or IP address" />
              <EnvRow name="DB_NAME" required description="Primary database name" />
              <EnvRow name="DB_USER" required description="MySQL username" />
              <EnvRow name="DB_PASSWORD" required description="MySQL password" />
              <EnvRow name="DB_PORT" description="MySQL port (default: 3306)" />
            </EnvGroup>

            <EnvGroup title="Authentication — Required">
              <EnvRow name="JWT_SECRET" required description="HS256 signing secret for session JWTs. Must be at least 32 random characters." />
            </EnvGroup>

            <EnvGroup title="Caching & Rate Limiting">
              <EnvRow name="REDIS_URL" description="Redis connection URL (e.g. redis://localhost:6379). Falls back to in-memory cache if absent." />
            </EnvGroup>

            <EnvGroup title="Cron Security">
              <EnvRow name="CRON_SECRET" description="Bearer token required by all /api/cron/* endpoints. Set in the external cron scheduler." />
            </EnvGroup>

            <EnvGroup title="Legacy Database (Sync Source — Read-Only)">
              <EnvRow name="OLD_DB_HOST" description="Legacy MySQL hostname" />
              <EnvRow name="OLD_DB_PORT" description="Legacy MySQL port" />
              <EnvRow name="OLD_DB_NAME" description="Legacy database name" />
              <EnvRow name="OLD_DB_USER" description="Legacy MySQL username" />
              <EnvRow name="OLD_DB_PASSWORD" description="Legacy MySQL password" />
            </EnvGroup>

            <EnvGroup title="Email — SMTP (Primary)">
              <EnvRow name="ADMISSION_SMTP_HOST" description="SMTP server hostname" />
              <EnvRow name="ADMISSION_SMTP_PORT" description="SMTP port (typically 587 for STARTTLS)" />
              <EnvRow name="ADMISSION_SMTP_USER" description="SMTP authentication username" />
              <EnvRow name="ADMISSION_SMTP_PASS" description="SMTP authentication password" />
              <EnvRow name="ADMISSION_FROM_EMAIL" description="From address shown on outgoing emails" />
            </EnvGroup>

            <EnvGroup title="Email — AWS SES (Fallback)">
              <EnvRow name="ADMISSION_AWS_SES_ACCESS_KEY_ID" description="AWS IAM access key with SES send permissions" />
              <EnvRow name="ADMISSION_AWS_SES_SECRET_ACCESS_KEY" description="AWS IAM secret key" />
              <EnvRow name="ADMISSION_AWS_SES_REGION" description="AWS region (e.g. ap-south-1)" />
            </EnvGroup>

            <EnvGroup title="Alumni / Jobs">
              <EnvRow name="ALUMNI_JOBS_SOURCE_EMAIL" description="From address for alumni job notification emails" />
            </EnvGroup>
          </section>

          <Divider />

          {/* ── 3. Project Structure ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-structure" title="Project Structure" />
            <CodeBlock>{`sitmanager/
├── app/                         # Next.js App Router root
│   ├── layout.tsx               # Root layout (fonts, metadata)
│   ├── page.tsx                 # Login page
│   ├── dashboard/
│   │   ├── layout.tsx           # Dashboard shell: topbar + sidebar nav
│   │   ├── page.tsx             # Home (role-based widget grid)
│   │   ├── inquiry/             # Inquiry management
│   │   ├── admission/           # Online admission review
│   │   ├── student/             # Student list & profiles
│   │   ├── daily-activities/    # Attendance, lectures, exams, feedback
│   │   ├── masters/             # Reference data (courses, batches…)
│   │   ├── corporate/           # Corporate training inquiry & execution
│   │   ├── placement/           # Jobs, screening, mock interviews
│   │   ├── finance/             # Finance dashboard
│   │   ├── cbd/                 # CBD dashboard & content calendar
│   │   ├── reports/             # Report pages
│   │   ├── roles/               # Role & permission management
│   │   ├── manual/              # Documentation (this page)
│   │   └── components/          # Shared dashboard widgets
│   └── api/                     # Next.js Route Handlers
│       ├── auth/                # login, logout, reset-password, session
│       ├── inquiry/             # CRUD + options + discussions
│       ├── finance/             # Finance CRUD (resource factory)
│       ├── cron/                # Background sync jobs
│       └── …                   # Other module APIs
├── lib/
│   ├── db.ts                    # MySQL pool, query(), queryOne(), cached()
│   ├── auth.ts                  # JWT, cookie management, verifySession()
│   ├── permissions.ts           # RBAC — hasPermission(), getPermissions()
│   ├── finance-resource.ts      # ResourceConfig factory
│   ├── mailer.ts                # Dual SMTP/SES email sender
│   ├── rate-limit.ts            # Redis Lua sliding-window rate limiter
│   └── cache.ts                 # Two-tier Redis + in-memory cache
├── scripts/
│   ├── cron/                    # Cron job runner scripts (Node.js ESM)
│   └── db/                      # One-off DB import/migration scripts
└── public/                      # Static assets`}</CodeBlock>
          </section>

          <Divider />

          {/* ── 4. Database ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-db" title="Database Layer" />
            <H3>Connection Pool</H3>
            <P>A single mysql2 connection pool is created once per Node.js process and stored in a global variable to survive Next.js hot-reload in development. All DB access goes through <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">getPool()</code>.</P>
            <CodeBlock>{`// lib/db.ts (simplified)
import { createPool } from 'mysql2/promise';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = createPool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT ?? 3306),
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}`}</CodeBlock>

            <H3>Query Helpers</H3>
            <Table
              headers={['Helper', 'Signature', 'Returns']}
              rows={[
                ['query', 'query<T>(sql, params?)', 'T[] — all matching rows'],
                ['queryOne', 'queryOne<T>(sql, params?)', 'T | null — first row or null'],
                ['cached', 'cached<T>(key, ttlSec, fn)', 'T — from cache or fn()'],
              ]}
            />

            <H3>Schema Migrations</H3>
            <P>Finance and other modules use <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">ensureOnce(key, fn)</code> to run <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">CREATE TABLE IF NOT EXISTS</code> exactly once per process. This prevents repeated schema checks on every API request while still auto-creating tables on first deploy.</P>
          </section>

          <Divider />

          {/* ── 5. Auth ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-auth" title="Authentication" />
            <H3>Login Flow</H3>
            <Steps items={[
              'Client POSTs <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">{ email, password }</code> to <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">/api/auth/login</code>',
              'Rate limiter checks IP: <strong>5 attempts per 60 s</strong> (Redis sliding window)',
              'DB query fetches user record by email from <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">users</code> table',
              'Password compared using MD5 hash (legacy compatibility) or plain comparison',
              'On success: JWT signed with HS256 using <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">JWT_SECRET</code>',
              'JWT payload: <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">{ userId, name, email, roleId, department }</code>',
              'JWT set as <strong>httpOnly, Secure, SameSite=Strict</strong> cookie named <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">sit_session</code>',
            ]} />

            <H3>Session Verification</H3>
            <P>Every protected API route calls <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">verifySession(req)</code> from <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">lib/auth.ts</code>, which reads the cookie, verifies the JWT signature and expiry using jose, and returns the decoded payload or throws a 401 error.</P>

            <CodeBlock>{`// Typical protected route pattern
export async function GET(req: Request) {
  const session = await verifySession(req);   // throws 401 if invalid
  const rows = await query('SELECT …');
  return NextResponse.json(rows);
}`}</CodeBlock>

            <H3>Password Reset</H3>
            <P>Authenticated users POST to <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">/api/auth/reset-password</code> with their current and new password. On success the DB hash is updated and the session cookie is cleared.</P>
          </section>

          <Divider />

          {/* ── 6. RBAC ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-rbac" title="Roles & Permissions (RBAC)" />
            <H3>Data Model</H3>
            <CodeBlock>{`users            (id, email, password_hash, name, department, role_id)
roles            (id, title)
role_permissions (role_id, permission_key)`}</CodeBlock>

            <H3>Permission Key Format</H3>
            <P>Permission keys follow the pattern <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">&lt;module&gt;.&lt;action&gt;</code>:</P>
            <Bullets items={[
              '<code class="font-mono text-[12px] bg-gray-100 px-1 rounded">inquiry.view</code>, <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">inquiry.add</code>, <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">inquiry.edit</code>',
              '<code class="font-mono text-[12px] bg-gray-100 px-1 rounded">finance.view</code>, <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">finance.edit</code>',
              '<code class="font-mono text-[12px] bg-gray-100 px-1 rounded">placement.view</code>, <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">placement.add</code>',
              '…and so on for every module',
            ]} />

            <H3>Super Admin</H3>
            <P>A user is treated as Super Admin if <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">role_id === 1</code> OR their role title matches <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">&quot;Super Admin&quot;</code> (case-insensitive). Super Admins bypass all permission checks.</P>

            <H3>Permission Caching</H3>
            <P>Permission sets are cached for 5 minutes per role ID (Redis key: <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">role-perms:{'{'}roleId{'}'}</code>) to avoid a DB roundtrip on every API call. Permission changes take effect within 5 minutes without requiring a user re-login.</P>
          </section>

          <Divider />

          {/* ── 7. API ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-api" title="API Architecture" />
            <H3>Route Conventions</H3>
            <CodeBlock>{`app/api/<module>/
  route.ts           # Collection: GET (list), POST (create)
  [id]/
    route.ts         # Item: GET, PUT, DELETE
  options/
    route.ts         # Dropdown options (cached, no auth required for some)`}</CodeBlock>

            <H3>Standard Response Codes</H3>
            <Table
              headers={['Status', 'Meaning']}
              rows={[
                ['200', 'Success with JSON body'],
                ['400', 'Bad request / missing required field'],
                ['401', 'Not authenticated (no valid session cookie)'],
                ['403', 'Authenticated but missing permission key'],
                ['429', 'Rate limit exceeded — try again after window resets'],
                ['500', 'Internal error — logged server-side, generic message to client'],
              ]}
            />
          </section>

          <Divider />

          {/* ── 8. Finance Resource ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-finance" title="Finance Resource Pattern" />
            <P>To avoid duplicating CRUD boilerplate across 10+ finance sub-modules, <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">lib/finance-resource.ts</code> exports a factory that generates typed route handlers from a config object.</P>
            <CodeBlock>{`// Define a resource
const config: ResourceConfig = {
  table: 'finance_monthly_sit',
  columns: ['month', 'year', 'target', 'actual', 'notes'],
  idColumn: 'id',
};

// app/api/finance/monthly-sit/route.ts
export const { GET, POST } = collectionHandlers(config);

// app/api/finance/monthly-sit/[id]/route.ts
export const { GET, PUT, DELETE } = idHandlers(config);`}</CodeBlock>
            <P>Each generated handler automatically verifies the session, checks <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">finance.view</code> or <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">finance.edit</code> permissions, validates the required columns, and returns typed JSON.</P>
          </section>

          <Divider />

          {/* ── 9. Cron ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-cron" title="Background Jobs & Cron" />
            <H3>Security</H3>
            <P>All cron routes are at <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">/api/cron/*</code> and require a valid bearer token:</P>
            <CodeBlock>{`Authorization: Bearer <CRON_SECRET>`}</CodeBlock>

            <H3>Registered Jobs</H3>
            <Table
              headers={['Job', 'npm script', 'Syncs from legacy DB']}
              rows={[
                ['sync-courses', 'cron:sync-courses', 'Course master (course_mst)'],
                ['sync-batch', 'cron:sync-batch', 'Batch records (batch_mst)'],
                ['sync-inquiry', 'cron:sync-inquiry', 'Inquiry / lead records'],
                ['sync-alumni-jobs', 'cron:sync-alumni-jobs', 'Alumni job postings'],
                ['sync-consultancy', 'cron:sync-consultancy', 'Consultancy / deputation records'],
                ['sync-all', 'cron:sync-all', 'Chains all five sync jobs'],
                ['migrate-roll-numbers', '(DB script)', 'Roll number assignment migration'],
              ]}
            />

            <H3>Incremental Sync</H3>
            <P>Each sync job tracks the last-synced primary key (stored in a state table). On each run it fetches only rows where <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">id &gt; lastSyncedId</code>, upserts them into the new DB, then saves the new high-water mark. This keeps sync jobs fast on large tables.</P>

            <Note>The legacy DB connection is enforced as read-only — any write attempt to it will throw an error at the application layer.</Note>
          </section>

          <Divider />

          {/* ── 10. Cache ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-cache" title="Caching Layer" />
            <H3>Two-Tier Architecture</H3>
            <CodeBlock>{`Request
  → Redis (if REDIS_URL is set)    ← primary cache, survives across instances
  → In-memory Map (fallback)       ← per-instance, lost on restart
  → DB query (on cache miss)`}</CodeBlock>

            <H3>TTL Reference</H3>
            <Table
              headers={['Data', 'TTL', 'Cache key pattern']}
              rows={[
                ['Role permissions', '300 s', 'role-perms:{roleId}'],
                ['Inquiry form options', '300 s', 'inquiry-form-options'],
                ['Finance options', '600 s', 'finance-options-*'],
                ['Dashboard stats', '30–120 s', 'module-specific'],
              ]}
            />

            <H3>Usage</H3>
            <CodeBlock>{`import { cached } from '@/lib/db';

const data = await cached('my-cache-key', 300, async () => {
  return await pool.query('SELECT …');
});`}</CodeBlock>
          </section>

          <Divider />

          {/* ── 11. Rate Limiting ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-ratelimit" title="Rate Limiting" />
            <P>Rate limiting uses an atomic Redis Lua script (sliding window counter) keyed by IP address. If Redis is unavailable, rate limiting degrades gracefully and all requests are allowed through.</P>
            <Table
              headers={['Endpoint', 'Max Requests', 'Window']}
              rows={[
                ['POST /api/auth/login', '5', '60 s'],
                ['GET|POST /api/*', '100', '60 s'],
                ['Dashboard pages', '60', '60 s'],
              ]}
            />
            <P>Requests that exceed the limit receive HTTP <strong>429</strong> with body <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">{'{"error":"Too many requests."}'}</code>.</P>
          </section>

          <Divider />

          {/* ── 12. Email ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-email" title="Email System" />
            <P><code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">lib/mailer.ts</code> exposes a single <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">sendMail()</code> function that tries SMTP first and falls back to AWS SES automatically.</P>
            <Table
              headers={['Trigger', 'Template']}
              rows={[
                ['Send admission form to student', 'HTML with personalised token URL'],
                ['Email shortlisted CVs to recruiter', 'HTML + student profile attachments'],
                ['Alumni job notification', 'Job detail HTML email'],
                ['Student feedback form', 'HTML with unique feedback token URL'],
              ]}
            />
            <CodeBlock>{`import { sendMail } from '@/lib/mailer';

await sendMail({
  to: 'student@example.com',
  subject: 'Your Admission Form — Suvidya Institute',
  html: '<p>…</p>',
});`}</CodeBlock>
          </section>

          <Divider />

          {/* ── 13. Deployment ── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <TechHeading id="tech-deploy" title="Deployment" />
            <H3>Required Services</H3>
            <Bullets items={[
              '<strong>MySQL 8+</strong> — primary database (all SIT Manager data)',
              '<strong>Legacy MySQL</strong> — read-only source for cron sync jobs',
              '<strong>Redis</strong> — optional but recommended (caching + rate limiting)',
              '<strong>SMTP server or AWS SES</strong> — email sending',
            ]} />

            <H3>Minimum Required Env Vars</H3>
            <CodeBlock>{`DB_HOST=
DB_NAME=
DB_USER=
DB_PASSWORD=
JWT_SECRET=`}</CodeBlock>

            <H3>Build & Start</H3>
            <CodeBlock>{`npm run build
npm start           # Next.js production server on port 3000

# Legacy backend proxy (if needed)
npm run backend:appp-lite`}</CodeBlock>

            <H3>Vercel Deployment</H3>
            <Steps items={[
              'Connect the GitHub repository to a Vercel project',
              'Add all required environment variables under Project → Settings → Environment Variables',
              'Configure cron jobs in Vercel to call <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">/api/cron/sync-all</code> on schedule with the <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">Authorization: Bearer CRON_SECRET</code> header',
              'Deploy — Vercel builds with <code class="font-mono text-[12px] bg-gray-100 px-1 rounded">next build</code> automatically',
            ]} />

            <Tip>Run <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">npm run vercel:env</code> locally to check that all required environment variables are set before deploying.</Tip>
          </section>

          <Divider />

          {/* Footer */}
          <div className="bg-gradient-to-br from-[#2E3093]/5 to-[#2A6BB5]/5 border border-[#2E3093]/10 rounded-2xl px-8 py-6 text-center">
            <p className="text-sm font-bold text-gray-800 mb-1">Suvidya Institute of Technology</p>
            <p className="text-[12px] text-gray-500">SIT Manager — Technical Reference</p>
            <p className="text-[11px] text-gray-400 mt-2">For questions about the codebase, refer to source code in <code className="font-mono">lib/</code> and <code className="font-mono">app/api/</code>.</p>
          </div>

        </main>
      </div>
      )}
    </div>
  );
}
