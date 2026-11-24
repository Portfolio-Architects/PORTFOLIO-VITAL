import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContactsBox } from '@/components/dashboard/ContactsBox';
import { ContactSchema, StrictContactSchema } from '@/lib/schemas';
import { auditVldsCopy } from '@/lib/vlds-microcopy';
import { Contact } from '@/types';

const mockUpdateRow = jest.fn().mockResolvedValue(true);
const mockAddRow = jest.fn().mockResolvedValue(true);
const mockDeleteRow = jest.fn().mockResolvedValue(true);
let mockServerContacts: Contact[] = [];

jest.mock('@/lib/crypto', () => ({
  isCryptoReady: () => true,
  getAuthToken: () => 'mock-token',
}));

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockImplementation((sheetName: string) => {
    if (sheetName === 'CONTACTS') {
      return Promise.resolve(mockServerContacts.map((c) => ({ ...c })));
    }
    return Promise.resolve([]);
  }),
  addRow: (...args: unknown[]) => mockAddRow(...args),
  updateRow: (...args: unknown[]) => mockUpdateRow(...args),
  deleteRow: (...args: unknown[]) => mockDeleteRow(...args),
  replaceAll: jest.fn().mockResolvedValue(true),
}));

function renderContactsBoxWithQuery() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContactsBox />
    </QueryClientProvider>
  );
}

function getRenderedContactOrder(container: HTMLElement): string[] {
  const cards = container.querySelectorAll('[data-testid^="contact-card-"], .group.relative');
  const names: string[] = [];
  cards.forEach((card) => {
    const nameEl = card.querySelector('.text-sm.font-bold.text-slate-900');
    if (nameEl?.textContent) {
      names.push(nameEl.textContent.trim());
    }
  });
  return names;
}

