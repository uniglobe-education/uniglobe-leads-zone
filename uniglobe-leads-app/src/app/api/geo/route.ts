import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Allow IP override for local testing via query param, else extract from NextRequest headers
        let ip = request.nextUrl.searchParams.get('ip') || '';

        if (!ip) {
            // Vercel / proxy headers
            const forwardedFor = request.headers.get('x-forwarded-for');
            const realIp = request.headers.get('x-real-ip');
            ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '8.8.8.8'); // default to US IP for local fallback

            // If it's a local IPv6/IPv4 address, we use a default Bangladesh IP for realistic local testing based on user's location
            if (ip === '::1' || ip === '127.0.0.1') {
                ip = '103.180.208.0'; // example Dhaka, BD IP
            }
        }

        const res = await fetch(`http://ip-api.com/json/${ip}`);

        if (!res.ok) {
            throw new Error('Geolocation service failed');
        }

        const data = await res.json();

        // ip-api.com returns 'status: fail' for bad queries instead of 4xx sometimes
        if (data.status === 'fail') {
            throw new Error(data.message || 'Geo query failed');
        }

        // Mapping ip-api.com to standard names
        // Note: ip-api.com doesn't natively return country calling code on the free plan. 
        // We will do a manual small map or fallback.

        const countryCodesMap: Record<string, string> = {
            'BD': '+880', 'US': '+1', 'GB': '+44', 'CA': '+1', 'IN': '+91', 'AU': '+61'
        };

        return NextResponse.json({
            success: true,
            ip: data.query,
            city: data.city,
            country_name: data.country,
            country_code: data.countryCode, // e.g. BD
            country_calling_code: countryCodesMap[data.countryCode] || '',
            data
        });

    } catch (error: any) {
        console.error('Geo API Error:', error);
        return NextResponse.json({ success: false, error: 'Could not resolve location' }, { status: 500 });
    }
}
