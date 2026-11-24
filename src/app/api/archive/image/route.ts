import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const winPath = path.win32;
const ARCHIVE_ROOT = winPath.resolve('F:\\_Organized_Archive');

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relPath = searchParams.get('path') || '';

    if (!relPath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    if (relPath.includes('\0') || /%00/i.test(relPath)) {
      return NextResponse.json({ error: 'Null bytes forbidden in path' }, { status: 400 });
    }

    const fullPath = winPath.resolve(ARCHIVE_ROOT, relPath);
    const normalizedFull = winPath.normalize(fullPath).toLowerCase();
    const normalizedRoot = winPath.normalize(ARCHIVE_ROOT).toLowerCase();
    const rootWithSep = normalizedRoot.endsWith(winPath.sep)
      ? normalizedRoot
      : normalizedRoot + winPath.sep;

    if (!normalizedFull.startsWith(rootWithSep) && normalizedFull !== normalizedRoot) {
      return NextResponse.json({ error: 'Forbidden path traversal' }, { status: 403 });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to serve archive image', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
