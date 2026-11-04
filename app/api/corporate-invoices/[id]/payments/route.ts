import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import { addInvoicePayment, deleteInvoicePayment } from '@/lib/services/corporate-invoice.service';
import { invoiceErr } from '@/lib/corporate-invoice-http';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const id = Number((await params).id);
    const body = await req.json();
    await addInvoicePayment(id, body, auth.session.userId ?? null);
    await logTableActivity(req, {
      tableName: 'corporate_invoice_payment', action: 'CREATE', recordId: id,
      details: { amount: Number(body.Amount) || 0, tds: Number(body.TDS_Amount) || 0 },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) { return invoiceErr(err, 'POST failed'); }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const id = Number((await params).id);
    const paymentId = Number(new URL(req.url).searchParams.get('paymentId'));
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    await deleteInvoicePayment(id, paymentId);
    await logTableActivity(req, {
      tableName: 'corporate_invoice_payment', action: 'DELETE', recordId: paymentId, details: { invoiceId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) { return invoiceErr(err, 'DELETE failed'); }
}
