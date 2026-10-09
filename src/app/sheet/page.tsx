'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SheetFallbackPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return <p>正在返回角色库...</p>;
}
