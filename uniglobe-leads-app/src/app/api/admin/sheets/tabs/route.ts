import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
// Ensure some form of auth check here if needed eventually, assuming /api/admin is protected.

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sheetId = searchParams.get('sheetId');

        if (!sheetId) {
            return NextResponse.json({ error: 'Missing sheetId' }, { status: 400 });
        }

        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!serviceAccountEmail || !privateKey) {
            return NextResponse.json({ error: 'Google Service Account credentials missing in .env' }, { status: 500 });
        }

        const auth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const doc = new GoogleSpreadsheet(sheetId, auth);
        await doc.loadInfo();

        // doc.sheetsByIndex is an array of Worksheets
        const tabs = doc.sheetsByIndex.map(sheet => ({
            id: sheet.sheetId,
            title: sheet.title,
            hidden: sheet.hidden || false,
        }));

        // Sort: active tabs first, hidden tabs at the bottom
        tabs.sort((a, b) => {
            if (a.hidden && !b.hidden) return 1;
            if (!a.hidden && b.hidden) return -1;
            return 0;
        });

        return NextResponse.json({ title: doc.title, tabs });
    } catch (error: any) {
        console.error('Error fetching google sheet tabs:', error);
        return NextResponse.json({ error: 'Failed to load tabs. Verify Sheet ID is correct and shared with the Service Account.' }, { status: 500 });
    }
}
