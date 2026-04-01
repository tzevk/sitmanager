'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionLoading } from '@/components/ui/PermissionGate';

export default function TrainingDiscussionIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/corporate-inquiry/execution');
  }, [router]);

  return <PermissionLoading />;
}
