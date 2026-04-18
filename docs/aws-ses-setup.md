# AWS SES Setup Guide for Admission Emails

This guide helps you set up Amazon SES (Simple Email Service) for sending admission form emails.

## Prerequisites

- AWS Account
- AWS CLI or AWS Console access
- IAM permissions to manage SES and IAM users

## Step 1: Request Production Access (If Needed)

By default, SES accounts are in **Sandbox Mode**, which limits you to sending 1 email/second to verified addresses only.

To move out of sandbox:
1. Go to AWS Console → **SES** → **Dashboard**
2. Under "Account Dashboard", click **Request Production Access**
3. Fill the application form with:
   - **Use case**: Sending admission form emails
   - **Website URL**: Your domain
   - **Expected volume**: Estimated daily emails
4. AWS will review within 1-2 business days

## Step 2: Verify Email Address

In AWS Console → **SES** → **Verified identities**:

1. Click **Create identity**
2. Select **Email address**
3. Enter your from-email (e.g., `noreply@yourdomain.com`)
4. AWS sends verification email
5. Click the verification link in your email inbox

**Common setup options:**
- Use domain verification for `@yourdomain.com` (allows any sender@yourdomain.com)
- Use email verification for specific address only

## Step 3: Create IAM User with SES Permission

In AWS Console → **IAM** → **Users**:

1. Click **Create user**
2. Enter username: `sitmanager-ses` (or your preference)
3. Click **Next**
4. Click **Attach policies directly**
5. Search for `AmazonSesSendingAccess` policy
6. Select it and click **Next** → **Create user**

## Step 4: Generate Access Keys

For the IAM user created above:

1. Go to **Security credentials** tab
2. Click **Create access key**
3. Select **Application running outside AWS**
4. Click **Next** → **Create access key**
5. **Copy and save:**
   - Access Key ID
   - Secret Access Key

**⚠️ Important**: Save these immediately—AWS only shows them once.

## Step 5: Configure Your Application

Choose one mode:

### Option A: SES SMTP mode (recommended when you already have SMTP credentials)

Use your SES SMTP endpoint in the same region as your verified identities:

```bash
ADMISSION_MAIL_PROVIDER=smtp
ADMISSION_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
ADMISSION_SMTP_PORT=587
ADMISSION_SMTP_SECURE=0
ADMISSION_SMTP_USER=YOUR_SES_SMTP_USERNAME
ADMISSION_SMTP_PASS=YOUR_SES_SMTP_PASSWORD
ADMISSION_SMTP_FROM=noreply@yourdomain.com
ADMISSION_SMTP_REPLY_TO=support@yourdomain.com
```

Notes:
- `ADMISSION_SMTP_PORT=587` + `ADMISSION_SMTP_SECURE=0` uses STARTTLS.
- TLS wrapper ports (`465`, `2465`) require `ADMISSION_SMTP_SECURE=1`.
- Ensure sender identity is verified in SES for `us-east-1`.

### Option B: SES SDK mode

Update your `.env.local` or `.env` file:

```bash
# Set mail provider to SES
ADMISSION_MAIL_PROVIDER=ses

# AWS SES Configuration
ADMISSION_AWS_SES_REGION=us-east-1
ADMISSION_AWS_SES_ACCESS_KEY=YOUR_ACCESS_KEY_ID
ADMISSION_AWS_SES_SECRET_KEY=YOUR_SECRET_ACCESS_KEY
ADMISSION_AWS_SES_FROM_EMAIL=noreply@yourdomain.com
ADMISSION_AWS_SES_REPLY_TO=support@yourdomain.com
```

Replace values with your actual credentials.

## Step 6: Test Email Sending

Once configured, try sending an admission form from the dashboard:

1. Go to **Dashboard** → **Inquiry** → **Add Inquiry**
2. Fill inquiry details and click **Send Admission Form**
3. Enter test email address
4. Click **Send**

Check your email inbox for the admission form link.

## AWS SES Regions

Choose closest region for lower latency:

| Region | Code | Use Case |
|--------|------|----------|
| N. Virginia | us-east-1 | US/Global |
| Ohio | us-west-2 | US West |
| Ireland | eu-west-1 | Europe |
| Frankfurt | eu-central-1 | Central Europe |
| Singapore | ap-southeast-1 | Asia-Pacific |
| Tokyo | ap-northeast-1 | Japan/Asia |
| Sydney | ap-southeast-2 | Australia |

## Monitoring & Troubleshooting

### Check Sending Statistics

AWS Console → **SES** → **Sending statistics**:
- View bounces, complaints, delivery rates
- Monitor sending quota

### Common Issues

**Issue**: "Email not verified"
- **Solution**: Verify email in SES console (Step 2)

**Issue**: "Configuration set not found"
- **Solution**: Not needed for basic setup; error indicates missing optional config

**Issue**: "Throttling - Maximum sending rate exceeded"
- **Solution**: SES limits you to 14 emails/second in production by default. Request higher limit in AWS Console.

**Issue**: "Service restricted to sandbox"
- **Solution**: Request production access (Step 1)

**Issue**: "Access Denied"
- **Solution**: Check IAM policy includes `AmazonSesSendingAccess` and trust relationship

### Debug Logs

Enable error logging in your app to see SES responses:

```typescript
// In lib/mailer.ts, errors will be thrown with AWS SES details
try {
  await sendAdmissionFormEmail(...);
} catch (error) {
  console.error('SES Error:', error);
  // Will show: Code, Message, and details
}
```

## Email Quotas & Rate Limits

**Default Production Quota:**
- **Sending Rate**: 14 emails per second
- **Daily Sending Limit**: 50,000 emails per day

**To increase:**
1. AWS Console → **SES** → **Send limit increase**
2. Submit request with business justification
3. AWS reviews within 1-2 days

## Cost

AWS SES pricing (as of 2024):
- **First 62,000 emails**: Free (per month)
- **Beyond 62,000**: $0.10 per 1,000 emails
- No charge for bounces/complaints (counted against quota limit)

## Security Best Practices

1. **Rotate Access Keys**: Every 90 days minimum
2. **Use Separate User**: Don't use root account credentials
3. **Restrict Permissions**: Use `AmazonSesSendingAccess` (more restrictive than full SES)
4. **Monitor Sending**: Set CloudWatch alarms for bounce rates
5. **Verify Domain**: Enables DKIM signing for authenticity

## Next Steps

- Configure email templates for different scenarios (acceptance, rejection, etc.)
- Set up bounce/complaint handling
- Monitor delivery in AWS CloudWatch
- Consider adding DKIM/SPF records for domain verification

## Support

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
- [AWS Support Center](https://console.aws.amazon.com/support/)
