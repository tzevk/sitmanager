import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CBD_PERFORMANCE } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_CBD_PERFORMANCE);
export const GET  = handlers.GET;
export const POST = handlers.POST;
