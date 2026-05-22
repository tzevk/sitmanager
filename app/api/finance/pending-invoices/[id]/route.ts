import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_PENDING_INVOICES } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_PENDING_INVOICES);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
