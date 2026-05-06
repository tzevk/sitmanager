import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CT_PERFORMANCE } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CT_PERFORMANCE);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
