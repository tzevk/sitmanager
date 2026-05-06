import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_DEPT_PERFORMANCE } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_DEPT_PERFORMANCE);
export const GET  = handlers.GET;
export const POST = handlers.POST;
