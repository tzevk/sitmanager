'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PermissionLoading } from '@/components/ui/PermissionGate';

export default function ConvertInquiryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);

  useEffect(() => {
    if (!inquiryId) {
      router.replace('/dashboard/corporate-inquiry/execution');
      return;
    }
    router.replace(`/dashboard/corporate-inquiry/execution/${inquiryId}`);
  }, [inquiryId, router]);

  return <PermissionLoading />;
}
