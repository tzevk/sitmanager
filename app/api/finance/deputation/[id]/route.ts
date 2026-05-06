import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_DEPUTATION } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_DEPUTATION);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
