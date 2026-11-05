import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARCHIVE_ROOT = path.resolve('F:\\_Organized_Archive');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode: 'file' | 'folder' | 'reindex' = body.mode || 'file';

    if (mode === 'reindex') {
      const scriptPath = path.join(process.cwd(), 'scripts', 'organize_and_index_archive.py');
      await new Promise<void>((resolve, reject) => {
        execFile('python', [scriptPath, '--index'], { timeout: 120000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return NextResponse.json({ ok: true, mode: 'reindex' });
    }

    const relPath = body.path || '';
    if (!relPath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const fullPath = path.resolve(ARCHIVE_ROOT, relPath);
    if (!fullPath.startsWith(ARCHIVE_ROOT + path.sep) && fullPath !== ARCHIVE_ROOT) {
      return NextResponse.json({ error: 'Forbidden path traversal' }, { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Target file does not exist' }, { status: 404 });
    }

    if (mode === 'folder') {
      const child = spawn('explorer.exe', [`/select,${fullPath}`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      const child = spawn('cmd.exe', ['/c', 'start', '""', fullPath], {
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: false,
      });
      child.unref();
    }

    return NextResponse.json({ ok: true, mode, fullPath });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to execute archive action', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
