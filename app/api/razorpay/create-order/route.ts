import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimiter } from '@/lib/rate-limit';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

// POST /api/razorpay/create-order
// Public — called by the admission form; students are not authenticated.
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const keyId     = process.env.RAZORPAY_KEY?.trim();
    const keySecret = process.env.RAZORPAY_SECRET?.trim();

    if (!keyId || !keySecret) {
      console.error('[Razorpay] RAZORPAY_KEY or RAZORPAY_SECRET not set');
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    const { inquiryId, amountRaw, modeOfPayment, studentName, email } = await req.json();

    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }
    if (!amountRaw || Number(amountRaw) < 100) {
      return NextResponse.json({ error: 'Amount must be at least ₹1' }, { status: 400 });
    }
    if (!['Full Payment', '50% Installment'].includes(modeOfPayment)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const rzpRes = await fetch(`${RAZORPAY_API}/orders`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   Math.round(Number(amountRaw)),
        currency: 'INR',
        receipt:  `sit_${inquiryId}_${Date.now()}`.slice(0, 40),
        notes: {
          inquiryId:     String(inquiryId),
          modeOfPayment: String(modeOfPayment),
          studentName:   String(studentName ?? '').slice(0, 50),
          email:         String(email ?? '').slice(0, 100),
        },
      }),
    });

    const order = await rzpRes.json();

    if (!rzpRes.ok) {
      console.error('[Razorpay] order creation failed:', rzpRes.status, order);
      const msg = order?.error?.description || order?.error?.code || `Razorpay error ${rzpRes.status}`;
      return NextResponse.json({ error: msg }, { status: rzpRes.status });
    }

    return NextResponse.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err: unknown) {
    console.error('[Razorpay] create-order error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}
