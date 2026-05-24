# Meta Ads Setup

This workspace now supports Meta lead ingestion into the inquiry module through a public webhook and a protected campaign performance API.

## What it does

- Verifies the Meta webhook challenge.
- Accepts Meta leadgen webhook events at `/api/public/meta-ads/webhook`.
- Fetches lead details from the Meta Graph API using the lead ID.
- Creates a new inquiry or links the lead to an existing inquiry when the same mobile or email already exists.
- Stores Meta-specific metadata in `meta_ads_lead_sync`.
- Surfaces campaign, form, tags, duplicate flags, filtering, and export on the inquiry listing page.
- Shows campaign reach/click/lead/spend summary on the inquiry listing page.

## Environment variables

Required for webhook ingestion:

```env
META_WEBHOOK_VERIFY_TOKEN=your-random-verify-token
META_ACCESS_TOKEN=your-meta-system-user-access-token
```

Recommended for secure signature validation:

```env
META_APP_SECRET=your-meta-app-secret
```

Required for campaign performance:

```env
META_AD_ACCOUNT_ID=123456789012345
```

Optional:

```env
META_GRAPH_VERSION=v22.0
META_LEAD_NOTIFY_EMAILS=admissions@example.com,counsellor@example.com
```

## Meta App configuration

1. In Meta for Developers, add the Webhooks product.
2. Subscribe the Page object to the `leadgen` field.
3. Set the callback URL to:

```text
https://your-domain.com/api/public/meta-ads/webhook
```

4. Use the same value from `META_WEBHOOK_VERIFY_TOKEN` as the verify token in Meta.
5. Make sure the access token in `META_ACCESS_TOKEN` can read leads and ad insights.

## Inquiry mapping

- `Inquiry_Type` => `Meta Ads`
- `Inquiry_From` => `Meta Instant Form`
- Duplicate match => latest inquiry with the same normalized mobile or same email
- Tags => stored in `meta_ads_lead_sync.tags_json`
- Campaign/form/ad metadata => stored in `meta_ads_lead_sync`

## Runtime notes

- If `META_APP_SECRET` is configured, the webhook validates `x-hub-signature-256`.
- If `META_AD_ACCOUNT_ID` is missing, the inquiry page still works, but the Meta campaign panel will show an error message.
- Notification emails are optional. If `META_LEAD_NOTIFY_EMAILS` is unset, lead sync still works.