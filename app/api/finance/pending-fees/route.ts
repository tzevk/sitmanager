import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_PENDING_FEES } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_PENDING_FEES);
export const GET  = handlers.GET;
export const POST = handlers.POST;
