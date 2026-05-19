import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CT_YEARLY } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_CT_YEARLY);
export const GET  = handlers.GET;
export const POST = handlers.POST;
