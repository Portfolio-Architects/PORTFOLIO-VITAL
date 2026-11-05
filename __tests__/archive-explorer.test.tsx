import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from '@/components/Sidebar';
import { ArchiveExplorerView } from '@/components/archive/ArchiveExplorerView';

jest.mock('@/components/layout/LocalhostStatusHUD', () => ({
  LocalhostStatusHUD: () => <div data-testid="localhost-status-hud">HUD</div>,
}));

const mockSampleItems = [
  {
    id: 'arc-00001',
    name: '(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
    rawName: '(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
    relPath: '2026년/03_양재천_건강페스티벌/(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx',
    year: '2026년',
    project: '03_양재천_건강페스티벌',
    subFolder: '',
    ext: '.hwpx',
    category: 'doc' as const,
    size: 48200,
    date: '2026-10-21',
    mtime: 1761000000,
    snippet: '2026 양재천 걷자 건강 페스티벌 수변문화쉼터 부스 운영 및 걷기 코스 완주 리워드 배부 결과',
    keywords: ['양재천', '페스티벌', '수변문화쉼터', '부스'],
    imageCategory: null,
    score: 125,
    matchReason: 'content' as const,
  },
  {
    id: 'arc-00002',
    name: 'KakaoTalk_20261023_104835625.jpg',
    rawName: 'KakaoTalk_20261023_104835625.jpg',
    relPath: '2026년/03_양재천_건강페스티벌/KakaoTalk_20261023_104835625.jpg',
    year: '2026년',
    project: '03_양재천_건강페스티벌',
    subFolder: '현장사진',
    ext: '.jpg',
    category: 'image' as const,
    size: 512000,
    date: '2026-10-23',
    mtime: 1761100000,
    snippet: '2026년 | 03 양재천 건강페스티벌 | 현장·수행 사진 자료 | 연관키워드: 양재천, 페스티벌, 부스',
    keywords: ['양재천', '페스티벌', '부스'],
    imageCategory: 'photo' as const,
    score: 90,
    matchReason: 'context' as const,
  },
  {
    id: 'arc-00003',
    name: '261020_물자총괄표.xlsx',
    rawName: '261020_물자총괄표.xlsx',
    relPath: '2026년/03_양재천_건강페스티벌/261020_물자총괄표.xlsx',
    year: '2026년',
    project: '03_양재천_건강페스티벌',
    subFolder: '',
    ext: '.xlsx',
    category: 'sheet' as const,
    size: 32400,
    date: '2026-10-20',
    mtime: 1760900000,
    snippet: '시트: 부스별물자, 현수막규격, 타올배부수량',
    keywords: ['양재천', '페스티벌', '물자총괄표'],
    imageCategory: null,
    score: 85,
    matchReason: 'content' as const,
  },
];

describe('Master Archive Organization & Explorer Integration Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/archive/open')) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          generatedAt: '2026-10-26T12:55:00.000Z',
          totalIndexed: 6208,
          totalMatched: mockSampleItems.length,
          facets: {
            years: { '2026년': 2150, '2025년': 750, '2024년': 924 },
            projects: {
              '03_양재천_건강페스티벌': 165,
              '04_서울체력장_AI메디헬스_메디런': 680,
            },
            categories: { doc: 3200, image: 2400, sheet: 550 },
          },
          items: mockSampleItems,
          cluster: {
            anchor: mockSampleItems[0],
            docs: [mockSampleItems[0]],
            sheets: [mockSampleItems[2]],
            images: [mockSampleItems[1]],
          },
        }),
      };
    }) as any;
  });

  it('renders Archive Explorer tab in Sidebar and triggers module switch', () => {
    const onModuleChange = jest.fn();
    render(
      <Sidebar
        activeModule="dashboard"
        onModuleChange={onModuleChange}
        taskStats={{ total: 5, done: 3, overdue: 0 }}
        appMode="VITAL"
        onModeChange={jest.fn()}
      />
    );

    const archiveBtn = screen.getByText('아카이브 탐색기').closest('button');
    expect(archiveBtn).not.toBeNull();
    fireEvent.click(archiveBtn!);
    expect(onModuleChange).toHaveBeenCalledWith('archive');
  });

  it('renders ArchiveExplorerView with content inference badges, project cluster, and photo gallery toggle', async () => {
    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(screen.getByText('마스터 아카이브 통합 탐색기')).toBeInTheDocument();
      expect(screen.getByText(/총 6,208건 색인됨/)).toBeInTheDocument();
    });

    // Verify content-match badge and snippet rendering for generically named file
    expect(screen.getAllByText('(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('본문 내용 일치').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/수변문화쉼터 부스 운영 및 걷기 코스 완주 리워드 배부 결과/)
    ).toBeInTheDocument();

    // Verify Linked Project Cluster panel displays related docs, sheets, and images
    expect(screen.getByText('연계 업무 묶음 (Project Cluster)')).toBeInTheDocument();
    expect(screen.getAllByText('261020_물자총괄표.xlsx').length).toBeGreaterThan(0);

    // Switch to Photo & Poster Gallery mode
    const galleryToggleBtn = screen.getByText('사진·시안 갤러리').closest('button');
    expect(galleryToggleBtn).not.toBeNull();
    fireEvent.click(galleryToggleBtn!);

    await waitFor(() => {
      expect(screen.getByText('사진·시안 썸네일 갤러리')).toBeInTheDocument();
      expect(screen.getAllByText('KakaoTalk_20261023_104835625.jpg').length).toBeGreaterThan(0);
    });
  });
});
