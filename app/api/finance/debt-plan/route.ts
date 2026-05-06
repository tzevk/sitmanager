import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_DEBT_PLAN } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_DEBT_PLAN);
export const GET  = handlers.GET;
export const POST = handlers.POST;
