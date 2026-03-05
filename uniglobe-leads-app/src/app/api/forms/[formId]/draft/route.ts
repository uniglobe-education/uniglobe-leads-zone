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

        // Only create a SheetPushJob when phone passes FULL validation
        if (phone && !lead.sheetPushJob) {
            const isPhoneValid = (() => {
                const parts = phone.trim().split(' ');
                const code = parts[0] || '';
                const subscriber = parts.slice(1).join('').replace(/\D/g, '');

                // Reject all-same digits
                if (/^(\d)\1{7,}$/.test(subscriber)) return false;

                // Expected subscriber digit counts per country
                const expected: Record<string, number> = {
                    '+880': 10, '+44': 10, '+91': 10, '+92': 10, '+1': 10,
                    '+61': 9, '+971': 9, '+966': 9, '+60': 9, '+49': 10,
                    '+65': 8, '+64': 9, '+977': 10, '+94': 9, '+353': 9,
                };
                const req = expected[code];
                if (req && subscriber.length !== req) return false;
                if (!req && (subscriber.length < 7 || subscriber.length > 12)) return false;

                // Carrier prefix rules
                const carriers: Record<string, string[]> = {
                    '+880': ['11', '12', '13', '14', '15', '16', '17', '18', '19'],
                    '+91': ['6', '7', '8', '9'],
                    '+92': ['3'],
                    '+44': ['7'],
                    '+971': ['5'],
                    '+966': ['5'],
                    '+977': ['97', '98'],
                    '+94': ['7'],
                };
                const rule = carriers[code];
                if (rule && subscriber.length >= 2) {
                    const prefixLen = rule[0]?.length ?? 1;
                    const prefix = subscriber.substring(0, prefixLen);
                    if (!rule.includes(prefix)) return false;
                }

                return true;
            })();

            if (isPhoneValid) {
                try {
                    const globalSetting = await prisma.globalSetting.findFirst();
                    if (globalSetting?.master_google_sheet_id) {
                        await prisma.sheetPushJob.create({
                            data: { leadId: lead.id, status: 'PENDING' },
                        });
                        console.log(`[DRAFT] Phone validated for lead ${lead.lead_id} — sync in 50s`);
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
