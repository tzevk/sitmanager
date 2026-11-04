import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import {
  getCorporateInvoice,
  updateCorporateInvoice,
  setInvoiceCancelled,
} from '@/lib/services/corporate-invoice.service';
import { invoiceErr } from '@/lib/corporate-invoice-http';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.view');
    if (auth instanceof NextResponse) return auth;
    const invoice = await getCorporateInvoice(Number((await params).id));
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (err) { return invoiceErr(err, 'GET failed'); }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const id = Number((await params).id);
    const body = await req.json();
    await updateCorporateInvoice(id, { ...body, Inquiry_Id: Number(body.Inquiry_Id) });
    await logTableActivity(req, { tableName: 'corporate_invoice', action: 'UPDATE', recordId: id, details: {} });
    return NextResponse.json({ ok: true });
  } catch (err) { return invoiceErr(err, 'PUT failed'); }
}

/** PATCH { cancelled: boolean } — cancel or restore an invoice (numbers are never reused). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const id = Number((await params).id);
    const { cancelled } = await req.json();
    await setInvoiceCancelled(id, Boolean(cancelled));
    await logTableActivity(req, {
      tableName: 'corporate_invoice', action: 'UPDATE', recordId: id, details: { cancelled: Boolean(cancelled) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) { return invoiceErr(err, 'PATCH failed'); }
}
