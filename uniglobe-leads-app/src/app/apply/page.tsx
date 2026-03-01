import { Suspense } from 'react';
import Image from 'next/image';
import ApplyForm from './ApplyForm';

export default function ApplyPage() {
    return (
        <div className="min-h-[100dvh] bg-[#F4F4F5] text-[#1E293B] flex flex-col items-center justify-start sm:justify-center px-4 py-8 sm:p-6 font-sans selection:bg-[#E32636] selection:text-white relative overflow-hidden">

            {/* UK Themed Background Elements */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none flex flex-col">
                {/* Subtle abstract geometric backdrop (soft red/blue accents) */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#0A369D]/10 to-transparent blur-3xl"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-[#E32636]/10 to-transparent blur-3xl"></div>

                {/* Line Art Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230A369D' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
            </div>

            {/* Main Container - Framed like a polished app */}
            <div className="w-full max-w-[480px] flex flex-col items-center relative z-10 sm:my-auto">

                {/* Header Branding */}
                <div className="text-center mb-6 sm:mb-8 flex flex-col items-center w-full relative">
                    <div className="relative w-[260px] h-[75px] drop-shadow-sm transition-transform hover:scale-[1.02] duration-300">
                        <Image
                            src="/logo.png"
                            alt="UniGlobe Education Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                {/* Suspense boundary for useSearchParams inside ApplyForm */}
                <Suspense fallback={
                    <div className="bg-white/90 backdrop-blur-xl rounded-[28px] shadow-2xl shadow-slate-300/50 border border-white p-6 sm:p-8 text-center flex flex-col items-center justify-center min-h-[400px] sm:min-h-[550px] w-full relative overflow-hidden">
                        {/* Red Loading Accent */}
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[#E32636] to-transparent opacity-70"></div>

                        <div className="relative">
                            <div className="animate-spin rounded-full h-14 w-14 border-4 border-slate-100 border-t-[#0A369D] mb-6 shadow-sm"></div>
                            {/* Inner red dot */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-3 h-2 w-2 bg-[#E32636] rounded-full animate-pulse"></div>
                        </div>
                        <p className="text-slate-500 font-semibold tracking-wide animate-pulse">Preparing your form...</p>
                    </div>
                }>
                    <ApplyForm />
                </Suspense>

                {/* Footer */}
                <div className="text-center mt-8 text-slate-400 text-[13px] pt-6 w-full max-w-[320px]">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="h-px bg-slate-200/60 flex-1"></div>
                        <span className="font-bold tracking-widest uppercase text-slate-400 text-[10px]">Since 2007</span>
                        <div className="h-px bg-slate-200/60 flex-1"></div>
                    </div>
                    <a
                        href="https://maps.app.goo.gl/HPKbHUiuhEkD7bqG6"
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 leading-relaxed text-slate-500 hover:text-[#0A369D] transition-colors inline-flex items-start gap-1 group"
                    >
                        <span className="text-red-400 text-xs mt-0.5">📍</span>
                        <span className="underline underline-offset-2 decoration-slate-200 group-hover:decoration-[#0A369D]">
                            Kha-215, Merul Badda<br />(Beside BRAC University)
                        </span>
                    </a>
                    <a href="https://uniglobeeducation.co.uk" target="_blank" rel="noreferrer" className="text-[#0A369D] opacity-80 font-semibold hover:opacity-100 transition-all mt-1 inline-block">
                        uniglobeeducation.co.uk
                    </a>
                </div>
            </div>
        </div>
    );
}
