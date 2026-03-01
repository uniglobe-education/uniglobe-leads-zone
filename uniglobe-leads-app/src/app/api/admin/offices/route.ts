import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';


// GET /api/admin/offices — all offices (including disabled)
export async function GET() {
    const offices = await prisma.office.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json({ offices });
}

// POST /api/admin/offices — create new office
export async function POST(req: Request) {
    const data = await req.json();
    const office = await prisma.office.create({
        data: {
            name: data.name,
            address: data.address,
            maps_url: data.maps_url,
            lat: data.lat,
            lon: data.lon,
            order: data.order ?? 0,
            enabled: data.enabled ?? true,
        }
    });
    revalidatePath('/');
    return NextResponse.json({ office });
}
