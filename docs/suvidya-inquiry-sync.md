## Suvidya Inquiry Sync

This app can pull inquiry records from the live Suvidya Admission API and insert them into the local `Student_Inquiry` flow.

### Source API

- URL: `https://suvidya.ac.in/admission/GetInquiry.php`
- Method: `GET`
- Response: JSON with records from `enquiry_form` and `quick_enquiry_form`

### App Route

- Cron/manual endpoint: `/api/cron/suvidya-inquiry-sync`
- Vercel cron schedule: `*/5 * * * *` (every 5 minutes)
- Methods: `GET`, `POST`
- Auth:
  - `x-vercel-cron` header from Vercel Cron, or
  - `Authorization: Bearer <CRON_SECRET>`, or
  - `x-cron-secret: <CRON_SECRET>`, or
  - `?secret=<CRON_SECRET>`

### Query Params

- `maxRecords`: limit how many newest Suvidya records are considered per run
- `sinceHours`: only import records newer than the last N hours

### Environment Variables

- `SUVIDYA_INQUIRY_API_URL`: override the default source URL
- `SUVIDYA_INQUIRY_SYNC_MAX_RECORDS`: default max records per run
- `SUVIDYA_INQUIRY_SYNC_SINCE_HOURS`: optional default age filter

### Mapping

- `first_name` -> `Student_Name`
- `email_id` -> `Email`
- `phone` -> `Present_Mobile`
- `select_qualification` -> `Qualification`
- `select_course` -> matched against `course_mst.Course_Name` when possible
- `page_source` -> `Inquiry_From`
- `created_date` -> `Inquiry_Dt`
- `table_name` -> mapped into local `Inquiry_Type`

### Idempotency

Imported records are tracked in `suvidya_inquiry_sync` using the pair:

- `source_table_name`
- `source_inquiry_id`

That prevents duplicate local inserts across repeated cron runs.