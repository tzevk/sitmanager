import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_PROJECTS } from '@/lib/finance-tables';

const handlers = collectionHandlers(FINANCE_PROJECTS);
export const GET  = handlers.GET;
export const POST = handlers.POST;
