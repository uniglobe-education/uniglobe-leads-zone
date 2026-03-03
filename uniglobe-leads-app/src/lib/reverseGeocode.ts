/**
 * Reverse geocoding utility using OpenStreetMap Nominatim.
 * Free, no API key required.
 * Returns the best available city name from GPS coordinates.
 */

interface NominatimResponse {
    address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state_district?: string;
        state?: string;
        country?: string;
    };
    error?: string;
}

/**
 * Reverse geocode GPS coordinates to a city name.
 * Priority: city → town → village → municipality → county → state_district
 * Returns null if lookup fails (network error, no result, etc.)
 * Never throws.
 */
export async function reverseGeocodeCity(
    lat: number,
    lon: number
): Promise<string | null> {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

        const res = await fetch(url, {
            headers: {
                // Nominatim requires a User-Agent identifying your app
                'User-Agent': 'UniGlobeLeads/1.0 (apply.uniglobeeducation.co.uk)',
                'Accept-Language': 'en',
            },
            signal: AbortSignal.timeout(4000), // 4-second timeout
        });

        if (!res.ok) {
            console.warn(`[GEO] Nominatim returned ${res.status} for (${lat}, ${lon})`);
            return null;
        }

        const data: NominatimResponse = await res.json();

        if (data.error) {
            console.warn(`[GEO] Nominatim error: ${data.error}`);
            return null;
        }

        const addr = data.address;
        if (!addr) return null;

        // Prefer the most specific populated place name available
        const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            addr.state_district ||
            null;

        if (city) {
            console.log(`[GEO] (${lat}, ${lon}) → ${city}`);
        }

        return city ?? null;
    } catch (err: any) {
        // TimeoutError or network failure — silently ignore
        console.warn(`[GEO] Reverse geocode failed for (${lat}, ${lon}):`, err?.message ?? err);
        return null;
    }
}
