'use client';

import { useEffect, useState, useRef } from 'react';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { PhoneNumberUtil } from 'google-libphonenumber';
import { motion, AnimatePresence } from 'framer-motion';

import { getCallingCodeFromCoords } from '@/lib/geoCoords';

const phoneUtil = PhoneNumberUtil.getInstance();

type Question = {
    id: string;
    key: string;
    label: string;
    type: string;
    required: boolean;
    options: string;
    placeholder: string;
    help_text: string;
};

import { Sparkles, Circle, Square, Triangle } from 'lucide-react';

export default function ApplyForm() {
    const searchParams = useSearchParams();
    const formId = searchParams.get('form_id');

    const [formConfig, setFormConfig] = useState<any>({
        form_name: 'Free Study Consultation',
        theme_color: '#0A369D',
        background_style: 'solid',
        success_title: 'Thanks!',
        success_description: "We've received your info.\nA counselor will call you shortly.",
        whatsapp_number: '+447441394235',
        office_location: 'dhaka',
        facebook_page_url: 'https://www.facebook.com/uniglobeeducation',
        products_page_url: '/'
    });
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
    // Follow-up sub-answers for smart MCQ questions (keyed by questionKey + subIndex)
    const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});

    const [submissionId, setSubmissionId] = useState<string | null>(null);
    const [geo, setGeo] = useState<any>(null);
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLon, setUserLon] = useState<number | null>(null);
    const [nearestOffice, setNearestOffice] = useState<any>(null);

    useEffect(() => {
        if (!formId) {
            setError('Form ID is missing from the URL.');
            setIsLoading(false);
            return;
        }

        const initForm = async () => {
            try {
                const qRes = await fetch(`/api/forms/${formId}/questions`);
                const qData = await qRes.json();
                if (qData.error) throw new Error(qData.error);
                setQuestions(qData.questions || []);
                if (qData.form) {
                    setFormConfig((prev: any) => ({ ...prev, ...qData.form }));
                }

                // Gather tracking rules
                const urlParams: Record<string, string> = {};
                const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ad_id', 'adset_id', 'campaign_id', '_fbp', 'fbc', 'landing_page'];
                for (const key of trackingKeys) {
                    if (searchParams.get(key)) urlParams[key] = searchParams.get(key) as string;
                }
                if (!urlParams['landing_page']) {
                    urlParams['landing_page'] = window.location.href.split('?')[0];
                }

                // Fetch IP geo (runs immediately)
                let fetchedGeo: any = null;
                try {
                    const geoRes = await fetch('/api/geo');
                    if (geoRes.ok) {
                        const geoData = await geoRes.json();
                        if (geoData.success) {
                            fetchedGeo = geoData;
                            setGeo(geoData);
                            // Use IP-based lat/lon for office matching
                            if (geoData.lat != null && geoData.lon != null) {
                                setUserLat(geoData.lat);
                                setUserLon(geoData.lon);
                            }
                        }
                    }
                } catch (e) { }

                // Recover draft
                const localKey = `uniglobe_draft_${formId}`;
                const existingSubmissionId = localStorage.getItem(localKey);
                let draftAnswers = {} as any;
                try {
                    const saved = localStorage.getItem(`uniglobe_draft_answers_${formId}`);
                    if (saved) draftAnswers = JSON.parse(saved);
                } catch (e) { }

                const initialAnswers = { ...draftAnswers };

                // City: IP geo
                if (fetchedGeo?.success) {
                    const cityQ = qData.questions?.find((q: any) => q.key === 'city' || q.label.toLowerCase().includes('city'));
                    if (cityQ && !initialAnswers[cityQ.key] && fetchedGeo.city) {
                        initialAnswers[cityQ.key] = fetchedGeo.city;
                    }
                }

                // Phone: IP geo first — GPS will reactively override when it arrives
                const phoneQ = qData.questions?.find((q: any) => q.type === 'phone');
                if (phoneQ && !initialAnswers[phoneQ.key] && fetchedGeo?.country_calling_code) {
                    initialAnswers[phoneQ.key] = fetchedGeo.country_calling_code + ' ';
                }

                if (Object.keys(initialAnswers).length > 0) setAnswers(initialAnswers);

                // Start session
                const startRes = await fetch(`/api/forms/${formId}/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urlParams, existingSubmissionId })
                });
                const startData = await startRes.json();
                if (startData.submissionId) {
                    setSubmissionId(startData.submissionId);
                    localStorage.setItem(localKey, startData.submissionId);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to initialize session.');
            } finally {
                setIsLoading(false);
            }
        };

        // GPS disabled — city determined by IP geo only
        // if (typeof navigator !== 'undefined' && navigator.geolocation) {
        //     navigator.geolocation.getCurrentPosition(
        //         (pos) => {
        //             setUserLat(pos.coords.latitude);
        //             setUserLon(pos.coords.longitude);
        //         },
        //         () => { /* denied — IP geo remains */ }
        //     );
        // }

        initForm();
    }, [formId, searchParams]);

    // GPS REACTIVE OVERRIDE — disabled (city from IP only)
    // useEffect(() => {
    //     if (userLat == null || userLon == null) return;
    //     const code = getCallingCodeFromCoords(userLat, userLon);
    //     if (!code) return;
    //     const phoneQ = questions.find((q: any) => q.type === 'phone');
    //     if (!phoneQ) return;
    //     setAnswers(prev => {
    //         const current = (prev[phoneQ.key] || '').trim();
    //         const parts = current.split(' ');
    //         const hasRealDigits = parts.length > 1 && parts[1].replace(/\D/g, '').length > 0;
    //         if (!hasRealDigits) return { ...prev, [phoneQ.key]: code + ' ' };
    //         return prev;
    //     });
    // }, [userLat, userLon, questions]);

    // When success screen shows, fetch offices and find the right one
    useEffect(() => {
        if (!isSuccess) return;
        const findOffice = async () => {
            try {
                const res = await fetch('/api/offices');
                const { offices } = await res.json();
                if (!offices || offices.length === 0) return;

                // Find Dhaka office (default) — first office or one with 'dhaka' in name
                const dhakaOffice = offices.find((o: any) => o.name.toLowerCase().includes('dhaka')) || offices[0];

                if (userLat != null && userLon != null) {
                    // Haversine distance (km)
                    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                        const R = 6371;
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLon = (lon2 - lon1) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    };

                    // Check if any non-Dhaka office is within 80km
                    const RADIUS_KM = 80;
                    let assignedOffice = dhakaOffice;
                    for (const o of offices) {
                        if (o.id === dhakaOffice.id) continue; // skip Dhaka
                        const dist = haversine(userLat, userLon, o.lat, o.lon);
                        if (dist <= RADIUS_KM) {
                            assignedOffice = o;
                            break;
                        }
                    }
                    setNearestOffice(assignedOffice);
                } else {
                    // No location — default to Dhaka
                    setNearestOffice(dhakaOffice);
                }
            } catch (e) { /* silently fail */ }
        };
        findOffice();
    }, [isSuccess, userLat, userLon]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-4xl shadow-2xl shadow-slate-200/60 p-6 sm:p-8 text-center flex flex-col items-center justify-center min-h-100 sm:min-h-125 w-full border border-slate-100/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#0A369D] to-transparent opacity-50"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A369D] mb-6"></div>
                <p className="text-slate-500 font-medium tracking-wide animate-pulse">Loading questions...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-4xl shadow-2xl shadow-slate-200/60 p-6 sm:p-8 text-center min-h-100 sm:min-h-125 flex flex-col justify-center w-full border border-red-50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 mb-3 tracking-tight">Oops! Something went wrong.</h2>
                <p className="text-red-600 font-medium px-4 mb-2">{error}</p>
                <p className="text-slate-500 mt-2 text-sm">Please check the URL or contact support.</p>
            </div>
        );
    }

    if (questions.length === 0 && !isSuccess) {
        return (
            <div className="bg-white rounded-4xl shadow-2xl shadow-slate-200/60 p-6 sm:p-8 text-center min-h-100 sm:min-h-125 flex flex-col justify-center w-full border border-slate-100/50">
                <h2 className="text-2xl font-extrabold text-slate-800 mb-3 tracking-tight">No active questions found.</h2>
                <p className="text-slate-500 font-medium">This form is empty or inactive.</p>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="bg-white rounded-4xl shadow-2xl shadow-emerald-500/10 p-6 sm:p-10 text-center flex flex-col items-center justify-center min-h-100 sm:min-h-125 w-full border border-emerald-50 relative overflow-hidden animate-in fade-in duration-700 slide-in-from-bottom-8">
                <div className="absolute inset-0 bg-linear-to-b from-emerald-50/50 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-8 ring-12 ring-emerald-50 shadow-inner">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"></polyline>
                    </svg>
                </div>

                <h2 className="text-3xl font-extrabold text-[#1E293B] mb-3 tracking-tight">{formConfig.success_title}</h2>
                <p className="text-slate-500 mb-10 font-medium text-lg leading-relaxed px-4 whitespace-pre-line">{formConfig.success_description}</p>

                <div className="w-full flex flex-col gap-4 relative z-10 px-2">
                    <a
                        href={`https://api.whatsapp.com/send/?phone=${formConfig.whatsapp_number.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-[#25D366] text-white py-4 px-6 rounded-2xl font-bold text-[17px] hover:bg-[#128C7E] transition-all active:scale-[0.98] shadow-xl shadow-green-500/20 flex items-center justify-center gap-2.5"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372C5.556 7.6 4.714 8.394 4.714 10.03c0 1.635 1.733 3.219 1.974 3.538.241.32 2.413 3.684 5.842 5.163.815.352 1.45.563 1.946.72.82.26 1.564.223 2.152.135.658-.098 2.03-.83 2.317-1.632.288-.802.288-1.493.203-1.636-.088-.147-.323-.232-.62-.381zM12 21.6A9.6 9.6 0 0 1 3.732 16.51L2.4 21.6l5.242-1.37A9.605 9.605 0 0 1 12 21.6c5.3 0 9.6-4.3 9.6-9.6S17.3 2.4 12 2.4 2.4 6.7 2.4 12c0 1.696.44 3.328 1.25 4.733L2.4 21.6l5.132-1.344C8.985 21.137 10.457 21.6 12 21.6z" />
                        </svg>
                        Chat on WhatsApp
                    </a>
                    <a
                        href="https://uniglobeeducation.co.uk"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-slate-100/80 text-slate-700 py-4 px-6 rounded-2xl font-bold text-[17px] hover:bg-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        🌐 Open Website
                    </a>
                    <a
                        href={formConfig.facebook_page_url || 'https://www.facebook.com/uniglobeeducation'}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-[#1877F2] text-white py-4 px-6 rounded-2xl font-bold text-[17px] hover:bg-[#0e65d9] transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        View Facebook Page
                    </a>
                    <a
                        href={formConfig.products_page_url || '/'}
                        className="w-full bg-[#0A369D] text-white py-4 px-6 rounded-2xl font-bold text-[17px] hover:bg-[#082d86] transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        🎓 View More Programs
                    </a>
                </div>

                {/* Nearest Office Address — dynamic based on user location */}
                {nearestOffice && (
                    <div className="mt-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="h-px bg-slate-200/60 flex-1" />
                            <span className="font-bold tracking-widest uppercase text-slate-400 text-[10px]">Since 2007</span>
                            <div className="h-px bg-slate-200/60 flex-1" />
                        </div>
                        {userLat != null && (
                            <p className="text-slate-400 text-[11px] mb-1.5 font-medium">📍 Your nearest office:</p>
                        )}
                        <p className="text-slate-600 font-bold text-sm mb-1">{nearestOffice.name}</p>
                        <a
                            href={nearestOffice.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-start gap-2 group"
                        >
                            <span className="text-red-500 mt-0.5 text-base shrink-0">📍</span>
                            <span className="text-slate-500 text-[13px] leading-relaxed text-left group-hover:text-[#0A369D] transition-colors underline underline-offset-2 decoration-slate-300 group-hover:decoration-[#0A369D] whitespace-pre-line">
                                {nearestOffice.address}
                            </span>
                        </a>
                        <div className="mt-2">
                            <a href="https://uniglobeeducation.co.uk" target="_blank" rel="noreferrer" className="text-[#0A369D] opacity-70 font-semibold hover:opacity-100 transition-all text-[13px]">
                                uniglobeeducation.co.uk
                            </a>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const isReviewStep = currentStep === questions.length;
    const currentQ = questions[currentStep];

    const handleNext = () => {
        // Save to localStorage
        localStorage.setItem(`uniglobe_draft_answers_${formId}`, JSON.stringify(answers));

        // Save partial answers to server (fire & forget — non-blocking)
        // Phone has already passed client-side validation to get this far.
        if (submissionId && Object.keys(answers).length > 0) {
            fetch(`/api/forms/${formId}/draft`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, answers }),
            }).catch(() => { /* silent — localStorage is the safety net */ });
        }

        if (isReviewStep) {
            submitForm();
        } else {
            setCurrentStep(s => s + 1);
            setTouchedFields({}); // Reset touched state for next question

            // Wait for framer-motion transition to complete, then auto-focus next input
            setTimeout(() => {
                const nextInput = document.querySelector('input, textarea, select') as HTMLElement;
                if (nextInput && typeof nextInput.focus === 'function') {
                    // Slight delay ensures the DOM has painted the new input
                    nextInput.focus();
                }
            }, 350);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(s => s - 1);
            setTouchedFields({});
        }
    };

    const submitForm = async () => {
        if (!submissionId) {
            alert("Session not initialized. Please refresh the page.");
            return;
        }
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/forms/${formId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, answers, user_lat: userLat, user_lon: userLon }),
            });
            const data = await res.json();
            if (data.success) {
                setIsSuccess(true);
                localStorage.removeItem(`uniglobe_draft_${formId}`);
                if (typeof (window as any).fbq === 'function') {
                    (window as any).fbq('track', 'Lead');
                }
            } else {
                alert(data.error || 'Unknown error');
            }
        } catch (err) {
            console.error(err);
            alert('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    let isValid = true;
    let phoneErrorMsg = "";

    if (!isReviewStep && currentQ) {
        const val = answers[currentQ.key] || '';
        if (currentQ.type === 'mcq') {
            isValid = !currentQ.required || val !== '';
        } else {
            isValid = !currentQ.required || val.trim().length > 0;

            // Phone Validation — digit count + carrier prefix check
            if (isValid && currentQ.type === 'phone' && val.trim().length > 0) {
                const cleanPhone = val.trim();
                const isTouched = touchedFields[currentQ.key];

                // Subscriber digits = everything after the calling code prefix
                const parts = cleanPhone.split(' ');
                const selectedCode = parts[0] || '';
                const subscriberDigits = parts.slice(1).join('').replace(/\D/g, '');

                // Expected subscriber digit counts per country
                const expectedDigits: Record<string, number> = {
                    '+880': 10, // BD: 1XXXXXXXXX
                    '+44': 10,  // UK
                    '+91': 10,  // India
                    '+92': 10,  // Pakistan
                    '+1': 10,   // US/CA
                    '+61': 9,   // Australia
                    '+971': 9,  // UAE
                    '+966': 9,  // Saudi
                    '+60': 9,   // Malaysia
                    '+49': 10,  // Germany
                    '+65': 8,   // Singapore
                    '+64': 9,   // NZ
                    '+977': 10, // Nepal
                    '+94': 9,   // Sri Lanka
                    '+353': 9,  // Ireland
                };

                // ── Carrier/operator prefix rules per country ──────────────────
                // Key: country code  → { valid: string[], name: string }
                // Prefixes are the first N digits of subscriber number (without leading 0)
                const carrierPrefixes: Record<string, { valid: string[]; label: string }> = {
                    '+880': {
                        label: 'BD',
                        // Subscriber starts with 1, then operator digit:
                        // 013x Grameenphone, 017x Grameenphone
                        // 016x Airtel→Robi,  018x Robi
                        // 014x Banglalink,   019x Banglalink
                        // 015x Teletalk
                        // 011x, 012x Citycell (defunct but still store numbers)
                        valid: ['11', '12', '13', '14', '15', '16', '17', '18', '19'],
                        // Subscriber must start with "1" + one of the above second digits
                    },
                    '+91': {
                        label: 'IN',
                        // India: subscriber must start with 6,7,8,9
                        valid: ['6', '7', '8', '9'],
                    },
                    '+92': {
                        label: 'PK',
                        // Pakistan: subscriber must start with 3
                        valid: ['3'],
                    },
                    '+44': {
                        label: 'UK',
                        // UK mobile: starts with 07 → subscriber starts with 7
                        valid: ['7'],
                    },
                    '+971': {
                        label: 'AE',
                        // UAE mobile: 050,052,054,055,056,058 → subscriber starts with 5
                        valid: ['5'],
                    },
                    '+966': {
                        label: 'SA',
                        // Saudi mobile: subscriber starts with 5
                        valid: ['5'],
                    },
                    '+977': {
                        label: 'NP',
                        // Nepal: subscriber starts with 97, 98
                        valid: ['97', '98'],
                    },
                    '+94': {
                        label: 'LK',
                        // Sri Lanka mobile: starts with 7
                        valid: ['7'],
                    },
                };

                // ── Helper: check carrier prefix ───────────────────────────────
                const checkCarrierPrefix = (): string | null => {
                    const rule = carrierPrefixes[selectedCode];
                    if (!rule || subscriberDigits.length < 2) return null; // not enough digits yet

                    // For BD specifically: subscriber is "1XXXXXXXXX", prefix check = chars 0-1
                    // e.g. "1711234567" → prefix "17" must be in valid list
                    const prefixLen = rule.valid[0]?.length ?? 1;
                    const prefix = subscriberDigits.substring(0, prefixLen);

                    if (!rule.valid.includes(prefix)) {
                        // Build operator name for BD for a friendlier message
                        const bdOperatorMap: Record<string, string> = {
                            '17': 'Grameenphone', '13': 'Grameenphone',
                            '18': 'Robi', '16': 'Robi (Airtel)',
                            '19': 'Banglalink', '14': 'Banglalink',
                            '15': 'Teletalk',
                            '11': 'Citycell', '12': 'Citycell',
                        };
                        if (selectedCode === '+880') {
                            const validNames = [...new Set(rule.valid.map(p => bdOperatorMap[p] || p))].join(', ');
                            return `Invalid BD number. Must start with a valid operator prefix (e.g. 017, 018, 019, 013…).`;
                        }
                        return `This doesn't look like a valid ${rule.label} mobile number.`;
                    }
                    return null; // valid prefix
                };

                const required = expectedDigits[selectedCode];

                if (/^(\d)\1{7,}$/.test(subscriberDigits)) {
                    // All-same digits heuristic
                    isValid = false;
                    if (isTouched) phoneErrorMsg = 'Please enter a real phone number.';
                } else if (subscriberDigits.length < (required ? required - 1 : 7)) {
                    // Still typing — disable Next silently
                    isValid = false;
                } else if (required && subscriberDigits.length < required) {
                    isValid = false;
                    if (isTouched) phoneErrorMsg = `Number needs ${required} digits (you have ${subscriberDigits.length}).`;
                } else if (required && subscriberDigits.length > required) {
                    isValid = false;
                    if (isTouched) phoneErrorMsg = 'Phone number is too long.';
                } else if (!required && (subscriberDigits.length < 7 || subscriberDigits.length > 12)) {
                    isValid = false;
                    if (isTouched) phoneErrorMsg = subscriberDigits.length < 7 ? '' : 'Phone number is too long.';
                } else {
                    // Digit count is correct — now check carrier prefix
                    const carrierError = checkCarrierPrefix();
                    if (carrierError) {
                        isValid = false;
                        if (isTouched) phoneErrorMsg = carrierError;
                    } else {
                        isValid = true;
                    }
                }
            }


            if (isValid && currentQ.type === 'email' && val.trim().length > 0) {
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
            }

            // Number validation — must be a valid number, optionally within min|max from options
            if (isValid && currentQ.type === 'number' && val.trim().length > 0) {
                const num = parseFloat(val.trim());
                if (isNaN(num)) {
                    isValid = false;
                } else if (currentQ.options) {
                    const [minStr, maxStr] = currentQ.options.split('|');
                    const min = parseFloat(minStr);
                    const max = parseFloat(maxStr);
                    if (!isNaN(min) && !isNaN(max) && (num < min || num > max)) {
                        isValid = false;
                    }
                }
            }
        }
    }

    return (
        <div className="w-full flex flex-col items-center relative">
            <BackgroundAnimation style={formConfig.background_style} />

            <div className="w-full flex flex-col items-center z-10 relative">
                {/* Hero Card — background image + frosted glass greeting box */}
                <div className="w-full max-w-md mb-4 sm:mb-6 rounded-2xl overflow-hidden shadow-lg shadow-slate-300/40 animate-in fade-in duration-500 relative">
                    {/* Background: product image or themed gradient fallback */}
                    {formConfig.product_image_url ? (
                        <Image
                            src={formConfig.product_image_url}
                            alt={formConfig.form_name}
                            className="absolute inset-0 w-full h-full object-cover"
                            fill
                            unoptimized
                            priority
                        />
                    ) : (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: `linear-gradient(135deg, ${formConfig.theme_color}, ${formConfig.theme_color}CC, ${formConfig.theme_color}99)` }}
                        />
                    )}

                    {/* Spacer for image visibility — top ~35% stays clear */}
                    <div className="relative z-10 pt-28 sm:pt-36" />

                    {/* Logo — oval white container straddling image/glass boundary */}
                    <div className="absolute left-1/2 -translate-x-1/2 z-30" style={{ top: 'calc(7rem - 30px)' }}>
                        <div className="w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] rounded-full bg-white shadow-lg shadow-slate-300/50 flex items-center justify-center ring-4 ring-white/80">
                            <Image
                                src="/logo.png"
                                alt="UniGlobe Education"
                                width={70}
                                height={70}
                                className="object-contain sm:w-[80px] sm:h-[80px]"
                                priority
                            />
                        </div>
                    </div>

                    {/* Frosted glass greeting box — covering bottom 50-70% */}
                    <div className="relative z-10 bg-white/85 backdrop-blur-xl border-t border-white/50 px-5 sm:px-6 pt-14 sm:pt-16 pb-5 sm:pb-6">
                        {/* Greeting headline as the main title */}
                        {formConfig.greeting_headline && (
                            <h1 className="text-[18px] sm:text-[22px] font-extrabold tracking-tight leading-snug text-slate-800 mb-2 text-center">
                                {formConfig.greeting_headline}
                            </h1>
                        )}

                        {/* Greeting body — paragraph or list */}
                        {formConfig.greeting_body && formConfig.greeting_type === 'list' ? (
                            <ul className="space-y-1.5 mt-1">
                                {formConfig.greeting_body.split('\n').filter(Boolean).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-[13px] sm:text-[14px] text-slate-600">
                                        <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>
                                        {item.trim()}
                                    </li>
                                ))}
                            </ul>
                        ) : formConfig.greeting_body ? (
                            <p className="text-[13px] sm:text-[14px] text-slate-500 leading-relaxed text-center">
                                {formConfig.greeting_body}
                            </p>
                        ) : null}

                        {/* Fallback: if no greeting at all, show form_name */}
                        {!formConfig.greeting_headline && !formConfig.greeting_body && (
                            <h1 className="text-[18px] sm:text-[22px] font-extrabold tracking-tight leading-snug text-slate-800 text-center">
                                {formConfig.form_name}
                            </h1>
                        )}
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white/95 backdrop-blur-md rounded-[28px] sm:rounded-4xl shadow-2xl shadow-slate-200/50 p-6 pb-20 sm:p-8 sm:px-10 w-full max-w-md min-h-87.5 sm:min-h-137.5 flex flex-col border border-white/60 relative overflow-hidden transition-all hover:shadow-slate-300/40">

                    {/* Subtle Top Accent Line */}
                    <div
                        className="absolute top-0 left-0 w-full h-1.5 opacity-90"
                        style={{ background: `linear-gradient(to right, ${formConfig.theme_color}, #00000020, ${formConfig.theme_color})` }}
                    ></div>

                    {/* Progress Elements */}
                    <div className="w-full mb-5 sm:mb-8 relative">
                        <div className="flex justify-between text-[12px] text-slate-500 font-bold mb-3 uppercase tracking-widest px-1">
                            <span>Step {currentStep + 1}</span>
                            <span>of {questions.length + 1}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="h-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${((currentStep + 1) / (questions.length + 1)) * 100}%`,
                                    backgroundColor: formConfig.theme_color
                                }}
                            ></div>
                        </div>
                    </div>

                    {/* Step Content Wrapper using Framer Motion */}
                    <div className="grow flex flex-col relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ x: 50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -50, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                className="grow flex flex-col pb-4"
                            >

                                {!isReviewStep && currentQ ? (
                                    <div className="flex flex-col h-full">
                                        <h2 className="text-[20px] sm:text-2xl font-extrabold text-[#1E293B] mb-1 sm:mb-2 leading-snug">
                                            {currentQ.label}
                                        </h2>
                                        {currentQ.help_text && !currentQ.help_text.trim().startsWith('{') && (
                                            <p className="text-slate-500 text-[14px] sm:text-[15px] mb-3 sm:mb-6 leading-relaxed font-medium">{currentQ.help_text}</p>
                                        )}

                                        {/* Render Inputs */}
                                        <div className="mt-2 sm:mt-6 mb-2 grow">
                                            {currentQ.type === 'mcq' && (() => {
                                                // Parse optional follow-up config from help_text JSON
                                                // Format: { "IELTS": [{label, type, placeholder, range}], "PTE": [...] }
                                                let followConfig: Record<string, Array<{ label: string; type: string; placeholder?: string; range?: string }>> = {};
                                                try {
                                                    if (currentQ.help_text?.trim().startsWith('{')) {
                                                        followConfig = JSON.parse(currentQ.help_text);
                                                    }
                                                } catch (e) {
                                                    console.error(`[SmartMCQ] Invalid follow-up JSON on question "${currentQ.key}":`, e);
                                                }

                                                const selectedOpt = (answers[currentQ.key] || '').split(' | ')[0];
                                                const followUps = followConfig[selectedOpt] || [];
                                                const hasFollowUps = Object.keys(followConfig).length > 0;

                                                return (
                                                    <div className="flex flex-col gap-3">
                                                        {currentQ.options?.split('|').map((opt) => {
                                                            const optTrimmed = opt.trim();
                                                            const isSelected = selectedOpt === optTrimmed;
                                                            return (
                                                                <div key={optTrimmed}>
                                                                    <button
                                                                        onClick={() => {
                                                                            // Reset follow-up answers for this question when option changes
                                                                            const cleared: Record<string, string> = { ...followUpAnswers };
                                                                            Object.keys(cleared).filter(k => k.startsWith(currentQ.key + '__')).forEach(k => delete cleared[k]);
                                                                            setFollowUpAnswers(cleared);
                                                                            // If no follow-ups for this option, auto-advance as before
                                                                            const optFollowUps = followConfig[optTrimmed] || [];
                                                                            if (optFollowUps.length === 0 && !hasFollowUps) {
                                                                                setAnswers({ ...answers, [currentQ.key]: optTrimmed });
                                                                                setTimeout(handleNext, 350);
                                                                            } else if (optFollowUps.length === 0) {
                                                                                // Option has no follow-ups but others do — set answer directly
                                                                                setAnswers({ ...answers, [currentQ.key]: optTrimmed });
                                                                            } else {
                                                                                // Has follow-ups — select but don't advance, show sub-inputs
                                                                                setAnswers({ ...answers, [currentQ.key]: optTrimmed });
                                                                            }
                                                                        }}
                                                                        className={`w-full text-left px-5 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[15px] sm:text-[16px] border-2 sm:border-[2.5px] transition-all duration-300 active:scale-[0.98] ${isSelected
                                                                            ? 'shadow-lg shadow-black/5'
                                                                            : 'border-slate-100 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md'
                                                                            }`}
                                                                        style={{
                                                                            ...(isSelected ? {
                                                                                borderColor: formConfig.theme_color,
                                                                                color: formConfig.theme_color,
                                                                                backgroundColor: `${formConfig.theme_color}10`
                                                                            } : {}),
                                                                            // Reduce opacity of unselected options when a follow-up is showing
                                                                            ...(!isSelected && selectedOpt && followUps.length > 0 ? {
                                                                                opacity: 0.3,
                                                                                transform: 'scale(0.97)',
                                                                                pointerEvents: 'auto' as const,
                                                                            } : {}),
                                                                        }}
                                                                    >
                                                                        {optTrimmed}
                                                                    </button>

                                                                    {/* Inline follow-up sub-inputs — shown only for the selected option */}
                                                                    {isSelected && followUps.length > 0 && (
                                                                        <div className="mt-2 ml-3 pl-3 border-l-2 flex flex-col gap-2" style={{ borderColor: formConfig.theme_color + '60' }}>
                                                                            {followUps.map((fu, fi) => {
                                                                                const fuKey = `${currentQ.key}__${fi}`;
                                                                                const [fuMin, fuMax] = (fu.range || '').split('|').map(Number);
                                                                                // For lowestValue type, cap max at the previous follow-up's value
                                                                                const isLowest = fu.type === 'lowestValue';
                                                                                const prevFuKey = fi > 0 ? `${currentQ.key}__${fi - 1}` : '';
                                                                                const prevVal = prevFuKey ? parseFloat(followUpAnswers[prevFuKey] || '') : NaN;
                                                                                const effectiveMax = isLowest && !isNaN(prevVal) ? prevVal : fuMax;
                                                                                const hasRange = !isNaN(fuMin) && !isNaN(effectiveMax);
                                                                                const inputType = isLowest ? 'number' : fu.type;
                                                                                // For text follow-ups, range is a single number = max chars
                                                                                const isTextType = fu.type === 'text';
                                                                                const textMaxChars = isTextType && fu.range && /^\d+$/.test(fu.range.trim()) ? parseInt(fu.range.trim()) : undefined;
                                                                                return (
                                                                                    <div key={fi} className="relative">
                                                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">{fu.label}</label>
                                                                                        <input
                                                                                            autoFocus={fi === 0}
                                                                                            type="text"
                                                                                            inputMode={inputType === 'number' || isLowest ? 'decimal' : 'text'}
                                                                                            placeholder={fu.placeholder || (isTextType ? '' : (hasRange ? `${fuMin}–${effectiveMax}` : ''))}
                                                                                            value={followUpAnswers[fuKey] || ''}
                                                                                            maxLength={textMaxChars}
                                                                                            onKeyDown={(e) => {
                                                                                                if (inputType === 'number' || isLowest) {
                                                                                                    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) e.preventDefault();
                                                                                                }
                                                                                                if (e.key === 'Enter') { e.preventDefault(); if (isValid && !isSubmitting) handleNext(); }
                                                                                            }}
                                                                                            onChange={(e) => {
                                                                                                let raw = e.target.value;
                                                                                                if ((inputType === 'number' || isLowest) && !/^\d*\.?\d*$/.test(raw)) return;
                                                                                                // Clamp to range for all number-like types
                                                                                                if (raw && (inputType === 'number' || isLowest)) {
                                                                                                    const num = parseFloat(raw);
                                                                                                    if (!isNaN(effectiveMax) && num > effectiveMax) raw = String(effectiveMax);
                                                                                                    if (!isNaN(fuMin) && num < fuMin) raw = String(fuMin);
                                                                                                }
                                                                                                const newFu = { ...followUpAnswers, [fuKey]: raw };
                                                                                                setFollowUpAnswers(newFu);
                                                                                                // Assemble combined answer: "IELTS | Score: 7.5 | Min Band: 6"
                                                                                                const parts = [optTrimmed];
                                                                                                followUps.forEach((f, i) => {
                                                                                                    const v = i === fi ? raw : (followUpAnswers[`${currentQ.key}__${i}`] || '');
                                                                                                    if (v) parts.push(`${f.label.replace('?', '').trim()}: ${v}`);
                                                                                                });
                                                                                                setAnswers({ ...answers, [currentQ.key]: parts.join(' | ') });
                                                                                            }}
                                                                                            className="w-full px-3 py-2 rounded-lg border-2 border-slate-100 bg-white text-slate-800 font-bold text-[15px] outline-none focus:ring-2 placeholder:text-slate-400 placeholder:font-medium transition-all hover:border-slate-300"
                                                                                            style={{ '--tw-ring-color': formConfig.theme_color } as any}
                                                                                        />
                                                                                        {hasRange && !isTextType && (
                                                                                            <span className="absolute right-2 top-8 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full pointer-events-none">{fuMin}–{effectiveMax}</span>
                                                                                        )}
                                                                                        {textMaxChars && (
                                                                                            <span className="absolute right-2 top-8 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full pointer-events-none">{(followUpAnswers[fuKey] || '').length}/{textMaxChars}</span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            {currentQ.type === 'dropdown' && (
                                                <select
                                                    className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 sm:border-[2.5px] border-slate-100 rounded-xl sm:rounded-2xl bg-white text-slate-800 font-bold text-[15px] sm:text-[16px] outline-none transition-all appearance-none cursor-pointer shadow-sm hover:border-slate-300"
                                                    value={answers[currentQ.key] || ''}
                                                    onChange={(e) => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
                                                >
                                                    <option value="" disabled>{currentQ.placeholder || 'Select an option'}</option>
                                                    {currentQ.options?.split('|').map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {['short_text', 'number', 'phone', 'email'].includes(currentQ.type) && (
                                                <div className="relative">
                                                    {currentQ.type === 'phone' ? (
                                                        <div className={`flex rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] overflow-hidden shadow-sm transition-all focus-within:ring-4 ${!isValid && touchedFields[currentQ.key] ? 'border-red-400 focus-within:ring-red-100 focus-within:border-red-500' : 'border-slate-100 hover:border-slate-300 focus-within:border-(--theme-color)'}`}>
                                                            {/* Country Code Picker */}
                                                            <select
                                                                className="shrink-0 bg-slate-50 border-r border-slate-200 px-2 py-3 sm:py-4 text-slate-700 font-bold text-[15px] outline-none cursor-pointer"
                                                                value={(answers[currentQ.key] || '').split(' ')[0] || ''}
                                                                onChange={(e) => {
                                                                    const code = e.target.value;
                                                                    const existing = (answers[currentQ.key] || '').trim();
                                                                    const parts = existing.split(' ');
                                                                    const digits = parts.length > 1 ? parts.slice(1).join(' ') : '';
                                                                    setAnswers({ ...answers, [currentQ.key]: code + ' ' + digits });
                                                                }}
                                                            >
                                                                {[
                                                                    { flag: '🇧🇩', name: 'BD', code: '+880' },
                                                                    { flag: '🇬🇧', name: 'UK', code: '+44' },
                                                                    { flag: '🇮🇳', name: 'IN', code: '+91' },
                                                                    { flag: '🇵🇰', name: 'PK', code: '+92' },
                                                                    { flag: '🇺🇸', name: 'US', code: '+1' },
                                                                    { flag: '🇨🇦', name: 'CA', code: '+1' },
                                                                    { flag: '🇦🇺', name: 'AU', code: '+61' },
                                                                    { flag: '🇦🇪', name: 'AE', code: '+971' },
                                                                    { flag: '🇸🇦', name: 'SA', code: '+966' },
                                                                    { flag: '🇲🇾', name: 'MY', code: '+60' },
                                                                    { flag: '🇩🇪', name: 'DE', code: '+49' },
                                                                    { flag: '🇸🇬', name: 'SG', code: '+65' },
                                                                    { flag: '🇳🇿', name: 'NZ', code: '+64' },
                                                                    { flag: '🇮🇪', name: 'IE', code: '+353' },
                                                                    { flag: '🇳🇵', name: 'NP', code: '+977' },
                                                                    { flag: '🇱🇰', name: 'LK', code: '+94' },
                                                                ].map(c => (
                                                                    <option key={c.name + c.code} value={c.code}>
                                                                        {c.flag} {c.code}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {/* Number Input */}
                                                            <input
                                                                autoFocus
                                                                type="tel"
                                                                enterKeyHint="next"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        setTouchedFields({ ...touchedFields, [currentQ.key]: true });
                                                                        if (isValid && !isSubmitting) handleNext();
                                                                    }
                                                                }}
                                                                placeholder="01XXXXXXXXX"
                                                                value={(() => {
                                                                    const val = answers[currentQ.key] || '';
                                                                    const parts = val.trim().split(' ');
                                                                    return parts.length > 1 ? parts.slice(1).join(' ') : '';
                                                                })()}
                                                                onChange={(e) => {
                                                                    const code = (answers[currentQ.key] || '').trim().split(' ')[0] || '';
                                                                    const rawDigits = e.target.value;
                                                                    // Only strip leading 0 after user has typed 4+ characters
                                                                    // so it feels natural, not aggressive
                                                                    const digits = rawDigits.length >= 4 && rawDigits.startsWith('0')
                                                                        ? rawDigits.slice(1)
                                                                        : rawDigits;
                                                                    setAnswers({ ...answers, [currentQ.key]: code + ' ' + digits });
                                                                }}
                                                                className="flex-1 min-w-0 px-3 sm:px-4 py-3 sm:py-4 bg-white text-slate-800 font-bold text-[16px] sm:text-[17px] outline-none placeholder:text-slate-400 placeholder:font-medium"
                                                                onBlur={() => setTouchedFields({ ...touchedFields, [currentQ.key]: true })}
                                                                onFocus={(e) => {
                                                                    setTimeout(() => {
                                                                        const container = e.target.closest('.bg-white\\/95');
                                                                        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                                                    }, 300);
                                                                }}
                                                            />
                                                        </div>
                                                    ) : currentQ.type === 'number' ? (
                                                        // ── Number Input (IELTS score, GPA, etc.) ──────────────
                                                        <div className="relative">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                inputMode="decimal"
                                                                enterKeyHint="next"
                                                                onKeyDown={(e) => {
                                                                    // Allow: digits, dot, backspace, delete, arrows, tab
                                                                    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                                                                        e.preventDefault();
                                                                    }
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        setTouchedFields({ ...touchedFields, [currentQ.key]: true });
                                                                        if (isValid && !isSubmitting) handleNext();
                                                                    }
                                                                }}
                                                                placeholder={currentQ.placeholder || ((() => {
                                                                    // Try to derive placeholder from min|max options
                                                                    const [mn, mx] = (currentQ.options || '').split('|').map(Number);
                                                                    if (!isNaN(mn) && !isNaN(mx)) return `${mn} – ${mx}`;
                                                                    return 'e.g. 6.5';
                                                                })())}
                                                                value={answers[currentQ.key] || ''}
                                                                onChange={(e) => {
                                                                    const raw = e.target.value;
                                                                    // Allow only valid numeric pattern
                                                                    if (/^\d*\.?\d*$/.test(raw)) {
                                                                        setAnswers({ ...answers, [currentQ.key]: raw });
                                                                    }
                                                                }}
                                                                className={`w-full px-4 sm:px-5 py-3 sm:py-4 border-2 sm:border-[2.5px] rounded-xl sm:rounded-2xl bg-white text-slate-800 font-bold text-[16px] sm:text-[17px] outline-none transition-all shadow-sm placeholder:text-slate-400 placeholder:font-medium ${!isValid && touchedFields[currentQ.key]
                                                                    ? 'border-red-400 focus:ring-4 focus:ring-red-100'
                                                                    : 'border-slate-100 hover:border-slate-300 focus:ring-4'
                                                                    }`}
                                                                onBlur={() => setTouchedFields({ ...touchedFields, [currentQ.key]: true })}
                                                            />
                                                            {/* Range hint badge */}
                                                            {currentQ.options && (currentQ.options.split('|').length === 2) && (() => {
                                                                const [mn, mx] = currentQ.options.split('|').map(Number);
                                                                if (!isNaN(mn) && !isNaN(mx)) {
                                                                    return (
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full pointer-events-none">
                                                                            {mn}–{mx}
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            autoFocus
                                                            type={currentQ.type === 'email' ? 'email' : 'text'}
                                                            enterKeyHint="next"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    setTouchedFields({ ...touchedFields, [currentQ.key]: true });
                                                                    if (isValid && !isSubmitting) handleNext();
                                                                }
                                                            }}
                                                            placeholder={currentQ.placeholder || ''}
                                                            value={answers[currentQ.key] || ''}
                                                            maxLength={currentQ.help_text && /^\d+$/.test(currentQ.help_text.trim()) ? parseInt(currentQ.help_text.trim()) : undefined}
                                                            onChange={(e) => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
                                                            className={`w-full px-4 sm:px-5 py-3 sm:py-4 border-2 sm:border-[2.5px] rounded-xl sm:rounded-2xl bg-white text-slate-800 font-bold text-[16px] sm:text-[17px] outline-none transition-all shadow-sm border-slate-100 hover:border-slate-300 focus:ring-4 placeholder:text-slate-400 placeholder:font-medium`}
                                                            onBlur={() => setTouchedFields({ ...touchedFields, [currentQ.key]: true })}
                                                            onFocus={(e) => {
                                                                setTimeout(() => {
                                                                    const container = e.target.closest('.bg-white\\/95');
                                                                    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                                                }, 300);
                                                            }}
                                                        />
                                                    )}
                                                    {/* Character counter for text inputs */}
                                                    {['short_text'].includes(currentQ.type) && currentQ.help_text && /^\d+$/.test(currentQ.help_text.trim()) && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full pointer-events-none">
                                                            {(answers[currentQ.key] || '').length}/{currentQ.help_text.trim()}
                                                        </span>
                                                    )}
                                                    {!isValid && currentQ.type === 'phone' && touchedFields[currentQ.key] && phoneErrorMsg && (
                                                        <p className="text-red-500 text-sm font-semibold mt-2 px-1 animate-in slide-in-from-top-1">{phoneErrorMsg}</p>
                                                    )}
                                                </div>
                                            )}

                                            {currentQ.type === 'paragraph' && (
                                                <div className="relative">
                                                    <textarea
                                                        autoFocus
                                                        placeholder={currentQ.placeholder || ''}
                                                        value={answers[currentQ.key] || ''}
                                                        maxLength={currentQ.help_text && /^\d+$/.test(currentQ.help_text.trim()) ? parseInt(currentQ.help_text.trim()) : undefined}
                                                        onChange={(e) => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
                                                        className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 sm:border-[2.5px] border-slate-100 rounded-xl sm:rounded-2xl bg-white text-slate-800 font-bold text-[15px] sm:text-[16px] outline-none transition-all min-h-30 sm:min-h-35 resize-none shadow-sm hover:border-slate-300 focus:ring-4 placeholder:text-slate-400 placeholder:font-medium"
                                                        onFocus={(e) => {
                                                            setTimeout(() => {
                                                                const container = e.target.closest('.bg-white\\/95');
                                                                if (container) {
                                                                    container.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                                                }
                                                            }, 300);
                                                        }}
                                                    />
                                                    {currentQ.help_text && /^\d+$/.test(currentQ.help_text.trim()) && (
                                                        <span className="absolute right-3 bottom-3 text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full pointer-events-none">
                                                            {(answers[currentQ.key] || '').length}/{currentQ.help_text.trim()}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full max-h-87.5">
                                        <h2 className="text-[24px] font-extrabold text-[#1E293B] mb-2 leading-tight">Almost done!</h2>
                                        <p className="text-slate-500 font-medium text-[15px] mb-6">Review your details below.</p>
                                        <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/60 grow overflow-y-auto shadow-inner custom-scrollbar relative">
                                            <div className="flex flex-col gap-5 relative z-10">
                                                {questions.map(q => (
                                                    <div key={q.id} className="pb-4 border-b border-slate-200/80 last:border-0 last:pb-0">
                                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">{q.label}</p>
                                                        <p className="text-[15px] sm:text-[16px] font-bold text-slate-800">{answers[q.key] || <span className="text-slate-400 font-normal italic">Not provided</span>}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="mt-auto pt-4 sm:pt-6 border-t border-slate-100 flex gap-3 sm:gap-4 relative z-10 w-full pb-8 sm:pb-0">
                        {currentStep > 0 && (
                            <button
                                disabled={isSubmitting}
                                onClick={handleBack}
                                className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex-[0.35] text-[15px] sm:text-[16px] active:scale-[0.98]"
                            >
                                Back
                            </button>
                        )}
                        <button
                            disabled={isSubmitting}
                            onClick={() => {
                                setTouchedFields({ ...touchedFields, [currentQ?.key]: true });
                                if (isValid) handleNext();
                            }}
                            className={`px-5 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold transition-all active:scale-[0.98] shadow-xl flex-1 flex justify-center items-center gap-2.5 text-[16px] sm:text-[17px] ${!isValid ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:brightness-95 text-white'}`}
                            style={isValid ? { backgroundColor: formConfig.theme_color, boxShadow: `0 10px 25px -5px ${formConfig.theme_color}40` } : { backgroundColor: '#94A3B8' }}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/60"></div>
                                    Processing...
                                </>
                            ) : (
                                isReviewStep ? 'Submit Application' : 'Next Step'
                            )}
                        </button>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #CBD5E1; border-radius: 20px; }
                `}} />
            </div>
        </div>
    );
}

const BackgroundAnimation = ({ style }: { style: string }) => {
    if (style === 'solid') {
        return <div className="fixed inset-0 bg-[#F4F7FB] -z-10" />;
    }

    if (style === 'abstract') {
        return (
            <div className="fixed inset-0 overflow-hidden bg-slate-50 -z-10 pointer-events-none">
                <Sparkles className="absolute top-[5%] left-[10%] w-24 h-24 text-blue-300/50 blur-sm animate-pulse" />
                <Circle className="absolute bottom-[15%] right-[10%] w-32 h-32 text-emerald-300/50 blur-sm animate-pulse" style={{ animationDelay: '1s' }} />
                <Square className="absolute top-[30%] right-[5%] w-20 h-20 text-rose-300/50 blur-sm animate-pulse" style={{ animationDelay: '2s' }} />
                <Triangle className="absolute bottom-[5%] left-[20%] w-28 h-28 text-purple-300/50 blur-sm animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute top-[60%] left-[40%] w-16 h-16 text-yellow-300/50 blur-sm animate-pulse" style={{ animationDelay: '1.5s' }} />
            </div>
        );
    }

    if (style === 'london_art') {
        return (
            <div className="fixed inset-0 bg-[#F1F5F9] -z-10 overflow-hidden flex items-end justify-center pointer-events-none opacity-80 mix-blend-multiply">
                {/* Basic SVG Line Art representation of London Skyline */}
                <svg viewBox="0 0 1000 300" className="w-full h-auto max-h-[50vh] min-w-300 text-slate-300" preserveAspectRatio="xMidYMax slice" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M100 300 V200 H150 V300" />
                    <path d="M125 200 L125 150" />
                    {/* Big Ben */}
                    <path d="M300 300 V50 H330 V300" />
                    <path d="M300 50 L315 20 L330 50" />
                    <circle cx="315" cy="80" r="10" />
                    <path d="M315 80 L315 75" />
                    {/* London Eye */}
                    <circle cx="600" cy="150" r="80" />
                    <path d="M520 150 L680 150" />
                    <path d="M600 70 L600 230" />
                    <path d="M543 93 L657 207" />
                    <path d="M543 207 L657 93" />
                    <path d="M580 230 L550 300" />
                    <path d="M620 230 L650 300" />
                    {/* Bridge */}
                    <path d="M750 300 V180 H850 V300" />
                    <path d="M750 180 L800 130 L850 180" />
                    <path d="M700 250 Q750 200 800 250 Q850 200 900 250" />
                </svg>
            </div>
        );
    }

    return <div className="fixed inset-0 bg-[#F4F7FB] -z-10" />;
};
