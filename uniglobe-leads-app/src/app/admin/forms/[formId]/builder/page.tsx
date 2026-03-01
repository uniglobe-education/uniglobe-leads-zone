import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import FormBuilderClient from './BuilderClient';


export default async function FormBuilderPage({ params }: { params: Promise<{ formId: string }> }) {
    const { formId } = await params;

    const form = await prisma.form.findUnique({
        where: { id: formId }
    });

    if (!form) {
        notFound();
    }

    const questions = await prisma.question.findMany({
        where: { form_id: formId },
        orderBy: { order: 'asc' }
    });

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-6">
                <a href="/admin" className="text-sm font-medium text-slate-500 hover:text-[#0A369D] flex items-center gap-2 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to All Forms
                </a>
            </div>

            <FormBuilderClient
                form={form}
                initialQuestions={questions}
            />
        </div>
    );
}
