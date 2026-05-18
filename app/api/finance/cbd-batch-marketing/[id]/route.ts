import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_CBD_BATCH_MARKETING } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_CBD_BATCH_MARKETING);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
