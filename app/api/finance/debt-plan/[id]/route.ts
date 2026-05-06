import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_DEBT_PLAN } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_DEBT_PLAN);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
