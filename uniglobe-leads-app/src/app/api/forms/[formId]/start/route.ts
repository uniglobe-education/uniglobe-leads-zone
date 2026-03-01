import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


export async function POST(
    request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;
        const body = await request.json().catch(() => ({}));
        const { urlParams = {}, existingSubmissionId } = body;

        // Find active form
        const form = await prisma.form.findUnique({
            where: { form_id: formId, status: 'ACTIVE' },
        });

        if (!form) return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });

        // Idempotency: Resume existing draft if client has one
        if (existingSubmissionId) {
            const existing = await prisma.lead.findUnique({
                where: { submissionId: existingSubmissionId }
            });
            // If it exists, return it, but don't error out if it was submitted. They'll find out on /submit.
            if (existing) {
                return NextResponse.json({ submissionId: existing.submissionId });
            }
        }

        // Create new DRAFT
        const submissionId = crypto.randomUUID();

        // Unique but temporary lead_id for Drafts
        const draftId = `DRAFT-${submissionId.split('-')[0]}-${Date.now().toString().slice(-4)}`;

        const lead = await prisma.lead.create({
            data: {
                lead_id: draftId,
                form_id: form.id,
                status: 'DRAFT',
                submissionId,
                platform: urlParams.platform || null,
                is_organic: urlParams.is_organic || null,
                campaign_id: urlParams.campaign_id || null,
                campaign_name: urlParams.campaign_name || null,
                adset_id: urlParams.adset_id || null,
                adset_name: urlParams.adset_name || null,
                ad_id: urlParams.ad_id || null,
                ad_name: urlParams.ad_name || null,
                utm_source: urlParams.utm_source || null,
                utm_medium: urlParams.utm_medium || null,
                utm_campaign: urlParams.utm_campaign || null,
                utm_term: urlParams.utm_term || null,
                utm_content: urlParams.utm_content || null,
                fbclid: urlParams.fbclid || null,
                fbp: urlParams._fbp || null,
                fbc: urlParams.fbc || null,
                landing_page: urlParams.landing_page || null,
            }
        });

        return NextResponse.json({ submissionId: lead.submissionId });
    } catch (error) {
        console.error('Error starting submission:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
