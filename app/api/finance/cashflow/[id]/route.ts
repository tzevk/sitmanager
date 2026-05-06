import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CASHFLOW } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CASHFLOW);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
