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
    // ── South Asia ──
    { name: 'Bangladesh', callingCode: '+880', latMin: 20.7, latMax: 26.6, lonMin: 88.0, lonMax: 92.7 },
    { name: 'India', callingCode: '+91', latMin: 8.1, latMax: 37.1, lonMin: 68.1, lonMax: 97.4 },
    { name: 'Pakistan', callingCode: '+92', latMin: 23.7, latMax: 37.1, lonMin: 60.9, lonMax: 77.8 },
    { name: 'Sri Lanka', callingCode: '+94', latMin: 5.9, latMax: 9.8, lonMin: 79.6, lonMax: 81.9 },
    { name: 'Nepal', callingCode: '+977', latMin: 26.3, latMax: 30.5, lonMin: 80.0, lonMax: 88.2 },
    { name: 'Bhutan', callingCode: '+975', latMin: 26.7, latMax: 28.3, lonMin: 88.7, lonMax: 92.1 },
    { name: 'Maldives', callingCode: '+960', latMin: -0.7, latMax: 7.1, lonMin: 72.6, lonMax: 73.8 },
    { name: 'Afghanistan', callingCode: '+93', latMin: 29.4, latMax: 38.5, lonMin: 60.5, lonMax: 74.9 },

    // ── Southeast Asia ──
    { name: 'Malaysia', callingCode: '+60', latMin: 0.9, latMax: 7.4, lonMin: 99.6, lonMax: 119.3 },
    { name: 'Singapore', callingCode: '+65', latMin: 1.1, latMax: 1.5, lonMin: 103.6, lonMax: 104.1 },
    { name: 'Thailand', callingCode: '+66', latMin: 5.6, latMax: 20.5, lonMin: 97.3, lonMax: 105.7 },
    { name: 'Vietnam', callingCode: '+84', latMin: 8.4, latMax: 23.4, lonMin: 102.1, lonMax: 109.5 },
    { name: 'Indonesia', callingCode: '+62', latMin: -11.0, latMax: 6.1, lonMin: 95.0, lonMax: 141.0 },
    { name: 'Philippines', callingCode: '+63', latMin: 4.6, latMax: 21.1, lonMin: 116.9, lonMax: 126.6 },
    { name: 'Myanmar', callingCode: '+95', latMin: 9.8, latMax: 28.5, lonMin: 92.2, lonMax: 101.2 },
    { name: 'Cambodia', callingCode: '+855', latMin: 10.4, latMax: 14.7, lonMin: 102.3, lonMax: 107.6 },

    // ── East Asia ──
    { name: 'China', callingCode: '+86', latMin: 18.2, latMax: 53.6, lonMin: 73.5, lonMax: 135.1 },
    { name: 'Japan', callingCode: '+81', latMin: 24.2, latMax: 45.5, lonMin: 122.9, lonMax: 153.0 },
    { name: 'South Korea', callingCode: '+82', latMin: 33.1, latMax: 38.6, lonMin: 124.6, lonMax: 131.9 },
    { name: 'Taiwan', callingCode: '+886', latMin: 21.9, latMax: 25.3, lonMin: 120.0, lonMax: 122.0 },
    { name: 'Hong Kong', callingCode: '+852', latMin: 22.1, latMax: 22.6, lonMin: 113.8, lonMax: 114.4 },
    { name: 'Mongolia', callingCode: '+976', latMin: 41.6, latMax: 52.1, lonMin: 87.7, lonMax: 119.9 },

    // ── Central Asia ──
    { name: 'Kazakhstan', callingCode: '+7', latMin: 40.6, latMax: 55.4, lonMin: 46.5, lonMax: 87.3 },
    { name: 'Uzbekistan', callingCode: '+998', latMin: 37.2, latMax: 45.6, lonMin: 56.0, lonMax: 73.1 },
    { name: 'Turkmenistan', callingCode: '+993', latMin: 35.1, latMax: 42.8, lonMin: 52.4, lonMax: 66.7 },
    { name: 'Kyrgyzstan', callingCode: '+996', latMin: 39.2, latMax: 43.3, lonMin: 69.3, lonMax: 80.2 },
    { name: 'Tajikistan', callingCode: '+992', latMin: 36.7, latMax: 41.0, lonMin: 67.3, lonMax: 75.1 },

    // ── Middle East ──
    { name: 'UAE', callingCode: '+971', latMin: 22.6, latMax: 26.1, lonMin: 51.5, lonMax: 56.4 },
    { name: 'Saudi Arabia', callingCode: '+966', latMin: 16.3, latMax: 32.2, lonMin: 36.6, lonMax: 55.7 },
    { name: 'Qatar', callingCode: '+974', latMin: 24.5, latMax: 26.2, lonMin: 50.7, lonMax: 51.7 },
    { name: 'Kuwait', callingCode: '+965', latMin: 28.5, latMax: 30.1, lonMin: 46.5, lonMax: 48.4 },
    { name: 'Bahrain', callingCode: '+973', latMin: 25.8, latMax: 26.3, lonMin: 50.3, lonMax: 50.7 },
    { name: 'Oman', callingCode: '+968', latMin: 16.6, latMax: 26.4, lonMin: 52.0, lonMax: 59.8 },
    { name: 'Jordan', callingCode: '+962', latMin: 29.2, latMax: 33.4, lonMin: 34.9, lonMax: 39.3 },
    { name: 'Lebanon', callingCode: '+961', latMin: 33.1, latMax: 34.7, lonMin: 35.1, lonMax: 36.6 },
    { name: 'Iraq', callingCode: '+964', latMin: 29.1, latMax: 37.4, lonMin: 38.8, lonMax: 48.6 },
    { name: 'Iran', callingCode: '+98', latMin: 25.1, latMax: 39.8, lonMin: 44.0, lonMax: 63.3 },
    { name: 'Turkey', callingCode: '+90', latMin: 36.0, latMax: 42.1, lonMin: 26.0, lonMax: 44.8 },

    // ── Europe (Western) ──
    { name: 'United Kingdom', callingCode: '+44', latMin: 49.8, latMax: 60.9, lonMin: -8.2, lonMax: 1.8 },
    { name: 'Ireland', callingCode: '+353', latMin: 51.4, latMax: 55.4, lonMin: -10.5, lonMax: -5.9 },
    { name: 'France', callingCode: '+33', latMin: 41.3, latMax: 51.1, lonMin: -5.1, lonMax: 9.6 },
    { name: 'Germany', callingCode: '+49', latMin: 47.3, latMax: 55.1, lonMin: 5.9, lonMax: 15.0 },
    { name: 'Netherlands', callingCode: '+31', latMin: 50.7, latMax: 53.6, lonMin: 3.3, lonMax: 7.2 },
    { name: 'Belgium', callingCode: '+32', latMin: 49.5, latMax: 51.5, lonMin: 2.5, lonMax: 6.4 },
    { name: 'Luxembourg', callingCode: '+352', latMin: 49.4, latMax: 50.2, lonMin: 5.7, lonMax: 6.5 },
    { name: 'Switzerland', callingCode: '+41', latMin: 45.8, latMax: 47.8, lonMin: 5.9, lonMax: 10.5 },
    { name: 'Austria', callingCode: '+43', latMin: 46.4, latMax: 49.0, lonMin: 9.5, lonMax: 17.2 },
    { name: 'Spain', callingCode: '+34', latMin: 35.9, latMax: 43.8, lonMin: -9.4, lonMax: 4.3 },
    { name: 'Portugal', callingCode: '+351', latMin: 36.8, latMax: 42.2, lonMin: -9.5, lonMax: -6.2 },
    { name: 'Italy', callingCode: '+39', latMin: 35.5, latMax: 47.1, lonMin: 6.6, lonMax: 18.5 },
    { name: 'Greece', callingCode: '+30', latMin: 34.8, latMax: 41.7, lonMin: 19.4, lonMax: 29.6 },
    { name: 'Malta', callingCode: '+356', latMin: 35.8, latMax: 36.1, lonMin: 14.2, lonMax: 14.6 },
    { name: 'Cyprus', callingCode: '+357', latMin: 34.6, latMax: 35.7, lonMin: 32.3, lonMax: 34.6 },

    // ── Europe (Northern) ──
    { name: 'Sweden', callingCode: '+46', latMin: 55.3, latMax: 69.1, lonMin: 11.0, lonMax: 24.2 },
    { name: 'Norway', callingCode: '+47', latMin: 57.9, latMax: 71.2, lonMin: 4.6, lonMax: 31.1 },
    { name: 'Denmark', callingCode: '+45', latMin: 54.6, latMax: 57.8, lonMin: 8.1, lonMax: 15.2 },
    { name: 'Finland', callingCode: '+358', latMin: 59.8, latMax: 70.1, lonMin: 20.6, lonMax: 31.6 },
    { name: 'Iceland', callingCode: '+354', latMin: 63.3, latMax: 66.5, lonMin: -24.5, lonMax: -13.5 },

    // ── Europe (Eastern/Central) ──
    { name: 'Poland', callingCode: '+48', latMin: 49.0, latMax: 54.8, lonMin: 14.1, lonMax: 24.1 },
    { name: 'Czech Republic', callingCode: '+420', latMin: 48.6, latMax: 51.1, lonMin: 12.1, lonMax: 18.9 },
    { name: 'Hungary', callingCode: '+36', latMin: 45.7, latMax: 48.6, lonMin: 16.1, lonMax: 22.9 },
    { name: 'Romania', callingCode: '+40', latMin: 43.6, latMax: 48.3, lonMin: 20.3, lonMax: 29.7 },
    { name: 'Bulgaria', callingCode: '+359', latMin: 41.2, latMax: 44.2, lonMin: 22.4, lonMax: 28.6 },
    { name: 'Croatia', callingCode: '+385', latMin: 42.4, latMax: 46.6, lonMin: 13.5, lonMax: 19.4 },
    { name: 'Serbia', callingCode: '+381', latMin: 42.2, latMax: 46.2, lonMin: 18.8, lonMax: 23.0 },
    { name: 'Slovakia', callingCode: '+421', latMin: 47.7, latMax: 49.6, lonMin: 16.8, lonMax: 22.6 },
    { name: 'Slovenia', callingCode: '+386', latMin: 45.4, latMax: 46.9, lonMin: 13.4, lonMax: 16.6 },
    { name: 'Estonia', callingCode: '+372', latMin: 57.5, latMax: 59.7, lonMin: 21.8, lonMax: 28.2 },
    { name: 'Latvia', callingCode: '+371', latMin: 55.7, latMax: 58.1, lonMin: 20.9, lonMax: 28.2 },
    { name: 'Lithuania', callingCode: '+370', latMin: 53.9, latMax: 56.4, lonMin: 21.0, lonMax: 26.8 },
    { name: 'Ukraine', callingCode: '+380', latMin: 44.4, latMax: 52.4, lonMin: 22.1, lonMax: 40.2 },
    { name: 'Russia', callingCode: '+7', latMin: 41.2, latMax: 81.9, lonMin: 19.6, lonMax: 180.0 },
    { name: 'Georgia', callingCode: '+995', latMin: 41.1, latMax: 43.6, lonMin: 40.0, lonMax: 46.7 },

    // ── North America ──
    { name: 'USA', callingCode: '+1', latMin: 24.4, latMax: 49.4, lonMin: -125.0, lonMax: -66.9 },
    { name: 'Canada', callingCode: '+1', latMin: 41.7, latMax: 83.1, lonMin: -141.0, lonMax: -52.6 },
    { name: 'Mexico', callingCode: '+52', latMin: 14.5, latMax: 32.7, lonMin: -118.4, lonMax: -86.7 },

    // ── Latin America ──
    { name: 'Brazil', callingCode: '+55', latMin: -33.8, latMax: 5.3, lonMin: -73.9, lonMax: -34.8 },
    { name: 'Argentina', callingCode: '+54', latMin: -55.0, latMax: -21.8, lonMin: -73.6, lonMax: -53.6 },
    { name: 'Colombia', callingCode: '+57', latMin: -4.2, latMax: 13.4, lonMin: -79.0, lonMax: -66.9 },
    { name: 'Chile', callingCode: '+56', latMin: -55.9, latMax: -17.5, lonMin: -75.6, lonMax: -66.4 },
    { name: 'Peru', callingCode: '+51', latMin: -18.4, latMax: -0.04, lonMin: -81.3, lonMax: -68.7 },
    { name: 'Ecuador', callingCode: '+593', latMin: -5.0, latMax: 1.7, lonMin: -81.1, lonMax: -75.2 },

    // ── Oceania ──
    { name: 'Australia', callingCode: '+61', latMin: -43.6, latMax: -10.7, lonMin: 113.3, lonMax: 153.6 },
    { name: 'New Zealand', callingCode: '+64', latMin: -47.3, latMax: -34.4, lonMin: 166.4, lonMax: 178.6 },
    { name: 'Fiji', callingCode: '+679', latMin: -21.0, latMax: -12.5, lonMin: 177.0, lonMax: -179.8 },

    // ── Africa ──
    { name: 'South Africa', callingCode: '+27', latMin: -34.8, latMax: -22.1, lonMin: 16.5, lonMax: 32.9 },
    { name: 'Nigeria', callingCode: '+234', latMin: 4.3, latMax: 13.9, lonMin: 2.7, lonMax: 14.7 },
    { name: 'Egypt', callingCode: '+20', latMin: 22.0, latMax: 31.7, lonMin: 24.7, lonMax: 37.1 },
    { name: 'Kenya', callingCode: '+254', latMin: -4.7, latMax: 5.0, lonMin: 33.9, lonMax: 41.9 },
    { name: 'Ghana', callingCode: '+233', latMin: 4.7, latMax: 11.2, lonMin: -3.3, lonMax: 1.2 },
    { name: 'Ethiopia', callingCode: '+251', latMin: 3.4, latMax: 15.0, lonMin: 33.0, lonMax: 48.0 },
    { name: 'Tanzania', callingCode: '+255', latMin: -11.7, latMax: -1.0, lonMin: 29.3, lonMax: 40.4 },
    { name: 'Morocco', callingCode: '+212', latMin: 27.7, latMax: 35.9, lonMin: -13.2, lonMax: -1.0 },
    { name: 'Tunisia', callingCode: '+216', latMin: 30.2, latMax: 37.3, lonMin: 7.5, lonMax: 11.6 },
    { name: 'Algeria', callingCode: '+213', latMin: 19.0, latMax: 37.1, lonMin: -8.7, lonMax: 12.0 },
    { name: 'Libya', callingCode: '+218', latMin: 19.5, latMax: 33.2, lonMin: 9.4, lonMax: 25.2 },
    { name: 'Uganda', callingCode: '+256', latMin: -1.5, latMax: 4.2, lonMin: 29.6, lonMax: 35.0 },
    { name: 'Rwanda', callingCode: '+250', latMin: -2.8, latMax: -1.1, lonMin: 28.9, lonMax: 30.9 },
    { name: 'Cameroon', callingCode: '+237', latMin: 1.7, latMax: 13.1, lonMin: 8.5, lonMax: 16.2 },
    { name: 'Ivory Coast', callingCode: '+225', latMin: 4.4, latMax: 10.7, lonMin: -8.6, lonMax: -2.5 },
    { name: 'Senegal', callingCode: '+221', latMin: 12.3, latMax: 16.7, lonMin: -17.5, lonMax: -11.4 },
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
