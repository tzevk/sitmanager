import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CBD_BATCH_MARKETING } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_CBD_BATCH_MARKETING);
export const GET  = handlers.GET;
export const POST = handlers.POST;
