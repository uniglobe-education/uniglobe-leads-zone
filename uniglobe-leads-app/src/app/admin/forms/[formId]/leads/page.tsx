import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';


async function checkAdmin() {
    const cookieStore = await cookies();
    return cookieStore.get('admin_auth')?.value === 'true';
}

export default async function LeadsViewPage({ params }: { params: Promise<{ formId: string }> }) {
    const { formId } = await params;
    if (!(await checkAdmin())) {
        redirect('/admin');
    }

    const form = await prisma.form.findUnique({
        where: { id: formId },
        include: {
            questions: { orderBy: { order: 'asc' } },
            leads: {
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!form) {
        return <div className="p-8 text-center text-red-500 font-bold">Form not found.</div>;
    }

    // Identify standard vs custom questions for rendering
    const questions = form.questions || [];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between pl-1 mb-8">
                    <div>
                        <Link href="/admin" className="text-sm font-semibold text-slate-400 hover:text-[#0A369D] mb-2 inline-flex items-center gap-1 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            {form.form_name} Leads
                            <span className="bg-emerald-100 text-emerald-800 text-sm py-1 px-3 rounded-full font-bold">
                                {form.leads.length} Total
                            </span>
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium text-sm">Reviewing website submissions for {form.form_id}</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone / Name</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Campaign</th>

                                    {questions.map(q => (
                                        <th key={q.id} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider max-w-[200px] truncate" title={q.label}>{q.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {form.leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={5 + questions.length} className="p-10 text-center text-slate-400 font-medium">No leads captured yet.</td>
                                    </tr>
                                ) : (
                                    form.leads.map((lead) => {
                                        const answers = JSON.parse(lead.answers || '{}');
                                        const name = answers['first_name'] || answers['name'] || '-';
                                        const city = answers['city'] || '-';

                                        return (
                                            <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-sm text-slate-600 font-medium">
                                                    {new Date(lead.createdAt).toLocaleDateString()} <span className="text-slate-400 text-xs">{new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>
                                                <td className="p-4 text-xs font-mono text-slate-400">
                                                    {lead.lead_id}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{lead.phone || '-'}</div>
                                                    <div className="text-xs text-slate-500 font-medium capitalize">{name} • {city}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-slate-700 max-w-[150px] truncate" title={lead.campaign_name || lead.adset_name || 'Organic'}>
                                                        {lead.campaign_name || lead.adset_name || 'Organic'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lead.platform || 'Website'}</div>
                                                </td>

                                                {questions.map(q => (
                                                    <td key={q.id} className="p-4 text-sm text-slate-700 font-medium max-w-[200px] truncate" title={answers[q.key] || '-'}>
                                                        {answers[q.key] || <span className="text-slate-300">-</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #E2E8F0; border-radius: 20px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #CBD5E1; }
            `}} />
        </div>
    );
}
