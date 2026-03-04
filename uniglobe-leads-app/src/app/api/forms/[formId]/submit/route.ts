import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendFacebookCapiEvent } from '@/lib/facebookCapi';
import { reverseGeocodeCity } from '@/lib/reverseGeocode';
import { syncLeadsToSheets } from '@/lib/syncSheets';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;
        const payload = await request.json();
        const { submissionId, answers, user_lat, user_lon } = payload;

        if (!submissionId) {
            return NextResponse.json({ error: 'Missing submission ID' }, { status: 400 });
        }

        if (!answers || Object.keys(answers).length === 0) {
            return NextResponse.json({ error: 'Missing answers' }, { status: 400 });
        }

        const lead = await prisma.lead.findUnique({
            where: { submissionId },
            include: { form: true },
        });

        // formId passed in the URL (e.g. MASTERS_UK) is actually the `form.form_id` in DB, 
        // while lead.form_id is the internal CUID. We must compare against lead.form.form_id
        if (!lead || lead.form.form_id !== formId) {
            return NextResponse.json({ error: 'Invalid submission' }, { status: 404 });
        }

        // Idempotency check: if already submitted, do nothing and return success
        if (lead.status === 'SUBMITTED') {
            return NextResponse.json({
                success: true,
                lead_id: lead.lead_id,
                idempotent: true
            });
        }

        // Generate Final Lead ID
        const today = new Date();
        const dateStr = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
        const prefix = `UG-${dateStr}-`;

        // Find the highest existing lead_id for today to avoid collisions
        const lastLead = await prisma.lead.findFirst({
            where: { lead_id: { startsWith: prefix } },
            orderBy: { lead_id: 'desc' },
            select: { lead_id: true },
        });

        let nextNum = 1;
        if (lastLead?.lead_id) {
            const lastNum = parseInt(lastLead.lead_id.split('-').pop() || '0', 10);
            nextNum = lastNum + 1;
        }
        const newLeadId = `${prefix}${nextNum.toString().padStart(6, '0')}`;

        const phone = answers.phone ? String(answers.phone).trim() : null;
        let duplicationCheck = null;

        if (phone) {
            const cleanIncomingPhone = phone.replace(/[^0-9]/g, '');
            const existingLeads = await prisma.lead.findMany({
                where: { phone: { not: null }, status: 'SUBMITTED' },
                select: { phone: true }
            });

            const isDuplicate = existingLeads.some(l => l.phone!.replace(/[^0-9]/g, '') === cleanIncomingPhone);
            if (isDuplicate) {
                duplicationCheck = 'DUPLICATE';
            }
        }

        console.log(`Finalizing lead ${newLeadId} for form ${formId}...`);

        // Update Lead to SUBMITTED and create SheetPushJob transactionally
        const updatedLead = await prisma.$transaction(async (tx) => {
            const updated = await tx.lead.update({
                where: { id: lead.id },
                data: {
                    lead_id: newLeadId,
                    phone,
                    answers: JSON.stringify(answers),
                    status: 'SUBMITTED',
                    duplication_check: duplicationCheck,
                    ...(user_lat != null && { user_lat: parseFloat(user_lat) }),
                    ...(user_lon != null && { user_lon: parseFloat(user_lon) }),
                }
            });

            // Enqueue sheet push job (but don't reset if already pushed successfully)
            const globalSetting = await tx.globalSetting.findFirst();
            if (globalSetting?.master_google_sheet_id && !updated.pushed_to_sheet) {
                const existingJob = await tx.sheetPushJob.findUnique({ where: { leadId: updated.id } });
                if (!existingJob) {
                    await tx.sheetPushJob.create({ data: { leadId: updated.id, status: 'PENDING' } });
                } else if (existingJob.status === 'FAILED') {
                    await tx.sheetPushJob.update({ where: { id: existingJob.id }, data: { status: 'PENDING', attempts: 0, lastError: null } });
                }
                // If SUCCESS — do nothing, already pushed
            }

            return updated;
        });

        // Step 1: Reverse geocode GPS → city (await this so city is in DB before sheet push)
        if (user_lat != null && user_lon != null) {
            try {
                const lat = parseFloat(user_lat);
                const lon = parseFloat(user_lon);
                if (!isNaN(lat) && !isNaN(lon)) {
                    const geocodedCity = await reverseGeocodeCity(lat, lon);
                    if (geocodedCity) {
                        await prisma.lead.update({
                            where: { id: updatedLead.id },
                            data: { city: geocodedCity },
                        });
                        console.log(`[GEO] Lead ${updatedLead.lead_id} city set to: ${geocodedCity}`);
                    }
                }
            } catch (e) { /* silent */ }
        }

        // Step 2: Fire & Forget sync to Google Sheets (city is now in DB)
        syncLeadsToSheets().catch(() => { });

        // Fire & Forget: Send server-side Lead event to Facebook Conversions API
        sendFacebookCapiEvent({ ...updatedLead, form: lead.form }, request.headers).catch(() => { });

        return NextResponse.json({
            success: true,
            lead_id: updatedLead.lead_id
        });

    } catch (error: any) {
        console.error('Error submitting form:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
