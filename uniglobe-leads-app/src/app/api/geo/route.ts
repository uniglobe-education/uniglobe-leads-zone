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
            // South Asia
            'BD': '+880', 'IN': '+91', 'PK': '+92', 'LK': '+94', 'NP': '+977', 'BT': '+975', 'MV': '+960', 'AF': '+93',
            // Southeast Asia
            'MY': '+60', 'SG': '+65', 'TH': '+66', 'VN': '+84', 'ID': '+62', 'PH': '+63', 'MM': '+95', 'KH': '+855',
            // East Asia
            'CN': '+86', 'JP': '+81', 'KR': '+82', 'TW': '+886', 'HK': '+852', 'MN': '+976',
            // Central Asia
            'KZ': '+7', 'UZ': '+998', 'TM': '+993', 'KG': '+996', 'TJ': '+992',
            // Middle East
            'AE': '+971', 'SA': '+966', 'QA': '+974', 'KW': '+965', 'BH': '+973', 'OM': '+968',
            'JO': '+962', 'LB': '+961', 'IQ': '+964', 'IR': '+98', 'TR': '+90', 'IL': '+972',
            // Europe
            'GB': '+44', 'IE': '+353', 'FR': '+33', 'DE': '+49', 'NL': '+31', 'BE': '+32', 'LU': '+352',
            'CH': '+41', 'AT': '+43', 'ES': '+34', 'PT': '+351', 'IT': '+39', 'GR': '+30', 'MT': '+356', 'CY': '+357',
            'SE': '+46', 'NO': '+47', 'DK': '+45', 'FI': '+358', 'IS': '+354',
            'PL': '+48', 'CZ': '+420', 'HU': '+36', 'RO': '+40', 'BG': '+359', 'HR': '+385', 'RS': '+381',
            'SK': '+421', 'SI': '+386', 'EE': '+372', 'LV': '+371', 'LT': '+370', 'UA': '+380', 'RU': '+7', 'GE': '+995',
            // Americas
            'US': '+1', 'CA': '+1', 'MX': '+52', 'BR': '+55', 'AR': '+54', 'CO': '+57', 'CL': '+56', 'PE': '+51', 'EC': '+593',
            // Oceania
            'AU': '+61', 'NZ': '+64', 'FJ': '+679',
            // Africa
            'ZA': '+27', 'NG': '+234', 'EG': '+20', 'KE': '+254', 'GH': '+233', 'ET': '+251', 'TZ': '+255',
            'MA': '+212', 'TN': '+216', 'DZ': '+213', 'LY': '+218', 'UG': '+256', 'RW': '+250', 'CM': '+237', 'CI': '+225', 'SN': '+221',
        };

        return NextResponse.json({
            success: true,
            ip: data.query,
            city: data.city,
            country_name: data.country,
            country_code: data.countryCode, // e.g. BD
            country_calling_code: countryCodesMap[data.countryCode] || '',
            lat: data.lat,
            lon: data.lon,
            data
        });

    } catch (error: any) {
        console.error('Geo API Error:', error);
        return NextResponse.json({ success: false, error: 'Could not resolve location' }, { status: 500 });
    }
}
