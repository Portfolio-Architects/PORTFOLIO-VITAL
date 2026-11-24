import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntegratedShowcaseSection } from '@/components/dashboard/IntegratedShowcaseSection';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockArchiveItems = [
  {
    id: 'arc-001',
    name: '2026_양재천_건강페스티벌_추진방침서.hwpx',
    rawName: '2026_양재천_건강페스티벌_추진방침서.hwpx',
    relPath: '2026년/03_양재천_건강페스티벌/2026_양재천_건강페스티벌_추진방침서.hwpx',
    year: '2026년',
    project: 'YANGJAE_FESTIVAL',
    subFolder: '방침서',
    ext: '.hwpx',
    category: 'doc' as const,
    size: 54000,
    date: '2026-09-14',
    mtime: 1761000000,
    snippet: '2026 양재천 건강 페스티벌 기본계획 및 부스 운영 방침',
    keywords: ['양재천', '페스티벌', '방침서'],
    imageCategory: null,
    score: 100,
    matchReason: 'content' as const,
  },
  {
    id: 'arc-002',
    name: '2026_체력측정_물품구매_지출품의서.xlsx',
    rawName: '2026_체력측정_물품구매_지출품의서.xlsx',
    relPath: '2026년/02_서울체력장/2026_체력측정_물품구매_지출품의서.xlsx',
    year: '2026년',
    project: 'HEALTH_CHECKUP',
    subFolder: '물품구매',
    ext: '.xlsx',
    category: 'sheet' as const,
    size: 24000,
    date: '2026-09-18',
    mtime: 1761100000,
    snippet: '체력측정기구 405-01 자산취득 및 소요예산 산출내역',
    keywords: ['물품구매', '체력장', '지출품의'],
    imageCategory: null,
    score: 85,
    matchReason: 'filename' as const,
  },
];

describe('IntegratedShowcaseSection Component Suite', () => {
  let queryClient: QueryClient;
  const mockNavigate = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockNavigate.mockClear();

    // Mock global fetch for /api/archive and /api/data
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/archive')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            generatedAt: '2026-11-16T00:00:00Z',
            totalIndexed: 422,
            totalMatched: mockArchiveItems.length,
            facets: {
              years: { '2026년': 2 },
              projects: { YANGJAE_FESTIVAL: 1, HEALTH_CHECKUP: 1 },
              categories: { doc: 1, sheet: 1 },
            },
            items: mockArchiveItems,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
    }) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1. renders showcase section container, SectionHeader, and live count badges', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedShowcaseSection onNavigateModule={mockNavigate} />
      </QueryClientProvider>
    );

    const section = screen.getByTestId('integrated-showcase-section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveClass('overflow-hidden');
    expect(section).toHaveClass('rounded-xl');

    expect(screen.getByText('행정 게시판')).toBeInTheDocument();
    expect(screen.queryByText('작업기억 보드 · 문서 보관함')).not.toBeInTheDocument();

    // Badges present
    expect(screen.getAllByText(/미반영/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/색인/).length).toBeGreaterThan(0);
  });

  test('2. defaults to split view and renders both memory summary and archive quick search', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedShowcaseSection onNavigateModule={mockNavigate} defaultView="split" />
      </QueryClientProvider>
    );

    expect(screen.getAllByText('업무 메모').length).toBeGreaterThan(0);
    expect(screen.getByText('문서 검색')).toBeInTheDocument();

    // Navigation buttons in split view
    const navButtons = screen.getAllByRole('button', { name: /전체/ });
    expect(navButtons.length).toBeGreaterThan(0);
  });

  test('3. switches to memory tab and displays memo list and quick snippet chips', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedShowcaseSection onNavigateModule={mockNavigate} />
      </QueryClientProvider>
    );

    const memoryTab = screen.getByRole('button', { name: /업무 메모/ });
    fireEvent.click(memoryTab);

    expect(screen.getByText('빠른 삽입:')).toBeInTheDocument();
    expect(screen.getByText('+ 팀장님 지시')).toBeInTheDocument();
    expect(screen.getByText('+ 2027 예산 가내시')).toBeInTheDocument();

    // Category filter tabs
    expect(screen.getByText('2027 예산')).toBeInTheDocument();
    expect(screen.getByText('지시')).toBeInTheDocument();

    // Bottom CTA
    const ctaButton = screen.getByText('작업기억 전체 관리 이동');
    expect(ctaButton).toBeInTheDocument();
    fireEvent.click(ctaButton);
    expect(mockNavigate).toHaveBeenCalledWith('memory');
  });

  test('4. switches to archive tab, shows search input and triggers navigation CTA', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedShowcaseSection onNavigateModule={mockNavigate} />
      </QueryClientProvider>
    );

    const archiveTab = screen.getByRole('button', { name: /문서 보관함/ });
    fireEvent.click(archiveTab);

    expect(screen.getByPlaceholderText(/마스터 아카이브 전문 검색/)).toBeInTheDocument();
    expect(screen.getByText('빠른 검색:')).toBeInTheDocument();
    expect(screen.getByText('양재천 페스티벌')).toBeInTheDocument();
    expect(screen.getByText('수의계약')).toBeInTheDocument();

    // Bottom CTA
    const ctaButton = screen.getByText('문서 보관함 이동');
    expect(ctaButton).toBeInTheDocument();
    fireEvent.click(ctaButton);
    expect(mockNavigate).toHaveBeenCalledWith('archive');
  });

  test('5. quick snippet insertion populates input field and category', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedShowcaseSection onNavigateModule={mockNavigate} defaultView="memory" />
      </QueryClientProvider>
    );

    const snippetBtn = screen.getByText('+ 팀장님 지시');
    fireEvent.click(snippetBtn);

    const input = screen.getByPlaceholderText(/작업기억 메모 입력/) as HTMLInputElement;
    expect(input.value).toContain('팀장님 지시:');
  });
});
