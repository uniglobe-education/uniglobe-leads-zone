/**
 * Determine a phone country calling code from GPS coordinates.
 * Uses bounding-box lookup — no external API required.
 * Returns null if no country matched (fallback to IP geo).
 */

type CountryEntry = {
    name: string;
    callingCode: string; // e.g. "+880"
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
};

const COUNTRY_BOXES: CountryEntry[] = [
    // South Asia
    { name: 'Bangladesh', callingCode: '+880', latMin: 20.7, latMax: 26.6, lonMin: 88.0, lonMax: 92.7 },
    { name: 'India', callingCode: '+91', latMin: 8.1, latMax: 37.1, lonMin: 68.1, lonMax: 97.4 },
    { name: 'Pakistan', callingCode: '+92', latMin: 23.7, latMax: 37.1, lonMin: 60.9, lonMax: 77.8 },
    { name: 'Sri Lanka', callingCode: '+94', latMin: 5.9, latMax: 9.8, lonMin: 79.6, lonMax: 81.9 },
    { name: 'Nepal', callingCode: '+977', latMin: 26.3, latMax: 30.5, lonMin: 80.0, lonMax: 88.2 },

    // Southeast Asia
    { name: 'Malaysia', callingCode: '+60', latMin: 0.9, latMax: 7.4, lonMin: 99.6, lonMax: 119.3 },
    { name: 'Singapore', callingCode: '+65', latMin: 1.1, latMax: 1.5, lonMin: 103.6, lonMax: 104.1 },
    { name: 'Thailand', callingCode: '+66', latMin: 5.6, latMax: 20.5, lonMin: 97.3, lonMax: 105.7 },
    { name: 'Vietnam', callingCode: '+84', latMin: 8.4, latMax: 23.4, lonMin: 102.1, lonMax: 109.5 },
    { name: 'Indonesia', callingCode: '+62', latMin: -11.0, latMax: 6.1, lonMin: 95.0, lonMax: 141.0 },

    // Middle East
    { name: 'UAE', callingCode: '+971', latMin: 22.6, latMax: 26.1, lonMin: 51.5, lonMax: 56.4 },
    { name: 'Saudi Arabia', callingCode: '+966', latMin: 16.3, latMax: 32.2, lonMin: 36.6, lonMax: 55.7 },
    { name: 'Qatar', callingCode: '+974', latMin: 24.5, latMax: 26.2, lonMin: 50.7, lonMax: 51.7 },
    { name: 'Kuwait', callingCode: '+965', latMin: 28.5, latMax: 30.1, lonMin: 46.5, lonMax: 48.4 },

    // Europe
    { name: 'United Kingdom', callingCode: '+44', latMin: 49.8, latMax: 60.9, lonMin: -8.2, lonMax: 1.8 },
    { name: 'Germany', callingCode: '+49', latMin: 47.3, latMax: 55.1, lonMin: 5.9, lonMax: 15.0 },
    { name: 'France', callingCode: '+33', latMin: 41.3, latMax: 51.1, lonMin: -5.1, lonMax: 9.6 },
    { name: 'Spain', callingCode: '+34', latMin: 35.9, latMax: 43.8, lonMin: -9.4, lonMax: 4.3 },
    { name: 'Italy', callingCode: '+39', latMin: 35.5, latMax: 47.1, lonMin: 6.6, lonMax: 18.5 },
    { name: 'Netherlands', callingCode: '+31', latMin: 50.7, latMax: 53.6, lonMin: 3.3, lonMax: 7.2 },
    { name: 'Sweden', callingCode: '+46', latMin: 55.3, latMax: 69.1, lonMin: 11.0, lonMax: 24.2 },
    { name: 'Norway', callingCode: '+47', latMin: 57.9, latMax: 71.2, lonMin: 4.6, lonMax: 31.1 },
    { name: 'Switzerland', callingCode: '+41', latMin: 45.8, latMax: 47.8, lonMin: 5.9, lonMax: 10.5 },
    { name: 'Ireland', callingCode: '+353', latMin: 51.4, latMax: 55.4, lonMin: -10.5, lonMax: -5.9 },
    { name: 'Portugal', callingCode: '+351', latMin: 36.8, latMax: 42.2, lonMin: -9.5, lonMax: -6.2 },

    // North America
    { name: 'USA', callingCode: '+1', latMin: 24.4, latMax: 49.4, lonMin: -125.0, lonMax: -66.9 },
    { name: 'Canada', callingCode: '+1', latMin: 41.7, latMax: 83.1, lonMin: -141.0, lonMax: -52.6 },
    { name: 'Mexico', callingCode: '+52', latMin: 14.5, latMax: 32.7, lonMin: -118.4, lonMax: -86.7 },

    // Oceania
    { name: 'Australia', callingCode: '+61', latMin: -43.6, latMax: -10.7, lonMin: 113.3, lonMax: 153.6 },
    { name: 'New Zealand', callingCode: '+64', latMin: -47.3, latMax: -34.4, lonMin: 166.4, lonMax: 178.6 },

    // Africa
    { name: 'South Africa', callingCode: '+27', latMin: -34.8, latMax: -22.1, lonMin: 16.5, lonMax: 32.9 },
    { name: 'Nigeria', callingCode: '+234', latMin: 4.3, latMax: 13.9, lonMin: 2.7, lonMax: 14.7 },
    { name: 'Egypt', callingCode: '+20', latMin: 22.0, latMax: 31.7, lonMin: 24.7, lonMax: 37.1 },
];

export function getCallingCodeFromCoords(lat: number, lon: number): string | null {
    for (const country of COUNTRY_BOXES) {
        if (
            lat >= country.latMin && lat <= country.latMax &&
            lon >= country.lonMin && lon <= country.lonMax
        ) {
            return country.callingCode;
        }
    }
    return null; // No match — caller should fall back to IP geo
}

export function getCountryNameFromCoords(lat: number, lon: number): string | null {
    for (const country of COUNTRY_BOXES) {
        if (
            lat >= country.latMin && lat <= country.latMax &&
            lon >= country.lonMin && lon <= country.lonMax
        ) {
            return country.name;
        }
    }
    return null;
}
