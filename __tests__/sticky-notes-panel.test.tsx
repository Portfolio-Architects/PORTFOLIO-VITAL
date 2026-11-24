import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StickyNotesPanel } from '@/components/memory/StickyNotesPanel';
import { resetWorkingMemoryStoreForTest } from '@/hooks/useWorkingMemory';
import { WorkingMemoryMemo } from '@/types';
import { addRow, updateRow, deleteRow } from '@/lib/sheets-api';

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockResolvedValue([]),
  addRow: jest.fn().mockResolvedValue(true),
  updateRow: jest.fn().mockResolvedValue(true),
  deleteRow: jest.fn().mockResolvedValue(true),
}));

const SEED_NOTES: WorkingMemoryMemo[] = [
  {
    id: 'note-short-1',
    content: '14시 팀장님 예산안 보고서 출력',
    category: 'directive',
    tags: ['[팀장님 지시]'],
    status: 'pending',
    source: 'pc',
    pinned: true,
    createdAt: '2026-11-19T05:00:00.000Z',
    updatedAt: '2026-11-19T05:00:00.000Z',
  },
  {
    id: 'note-long-1',
    content:
      '11/18 제339회 경제도시위원회 대비 보건행정과 예상질문 2종 HWPX 완비 후속: AI 메디헬스센터 발주 전 과업심의 및 보안성 검토 일정 재확인 필요',
    category: 'budget',
    tags: ['[2027 예산편성]'],
    status: 'pending',
    source: 'pc',
    pinned: false,
    createdAt: '2026-11-19T04:00:00.000Z',
    updatedAt: '2026-11-19T04:00:00.000Z',
  },
];

describe('StickyNotesPanel — Side-Sheet Post-it UX & Data Preservation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetWorkingMemoryStoreForTest(SEED_NOTES);
    jest.clearAllMocks();
  });

  it('stays hidden when isOpen is false (default hidden side-sheet state)', () => {
    render(<StickyNotesPanel isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('sticky-notes-panel')).not.toBeInTheDocument();
  });

  it('renders existing WORKING_MEMORY notes losslessly, clamps long notes by default, and toggles full text', () => {
    render(<StickyNotesPanel isOpen onClose={jest.fn()} />);

    expect(screen.getByTestId('sticky-notes-count')).toHaveTextContent('2');
    expect(screen.getByTestId('sticky-note-note-short-1')).toHaveAttribute('data-color', 'pink');
    expect(screen.getByTestId('sticky-note-note-long-1')).toHaveAttribute('data-color', 'yellow');

    const longContent = screen.getByTestId('sticky-note-content-note-long-1');
    expect(longContent.className).toContain('line-clamp-3');

    fireEvent.click(screen.getByTestId('sticky-note-expand-note-long-1'));
    expect(longContent.className).not.toContain('line-clamp-3');
    expect(screen.getByTestId('sticky-note-expand-note-long-1')).toHaveTextContent('접기');
  });

  it('attaches a short 20~50 char sticky note with chosen color on Enter and persists via addRow', async () => {
    render(<StickyNotesPanel isOpen onClose={jest.fn()} />);

    fireEvent.click(screen.getByTestId('sticky-notes-new-color-mint'));
    const input = screen.getByTestId('sticky-notes-input');
    fireEvent.change(input, { target: { value: '계약팀 재정합의 전화 확인 ☎5008' } });
    expect(screen.getByTestId('sticky-notes-char-count')).toHaveTextContent('20/50');

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByTestId('sticky-notes-count')).toHaveTextContent('3');
      expect(screen.getByText('계약팀 재정합의 전화 확인 ☎5008')).toBeInTheDocument();
    });

    const newCard = screen.getByText('계약팀 재정합의 전화 확인 ☎5008').closest('article');
    expect(newCard).toHaveAttribute('data-color', 'mint');
    expect(addRow).toHaveBeenCalledWith(
      'WORKING_MEMORY',
      expect.objectContaining({
        content: '계약팀 재정합의 전화 확인 ☎5008',
        color: 'mint',
      })
    );
  });

  it('changes note color, edits content inline on double-click, tears off (done), restores, and purges cleanly', async () => {
    render(<StickyNotesPanel isOpen onClose={jest.fn()} />);

    // 1. Change color
    fireEvent.click(screen.getByTestId('sticky-note-color-note-short-1-sky'));
    await waitFor(() => {
      expect(screen.getByTestId('sticky-note-note-short-1')).toHaveAttribute('data-color', 'sky');
      expect(updateRow).toHaveBeenCalledWith(
        'WORKING_MEMORY',
        'note-short-1',
        expect.objectContaining({ color: 'sky' })
      );
    });

    // 2. Inline double-click edit + Enter save
    fireEvent.doubleClick(screen.getByTestId('sticky-note-content-note-short-1'));
    const editInput = screen.getByTestId('sticky-note-edit-input-note-short-1');
    fireEvent.change(editInput, { target: { value: '15시 팀장님 보고서 2부 출력' } });
    fireEvent.keyDown(editInput, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByTestId('sticky-note-content-note-short-1')).toHaveTextContent(
        '15시 팀장님 보고서 2부 출력'
      );
    });

    // 3. Tear off (mark reflected) -> Done drawer -> Restore
    fireEvent.click(screen.getByTestId('sticky-note-done-note-short-1'));
    await waitFor(() => {
      expect(screen.getByTestId('sticky-notes-count')).toHaveTextContent('1');
      expect(screen.queryByTestId('sticky-note-note-short-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('sticky-notes-done-toggle')).toHaveTextContent('떼어낸 메모 (1)');
    });

    fireEvent.click(screen.getByTestId('sticky-notes-done-toggle'));
    expect(screen.getByTestId('sticky-note-done-item-note-short-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sticky-note-restore-note-short-1'));
    await waitFor(() => {
      expect(screen.getByTestId('sticky-notes-count')).toHaveTextContent('2');
      expect(screen.getByTestId('sticky-note-note-short-1')).toBeInTheDocument();
    });

    // 4. Delete
    fireEvent.click(screen.getByTestId('sticky-note-delete-note-long-1'));
    await waitFor(() => {
      expect(screen.getByTestId('sticky-notes-count')).toHaveTextContent('1');
      expect(deleteRow).toHaveBeenCalledWith('WORKING_MEMORY', 'note-long-1');
    });
  });

  it('hides the side sheet via hide button, backdrop click, or Escape key', () => {
    const onClose = jest.fn();

    render(<StickyNotesPanel isOpen onClose={onClose} />);

    fireEvent.click(screen.getByTestId('sticky-notes-close'));
    fireEvent.click(screen.getByTestId('sticky-notes-backdrop'));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
