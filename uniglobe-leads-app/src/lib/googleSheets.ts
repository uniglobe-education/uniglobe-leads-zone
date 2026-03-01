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
    const normalizeHeader = (label: string) => label ? String(label).toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    const rawPhone = lead.phone || answers['phone'] || answers['phonenumber'] || '';
    const formattedPhone = rawPhone ? (rawPhone.startsWith('p:') ? rawPhone : `p:${rawPhone}`) : '';

    const leadData: Record<string, string> = {
        'id': lead.lead_id || '',
        'createdtime': new Date(lead.createdAt).toISOString(),
        'createdat': new Date(lead.createdAt).toISOString(),
        'adid': lead.ad_id || '',
        'adname': lead.ad_name || '',
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
        'city': answers['city'] || ''
    };

    // Add raw answers mapped by normalized question key
    for (const [key, val] of Object.entries(answers)) {
        let finalVal = String(val);
        const normKey = normalizeHeader(key);
        if ((normKey === 'phone' || normKey === 'phonenumber') && finalVal) {
            finalVal = finalVal.startsWith('p:') ? finalVal : `p:${finalVal}`;
        }
        leadData[normKey] = finalVal;
    }

    // Build the row array perfectly matching the header positions
    const rowArray = new Array(headers.length).fill('');

    for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (!h) continue;
        const normH = normalizeHeader(h);

        if (leadData[normH] !== undefined) {
            rowArray[i] = leadData[normH];
        } else {
            // Also attempt loose sub-string matching for questions naturally phrased.
            // i.e. "what is your english proficiency?" matching an answer key of just "english_proficiency"
            let matched = false;
            for (const [key, val] of Object.entries(answers)) {
                const normQKey = normalizeHeader(key);
                if (normH.includes(normQKey) || normQKey.includes(normH)) {
                    let finalVal = String(val);
                    if ((normQKey.includes('phone') || normH.includes('phone')) && finalVal) {
                        finalVal = finalVal.startsWith('p:') ? finalVal : `p:${finalVal}`;
                    }
                    rowArray[i] = finalVal;
                    matched = true;
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
