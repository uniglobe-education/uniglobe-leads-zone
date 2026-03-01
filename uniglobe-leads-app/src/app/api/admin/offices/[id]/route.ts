import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';


// PUT /api/admin/offices/[id] — update office
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await req.json();
    const office = await prisma.office.update({
        where: { id },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.maps_url !== undefined && { maps_url: data.maps_url }),
            ...(data.lat !== undefined && { lat: data.lat }),
            ...(data.lon !== undefined && { lon: data.lon }),
            ...(data.order !== undefined && { order: data.order }),
            ...(data.enabled !== undefined && { enabled: data.enabled }),
        }
    });
    revalidatePath('/');
    return NextResponse.json({ office });
}

// DELETE /api/admin/offices/[id]
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await prisma.office.delete({ where: { id } });
    revalidatePath('/');
    return NextResponse.json({ success: true });
}
