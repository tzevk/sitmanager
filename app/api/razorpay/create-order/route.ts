/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { apiRateLimiter } from '@/lib/rate-limit';

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY!,
  key_secret: process.env.RAZORPAY_SECRET!,
});

// POST /api/razorpay/create-order
// Public endpoint — called by the admission form (students are not authenticated).
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const { inquiryId, amountPaise, modeOfPayment, studentName, email } = body as {
      inquiryId: string | number;
      amountPaise: number;        // amount in paise (INR × 100)
      modeOfPayment: string;
      studentName?: string;
      email?: string;
    };

    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }
    if (!amountPaise || amountPaise < 100) {
      return NextResponse.json({ error: 'Amount must be at least ₹1' }, { status: 400 });
    }
    if (!['Full Payment', '50% Installment'].includes(modeOfPayment)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(amountPaise),
      currency: 'INR',
      receipt:  `sit_${inquiryId}_${Date.now()}`,
      notes: {
        inquiryId:      String(inquiryId),
        modeOfPayment,
        studentName:    studentName ?? '',
        email:          email ?? '',
      },
    });

    return NextResponse.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY,
    });
  } catch (err: any) {
    console.error('[Razorpay] create-order error:', err);
    return NextResponse.json(
      { error: err?.error?.description || err?.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
