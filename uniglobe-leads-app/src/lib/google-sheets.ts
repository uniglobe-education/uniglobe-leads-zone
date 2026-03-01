import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function appendToGoogleSheet(
    spreadsheetId: string,
    formId: string,
    formName: string,
    leadData: any,
    answers: Record<string, any>,
    urlParams: Record<string, any>
) {
    // Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail || !privateKey) {
        throw new Error('Google Service Account credentials missing in environment variables.');
    }

    const auth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, auth);
    await doc.loadInfo();

    const tabName = `LEADS__${formId}`;
    let sheet = doc.sheetsByTitle[tabName];

    const baseTrackingColumns = [
        "id", "created_time", "platform", "is_organic",
        "campaign_id", "campaign_name", "adset_id", "adset_name",
        "ad_id", "ad_name", "form_id", "form_name",
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "_fbp", "fbc", "landing_page"
    ];

    const crmColumns = [
        "lead_status", "assigned_to", "note", "follow_up", "next_follow_up", "duplication_check", "status"
    ];

    // Dynamic keys from answers
    const dynamicColumns = Object.keys(answers);

    const desiredHeaders = [...baseTrackingColumns, ...dynamicColumns, ...crmColumns];

    // If tab does not exist, create it
    if (!sheet) {
        console.log(`Creating new tab ${tabName} in Google Sheet...`);
        sheet = await doc.addSheet({ title: tabName, headerValues: desiredHeaders });
    } else {
        // Check missing headers
        await sheet.loadHeaderRow().catch(() => null);
        const existingHeaders = sheet.headerValues || [];
        let updatedHeaders = [...existingHeaders];
        let needsHeaderUpdate = false;

        for (const h of desiredHeaders) {
            if (!existingHeaders.includes(h)) {
                updatedHeaders.push(h);
                needsHeaderUpdate = true;
            }
        }

        if (needsHeaderUpdate || existingHeaders.length === 0) {
            await sheet.setHeaderRow(updatedHeaders);
        }
    }

    // Construct the row object
    const newRow: Record<string, string | number | Date> = {};

    // Base fields
    newRow["id"] = leadData.lead_id;
    newRow["created_time"] = leadData.createdAt;
    newRow["form_id"] = formId;
    newRow["form_name"] = formName;
    newRow["duplication_check"] = leadData.duplication_check || '';

    // URL Params
    for (const [key, val] of Object.entries(urlParams)) {
        newRow[key] = val as string;
    }

    // Answers
    for (const [key, val] of Object.entries(answers)) {
        newRow[key] = val as string;
    }

    await sheet.addRow(newRow);
    console.log(`Successfully appended row to ${tabName}`);
}
