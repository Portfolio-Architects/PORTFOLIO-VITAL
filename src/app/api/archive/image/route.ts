import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ARCHIVE_ROOT = path.resolve('F:\\_Organized_Archive');

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

    const fullPath = path.resolve(ARCHIVE_ROOT, relPath);
    const normalizedFull = path.normalize(fullPath).toLowerCase();
    const normalizedRoot = path.normalize(ARCHIVE_ROOT).toLowerCase();
    const rootWithSep = normalizedRoot.endsWith(path.sep)
      ? normalizedRoot
      : normalizedRoot + path.sep;

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
