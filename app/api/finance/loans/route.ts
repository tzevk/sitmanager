import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_LOANS } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_LOANS);
export const GET  = handlers.GET;
export const POST = handlers.POST;
