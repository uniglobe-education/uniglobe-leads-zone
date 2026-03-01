import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


/**
 * PATCH /api/forms/[formId]/draft
 * Saves partial answers to a DRAFT lead while the user is still filling the form.
 * Phone number (if present in answers) must have already passed client-side validation.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;
        const body = await request.json();
        const { submissionId, answers } = body;

        if (!submissionId || !answers) {
            return NextResponse.json({ error: 'Missing submissionId or answers' }, { status: 400 });
        }

        const lead = await prisma.lead.findUnique({
            where: { submissionId },
            include: { form: true, sheetPushJob: true },
        });

        if (!lead || lead.form.form_id !== formId) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Don't overwrite a submitted lead
        if (lead.status === 'SUBMITTED') {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Save partial answers — merge with any existing answers so we never lose data
        let existingAnswers: Record<string, any> = {};
        try {
            if (lead.answers) existingAnswers = JSON.parse(lead.answers);
        } catch { }

        const merged = { ...existingAnswers, ...answers };

        // Extract phone if present (for top-level field)
        const phone = merged.phone ? String(merged.phone).trim() : lead.phone ?? null;

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                answers: JSON.stringify(merged),
                ...(phone && { phone }),
            },
        });

        // If we have a valid phone and no SheetPushJob exists, create one
        if (phone && !lead.sheetPushJob) {
            try {
                const globalSetting = await prisma.globalSetting.findFirst();
                if (globalSetting?.master_google_sheet_id) {
                    await prisma.sheetPushJob.create({
                        data: { leadId: lead.id, status: 'PENDING' },
                    });
                    // Fire & forget sync
                    fetch(`${request.headers.get('origin') || 'http://localhost:3000'}/api/cron/sync-sheets`, { method: 'POST' }).catch(() => { });
                }
            } catch { /* unique constraint — job already exists */ }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Draft save error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
