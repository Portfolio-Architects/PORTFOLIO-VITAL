'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { YangjaeFestivalSkeleton } from '@/components/skeletons/YangjaeFestivalSkeleton';

const DynamicDashboard = dynamic(
  () => import('@/components/festival/YangjaeFestivalDashboard'),
  {
    ssr: false,
    loading: () => <YangjaeFestivalSkeleton />,
  }
);

export default function YangjaeFestivalClientWrapper() {
  return <DynamicDashboard />;
}
