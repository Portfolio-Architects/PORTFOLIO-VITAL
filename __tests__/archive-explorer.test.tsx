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

    const archiveBtn = screen.getByText('문서 보관함').closest('button');
    expect(archiveBtn).not.toBeNull();
    fireEvent.click(archiveBtn!);
    expect(onModuleChange).toHaveBeenCalledWith('archive');
  });

  it('renders ArchiveExplorerView with content inference badges, project cluster, and photo gallery toggle', async () => {
    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(screen.getAllByText('문서 보관함').length).toBeGreaterThan(0);
      expect(screen.getByText(/총 6,208건 색인됨/)).toBeInTheDocument();
    });

    // Verify content-match badge and snippet rendering for generically named file
    expect(screen.getAllByText('(붙임2) 합동 캠페인 결과보고_강남구보건소.hwpx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('본문 내용 일치').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/수변문화쉼터 부스 운영 및 걷기 코스 완주 리워드 배부 결과/)
    ).toBeInTheDocument();

    // Verify Linked Project Cluster panel displays related docs, sheets, and images
    expect(screen.getByText('연계 자료')).toBeInTheDocument();
    expect(screen.getAllByText('261020_물자총괄표.xlsx').length).toBeGreaterThan(0);

    // Switch to Photo & Poster Gallery mode
    const galleryToggleBtn = screen.getByText('사진 갤러리').closest('button');
    expect(galleryToggleBtn).not.toBeNull();
    fireEvent.click(galleryToggleBtn!);

    await waitFor(() => {
      expect(screen.getByText('사진·시안 썸네일 갤러리')).toBeInTheDocument();
      expect(screen.getAllByText('KakaoTalk_20261023_104835625.jpg').length).toBeGreaterThan(0);
    });
  });

  it('supports design/media categories, photo/poster/logo context filtering, and escapes literal % when opening rescued files', async () => {
    const percentRescuedItem = {
      id: 'arc-09999',
      name: '20260129_기준 중위소득 80% 건보료 소득판정 기준표_1_1_1_1.png',
      rawName: '20260129_기준 중위소득 80% 건보료 소득판정 기준표_1_1_1_1.png',
      relPath:
        '2026년/09_일반행정_보안_법령_기타/01_기획·품의/20260129_기준 중위소득 80% 건보료 소득판정 기준표_1_1_1_1.png',
      year: '2026년',
      project: '09_일반행정_보안_법령_기타',
      subFolder: '01_기획·품의',
      ext: '.png',
      category: 'image' as const,
      size: 128000,
      date: '2026-01-29',
      mtime: 1761200000,
      snippet: '2026년 | 일반행정 보안 법령 기타 | 현장·수행 사진 자료',
      keywords: ['중위소득', '건보료'],
      imageCategory: 'photo' as const,
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/archive/open')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          generatedAt: '2026-11-10T12:30:00.000Z',
          totalIndexed: 7723,
          totalMatched: 1,
          facets: {
            years: { '2026년': 2100 },
            projects: { '09_일반행정_보안_법령_기타': 500 },
            categories: { image: 3652, design: 58, media: 104 },
          },
          items: [percentRescuedItem],
          cluster: null,
        }),
      };
    });

    render(<ArchiveExplorerView />);

    await waitFor(() => {
      expect(
        screen.getByText('20260129_기준 중위소득 80% 건보료 소득판정 기준표_1_1_1_1.png')
      ).toBeInTheDocument();
    });

    // Verify design, media, and logo options exist in filter selects
    expect(screen.getByRole('option', { name: '디자인 원본 (PSD/AI)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '영상/미디어 (MP4)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CI·로고·슬로건' })).toBeInTheDocument();

    // Clicking "파일 열기" escapes literal % as %25 so resolveAndValidatePath succeeds
    const openBtn = screen.getByRole('button', { name: /파일 열기/i });
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/archive/open',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            path: '2026년/09_일반행정_보안_법령_기타/01_기획·품의/20260129_기준 중위소득 80%25 건보료 소득판정 기준표_1_1_1_1.png',
            mode: 'file',
          }),
        })
      );
    });
  });
});
