import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendFacebookCapiStatusEvent } from '@/lib/facebookCapi';

const VALID_STATUSES = [
    'CREATED',
    'CONTACTED',
    'NO_RESPONSE',
    'UNQUALIFIED',
    'INTERESTED',
    'QUALIFIED ⭐',
    'QUALIFIED',
    'APPLICATION_STARTED',
    'OFFER_ISSUED',
    'CAS_ISSUED',
    'DUPLICATE',
];

/**
 * POST /api/leads/status
 *
 * Called by Google Apps Script (main_lead.gs) when a counselor
 * changes the lead_status column in the main CRM sheet.
 *
 * Body: { lead_id, lead_status, webhook_secret }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lead_id, lead_status, webhook_secret } = body;

        // ── Auth: validate webhook secret ──────────────────────────────────
        const expectedSecret = process.env.WEBHOOK_SECRET;
        if (!expectedSecret || webhook_secret !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Validate inputs ────────────────────────────────────────────────
        if (!lead_id || typeof lead_id !== 'string') {
            return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
        }
        if (!lead_status || typeof lead_status !== 'string') {
            return NextResponse.json({ error: 'Missing lead_status' }, { status: 400 });
        }

        // Accept known statuses + any custom ones from the sheet
        const normStatus = lead_status.trim();
        if (normStatus.length === 0) {
            return NextResponse.json({ error: 'lead_status cannot be empty' }, { status: 400 });
        }

        // ── Find lead ──────────────────────────────────────────────────────
        const lead = await prisma.lead.findUnique({
            where: { lead_id: lead_id.trim() },
            include: { form: true },
        });

        if (!lead) {
            return NextResponse.json({ error: `Lead not found: ${lead_id}` }, { status: 404 });
        }

        // Only update SUBMITTED leads (skip DRAFT / test rows)
        if (lead.status !== 'SUBMITTED') {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: 'Lead is not yet submitted',
            });
        }

        // Idempotency: skip if status already matches
        if (lead.lead_status === normStatus) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: 'lead_status already matches',
            });
        }

        // ── Update DB ──────────────────────────────────────────────────────
        const updated = await prisma.lead.update({
            where: { id: lead.id },
            data: { lead_status: normStatus },
            include: { form: true },
        });

        console.log(`[STATUS] Lead ${lead_id} status → ${normStatus}`);

        // ── Fire CAPI event ────────────────────────────────────────────────
        // Fire-and-forget — does not block the response
        sendFacebookCapiStatusEvent(
            { ...updated, form: updated.form },
            normStatus
        ).catch(() => { });

        return NextResponse.json({
            success: true,
            lead_id,
            lead_status: normStatus,
        });

    } catch (error: any) {
        console.error('[STATUS] Error updating lead status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
