'use client';

import { useRef, useState } from 'react';

type Props = {
    label: string;
    value: string;
    onChange: (url: string) => void;
    placeholder?: string;
    hint?: string;
};

export default function ImageUploadField({ label, value, onChange, placeholder, hint }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [progress, setProgress] = useState(0);

    const handleFile = async (file: File) => {
        setUploadError('');
        setUploading(true);
        setProgress(20);

        try {
            const fd = new FormData();
            fd.append('file', file);

            setProgress(50);
            const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
            setProgress(90);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Upload failed');
            onChange(data.url);
            setProgress(100);
        } catch (e: any) {
            setUploadError(e.message);
        } finally {
            setUploading(false);
            setTimeout(() => setProgress(0), 1200);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>

            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="relative w-full border-2 border-dashed border-slate-300 hover:border-[#0A369D] rounded-xl overflow-hidden transition-colors cursor-pointer group"
                style={{ minHeight: value ? '140px' : '90px' }}
            >
                {value ? (
                    <img
                        src={value}
                        alt="preview"
                        className="w-full h-36 object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = ''; }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-24 gap-2">
                        <span className="text-3xl">🖼</span>
                        <p className="text-slate-400 text-xs font-medium">
                            {uploading ? 'Uploading...' : 'Click or drag an image here'}
                        </p>
                    </div>
                )}

                {/* Upload overlay on hover when there's already an image */}
                {value && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-bold bg-black/50 px-3 py-1.5 rounded-full">
                            {uploading ? 'Uploading...' : '🔄 Replace image'}
                        </span>
                    </div>
                )}

                {/* Progress bar */}
                {uploading && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200">
                        <div
                            className="h-full bg-[#0A369D] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
            </div>

            {uploadError && (
                <p className="text-red-500 text-xs mt-1">⚠ {uploadError}</p>
            )}

            {/* Manual URL override */}
            <div className="mt-2">
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || 'https://... or /public/image.png'}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A369D] outline-none font-mono text-xs text-slate-600"
                />
            </div>

            {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
    );
}
