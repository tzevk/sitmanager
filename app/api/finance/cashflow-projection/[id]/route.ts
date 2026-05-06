import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CASHFLOW_PROJECTION } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CASHFLOW_PROJECTION);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
