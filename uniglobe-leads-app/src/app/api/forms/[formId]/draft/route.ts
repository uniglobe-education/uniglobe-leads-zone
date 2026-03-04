import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncLeadsToSheets } from '@/lib/syncSheets';


/**
 * PATCH /api/forms/[formId]/draft
 * Saves partial answers to a DRAFT lead while the user is still filling the form.
 * Creates a SheetPushJob when phone is fully valid (≥10 digits), with a 50s delay
 * so more fields get filled before the push fires.
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

        // Extract phone — find the question with type 'phone' to get the right key
        const phoneQuestion = await prisma.question.findFirst({
            where: { form_id: lead.form.id, type: 'phone' },
            select: { key: true },
        });
        const phoneKey = phoneQuestion?.key || 'phone';
        const rawPhone = merged[phoneKey] || merged.phone || merged.phonenumber;
        const phone = rawPhone ? String(rawPhone).trim() : lead.phone ?? null;

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                answers: JSON.stringify(merged),
                ...(phone && { phone }),
            },
        });

        // Only create a SheetPushJob when phone is VALID (≥10 digits) and no job exists yet
        if (phone && !lead.sheetPushJob) {
            const digitCount = phone.replace(/[^0-9]/g, '').length;
            if (digitCount >= 10) {
                try {
                    const globalSetting = await prisma.globalSetting.findFirst();
                    if (globalSetting?.master_google_sheet_id) {
                        await prisma.sheetPushJob.create({
                            data: { leadId: lead.id, status: 'PENDING' },
                        });
                        console.log(`[DRAFT] Phone valid (${digitCount} digits) for lead ${lead.lead_id} — sync in 50s`);
                        // Fire sync after 50-second delay so more fields get filled
                        setTimeout(() => {
                            syncLeadsToSheets().catch(() => { });
                        }, 50_000);
                    }
                } catch { /* unique constraint — job already exists */ }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Draft save error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
