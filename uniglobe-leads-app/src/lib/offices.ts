// Shared office location config
// To add a new office: add an entry here with a unique key

export const OFFICE_LOCATIONS: Record<string, {
    label: string;
    address: string;
    maps_url: string;
}> = {
    dhaka: {
        label: 'Dhaka Office',
        address: 'Kha-215, Merul Badda\n(Beside BRAC University)',
        maps_url: 'https://maps.app.goo.gl/HPKbHUiuhEkD7bqG6',
    },
    sylhet: {
        label: 'Sylhet Office',
        address: 'UniGlobe Education\nSylhet Branch',
        maps_url: 'https://maps.app.goo.gl/LiHcwntRbRFZDU2z8',
    },
};

export const DEFAULT_OFFICE_KEY = 'dhaka';

export function getOffice(key?: string | null) {
    return OFFICE_LOCATIONS[key || DEFAULT_OFFICE_KEY] ?? OFFICE_LOCATIONS[DEFAULT_OFFICE_KEY];
}
