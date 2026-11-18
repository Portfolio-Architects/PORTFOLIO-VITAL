import { NextResponse } from 'next/server';
import { withLock, readSheetData, writeSheetData } from '@/lib/server/storage-service';

export const dynamic = 'force-dynamic';

const CLOUDFLARE_URL =
  process.env.CLOUDFLARE_PAGES_URL ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_PAGES_URL ||
  'https://portfolio-hchps.pages.dev';

async function syncToCloudflareReplica(payload: unknown): Promise<boolean> {
  try {
    const target = `${CLOUDFLARE_URL.replace(/\/+$/, '')}/api/festival/yangjae`;
    const token = process.env.HCHPS_AUTH_TOKEN || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sync-Source': 'local-ssot-dual-sync',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      console.info(`[Dual-Sync] Successfully published festival snapshot to Cloudflare (${target})`);
      return true;
    } else {
      console.warn(`[Dual-Sync] Cloudflare replica returned HTTP ${res.status}`);
      return false;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Dual-Sync] Cloudflare replica offline or skipped: ${msg}`);
    return false;
  }
}

export async function GET() {
  try {
    const data = await readSheetData<Record<string, unknown> | null>('FESTIVAL_YANGJAE_2026', {
      fallback: null,
    });
    if (data) {
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return NextResponse.json({ error: 'Festival data not found' }, { status: 404 });
  } catch (error) {
    console.error('[API /api/festival/yangjae] Error reading data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (!payload || !payload.meta) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    return await withLock('FESTIVAL_YANGJAE_2026', async () => {
      // Update lastUpdated timestamp
      payload.meta.lastUpdated = new Date().toISOString().split('T')[0];

      // Write to disk (Local SSOT) using safe atomic file write and 3-tier GFS backup
      await writeSheetData('FESTIVAL_YANGJAE_2026', payload, { skipValidation: true });

      // Decouple Dual-Sync to Cloudflare Pages 24/7 Read-Only Replica (run asynchronously without blocking HTTP response)
      syncToCloudflareReplica(payload).catch((syncErr) => {
        console.warn('[Dual-Sync Background Warning]:', syncErr);
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Saved successfully',
          data: payload,
          cloudSync: true,
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    });
  } catch (error) {
    console.error('[API /api/festival/yangjae] Error saving data:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
