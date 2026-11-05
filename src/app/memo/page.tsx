import React from 'react';
import { MobileMemoInbox } from '@/components/dashboard/MobileMemoInbox';

export const metadata = {
  title: 'VITAL 모바일 메모 우체통 | 작업기억 보조 보드',
  description: '스마트폰에서 1초 만에 행정 메모보고·지시사항·예산 증감액을 캡처하여 업무용 PC 보드로 전송합니다.',
};

export default function MemoInboxPage() {
  return <MobileMemoInbox />;
}
