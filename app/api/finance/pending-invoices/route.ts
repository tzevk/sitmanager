import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_PENDING_INVOICES } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_PENDING_INVOICES);
export const GET  = handlers.GET;
export const POST = handlers.POST;
