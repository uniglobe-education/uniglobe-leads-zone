import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';


const COUNTRY_FLAGS: Record<string, string> = {
    'United Kingdom': '🇬🇧',
    'Canada': '🇨🇦',
    'Australia': '🇦🇺',
    'USA': '🇺🇸',
    'Germany': '🇩🇪',
    'Malaysia': '🇲🇾',
    'Ireland': '🇮🇪',
    'New Zealand': '🇳🇿',
};

export default async function ProductsPage() {
    const [forms, offices] = await Promise.all([
        prisma.form.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.office.findMany({
            where: { enabled: true },
            orderBy: { order: 'asc' },
        }),
    ]);

    return (
        <div className="min-h-screen bg-[#060E24] font-sans">
            {/* Background radial gradient */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
                <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[900px] h-[700px] rounded-full bg-[#0A369D]/25 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#E32636]/10 blur-[100px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-white/5 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/icon.png" alt="UniGlobe Education" width={40} height={40} className="rounded-xl" />
                        <div>
                            <p className="text-white font-extrabold text-lg leading-none tracking-tight">UniGlobe</p>
                            <p className="text-white/50 text-xs tracking-widest uppercase">Education</p>
                        </div>
                    </div>
                    <a
                        href="https://uniglobeeducation.co.uk"
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/60 text-sm hover:text-white transition-colors hidden sm:block"
                    >
                        uniglobeeducation.co.uk ↗
                    </a>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative z-10 text-center pt-16 pb-10 px-4">
                <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-semibold uppercase tracking-widest">
                    Study Abroad Programs
                </span>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
                    Your Future,{' '}
                    <span className="bg-gradient-to-r from-[#5B9AF5] to-[#E32636] bg-clip-text text-transparent">
                        Your World
                    </span>
                </h1>
                <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
                    Explore top universities, unlock scholarships, and start your journey abroad with UniGlobe Education — trusted since 2007.
                </p>
            </section>

            {/* Product Cards Grid */}
            <main className="relative z-10 max-w-6xl mx-auto px-4 pb-20">
                {forms.length === 0 ? (
                    <div className="text-center py-24 text-white/30">
                        <p className="text-5xl mb-4">🎓</p>
                        <p className="text-xl font-semibold">No programs available yet.</p>
                        <p className="text-sm mt-2">Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {forms.map((form: any) => (
                            <ProductCard key={form.id} form={form} />
                        ))}
                    </div>
                )}
            </main>

            {/* Our Offices Strip */}
            {offices.length > 0 && (
                <section className="relative z-10 max-w-6xl mx-auto px-4 pb-12">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="h-px bg-white/10 flex-1" />
                        <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Our Offices</span>
                        <div className="h-px bg-white/10 flex-1" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {offices.map((office: any) => (
                            <a
                                key={office.id}
                                href={office.maps_url}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex flex-col bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition-all duration-200"
                            >
                                {/* Info */}
                                <div className="flex items-start gap-4 p-5">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5 text-lg">
                                        📍
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">{office.name}</p>
                                        <p className="text-white/50 text-[13px] mt-0.5 whitespace-pre-line leading-relaxed">{office.address}</p>
                                        <p className="text-blue-400/70 text-xs mt-1.5 group-hover:text-blue-300 transition-colors font-medium">Open in Google Maps ↗</p>
                                    </div>
                                </div>
                                {/* Mini map */}
                                <div className="relative h-36 w-full overflow-hidden">
                                    <iframe
                                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent('Uniglobe Education Bangladesh' + (office.name.toLowerCase().includes('sylhet') ? ' Sylhet' : office.name.toLowerCase().includes('dhaka') ? '' : ' ' + office.name))}&zoom=17`}
                                        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        title={`Map of ${office.name}`}
                                    />
                                </div>
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-8 px-6">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-white/30 text-sm">
                    <p>© {new Date().getFullYear()} UniGlobe Education. Since 2007.</p>
                    <a
                        href="https://maps.app.goo.gl/HPKbHUiuhEkD7bqG6"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
                    >
                        <span className="text-red-400">📍</span>
                        Kha-215, Merul Badda (Beside BRAC University)
                    </a>
                </div>
            </footer>
        </div>
    );
}

function ProductCard({ form }: { form: any }) {
    const flag = form.country ? (COUNTRY_FLAGS[form.country] || '🌍') : '🌍';
    const bgImage = form.bg_image_url || '/uk_bg.png';
    const hasProductInfo = form.university_name || form.tuition_fee || form.scholarship || form.duration;

    const benefits = [
        form.tuition_fee && { icon: '📚', label: 'Tuition', value: form.tuition_fee },
        form.scholarship && { icon: '🎓', label: 'Scholarship', value: form.scholarship },
        form.cash_deposit && { icon: '💰', label: 'Deposit', value: form.cash_deposit },
        form.duration && { icon: '⏱', label: 'Duration', value: form.duration },
    ].filter(Boolean) as { icon: string; label: string; value: string }[];

    return (
        <Link href={`/apply?form_id=${form.form_id}`} className="group relative flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-2xl hover:shadow-[#0A369D]/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            {/* Background Image */}
            <div className="relative h-52 overflow-hidden">
                <img
                    src={bgImage}
                    alt={form.country || 'University'}
                    className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-700"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />

                {/* Country Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5">
                    <span className="text-base">{flag}</span>
                    <span className="text-white text-xs font-bold">{form.country || 'International'}</span>
                </div>

                {/* Program name on image */}
                <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{form.form_id}</p>
                    <h2 className="text-white font-extrabold text-xl leading-tight">
                        {form.university_name || form.form_name}
                    </h2>
                </div>
            </div>

            {/* Card Body */}
            <div className="flex flex-col flex-1 bg-[#0B1229] p-5 gap-4">
                {/* Benefits Pills */}
                {benefits.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        {benefits.map((b) => (
                            <div key={b.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-0.5">
                                    {b.icon} {b.label}
                                </p>
                                <p className="text-white text-sm font-bold">{b.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {!hasProductInfo && (
                    <p className="text-white/30 text-sm text-center py-2">
                        Program details coming soon.
                    </p>
                )}

                {/* CTA */}
                <div
                    className="mt-auto w-full py-3.5 rounded-2xl font-bold text-white text-center text-[16px] transition-all active:scale-[0.98]"
                    style={{
                        background: `linear-gradient(135deg, ${form.theme_color || '#0A369D'}, ${form.theme_color || '#0A369D'}99)`,
                        boxShadow: `0 8px 24px -4px ${form.theme_color || '#0A369D'}60`,
                    }}
                >
                    Apply Now →
                </div>
            </div>
        </Link>
    );
}
