import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Trainer Portal – SIT' };

export default function TrainerPortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
