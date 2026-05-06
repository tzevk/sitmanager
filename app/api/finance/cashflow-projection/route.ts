import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CASHFLOW_PROJECTION } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_CASHFLOW_PROJECTION);
export const GET  = handlers.GET;
export const POST = handlers.POST;
