This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev

## Cron: legacy → new DB sync

This project supports syncing reference data from a legacy (old) MySQL database into the current (new) database via a cron-triggered API route.

### Environment variables

New DB (existing):

- `DB_HOST`, `DB_PORT` (optional), `DB_NAME`, `DB_USER`, `DB_PASSWORD`

Old DB (source, read-only):

- `OLD_DB_HOST`, `OLD_DB_PORT` (optional), `OLD_DB_NAME`, `OLD_DB_USER`, `OLD_DB_PASSWORD`
- Optional: `OLD_DB_CONNECTION_LIMIT`, `OLD_DB_SSL`

Cron auth (recommended in production):

- `CRON_SECRET` (send as request header `x-cron-secret` when triggering manually)

### Endpoints

- `GET /api/cron/sync-all` — Incrementally upserts **all** base tables (requires primary keys) from old → new.
- `GET /api/cron/sync-courses` — Incrementally upserts `course_mst` from old → new.

### Manual run (local)

1. Ensure `BASE_URL` is set (or it defaults to `http://localhost:3000`).
2. Run `npm run cron:sync-all`.

Notes:

- Tables without a primary key are skipped.
- Use `SYNC_EXCLUDE_TABLES` (comma-separated) to skip specific tables (e.g. `SYNC_EXCLUDE_TABLES=logs,tmp_table`).
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
