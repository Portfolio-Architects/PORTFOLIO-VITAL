import React from 'react';
import { Metadata, Viewport } from 'next';
import YangjaeFestivalClientWrapper from '@/components/festival/YangjaeFestivalClientWrapper';

export const metadata: Metadata = {
  title: '제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌 | 강남구보건소',
  description: '『강남구보건소』와 함께하는 제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌 실시간 진행현황 대시보드',
  openGraph: {
    title: '제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌',
    description: '『강남구보건소』와 함께하는 제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌 실시간 진행현황 대시보드',
    siteName: '제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌',
    type: 'website',
  },
  twitter: {
    title: '제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌',
    description: '『강남구보건소』와 함께하는 제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌 실시간 진행현황 대시보드',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function YangjaeFestivalPage() {
  return (
    <div className="min-h-screen bg-slate-100/70 sm:py-8 sm:px-4 flex justify-center items-start">
      <YangjaeFestivalClientWrapper />
    </div>
  );
}

