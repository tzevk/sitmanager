import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_LOANS } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_LOANS);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
