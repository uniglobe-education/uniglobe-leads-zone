import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import prisma from '@/lib/prisma';


export async function pushLeadToSheet(lead: any, form: any) {
    console.log(`[SHEET-PUSH] Starting push for lead ${lead.lead_id} | form: ${form.form_name} (${form.form_id})`);
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
    console.log(`[SHEET-PUSH] Target: spreadsheet=${spreadsheetId} tab="${tabName}"`);

    // ── Fetch questions with sheet_column mappings ────────────────────────
    const formQuestions = await prisma.question.findMany({
        where: { form_id: form.id, enabled: true },
        orderBy: { order: 'asc' },
        select: { key: true, sheet_column: true },
    });

    // Build reverse map: normalized sheet_column → [question keys]
    // ONLY for questions with an explicit sheet_column set by admin
    const columnToKeys: Record<string, string[]> = {};
    for (const q of formQuestions) {
        if (!q.sheet_column?.trim()) continue; // skip — no explicit mapping
        const normTarget = normalizeHeader(q.sheet_column.trim());
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
    console.log(`[SHEET-PUSH] Found ${headers.length} headers: ${headers.slice(0, 10).join(', ')}${headers.length > 10 ? '...' : ''}`);

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
        'createdtime': new Date(lead.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }),
        'createdat': new Date(lead.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }),
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

    // ── Find existing row or append new one ────────────────────────────────
    // Search the "id" column for an existing row for this lead (DRAFT-xxx or UG-xxx)
    // so we UPDATE it instead of creating duplicates.
    const submissionPrefix = lead.submissionId ? lead.submissionId.substring(0, 8) : null;
    let existingRowIndex = -1;

    if (submissionPrefix) {
        // Find which column is "id"
        const idColIdx = headers.findIndex((h: string) => normalizeHeader(h) === 'id');
        if (idColIdx >= 0) {
            // Fetch all values in the "id" column to find existing row
            const colLetter = String.fromCharCode(65 + idColIdx); // A, B, C...
            const idColUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName + '!' + colLetter + ':' + colLetter)}`;
            const idColRes = await fetch(idColUrl, { headers: { 'Authorization': `Bearer ${token.token}` } });
            if (idColRes.ok) {
                const idColData = await idColRes.json();
                const idValues: string[][] = idColData.values || [];
                for (let r = 1; r < idValues.length; r++) { // skip header row
                    const cellVal = idValues[r]?.[0] || '';
                    if (cellVal.includes(submissionPrefix)) {
                        existingRowIndex = r + 1; // 1-indexed row number in sheet
                        console.log(`[SHEET-PUSH] Found existing row ${existingRowIndex} for submissionPrefix ${submissionPrefix}`);
                        break;
                    }
                }
            }
        }
    }

    if (existingRowIndex > 0) {
        // UPDATE existing row in place
        const updateRange = `${tabName}!A${existingRowIndex}`;
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;
        const response = await fetch(updateUrl, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ range: updateRange, majorDimension: 'ROWS', values: [rowArray] })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error(`[SHEET-PUSH] UPDATE FAILED for lead ${lead.lead_id}:`, data.error?.message);
            throw new Error(data.error?.message || 'Failed to update Google Sheets row');
        }
        console.log(`[SHEET-PUSH] UPDATED row ${existingRowIndex} for lead ${lead.lead_id} → tab "${tabName}"`);
    } else {
        // APPEND new row
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}:append?valueInputOption=USER_ENTERED`;
        const response = await fetch(appendUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ range: tabName, majorDimension: 'ROWS', values: [rowArray] })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error(`[SHEET-PUSH] APPEND FAILED for lead ${lead.lead_id}:`, data.error?.message);
            throw new Error(data.error?.message || 'Failed to push to Google Sheets API');
        }
        console.log(`[SHEET-PUSH] APPENDED lead ${lead.lead_id} → tab "${tabName}"`);
    }
}
