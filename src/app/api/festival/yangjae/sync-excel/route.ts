import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const DESKTOP_DIR = 'D:\\Desktop';
const MASTER_FILENAME = '2026_양재천_걷자_건강페스티벌_종합현황_ver 261006_SSOT.xlsx';
const MASTER_PATH = path.join(DESKTOP_DIR, MASTER_FILENAME);

function getMasterExcelStatus(): { path: string; filename: string; version: string; mtime: Date; isMaster: boolean } | null {
  try {
    if (!fs.existsSync(DESKTOP_DIR)) return null;

    if (fs.existsSync(MASTER_PATH)) {
      const stats = fs.statSync(MASTER_PATH);
      return {
        path: MASTER_PATH,
        filename: MASTER_FILENAME,
        version: 'SSOT-MASTER',
        mtime: stats.mtime,
        isMaster: true,
      };
    }

    // Fallback scan if master not yet created
    const files = fs.readdirSync(DESKTOP_DIR)
      .filter(f => (f.startsWith('2026_양재천_걷자_건강페스티벌_종합현황') || f.startsWith('2026_양재천_걷자_건강페스티벌_부스_종합현황')) && f.endsWith('.xlsx') && !f.startsWith('~$'))
      .map(f => {
        const fullPath = path.join(DESKTOP_DIR, f);
        const stats = fs.statSync(fullPath);
        const verMatch = f.match(/ver\s*([0-9a-zA-Z]+)/);
        return {
          path: fullPath,
          filename: f,
          version: verMatch ? verMatch[1] : 'SSOT',
          mtime: stats.mtime,
          isMaster: f === MASTER_FILENAME,
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files.length > 0 ? files[0] : null;
  } catch (err) {
    console.error('[API /sync-excel] Error scanning desktop:', err);
    return null;
  }
}

export async function GET() {
  const masterStatus = getMasterExcelStatus();
  return NextResponse.json({
    success: true,
    latestExcel: masterStatus,
    masterFilename: MASTER_FILENAME,
    masterPath: MASTER_PATH,
  });
}

export async function POST(req: Request) {
  let direction = 'to-excel';
  try {
    const url = new URL(req.url);
    const dirParam = url.searchParams.get('direction') || url.searchParams.get('mode');
    if (dirParam) {
      direction = dirParam;
    } else {
      const body = await req.json().catch(() => null);
      if (body && (body.direction || body.mode)) {
        direction = body.direction || body.mode;
      }
    }
  } catch {}

  const isImport = direction === 'to-frontend' || direction === 'import';
  const flag = isImport ? '--to-frontend' : '--to-excel';

  return new Promise<NextResponse>((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync_festival_excel.py');
    const pythonCmd = `python "${scriptPath}" ${flag}`;

    exec(pythonCmd, { cwd: process.cwd(), encoding: 'utf-8' }, (error, stdout, stderr) => {
      if (error) {
        console.error('[API /sync-excel] Exec error:', error, stderr);
        const isLocked = stderr.includes('Export-Locked') || stderr.includes('Permission denied') || error.code === 13;
        const userMsg = isLocked
          ? `현재 엑셀에서 '${MASTER_FILENAME}' 파일이 열려 있어 덮어쓸 수 없습니다. 엑셀을 저장 및 닫은 후 다시 [엑셀 동기화]를 눌러주세요.`
          : (error.message || '엑셀 동기화 중 오류가 발생했습니다.');

        resolve(NextResponse.json({
          success: false,
          isLocked,
          error: userMsg,
          stderr: stderr.trim(),
        }, { status: isLocked ? 423 : 500 }));
        return;
      }

      const masterStatus = getMasterExcelStatus();
      const successMsg = isImport
        ? '바탕화면 단일 마스터 엑셀 최신 수정사항이 프론트엔드로 성공적으로 동기화되었습니다.'
        : '바탕화면 단일 마스터 엑셀 파일이 성공적으로 덮어쓰기 최신화되었습니다.';

      resolve(NextResponse.json({
        success: true,
        message: successMsg,
        direction: isImport ? 'to-frontend' : 'to-excel',
        version: 'SSOT-MASTER',
        filename: MASTER_FILENAME,
        filePath: MASTER_PATH,
        mtime: masterStatus?.mtime,
        stdout: stdout.trim(),
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }));
    });
  });
}
