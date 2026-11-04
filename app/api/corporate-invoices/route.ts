import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import {
  listCorporateInvoices,
  createCorporateInvoice,
  getInvoicePrefill,
} from '@/lib/services/corporate-invoice.service';
import { invoiceErr } from '@/lib/corporate-invoice-http';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.view');
    if (auth instanceof NextResponse) return auth;
    const sp = new URL(req.url).searchParams;

    const prefillId = Number(sp.get('prefillInquiryId'));
    if (prefillId > 0) {
      const prefill = await getInvoicePrefill(prefillId);
      if (!prefill) return NextResponse.json({ error: 'Corporate inquiry not found' }, { status: 404 });
      return NextResponse.json({ prefill });
    }

    const result = await listCorporateInvoices({
      search: sp.get('search')?.trim() || '',
      status: sp.get('status')?.trim() || '',
      inquiryId: Number(sp.get('inquiryId')) || undefined,
    });
    return NextResponse.json(result);
  } catch (err) { return invoiceErr(err, 'GET failed'); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const created = await createCorporateInvoice(
      { ...body, Inquiry_Id: Number(body.Inquiry_Id) },
      auth.session.userId ?? null,
    );
    await logTableActivity(req, {
      tableName: 'corporate_invoice', action: 'CREATE', recordId: created.id,
      details: { invoiceNo: created.invoiceNo, inquiryId: Number(body.Inquiry_Id) },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) { return invoiceErr(err, 'POST failed'); }
}
