'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';


export async function bulkUpsertQuestions(formId: string, questions: any[]) {
    // Basic verification of access could go here

    await prisma.$transaction(async (tx) => {
        // Upsert incoming — no hard deletes, disabled questions stay in DB
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const isNew = q.id.startsWith('new-');

            if (isNew) {
                await tx.question.create({
                    data: {
                        form_id: formId,
                        key: q.key,
                        label: q.label,
                        type: q.type,
                        required: q.required,
                        options: q.options || null,
                        placeholder: q.placeholder || null,
                        help_text: q.help_text || null,
                        sheet_column: q.sheet_column || null,
                        enabled: q.enabled !== false,
                        order: i
                    }
                });
            } else {
                await tx.question.update({
                    where: { id: q.id },
                    data: {
                        key: q.key,
                        label: q.label,
                        type: q.type,
                        required: q.required,
                        options: q.options || null,
                        placeholder: q.placeholder || null,
                        help_text: q.help_text || null,
                        sheet_column: q.sheet_column || null,
                        enabled: q.enabled !== false,
                        order: i
                    }
                });
            }
        }
    });

    revalidatePath('/admin');
    revalidatePath(`/admin/forms/${formId}/builder`);
    revalidatePath('/apply');
}

export async function updateFormSettings(formId: string, data: any) {
    await prisma.form.update({
        where: { id: formId },
        data: {
            theme_color: data.theme_color,
            background_style: data.background_style,
            success_title: data.success_title,
            success_description: data.success_description,
            whatsapp_number: data.whatsapp_number,
            office_location: data.office_location || 'dhaka',
            // Product card fields
            country: data.country || null,
            university_name: data.university_name || null,
            tuition_fee: data.tuition_fee || null,
            scholarship: data.scholarship || null,
            cash_deposit: data.cash_deposit || null,
            duration: data.duration || null,
            product_image_url: data.product_image_url || null,
            bg_image_url: data.bg_image_url || null,
            // Social / redirect
            facebook_page_url: data.facebook_page_url || null,
            products_page_url: data.products_page_url || null,
            // Greeting
            greeting_headline: data.greeting_headline || null,
            greeting_body: data.greeting_body || null,
            greeting_type: data.greeting_type || 'paragraph',
        }
    });

    revalidatePath('/admin');
    revalidatePath(`/admin/forms/${formId}/builder`);
    revalidatePath('/apply');
    revalidatePath('/');
}
