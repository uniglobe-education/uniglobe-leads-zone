'use client';

import { useState } from 'react';
import { bulkUpsertQuestions, updateFormSettings } from './actions';
import ImageUploadField from '@/components/ImageUploadField';

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

export default function FormBuilderClient({ form, initialQuestions }: { form: any, initialQuestions: any[] }) {
    const [activeTab, setActiveTab] = useState<'questions' | 'design' | 'product'>('questions');
    const [isSaving, setIsSaving] = useState(false);

    // Form Design Settings State
    const [settings, setSettings] = useState({
        theme_color: form.theme_color || '#0A369D',
        background_style: form.background_style || 'solid',
        success_title: form.success_title || 'Thanks!',
        success_description: form.success_description || "We've received your info.\nA counselor will call you shortly.",
        whatsapp_number: form.whatsapp_number || '+447441394235',
        office_location: form.office_location || 'dhaka',
        // Greeting section
        greeting_headline: form.greeting_headline || '',
        greeting_body: form.greeting_body || '',
        greeting_type: form.greeting_type || 'paragraph',
        // Product card fields
        country: form.country || '',
        university_name: form.university_name || '',
        tuition_fee: form.tuition_fee || '',
        scholarship: form.scholarship || '',
        cash_deposit: form.cash_deposit || '',
        duration: form.duration || '',
        product_image_url: form.product_image_url || '',
        bg_image_url: form.bg_image_url || '',
        // Social/links
        facebook_page_url: form.facebook_page_url || '',
        products_page_url: form.products_page_url || '/',
    });

    const [questions, setQuestions] = useState<Question[]>(
        initialQuestions.map(q => ({
            id: q.id,
            key: q.key,
            label: q.label,
            type: q.type,
            required: q.required,
            options: q.options || '',
            placeholder: q.placeholder || '',
            help_text: q.help_text || ''
        }))
    );

    const handleAddQuestion = () => {
        setQuestions([
            ...questions,
            {
                id: `new-${Date.now()}`,
                key: `question_${questions.length + 1}`,
                label: 'New Question',
                type: 'short_text',
                required: false,
                options: '',
                placeholder: '',
                help_text: ''
            }
        ]);
    };

    const updateQuestion = (id: string, field: keyof Question, value: any) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        const newQs = [...questions];
        if (direction === 'up' && index > 0) {
            [newQs[index - 1], newQs[index]] = [newQs[index], newQs[index - 1]];
        } else if (direction === 'down' && index < newQs.length - 1) {
            [newQs[index + 1], newQs[index]] = [newQs[index], newQs[index + 1]];
        }
        setQuestions(newQs);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save both Questions and Settings concurrently
            await Promise.all([
                bulkUpsertQuestions(form.id, questions),
                updateFormSettings(form.id, settings)
            ]);
            alert('Form layout and settings saved successfully!');
        } catch (e: any) {
            alert(`Error saving: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-150">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#1E293B]">Builder: {form.form_name}</h2>
                    <p className="text-slate-500 mt-1">Configure questions and the student UI experience.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 md:flex-none px-6 py-2.5 rounded-lg font-medium text-white bg-[#E32636] hover:bg-[#C8102E] transition-colors disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-xl w-full md:w-fit flex-wrap">
                <button
                    onClick={() => setActiveTab('questions')}
                    className={`flex-1 md:w-36 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'questions' ? 'bg-white text-[#0A369D] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Questions
                </button>
                <button
                    onClick={() => setActiveTab('design')}
                    className={`flex-1 md:w-36 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'design' ? 'bg-white text-[#0A369D] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Design & Text
                </button>
                <button
                    onClick={() => setActiveTab('product')}
                    className={`flex-1 md:w-36 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'product' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    🎓 Product Info
                </button>
            </div>

            {activeTab === 'questions' && (
                <div className="flex flex-col gap-6">
                    <div className="flex justify-end">
                        <button
                            onClick={handleAddQuestion}
                            className="px-5 py-2 rounded-lg font-medium text-[#0A369D] bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                            + Add Question
                        </button>
                    </div>
                    {questions.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No questions configured yet. Click "Add Question" to start building.
                        </div>
                    ) : (
                        questions.map((q, i) => (
                            <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 relative group">

                                {/* Reorder Controls */}
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => moveQuestion(i, 'up')} disabled={i === 0} className="p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-[#0A369D] disabled:opacity-30">▲</button>
                                    <button onClick={() => moveQuestion(i, 'down')} disabled={i === questions.length - 1} className="p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-[#0A369D] disabled:opacity-30">▼</button>
                                </div>

                                <div className="flex justify-between items-start mb-4 pl-6">
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="w-8 h-8 rounded-full bg-[#0A369D] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                            {i + 1}
                                        </span>
                                        <input
                                            type="text"
                                            value={q.label}
                                            onChange={(e) => updateQuestion(q.id, 'label', e.target.value)}
                                            placeholder="Question Label (e.g. Full Name)"
                                            className="text-lg font-bold text-[#1E293B] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#0A369D] focus:outline-none px-1 py-0.5 w-full"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeQuestion(q.id)}
                                        className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors ml-4 shrink-0"
                                        title="Delete Question"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-14">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Type</label>
                                        <select
                                            value={q.type}
                                            onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}
                                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none bg-white text-sm"
                                        >
                                            <option value="short_text">Short Text</option>
                                            <option value="paragraph">Paragraph</option>
                                            <option value="email">Email</option>
                                            <option value="phone">Phone</option>
                                            <option value="mcq">Multiple Choice (Buttons)</option>
                                            <option value="dropdown">Dropdown Select</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-red-600">Stable DB Key</label>
                                        <input
                                            type="text"
                                            value={q.key}
                                            onChange={(e) => updateQuestion(q.id, 'key', e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                                            placeholder="e.g. first_name"
                                            className="w-full p-2.5 border border-red-200 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-mono"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Changes to this key will map answers to a new column in Sheets.</p>
                                    </div>

                                    {['mcq', 'dropdown'].includes(q.type) && (
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Options (Pipe | Separated)</label>
                                            <input
                                                type="text"
                                                value={q.options}
                                                onChange={(e) => updateQuestion(q.id, 'options', e.target.value)}
                                                placeholder="e.g. Option A|Option B|Option C"
                                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none bg-white text-sm font-mono"
                                            />
                                        </div>
                                    )}

                                    <div className="md:col-span-2 flex gap-4 mt-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={q.required}
                                                onChange={(e) => updateQuestion(q.id, 'required', e.target.checked)}
                                                className="w-4 h-4 text-[#0A369D] rounded focus:ring-[#0A369D]"
                                            />
                                            Required Field
                                        </label>
                                    </div>

                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'design' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* General Settings */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">Form Aesthetics</h3>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Theme Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={settings.theme_color}
                                    onChange={e => setSettings({ ...settings, theme_color: e.target.value })}
                                    className="w-12 h-12 rounded cursor-pointer border-0"
                                />
                                <input
                                    type="text"
                                    value={settings.theme_color}
                                    onChange={e => setSettings({ ...settings, theme_color: e.target.value })}
                                    className="p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-mono"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Controls the primary button and progress bar colors.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Background Style</label>
                            <select
                                value={settings.background_style}
                                onChange={e => setSettings({ ...settings, background_style: e.target.value })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-medium"
                            >
                                <option value="solid">Solid (Minimal White/Gray)</option>
                                <option value="london_art">Animated London Line Art (Premium)</option>
                                <option value="abstract">Abstract Blobs Background</option>
                            </select>
                        </div>
                    </div>

                    {/* Success Screen Settings */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">Success Screen Configuration</h3>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Success Title</label>
                            <input
                                type="text"
                                value={settings.success_title}
                                onChange={e => setSettings({ ...settings, success_title: e.target.value })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Success Description</label>
                            <textarea
                                value={settings.success_description}
                                onChange={e => setSettings({ ...settings, success_description: e.target.value })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-medium min-h-25"
                            />
                            <p className="text-xs text-slate-500 mt-1">Text shown immediately after lead submission.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Call-to-Action Number</label>
                            <input
                                type="text"
                                value={settings.whatsapp_number}
                                onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })}
                                placeholder="+447441394235"
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-mono"
                            />
                            <p className="text-xs text-slate-500 mt-1">Number formatted with Country Code (no spaces). Users click to chat instantly.</p>
                        </div>

                    </div>

                    {/* Greeting Section */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl md:col-span-2">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">👋 Greeting (shown under form title)</h3>
                        <p className="text-xs text-slate-500 -mt-3">Shown below the form name heading to set expectations. Leave both fields blank to hide the greeting.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Headline</label>
                                <input
                                    type="text"
                                    value={settings.greeting_headline}
                                    onChange={e => setSettings({ ...settings, greeting_headline: e.target.value })}
                                    placeholder="e.g. Study in the UK – Masters by Research"
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Description Style</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, greeting_type: 'paragraph' })}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${settings.greeting_type === 'paragraph'
                                            ? 'bg-[#0A369D] text-white border-[#0A369D]'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-[#0A369D]'
                                            }`}
                                    >¶ Paragraph</button>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, greeting_type: 'list' })}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${settings.greeting_type === 'list'
                                            ? 'bg-[#0A369D] text-white border-[#0A369D]'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-[#0A369D]'
                                            }`}
                                    >☰ List</button>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    Description {settings.greeting_type === 'list' ? '(one item per line → becomes bullet ✓)' : '(paragraph text)'}
                                </label>
                                <textarea
                                    value={settings.greeting_body}
                                    onChange={e => setSettings({ ...settings, greeting_body: e.target.value })}
                                    placeholder={
                                        settings.greeting_type === 'list'
                                            ? 'Apply MRes and get your Offer Letter\nFly with your dependents\nScholarship available'
                                            : 'e.g. Apply MRes and secure your Offer Letter today.'
                                    }
                                    rows={4}
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 text-sm font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'product' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* University Details */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">🏫 University Details</h3>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Country</label>
                            <input type="text" value={settings.country} onChange={e => setSettings({ ...settings, country: e.target.value })} placeholder="e.g. United Kingdom" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">University Name</label>
                            <input type="text" value={settings.university_name} onChange={e => setSettings({ ...settings, university_name: e.target.value })} placeholder="e.g. University of Westminster" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Duration</label>
                            <input type="text" value={settings.duration} onChange={e => setSettings({ ...settings, duration: e.target.value })} placeholder="e.g. 1 Year (Masters)" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800" />
                        </div>
                    </div>

                    {/* Fees & Benefits */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">💰 Fees & Benefits</h3>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Tuition Fee</label>
                            <input type="text" value={settings.tuition_fee} onChange={e => setSettings({ ...settings, tuition_fee: e.target.value })} placeholder="e.g. £12,000/year" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Scholarship</label>
                            <input type="text" value={settings.scholarship} onChange={e => setSettings({ ...settings, scholarship: e.target.value })} placeholder="e.g. Up to £5,000" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Cash Deposit Required</label>
                            <input type="text" value={settings.cash_deposit} onChange={e => setSettings({ ...settings, cash_deposit: e.target.value })} placeholder="e.g. £2,500" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800" />
                        </div>
                    </div>

                    {/* Images */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">🖼 Card Images</h3>
                        <ImageUploadField
                            label="Background Image (product card)"
                            value={settings.bg_image_url}
                            onChange={url => setSettings({ ...settings, bg_image_url: url })}
                            placeholder="/uk_bg.png or https://..."
                            hint="Full-bleed background image on the product card. Leave blank to use the default UK image."
                        />
                        <ImageUploadField
                            label="Product Image (optional overlay)"
                            value={settings.product_image_url}
                            onChange={url => setSettings({ ...settings, product_image_url: url })}
                            placeholder="/logo.png or https://..."
                            hint="University logo or programme badge shown on the card."
                        />
                    </div>

                    {/* Social & Links */}
                    <div className="flex flex-col gap-5 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-200 pb-2 mb-2">🔗 Links (Success Page)</h3>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Facebook Page URL</label>
                            <input type="text" value={settings.facebook_page_url} onChange={e => setSettings({ ...settings, facebook_page_url: e.target.value })} placeholder="https://facebook.com/yourpage" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-mono text-sm" />
                            <p className="text-xs text-slate-500 mt-1">Shown on the success screen after form submission.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">"View More Programs" URL</label>
                            <input type="text" value={settings.products_page_url} onChange={e => setSettings({ ...settings, products_page_url: e.target.value })} placeholder="/ or https://yourdomain.com/products" className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none text-slate-800 font-mono text-sm" />
                            <p className="text-xs text-slate-500 mt-1">Where users go after clicking "View More Programs" button.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
