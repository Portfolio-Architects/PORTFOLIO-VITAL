import { useMemo } from 'react';
import { extractKeywords, SignalEntry } from '@/hooks/useSignal';
import { Task, Project, Meeting, BudgetEntry, InventoryItem } from '@/types';

const EMPTY_KEYWORD_MAP: Record<string, number> = {};
const EMPTY_MERGED_ENTRIES: SignalEntry[] = [];

export function useMergedSignals(
  signalEntries: SignalEntry[],
  keywordMap: Record<string, number>,
  tasks: Task[],
  projects: Project[],
  meetings: Meeting[],
  budgetEntries: BudgetEntry[],
  inventoryItems: InventoryItem[],
  enabled: boolean = true
) {
  // ── Merge keywords from ALL Modules into Signal Map (Brain Dump) ──
  const mergedKeywordMap = useMemo(() => {
    if (!enabled) return EMPTY_KEYWORD_MAP;
    const map: Record<string, number> = { ...keywordMap };
    
    const extractAndAdd = (text: string, tags?: string[]) => {
      const words = extractKeywords(text);
      if (tags) {
        for (let i = 0; i < tags.length; i++) {
          if (tags[i].length >= 2) words.push(tags[i]);
        }
      }
      for (let i = 0; i < words.length; i++) {
        const kw = words[i];
        map[kw] = (map[kw] || 0) + 1;
      }
    };

    // 1. 업무 (Tasks)
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      extractAndAdd(t.title + ' ' + (t.description || ''), t.tags);
    }
    // 2. 프로젝트 (Projects)
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      let pText = p.name + ' ' + (p.description || '');
      if (p.checklistItems) {
        for (let j = 0; j < p.checklistItems.length; j++) {
          pText += ' ' + p.checklistItems[j].text;
        }
      }
      extractAndAdd(pText);
    }
    // 3. 회의록 (Meetings)
    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      extractAndAdd(m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), m.attendees);
    }
    // 4. 예산/지출 (Budget)
    for (let i = 0; i < budgetEntries.length; i++) {
      const b = budgetEntries[i];
      extractAndAdd(b.purpose + ' ' + (b.memo || ''));
    }
    // 5. 재고/비품 (Inventory)
    for (let i = 0; i < inventoryItems.length; i++) {
      const inv = inventoryItems[i];
      extractAndAdd(inv.name + ' ' + inv.category);
    }

    return map;
  }, [enabled, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems]);

  const mergedEntries = useMemo(() => {
    if (!enabled) return EMPTY_MERGED_ENTRIES;
    const buildEntry = (idPrefix: string, id: string, text: string, keywordsSource: string, tags: string[], createdAt: string, category: string) => {
      const filteredTags: string[] = [];
      for (let i = 0; i < tags.length; i++) {
        if (tags[i].length >= 2) filteredTags.push(tags[i]);
      }
      const kws = extractKeywords(keywordsSource);
      for (let i = 0; i < filteredTags.length; i++) {
        kws.push(filteredTags[i]);
      }
      return {
        id: `${idPrefix}-${id}`,
        text,
        keywords: kws,
        createdAt,
        category,
        tags: filteredTags,
        _time: Date.parse(createdAt) || 0,
      };
    };

    const all: (SignalEntry & { category: string; tags: string[]; _time: number })[] = [];

    // 1. Signal Entries
    for (let i = 0; i < signalEntries.length; i++) {
      const s = signalEntries[i];
      all.push({
        ...s,
        category: '내 생각',
        tags: [],
        _time: Date.parse(s.createdAt) || 0,
      });
    }

    // 2. Tasks
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      all.push(buildEntry('task', t.id, `[업무] ${t.title}`, t.title + ' ' + (t.description || ''), t.tags || [], t.createdAt, '업무'));
    }

    // 3. Projects
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      let pText = p.name + ' ' + (p.description || '');
      if (p.checklistItems) {
        for (let j = 0; j < p.checklistItems.length; j++) {
          pText += ' ' + p.checklistItems[j].text;
        }
      }
      all.push(buildEntry('proj', p.id, `[프로젝트] ${p.name}`, pText, ['프로젝트'], p.createdAt, '프로젝트'));
    }

    // 4. Meetings
    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      const meetTags = ['회의록'];
      if (m.attendees) {
        for (let j = 0; j < m.attendees.length; j++) {
          meetTags.push(m.attendees[j]);
        }
      }
      all.push(buildEntry('meet', m.id, `[회의] ${m.title}`, m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), meetTags, m.createdAt, '회의록'));
    }

    // 5. Budget Entries
    for (let i = 0; i < budgetEntries.length; i++) {
      const b = budgetEntries[i];
      all.push(buildEntry('budg', b.id, `[지출] ${b.purpose}`, b.purpose + ' ' + (b.memo || ''), ['예산'], b.date, '지출예산'));
    }

    // 6. Inventory Items
    for (let i = 0; i < inventoryItems.length; i++) {
      const inv = inventoryItems[i];
      all.push(buildEntry('inv', inv.id, `[비품] ${inv.name}`, inv.name + ' ' + inv.category, ['재고'], inv.createdAt, '홍보물'));
    }

    return all.sort((a, b) => b._time - a._time);
  }, [enabled, signalEntries, tasks, projects, meetings, budgetEntries, inventoryItems]);

  return { mergedKeywordMap, mergedEntries };
}

