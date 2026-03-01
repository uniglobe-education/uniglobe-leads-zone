'use client';

import { useState, useEffect } from 'react';

type Office = {
    id: string;
    name: string;
    address: string;
    maps_url: string;
    lat: number;
    lon: number;
    enabled: boolean;
    order: number;
};

const emptyForm = { name: '', address: '', maps_url: '', lat: '', lon: '', order: '0' };

export default function OfficesAdminPage() {
    const [offices, setOffices] = useState<Office[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchOffices = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/offices');
        const data = await res.json();
        setOffices(data.offices || []);
        setLoading(false);
    };

    useEffect(() => { fetchOffices(); }, []);

    const handleEdit = (o: Office) => {
        setEditId(o.id);
        setForm({ name: o.name, address: o.address, maps_url: o.maps_url, lat: String(o.lat), lon: String(o.lon), order: String(o.order) });
        setShowForm(true);
    };

    const handleAdd = () => {
        setEditId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = {
            ...form,
            lat: parseFloat(form.lat),
            lon: parseFloat(form.lon),
            order: parseInt(form.order),
        };
        const url = editId ? `/api/admin/offices/${editId}` : '/api/admin/offices';
        const method = editId ? 'PUT' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        setShowForm(false);
        fetchOffices();
        setSaving(false);
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        await fetch(`/api/admin/offices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) });
        fetchOffices();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this office?')) return;
        await fetch(`/api/admin/offices/${id}`, { method: 'DELETE' });
        fetchOffices();
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-extrabold text-[#1E293B]">📍 Office Locations</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage office addresses and Google Maps links. Users see the nearest one on the success screen.</p>
                    </div>
                    <button onClick={handleAdd} className="px-5 py-2.5 bg-[#0A369D] text-white rounded-xl font-bold hover:bg-[#082d86] transition-colors">
                        + Add Office
                    </button>
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-in slide-in-from-top-2 duration-300">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">{editId ? 'Edit Office' : 'New Office'}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Office Name</label>
                                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dhaka Office" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A369D]" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Google Maps URL</label>
                                <input type="text" value={form.maps_url} onChange={e => setForm({ ...form, maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/..." className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A369D] font-mono text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address (shown to users)</label>
                                <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={"Kha-215, Merul Badda\n(Beside BRAC University)"} rows={2} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A369D] resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
                                <input type="number" step="any" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="23.7769" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A369D] font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
                                <input type="number" step="any" value={form.lon} onChange={e => setForm({ ...form, lon: e.target.value })} placeholder="90.4217" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A369D] font-mono" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-[#0A369D] text-white rounded-xl font-bold hover:bg-[#082d86] transition-colors disabled:opacity-50">
                                {saving ? 'Saving...' : 'Save Office'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Offices Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400">Loading offices...</div>
                    ) : offices.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">No offices yet. Click "+ Add Office" to get started.</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Office</th>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Coordinates</th>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Status</th>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {offices.map(o => (
                                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <p className="font-bold text-slate-800">{o.name}</p>
                                            <p className="text-slate-500 text-sm whitespace-pre-line">{o.address}</p>
                                            <a href={o.maps_url} target="_blank" rel="noreferrer" className="text-blue-500 text-xs hover:underline mt-0.5 inline-block">
                                                View on Google Maps ↗
                                            </a>
                                        </td>
                                        <td className="px-5 py-4 font-mono text-sm text-slate-600">
                                            <p>{o.lat.toFixed(4)}°N</p>
                                            <p>{o.lon.toFixed(4)}°E</p>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <button onClick={() => handleToggle(o.id, o.enabled)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${o.enabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                {o.enabled ? 'Active' : 'Disabled'}
                                            </button>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => handleEdit(o)} className="px-3 py-1.5 text-sm font-medium text-[#0A369D] hover:bg-blue-50 rounded-lg transition-colors">Edit</button>
                                                <button onClick={() => handleDelete(o.id)} className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
