import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CBD_PERFORMANCE } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CBD_PERFORMANCE);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
