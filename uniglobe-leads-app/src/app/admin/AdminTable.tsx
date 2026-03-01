'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createForm, updateForm, updateGlobalSettings } from './actions';

export default function AdminTable({ initialForms, globalSetting }: { initialForms: any[], globalSetting: any }) {
    const [forms, setForms] = useState(initialForms);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<any>(null);

    // Tab loading state
    const [availableTabs, setAvailableTabs] = useState<any[]>([]);
    const [isLoadingTabs, setIsLoadingTabs] = useState(false);
    const [tabError, setTabError] = useState('');
    const [masterSheetTitle, setMasterSheetTitle] = useState('');

    useEffect(() => {
        if (globalSetting?.master_google_sheet_id) {
            fetch(`/api/admin/sheets/tabs?sheetId=${globalSetting.master_google_sheet_id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.title) setMasterSheetTitle(data.title);
                })
                .catch(() => { });
        }
    }, [globalSetting]);

    const maskId = (id: string) => {
        if (!id) return '';
        if (id.length <= 8) return '****';
        return id.substring(0, 4) + '*'.repeat(8) + id.substring(id.length - 4);
    };
    const [sheetIdInput, setSheetIdInput] = useState('');

    const handleEditClick = (form: any) => {
        setEditingForm(form);
        setAvailableTabs([]);
        setTabError('');
    };

    const loadTabs = async () => {
        if (!globalSetting?.master_google_sheet_id) {
            setTabError("Please save a Master Google Sheet ID in Global Settings first.");
            return;
        }
        setIsLoadingTabs(true);
        setTabError('');
        try {
            const res = await fetch(`/api/admin/sheets/tabs?sheetId=${globalSetting.master_google_sheet_id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAvailableTabs(data.tabs || []);
        } catch (err: any) {
            setTabError(err.message || 'Failed to load tabs');
        } finally {
            setIsLoadingTabs(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Global Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
                <h2 className="text-lg font-bold text-[#1E293B] mb-4">Global Integration Settings</h2>
                <form action={async (formData) => {
                    await updateGlobalSettings(formData);
                    alert("Master Settings Saved");
                    window.location.reload();
                }} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full flex flex-col gap-2">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Master Lead Distribution Sheet ID
                            </label>
                            <p className="text-xs text-slate-500 mb-2">The Google Sheet ID where all forms will route leads to.</p>
                        </div>

                        {globalSetting?.master_google_sheet_id && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-sm flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <div>
                                    <strong>Current Sheet:</strong> {masterSheetTitle ? masterSheetTitle : 'Loading...'} <span className="font-mono text-xs opacity-70 ml-1">({maskId(globalSetting.master_google_sheet_id)})</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                name="master_google_sheet_id"
                                type="text"
                                placeholder={globalSetting?.master_google_sheet_id ? "Enter new Sheet ID to change..." : "e.g. 1BxiMVs0XRYFgCE..."}
                                className="flex-1 p-3 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-[#0A369D] focus:border-[#0A369D] outline-none"
                            />
                            <input
                                name="password"
                                type="password"
                                required
                                placeholder="Admin Password"
                                className="w-full md:w-48 p-3 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0A369D] outline-none"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
                        Save Master ID
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex justify-end p-4 border-b border-slate-200 bg-slate-50">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-[#0A369D] text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors shadow-sm text-sm"
                    >
                        + Create New Form
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs sm:text-sm uppercase tracking-wider">
                                <th className="p-4 font-semibold">Form Name (ID)</th>
                                <th className="p-4 font-semibold">Destination</th>
                                <th className="p-4 font-semibold text-center hidden md:table-cell">Questions</th>
                                <th className="p-4 font-semibold text-center hidden md:table-cell">Leads</th>
                                <th className="p-4 font-semibold text-center hidden md:table-cell">Network</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {forms.map(form => (
                                <tr key={form.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="font-semibold text-slate-800">{form.form_name}</div>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium ${form.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                                                {form.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-mono">
                                            <span>{form.form_id}</span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/apply?form_id=${form.form_id}`);
                                                    alert('Public link copied to clipboard!');
                                                }}
                                                className="ml-1 text-[#0A369D] hover:underline flex items-center gap-1"
                                                title="Copy Public Link"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                                Copy Link
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-4 text-xs sm:text-sm text-slate-600 truncate max-w-[200px]" title={globalSetting?.master_google_sheet_id || 'Not Set'}>
                                        <div className="font-mono bg-slate-100 rounded px-2 py-1 truncate mb-1 text-xs">
                                            {globalSetting?.master_google_sheet_id ? (masterSheetTitle || 'Master Sheet Linked') : <span className="text-slate-400 italic">No Master Sheet</span>}
                                        </div>
                                        {form.target_sheet_tab_name ? (
                                            <div className="flex items-center gap-1 text-xs font-medium text-[#1E293B]">
                                                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                                {form.target_sheet_tab_name}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                                                <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                No Tab Selected
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center font-medium hidden md:table-cell">{form._count.questions}</td>
                                    <td className="p-4 text-center hidden md:table-cell">
                                        <Link href={`/admin/forms/${form.id}/leads`} className="inline-flex items-center justify-center bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-xs hover:bg-blue-100 transition-colors shadow-sm cursor-pointer" title="View all leads">
                                            {form._count.leads} <span className="ml-1 opacity-70">➔</span>
                                        </Link>
                                    </td>
                                    <td className="p-4 text-center hidden md:table-cell">
                                        <div className="flex flex-col items-center gap-1 text-xs font-medium">
                                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded" title="Successful Pushes">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                {form.networkStats?.success || 0}
                                            </div>
                                            <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded" title="Failed Pushes">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                {form.networkStats?.failed || 0}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right w-[160px] sm:w-[200px]">
                                        <div className="flex justify-end items-center gap-3 text-sm font-medium">
                                            <a href={`/apply?form_id=${form.form_id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                                Preview
                                            </a>
                                            <span className="text-slate-300">|</span>
                                            <a
                                                href={`/admin/forms/${form.id}/builder`}
                                                className="text-slate-600 hover:text-[#0A369D] hover:underline"
                                            >
                                                Build Form
                                            </a>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                onClick={() => handleEditClick(form)}
                                                className="text-slate-600 flex items-center gap-1 hover:text-slate-800"
                                                title="Settings"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {forms.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-500">
                                        No forms found. Create your first form to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Create Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-[#1E293B]">Create New Form</h3>
                            <form action={async (formData) => {
                                await createForm(formData);
                                setIsCreateModalOpen(false);
                                window.location.reload(); // Quick refresh to catch updated data
                            }} className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Form Name</label>
                                    <input name="form_name" type="text" required placeholder="e.g. Diploma 2024" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] focus:border-[#0A369D] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Unique Form ID</label>
                                    <input name="form_id" type="text" required placeholder="e.g. DIPLOMA_24" className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-[#0A369D] focus:border-[#0A369D] outline-none" />
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                                    <button type="submit" className="px-5 py-2 rounded-lg font-medium bg-[#0A369D] text-white hover:bg-blue-800">Create</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editingForm && (
                    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-[#1E293B]">Edit Configuration</h3>
                            <form action={async (formData) => {
                                await updateForm(formData);
                                setEditingForm(null);
                                window.location.reload();
                            }} className="flex flex-col gap-4">
                                <input type="hidden" name="id" value={editingForm.id} />

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Form Name</label>
                                    <input name="form_name" type="text" defaultValue={editingForm.form_name} required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] focus:border-[#0A369D] outline-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Target Sheet Tab
                                        <span className="block text-xs text-slate-500 font-normal mt-0.5">Leads will be pushed to this tab in the Master Google Sheet. Click Load Tabs to fetch the latest.</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={loadTabs}
                                            disabled={isLoadingTabs || !globalSetting?.master_google_sheet_id}
                                            className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                        >
                                            {isLoadingTabs ? 'Loading Master Tabs...' : 'Load Master Tabs'}
                                        </button>
                                    </div>
                                    {tabError && <p className="text-red-500 text-xs mt-2 font-medium">{tabError}</p>}
                                </div>

                                {availableTabs.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Select Target Tab
                                            <span className="block text-xs text-slate-500 font-normal mt-0.5">Leads will be pushed to this specific tab. Hidden tabs are pushed to the bottom.</span>
                                        </label>
                                        <select
                                            name="target_sheet_tab_name"
                                            defaultValue={editingForm.target_sheet_tab_name || editingForm.form_name}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none"
                                        >
                                            {availableTabs.map((tab) => (
                                                <option key={tab.id} value={tab.title}>
                                                    {tab.title} {tab.hidden ? '(Hidden)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                                    <select name="status" defaultValue={editingForm.status} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] focus:border-[#0A369D] outline-none">
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setEditingForm(null)} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                                    <button type="submit" className="px-5 py-2 rounded-lg font-medium bg-[#0A369D] text-white hover:bg-blue-800">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
