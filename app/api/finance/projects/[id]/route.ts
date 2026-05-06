import { idHandlers } from '@/lib/finance-resource';
import { FINANCE_PROJECTS } from '@/lib/finance-tables';

const handlers = idHandlers(FINANCE_PROJECTS);
export const PUT    = handlers.PUT;
export const DELETE = handlers.DELETE;
