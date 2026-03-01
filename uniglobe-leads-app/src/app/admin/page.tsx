import prisma from '@/lib/prisma';
import AdminTable from './AdminTable';
import { checkAdminPassword } from './actions';
import { cookies } from 'next/headers';


export default async function AdminDashboard() {
    const cookieStore = await cookies();
    const isAuthenticated = cookieStore.get('admin_auth')?.value === 'true';

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border border-slate-100">
                    <h1 className="text-2xl font-bold text-[#1E293B] mb-2">Admin Login</h1>
                    <p className="text-slate-500 mb-6 text-sm">Enter password to access dashboard</p>
                    <form action={async (formData) => {
                        'use server';
                        const pwd = formData.get('password') as string;
                        const isValid = await checkAdminPassword(pwd);
                        if (isValid) {
                            const cookiesList = await cookies();
                            cookiesList.set('admin_auth', 'true', { maxAge: 60 * 60 * 24 }); // 1 day
                        }
                    }} className="flex flex-col gap-4">
                        <input name="password" type="password" required placeholder="Password" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] focus:border-[#0A369D] outline-none" />
                        <button type="submit" className="w-full bg-[#0A369D] text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition-colors shadow-md shadow-blue-500/20">Login</button>
                    </form>
                </div>
            </div>
        );
    }

    const forms = await prisma.form.findMany({
        include: {
            _count: {
                select: { leads: true, questions: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const formsWithCounts = await Promise.all(forms.map(async (form) => {
        const jobs = await prisma.sheetPushJob.findMany({
            where: { lead: { form_id: form.id } },
            select: { status: true }
        });

        const successCount = jobs.filter((j: { status: string }) => j.status === 'SUCCESS').length;
        const failedCount = jobs.filter((j: { status: string }) => j.status === 'FAILED').length;

        return {
            ...form,
            networkStats: { success: successCount, failed: failedCount }
        };
    }));

    const globalSetting = await prisma.globalSetting.findFirst();

    return (
        <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[#0A369D]">Admin Dashboard</h1>
                        <p className="text-slate-500 mt-1">Manage Forms, Questions, and View Leads</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="/admin/offices" className="text-sm font-medium text-slate-500 hover:text-[#0A369D] transition-colors flex items-center gap-1.5">
                            📍 Manage Offices
                        </a>
                        <form action={async () => {
                            'use server';
                            const cookiesList = await cookies();
                            cookiesList.delete('admin_auth');
                        }}>
                            <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-800 underline">Sign Out</button>
                        </form>
                    </div>
                </div>

                <AdminTable initialForms={formsWithCounts} globalSetting={globalSetting} />

            </div>
        </div>
    );
}
