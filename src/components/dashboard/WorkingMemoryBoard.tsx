'use client';

import React from 'react';
import { WorkingMemoryPage, WorkingMemoryPageProps } from '@/components/memory/WorkingMemoryPage';

export function WorkingMemoryBoard(props: WorkingMemoryPageProps = {}) {
  return <WorkingMemoryPage {...props} />;
}
