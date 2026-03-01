import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pushLeadToSheet } from '@/lib/googleSheets';

// ── Self-triggering 10-minute timer ──────────────────────────────────────────
let intervalStarted = false;

function startSyncInterval() {
    if (intervalStarted) return;
    intervalStarted = true;

    setInterval(async () => {
        try {
            // Use internal fetch to re-trigger this same endpoint
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            await fetch(`${baseUrl}/api/cron/sync-sheets`, { method: 'POST' }).catch(() => { });
        } catch { }
    }, 10 * 60 * 1000); // every 10 minutes

    console.log('[sync-sheets] 10-minute auto-sync interval started');
}

// ── Core sync logic (shared by GET and POST) ────────────────────────────────
async function syncLeadsToSheets() {
    // Start the 10-minute timer on first invocation
    startSyncInterval();

    // ── Step 1: Catch-all sweep ──────────────────────────────────────────
    // Find leads that should be in Sheets but don't have a SheetPushJob
    const orphanedLeads = await prisma.lead.findMany({
        where: {
            pushed_to_sheet: false,
            phone: { not: null },
            sheetPushJob: null, // No job exists at all
            OR: [
                { status: 'SUBMITTED' },
                { status: 'DRAFT' },
            ],
        },
        take: 50,
    });

    if (orphanedLeads.length > 0) {
        console.log(`[sync-sheets] Creating ${orphanedLeads.length} missing SheetPushJobs`);
        for (const lead of orphanedLeads) {
            try {
                await prisma.sheetPushJob.create({
                    data: { leadId: lead.id, status: 'PENDING' },
                });
            } catch {
                // Unique constraint — job already exists, skip
            }
        }
    }

    // ── Step 2: Process pending/failed jobs ──────────────────────────────
    const jobs = await prisma.sheetPushJob.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                { status: 'FAILED', attempts: { lt: 5 } },
            ],
        },
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: {
            lead: { include: { form: true } },
        },
    });

    if (jobs.length === 0 && orphanedLeads.length === 0) {
        return { success: true, message: 'No jobs to process' };
    }

    const results = [];

    for (const job of jobs) {
        // Skip leads without a phone number (incomplete drafts)
        if (!job.lead.phone) {
            await prisma.sheetPushJob.update({
                where: { id: job.id },
                data: { status: 'SKIPPED', lastError: 'No phone number' },
            });
            results.push({ id: job.id, status: 'SKIPPED' });
            continue;
        }

        try {
            // Increment attempt counter
            await prisma.sheetPushJob.update({
                where: { id: job.id },
                data: { attempts: job.attempts + 1 },
            });

            // Push to Google Sheets
            await pushLeadToSheet(job.lead, job.lead.form);

            // Mark success on both job and lead
            await prisma.$transaction([
                prisma.sheetPushJob.update({
                    where: { id: job.id },
                    data: { status: 'SUCCESS', lastError: null },
                }),
                prisma.lead.update({
                    where: { id: job.lead.id },
                    data: { pushed_to_sheet: true },
                }),
            ]);

            results.push({ id: job.id, lead_id: job.lead.lead_id, status: 'SUCCESS' });
        } catch (err: any) {
            console.error(`[sync-sheets] Failed job ${job.id} (lead ${job.lead.lead_id}):`, err.message);
            await prisma.sheetPushJob.update({
                where: { id: job.id },
                data: { status: 'FAILED', lastError: err.message || 'Unknown error' },
            });
            results.push({ id: job.id, lead_id: job.lead.lead_id, status: 'FAILED', error: err.message });
        }
    }

    return {
        success: true,
        orphanedJobsCreated: orphanedLeads.length,
        jobsProcessed: results.length,
        results,
    };
}

// ── GET handler (for browser/cron access) ────────────────────────────────────
export async function GET() {
    try {
        const result = await syncLeadsToSheets();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[sync-sheets] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ── POST handler (called fire-and-forget from submit/draft) ──────────────────
export async function POST() {
    try {
        const result = await syncLeadsToSheets();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[sync-sheets] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
