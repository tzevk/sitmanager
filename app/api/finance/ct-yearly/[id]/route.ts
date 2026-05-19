import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CT_YEARLY } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CT_YEARLY);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
