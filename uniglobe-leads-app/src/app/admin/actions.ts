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
