import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CT_MONTHLY } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CT_MONTHLY);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
