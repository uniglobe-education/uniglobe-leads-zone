import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import prisma from '@/lib/prisma';


export async function pushLeadToSheet(lead: any, form: any) {
    const globalSetting = await prisma.globalSetting.findFirst();
    if (!globalSetting || !globalSetting.master_google_sheet_id) {
        throw new Error('No Master Google Sheet ID configured in Global Settings.');
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail || !privateKey) {
        throw new Error('Google Service Account credentials missing in .env');
    }

    const auth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const token = await auth.getAccessToken();

    const tabName = form.target_sheet_tab_name || form.form_name;
    const spreadsheetId = globalSetting.master_google_sheet_id;

    // ── Fetch questions with sheet_column mappings ────────────────────────
    const formQuestions = await prisma.question.findMany({
        where: { form_id: form.id, enabled: true },
        orderBy: { order: 'asc' },
        select: { key: true, sheet_column: true },
    });

    // Build reverse map: normalized sheet_column → [question keys]
    // This lets multiple questions merge their answers into one sheet column
    const columnToKeys: Record<string, string[]> = {};
    for (const q of formQuestions) {
        const target = q.sheet_column?.trim() || q.key; // fallback to question key
        const normTarget = normalizeHeader(target);
        if (!columnToKeys[normTarget]) columnToKeys[normTarget] = [];
        columnToKeys[normTarget].push(q.key);
    }

    // Fetch the header row to determine exact column placement
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName + '!1:1')}`;
    const headerRes = await fetch(headerUrl, {
        headers: { 'Authorization': `Bearer ${token.token}` }
    });

    const headerData = await headerRes.json();
    if (!headerRes.ok) {
        throw new Error(headerData.error?.message || 'Failed to fetch sheet headers');
    }

    const headers: string[] = headerData.values && headerData.values.length > 0 ? headerData.values[0] : [];

    if (headers.length === 0) {
        throw new Error('Target Google Sheet tab is completely empty. Please create at least one header row.');
    }

    const answers = JSON.parse(lead.answers || '{}');

    // Helper to normalize the user's header columns so we can loosely match them
    function normalizeHeader(label: string) {
        return label ? String(label).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    }

    const rawPhone = lead.phone || answers['phone'] || answers['phonenumber'] || '';
    const formattedPhone = rawPhone ? (rawPhone.startsWith('p:') ? rawPhone : `p:${rawPhone}`) : '';

    // ── Base lead data (non-question fields) ─────────────────────────────
    const leadData: Record<string, string> = {
        'id': lead.lead_id || '',
        'createdtime': new Date(lead.createdAt).toISOString(),
        'createdat': new Date(lead.createdAt).toISOString(),
        'adid': lead.ad_id || '',
        'adname': lead.ad_name || form.form_name || '',
        'adsetid': lead.adset_id || '',
        'adsetname': lead.adset_name || '',
        'campaignid': lead.campaign_id || '',
        'campaignname': lead.campaign_name || '',
        'formid': form.form_id || '',
        'formname': form.form_name || '',
        'isorganic': lead.is_organic || '',
        'platform': lead.platform || 'Website',
        'phone': formattedPhone,
        'firstname': answers['first_name'] || answers['name'] || answers['firstname'] || answers['first name'] || '',
        'city': (lead.city as string | undefined) || answers['city'] || ''
    };

    // Add raw answers mapped by normalized question key (for non-mapped questions)
    for (const [key, val] of Object.entries(answers)) {
        let finalVal = String(val);
        const normKey = normalizeHeader(key);
        if ((normKey === 'phone' || normKey === 'phonenumber') && finalVal) {
            finalVal = finalVal.startsWith('p:') ? finalVal : `p:${finalVal}`;
        }
        leadData[normKey] = finalVal;
    }

    // ── Build the row array matching header positions ─────────────────────
    const rowArray = new Array(headers.length).fill('');

    for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (!h) continue;
        const normH = normalizeHeader(h);

        // Priority 1: Check if this header is a sheet_column target → merge answers
        if (columnToKeys[normH] && columnToKeys[normH].length > 0) {
            const parts: string[] = [];
            for (const qKey of columnToKeys[normH]) {
                const val = answers[qKey];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    let finalVal = String(val);
                    if ((qKey === 'phone' || qKey === 'phonenumber') && finalVal) {
                        finalVal = finalVal.startsWith('p:') ? finalVal : `p:${finalVal}`;
                    }
                    parts.push(finalVal);
                }
            }
            if (parts.length > 0) {
                rowArray[i] = parts.join(' | ');
                continue;
            }
        }

        // Priority 2: Direct match from base leadData
        if (leadData[normH] !== undefined) {
            rowArray[i] = leadData[normH];
        } else {
            // Priority 3: Loose sub-string matching for naturally phrased headers
            for (const [key, val] of Object.entries(answers)) {
                const normQKey = normalizeHeader(key);
                if (normH.includes(normQKey) || normQKey.includes(normH)) {
                    let finalVal = String(val);
                    if ((normQKey.includes('phone') || normH.includes('phone')) && finalVal) {
                        finalVal = finalVal.startsWith('p:') ? finalVal : `p:${finalVal}`;
                    }
                    rowArray[i] = finalVal;
                    break;
                }
            }
        }
    }

    // Call raw Google Sheets api v4 to append the intelligently ordered row
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(appendUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            range: tabName,
            majorDimension: 'ROWS',
            values: [rowArray]
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to push to Google Sheets API');
    }
}
