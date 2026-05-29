# Suvidya Pune Inquiries

This repo includes a dedicated DB view for Suvidya inquiries whose stored source contains `pune`.

## Create Or Refresh The View

Run:

```bash
set -a && source ./.env && set +a && node scripts/db/create-suvidya-pune-inquiries-view.mjs
```

The script creates or replaces `vw_suvidya_pune_inquiries` against the actual local inquiry table name.

## Base Query

```sql
SELECT *
FROM vw_suvidya_pune_inquiries
ORDER BY source_created_day DESC, source_inquiry_id DESC;
```

## Split By Course

```sql
SELECT
  COALESCE(NULLIF(TRIM(source_course), ''), 'Unknown') AS source_course,
  COUNT(*) AS inquiry_count
FROM vw_suvidya_pune_inquiries
GROUP BY COALESCE(NULLIF(TRIM(source_course), ''), 'Unknown')
ORDER BY inquiry_count DESC, source_course ASC;
```

## Split By Date

```sql
SELECT
  COALESCE(CAST(source_created_day AS CHAR), 'Unknown') AS source_created_day,
  COUNT(*) AS inquiry_count
FROM vw_suvidya_pune_inquiries
GROUP BY COALESCE(CAST(source_created_day AS CHAR), 'Unknown')
ORDER BY source_created_day DESC;
```

## Split By Location

```sql
SELECT
  COALESCE(NULLIF(TRIM(source_location), ''), 'Unknown') AS source_location,
  COUNT(*) AS inquiry_count
FROM vw_suvidya_pune_inquiries
GROUP BY COALESCE(NULLIF(TRIM(source_location), ''), 'Unknown')
ORDER BY inquiry_count DESC, source_location ASC;
```

## Export Current Breakdowns

Run:

```bash
set -a && source ./.env && set +a && node scripts/export-suvidya-pune-breakdown.mjs
```

This writes the current local Pune slice into:

- `public/reports/suvidya-pune-inquiries-detailed.csv`
- `public/reports/suvidya-pune-by-course.csv`
- `public/reports/suvidya-pune-by-date.csv`
- `public/reports/suvidya-pune-by-location.csv`
