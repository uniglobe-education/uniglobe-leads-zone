import prisma from '@/lib/prisma';
import { pushLeadToSheet } from '@/lib/googleSheets';

/**
 * Core sync logic — processes pending/failed SheetPushJobs.
 * Extracted into a shared lib so it can be called directly from
 * submit/draft routes without HTTP self-fetch (which fails in Docker).
 */
export async function syncLeadsToSheets() {
    // ── Step 1: Catch-all sweep ──────────────────────────────────────────
    // Find leads that should be in Sheets but don't have a SheetPushJob
    const orphanedLeads = await prisma.lead.findMany({
        where: {
            pushed_to_sheet: false,
            phone: { not: null },
            sheetPushJob: null,
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
        if (!job.lead.phone) {
            await prisma.sheetPushJob.update({
                where: { id: job.id },
                data: { status: 'SKIPPED', lastError: 'No phone number' },
            });
            results.push({ id: job.id, status: 'SKIPPED' });
            continue;
        }

        try {
            await prisma.sheetPushJob.update({
                where: { id: job.id },
                data: { attempts: job.attempts + 1 },
            });

            await pushLeadToSheet(job.lead, job.lead.form);

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
