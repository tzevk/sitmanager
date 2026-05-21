import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CT_MONTHLY } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_CT_MONTHLY);
export const GET  = handlers.GET;
export const POST = handlers.POST;
