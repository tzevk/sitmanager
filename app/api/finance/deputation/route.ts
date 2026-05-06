import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_DEPUTATION } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_DEPUTATION);
export const GET  = handlers.GET;
export const POST = handlers.POST;
