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

    const fullPath = path.resolve(ARCHIVE_ROOT, relPath);
    if (!fullPath.startsWith(ARCHIVE_ROOT + path.sep) && fullPath !== ARCHIVE_ROOT) {
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