describe('ContactsBox Recent Contact Sorting (최근 연락순)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });

    mockServerContacts = [
      {
        id: 'c-old-seed',
        name: '박가나다',
        phone: '010-1111-1111',
        email: 'park@gangnam.go.kr',
        notes: '소속: 보건행정과',
        createdAt: '2026-06-15T00:00:00.000Z',
        updatedAt: '2026-06-15T00:00:00.000Z',
      },
      {
        id: 'c-newer-uncontacted',
        name: '최미연락',
        phone: '010-2222-2222',
        email: 'choi@gangnam.go.kr',
        notes: '소속: 건강증진과',
        createdAt: '2026-11-17T05:00:00.000Z',
        updatedAt: '2026-11-17T05:00:00.000Z',
      },
      {
        id: 'c-contacted-older',
        name: '강예전연락',
        phone: '010-3333-3333',
        email: 'kang@gangnam.go.kr',
        notes: '소속: 의약과',
        createdAt: '2026-06-15T00:00:00.000Z',
        updatedAt: '2026-11-01T09:00:00.000Z',
        lastContactedAt: '2026-11-01T09:00:00.000Z',
      },
      {
        id: 'c-contacted-latest',
        name: '홍최근연락',
        phone: '010-4444-4444',
        email: 'hong@gangnam.go.kr',
        notes: '소속: 위생과',
        createdAt: '2026-06-15T00:00:00.000Z',
        updatedAt: '2026-11-10T10:00:00.000Z',
        lastContactedAt: '2026-11-10T10:00:00.000Z',
      },
    ];
  });

  it('defaults to 최근 연락순 and orders contacted entries first, then uncontacted by activity/name', async () => {
    const { container } = renderContactsBoxWithQuery();

    await waitFor(() => {
      expect(screen.getByText('홍최근연락')).toBeInTheDocument();
    });

    const sortBtn = screen.getByRole('button', { name: /최근 연락순/ });
    expect(sortBtn).toBeInTheDocument();

    expect(getRenderedContactOrder(container)).toEqual([
      '홍최근연락',
      '강예전연락',
      '최미연락',
      '박가나다',
    ]);
  });

  it('cycles sort modes between 최근 연락순, 가나다순, and 최근 등록순', async () => {
    const { container } = renderContactsBoxWithQuery();

    await waitFor(() => {
      expect(screen.getByText('홍최근연락')).toBeInTheDocument();
    });

    const sortBtn = screen.getByRole('button', { name: /최근 연락순/ });

    // Switch to 가나다순
    fireEvent.click(sortBtn);
    expect(screen.getByRole('button', { name: /가나다순/ })).toBeInTheDocument();
    expect(getRenderedContactOrder(container)).toEqual([
      '강예전연락',
      '박가나다',
      '최미연락',
      '홍최근연락',
    ]);

    // Switch to 최근 등록순
    fireEvent.click(sortBtn);
    expect(screen.getByRole('button', { name: /최근 등록순/ })).toBeInTheDocument();
    expect(getRenderedContactOrder(container)).toEqual([
      '최미연락',
      '강예전연락',
      '박가나다',
      '홍최근연락',
    ]);

    // Cycle back to 최근 연락순
    fireEvent.click(sortBtn);
    expect(screen.getByRole('button', { name: /최근 연락순/ })).toBeInTheDocument();
    expect(getRenderedContactOrder(container)).toEqual([
      '홍최근연락',
      '강예전연락',
      '최미연락',
      '박가나다',
    ]);
  });

  it('records lastContactedAt and promotes contact to top on 연락 click, phone/email copy, and tel link click', async () => {
    jest.useFakeTimers({
      now: Date.parse('2026-11-18T10:10:00.000Z'),
      doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });

    try {
      const { container } = renderContactsBoxWithQuery();

      await waitFor(() => {
        expect(screen.getByText('박가나다')).toBeInTheDocument();
      });

      // 1. Click explicit 연락 button on 박가나다
      fireEvent.click(screen.getByRole('button', { name: '박가나다 연락 기록' }));

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'CONTACTS',
          'c-old-seed',
          expect.objectContaining({
            lastContactedAt: '2026-11-18T10:10:00.000Z',
            updatedAt: '2026-11-18T10:10:00.000Z',
          })
        );
        expect(getRenderedContactOrder(container)[0]).toBe('박가나다');
      });

      // 2. Advance time and copy phone number of 최미연락
      jest.setSystemTime(Date.parse('2026-11-18T10:11:00.000Z'));
      const choiPhoneLink = screen.getByText('010-2222-2222').closest('div');
      const choiCopyPhoneBtn = choiPhoneLink?.querySelector('button[title="전화번호 복사"]');
      expect(choiCopyPhoneBtn).toBeTruthy();
      fireEvent.click(choiCopyPhoneBtn!);

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'CONTACTS',
          'c-newer-uncontacted',
          expect.objectContaining({
            lastContactedAt: '2026-11-18T10:11:00.000Z',
          })
        );
        expect(getRenderedContactOrder(container)[0]).toBe('최미연락');
      });

      // 3. Advance time and copy email of 강예전연락
      jest.setSystemTime(Date.parse('2026-11-18T10:12:00.000Z'));
      fireEvent.click(screen.getByText('kang@gangnam.go.kr'));

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'CONTACTS',
          'c-contacted-older',
          expect.objectContaining({
            lastContactedAt: '2026-11-18T10:12:00.000Z',
          })
        );
        expect(getRenderedContactOrder(container)[0]).toBe('강예전연락');
      });

      // 4. Advance time and click tel link of 홍최근연락
      jest.setSystemTime(Date.parse('2026-11-18T10:13:00.000Z'));
      const hongTelLink = screen.getByText('010-4444-4444').closest('a');
      expect(hongTelLink).toHaveAttribute('href', 'tel:01044444444');
      hongTelLink!.addEventListener('click', (e) => e.preventDefault(), { once: true });
      fireEvent.click(hongTelLink!);

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'CONTACTS',
          'c-contacted-latest',
          expect.objectContaining({
            lastContactedAt: '2026-11-18T10:13:00.000Z',
          })
        );
        expect(getRenderedContactOrder(container)[0]).toBe('홍최근연락');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps contacted entries above uncontacted entries even after editing an uncontacted entry profile', async () => {
    jest.useFakeTimers({
      now: Date.parse('2026-11-18T10:15:00.000Z'),
      doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });

    try {
      const { container } = renderContactsBoxWithQuery();

      await waitFor(() => {
        expect(screen.getByText('박가나다')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('연락처 수정');
      // Last card is 박가나다
      fireEvent.click(editButtons[editButtons.length - 1]);

      const notesTextarea = screen.getByPlaceholderText('예: 소속: 보건행정과, 비고: 예산 총괄');
      fireEvent.change(notesTextarea, { target: { value: '소속: 보건행정과; 비고: 오타 수정' } });
      fireEvent.click(screen.getByRole('button', { name: '연락처 수정 완료' }));

      await waitFor(() => {
        expect(mockUpdateRow).toHaveBeenCalledWith(
          'CONTACTS',
          'c-old-seed',
          expect.objectContaining({
            notes: '소속: 보건행정과; 비고: 오타 수정',
            updatedAt: '2026-11-18T10:15:00.000Z',
          })
        );
      });

      // Contacted records (홍최근연락, 강예전연락) remain ahead of uncontacted 박가나다
      expect(getRenderedContactOrder(container).slice(0, 2)).toEqual([
        '홍최근연락',
        '강예전연락',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('validates lastContactedAt across ContactSchema/StrictContactSchema and VLDS copy budget', () => {
    const withLastContact = {
      id: 'c-schema-1',
      name: '김연락',
      phone: '010-1234-5678',
      email: 'test@gangnam.go.kr',
      notes: '소속: 보건소',
      lastContactedAt: '2026-11-18T10:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
    };
    const withoutLastContact = {
      id: 'c-schema-2',
      name: '이연락',
      phone: '010-9876-5432',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };

    expect(StrictContactSchema.safeParse(withLastContact).success).toBe(true);
    expect(StrictContactSchema.safeParse(withoutLastContact).success).toBe(true);
    expect(ContactSchema.safeParse(withLastContact).success).toBe(true);
    expect(ContactSchema.safeParse(withoutLastContact).success).toBe(true);

    expect(auditVldsCopy('최근 연락순', 'cta').valid).toBe(true);
    expect(auditVldsCopy('가나다순', 'cta').valid).toBe(true);
    expect(auditVldsCopy('최근 등록순', 'cta').valid).toBe(true);
  });
});
