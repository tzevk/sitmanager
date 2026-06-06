/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPool } from '@/lib/db';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_SECRET!;

function verifySignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// POST /api/razorpay/webhook
// Razorpay sends events here. Configure this URL in the Razorpay dashboard:
//   https://<your-domain>/api/razorpay/webhook
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') ?? '';

    if (!signature || !verifySignature(rawBody, signature)) {
      console.warn('[Razorpay webhook] invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload: {
        payment?: { entity: any };
        order?:   { entity: any };
      };
    };

    const payment = event.payload.payment?.entity;
    const inquiryId = payment?.notes?.inquiryId;

    if (event.event === 'payment.captured' && payment && inquiryId) {
      await handlePaymentCaptured(payment, inquiryId);
    }

    if (event.event === 'payment.failed' && payment && inquiryId) {
      console.warn(`[Razorpay] payment failed — inquiryId=${inquiryId} paymentId=${payment.id}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Razorpay webhook] error:', err?.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCaptured(payment: any, inquiryId: string) {
  const pool = getPool();

  // Ensure the payments table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admission_payments (
      id             INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      inquiry_id     INT          NOT NULL,
      razorpay_order_id   VARCHAR(100) NOT NULL,
      razorpay_payment_id VARCHAR(100) NOT NULL,
      amount_paise   INT          NOT NULL,
      currency       VARCHAR(10)  NOT NULL DEFAULT 'INR',
      mode_of_payment VARCHAR(50) NULL,
      status         VARCHAR(30)  NOT NULL DEFAULT 'captured',
      captured_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_inquiry (inquiry_id),
      INDEX idx_payment (razorpay_payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {/* table may already exist */});

  await pool.query(
    `INSERT INTO admission_payments
       (inquiry_id, razorpay_order_id, razorpay_payment_id, amount_paise, currency, mode_of_payment, status)
     VALUES (?, ?, ?, ?, ?, ?, 'captured')
     ON DUPLICATE KEY UPDATE status = 'captured', captured_at = NOW()`,
    [
      Number(inquiryId),
      payment.order_id ?? '',
      payment.id,
      payment.amount,
      payment.currency ?? 'INR',
      payment.notes?.modeOfPayment ?? null,
    ]
  );

  console.log(`[Razorpay] payment captured — inquiryId=${inquiryId} paymentId=${payment.id} amount=${payment.amount}`);
}
