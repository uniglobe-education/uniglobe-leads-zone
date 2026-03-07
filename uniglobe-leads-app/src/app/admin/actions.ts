'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';


export async function createForm(formData: FormData) {
    const form_id = formData.get('form_id') as string;
    const form_name = formData.get('form_name') as string;

    if (!form_id || !form_name) {
        throw new Error('Form ID and Form Name are required');
    }

    await prisma.form.create({
        data: {
            form_id,
            form_name,
            status: 'ACTIVE',
        }
    });

    revalidatePath('/admin');
}

export async function updateForm(formData: FormData) {
    const id = formData.get('id') as string;
    const form_name = formData.get('form_name') as string;
    const target_sheet_tab_name = formData.get('target_sheet_tab_name') as string | null;
    const status = formData.get('status') as string;

    if (!id) throw new Error('Form ID string is required for update');

    await prisma.form.update({
        where: { id },
        data: {
            form_name,
            target_sheet_tab_name,
            status,
        }
    });

    revalidatePath('/admin');
}

export async function checkAdminPassword(password: string) {
    // Simple env-based password protection
    const adminPassword = process.env.ADMIN_PASSWORD || 'uniglobe2024';
    return password === adminPassword;
}

export async function updateGlobalSettings(formData: FormData) {
    const master_google_sheet_id = formData.get('master_google_sheet_id') as string;
    const password = formData.get('password') as string;

    const isValid = await checkAdminPassword(password);
    if (!isValid) {
        throw new Error("Invalid admin password");
    }

    const existing = await prisma.globalSetting.findFirst();
    if (existing) {
        await prisma.globalSetting.update({
            where: { id: existing.id },
            data: { master_google_sheet_id }
        });
    } else {
        await prisma.globalSetting.create({
            data: { master_google_sheet_id }
        });
    }

    revalidatePath('/admin');
}

export async function duplicateForm(formId: string, customFormName?: string, customFormId?: string) {
    const form = await prisma.form.findUnique({
        where: { id: formId },
        include: { questions: { orderBy: { order: 'asc' } } }
    });

    if (!form) throw new Error('Form not found');

    const newFormId = customFormId || `${form.form_id}_COPY_${Date.now().toString(36).toUpperCase()}`;
    const newFormName = customFormName || `${form.form_name} (Copy)`;

    // Check for form_id uniqueness
    const existingForm = await prisma.form.findUnique({ where: { form_id: newFormId } });
    if (existingForm) throw new Error(`Form ID "${newFormId}" already exists. Please choose a different one.`);

    const newForm = await prisma.form.create({
        data: {
            form_id: newFormId,
            form_name: newFormName,
            status: 'DRAFT',
            theme_color: form.theme_color,
            background_style: form.background_style,
            success_title: form.success_title,
            success_description: form.success_description,
            whatsapp_number: form.whatsapp_number,
            greeting_headline: form.greeting_headline,
            greeting_body: form.greeting_body,
            greeting_type: form.greeting_type,
            country: form.country,
            university_name: form.university_name,
            tuition_fee: form.tuition_fee,
            scholarship: form.scholarship,
            cash_deposit: form.cash_deposit,
            duration: form.duration,
            product_image_url: form.product_image_url,
            bg_image_url: form.bg_image_url,
            facebook_page_url: form.facebook_page_url,
            products_page_url: form.products_page_url,
            office_location: form.office_location,
        }
    });

    // Copy all questions
    if (form.questions.length > 0) {
        await prisma.question.createMany({
            data: form.questions.map((q, i) => ({
                form_id: newForm.id,
                key: q.key,
                label: q.label,
                type: q.type,
                required: q.required,
                options: q.options,
                placeholder: q.placeholder,
                help_text: q.help_text,
                sheet_column: q.sheet_column,
                order: i,
            }))
        });
    }

    revalidatePath('/admin');
    return newForm;
}

export async function softDeleteForm(formId: string) {
    await prisma.form.update({
        where: { id: formId },
        data: { deleted_at: new Date() }
    });
    revalidatePath('/admin');
}

export async function restoreForm(formId: string) {
    await prisma.form.update({
        where: { id: formId },
        data: { deleted_at: null }
    });
    revalidatePath('/admin');
}
