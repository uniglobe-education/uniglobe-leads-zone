import { NextResponse } from 'next/server';
import { syncLeadsToSheets } from '@/lib/syncSheets';

// ── Self-triggering 10-minute timer ──────────────────────────────────────────
let intervalStarted = false;

function startSyncInterval() {
    if (intervalStarted) return;
    intervalStarted = true;

    setInterval(async () => {
        try {
            await syncLeadsToSheets();
        } catch (e) {
            console.error('[sync-sheets] Auto-sync error:', e);
        }
    }, 10 * 60 * 1000); // every 10 minutes

    console.log('[sync-sheets] 10-minute auto-sync interval started');
}

// ── GET handler (for browser/cron access) ────────────────────────────────────
export async function GET() {
    try {
        startSyncInterval();
        const result = await syncLeadsToSheets();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[sync-sheets] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ── POST handler (called from submit/draft) ──────────────────────────────────
export async function POST() {
    try {
        startSyncInterval();
        const result = await syncLeadsToSheets();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[sync-sheets] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
