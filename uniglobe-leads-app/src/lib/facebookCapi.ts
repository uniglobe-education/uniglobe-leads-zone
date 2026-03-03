import crypto from 'crypto';

const PIXEL_ID = process.env.FB_PIXEL_ID;
const ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE; // Only set during testing

/** SHA-256 hash a string (for PII normalisation required by Facebook) */
function sha256(value: string): string {
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** Normalise a phone number to E.164 digits-only (e.g. "+880 1711XXXXXX" → "8801711XXXXXX") */
function normalisePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
}

interface LeadForCapi {
    id: string;
    lead_id: string;
    phone?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    fbclid?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    landing_page?: string | null;
    answers?: string | null;
    form?: { form_id?: string; form_name?: string } | null;
    createdAt: Date;
}

/**
 * Fire a Facebook Conversions API `Lead` event for a submitted lead.
 * This is fire-and-forget — it never throws, so a CAPI failure
 * cannot break the user-facing form submission.
 */
export async function sendFacebookCapiEvent(
    lead: LeadForCapi,
    headers: Headers
): Promise<void> {
    if (!PIXEL_ID || !ACCESS_TOKEN) {
        console.warn('[CAPI] FB_PIXEL_ID or FB_CAPI_ACCESS_TOKEN not set — skipping CAPI event.');
        return;
    }

    try {
        // Resolve client IP — prefer x-forwarded-for (set by Cloudflare / proxies)
        const clientIp =
            headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            headers.get('x-real-ip') ||
            null;

        // Build user_data — only include fields we actually have
        const userData: Record<string, string | undefined> = {};

        if (lead.phone) {
            const normPhone = normalisePhone(lead.phone);
            if (normPhone.length >= 7) {
                userData['ph'] = sha256(normPhone);
            }
        }

        // Try to extract email from answers JSON
        try {
            if (lead.answers) {
                const parsed = JSON.parse(lead.answers);
                const email = parsed['email'] || parsed['Email'] || parsed['email_address'];
                if (email && typeof email === 'string' && email.includes('@')) {
                    userData['em'] = sha256(email);
                }
            }
        } catch { /* ignore JSON parse errors */ }

        if (lead.fbp) userData['fbp'] = lead.fbp;
        if (lead.fbc) userData['fbc'] = lead.fbc;
        if (clientIp) userData['client_ip_address'] = clientIp;
        userData['client_user_agent'] = headers.get('user-agent') || undefined;

        // Build the event payload
        const eventPayload: Record<string, unknown> = {
            event_name: 'Lead',
            event_time: Math.floor(lead.createdAt.getTime() / 1000),
            event_id: lead.id, // Used for deduplication with the browser pixel
            action_source: 'website',
            user_data: userData,
            custom_data: {
                lead_id: lead.lead_id,
                form_id: lead.form?.form_id,
                utm_source: lead.utm_source || undefined,
                utm_medium: lead.utm_medium || undefined,
                utm_campaign: lead.utm_campaign || undefined,
                utm_content: lead.utm_content || undefined,
                utm_term: lead.utm_term || undefined,
            },
        };

        if (lead.landing_page) {
            eventPayload['event_source_url'] = lead.landing_page;
        }

        const body: Record<string, unknown> = {
            data: [eventPayload],
        };

        // Only include test_event_code when explicitly set (remove in production)
        if (TEST_EVENT_CODE) {
            body['test_event_code'] = TEST_EVENT_CODE;
        }

        const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`[CAPI] Facebook returned ${res.status}: ${text}`);
        } else {
            const json = await res.json() as { events_received?: number };
            console.log(`[CAPI] Lead event sent. FB events_received: ${json.events_received ?? '?'}`);
        }
    } catch (err) {
        // Never propagate — CAPI failure must not break form submission
        console.error('[CAPI] Failed to send event:', err);
    }
}
