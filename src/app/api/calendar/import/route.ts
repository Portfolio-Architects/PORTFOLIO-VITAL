import { NextResponse } from 'next/server';
import { Schedule, generateId } from '@/types';
import { parseIcsFeed } from '@/lib/calendar-utils';
import { withLock, readSheetData, writeSheetData } from '@/lib/server/storage-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { icsUrl, rawIcs } = body;

    let icsContent = rawIcs || '';

    if (icsUrl) {
      const response = await fetch(icsUrl, {
        headers: { 'User-Agent': 'VITAL-Calendar-Importer/1.0' }
      });
      if (!response.ok) {
        return NextResponse.json({ success: false, error: `Failed to fetch ICS from URL: ${response.status}` }, { status: 400 });
      }
      icsContent = await response.text();
    }

    if (!icsContent || !icsContent.trim()) {
      return NextResponse.json({ success: false, error: 'No ICS content or URL provided' }, { status: 400 });
    }

    const parsedEvents = parseIcsFeed(icsContent);
    if (parsedEvents.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No valid events found in ICS' });
    }

    return await withLock('SCHEDULES', async () => {
      let existingSchedules = await readSheetData<Schedule[]>('SCHEDULES', { fallback: [] });
      if (!Array.isArray(existingSchedules)) {
        existingSchedules = [];
      }

      const now = new Date().toISOString();
      let importedCount = 0;

      for (const event of parsedEvents) {
        if (!event.title || !event.date) continue;

        // 중복 체크 (id 일치 또는 날짜+시작시간+제목 일치)
        const isDuplicate = existingSchedules.some(s => 
          (event.id && s.id === event.id) || 
          (s.date === event.date && s.startTime === event.startTime && s.title === event.title)
        );

        if (!isDuplicate) {
          const newSched: Schedule = {
            id: event.id || generateId(),
            title: event.title,
            type: event.type || 'other',
            person: event.person || '담당자',
            date: event.date,
            endDate: event.endDate || event.date,
            startTime: event.startTime || '09:00',
            endTime: event.endTime || '10:00',
            notes: event.notes || '',
            createdAt: now,
            updatedAt: now
          };
          existingSchedules.unshift(newSched);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        await writeSheetData('SCHEDULES', existingSchedules);
      }

      return NextResponse.json({
        success: true,
        importedCount,
        totalCount: existingSchedules.length
      });
    });
  } catch (error: any) {
    console.error('[Calendar Import Error]:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to import calendar' }, { status: 500 });
  }
}
