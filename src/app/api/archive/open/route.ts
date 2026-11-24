import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

// Always evaluate against Win32 path semantics because allowed archive/desktop roots use Windows drive paths,
// ensuring consistent traversal defense even when executed on POSIX CI runners.
const winPath = path.win32;
const ARCHIVE_ROOT = winPath.resolve('F:\\_Organized_Archive');
const DESKTOP_ROOT = winPath.resolve('D:\\Desktop');
const ALLOWED_ROOTS = [ARCHIVE_ROOT, DESKTOP_ROOT];

/**
 * Validates that the requested target path resolves strictly within
 * the authorized roots (F:\_Organized_Archive or D:\Desktop).
 * Defends against:
 * 1. Poison null bytes (\0, %00, %2500)
 * 2. URL-encoded path traversal (%2e%2e%2f, %2e%2e%5c, ..%2f, multi-encoded %252e%252e)
 * 3. Prefix spoofing attacks (e.g. D:\DesktopFake)
 * 4. Case-insensitive Windows filesystem semantics
 */
export function resolveAndValidatePath(
  rawPath: string
): { ok: true; fullPath: string } | { ok: false; status: number; error: string } {
  if (!rawPath || typeof rawPath !== 'string') {
    return { ok: false, status: 400, error: 'Missing path' };
  }

  // Reject poison null bytes before URI decoding
  if (rawPath.includes('\0') || /%00/i.test(rawPath)) {
    return { ok: false, status: 400, error: 'Null bytes forbidden in path' };
  }

  // Safely decode URI components recursively (up to 3 passes to catch multi-encoded traversal)
  let decodedPath = rawPath;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decodedPath);
      if (next === decodedPath) break;
      decodedPath = next;
    } catch {
      // If the initial rawPath fails decodeURIComponent, reject with 400 for malformed URI encoding
      if (i === 0) {
        return { ok: false, status: 400, error: 'Malformed URI encoding in path' };
      }
      // If a subsequent iteration fails (e.g. decoded string has literal '%'), terminate recursion
      break;
    }
  }

  // Reject poison null bytes after URI decoding
  if (decodedPath.includes('\0')) {
    return { ok: false, status: 400, error: 'Null bytes forbidden in path' };
  }

  // Resolve absolute Win32 path or relative to ARCHIVE_ROOT
  const fullPath = winPath.isAbsolute(decodedPath)
    ? winPath.resolve(decodedPath)
    : winPath.resolve(ARCHIVE_ROOT, decodedPath);

  const normalizedTarget = winPath.normalize(fullPath).toLowerCase();

  const isAllowed = ALLOWED_ROOTS.some((root) => {
    const normalizedRoot = winPath.normalize(root).toLowerCase();
    const rootWithSep = normalizedRoot.endsWith(winPath.sep)
      ? normalizedRoot
      : normalizedRoot + winPath.sep;
    return (
      normalizedTarget === normalizedRoot ||
      normalizedTarget.startsWith(rootWithSep)
    );
  });

  if (!isAllowed) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden path traversal: Path outside allowed roots (F:\\_Organized_Archive, D:\\Desktop)',
    };
  }

  return { ok: true, fullPath };
}

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

    const rawPath = body.path || '';
    const validation = resolveAndValidatePath(rawPath);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { fullPath } = validation;

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Target file does not exist', path: fullPath },
        { status: 404 }
      );
    }

    const isDir = fs.statSync(fullPath).isDirectory();

    if (mode === 'folder') {
      const targetArg = isDir ? fullPath : `/select,${fullPath}`;
      const child = spawn('explorer.exe', [targetArg], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      const child = spawn('explorer.exe', [fullPath], {
        detached: true,
        stdio: 'ignore',
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
