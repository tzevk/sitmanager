import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CT_PERFORMANCE } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_CT_PERFORMANCE);
export const GET  = handlers.GET;
export const POST = handlers.POST;
