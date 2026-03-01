import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


// GET /api/offices — returns all enabled offices
export async function GET() {
    const offices = await prisma.office.findMany({
        where: { enabled: true },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, address: true, maps_url: true, lat: true, lon: true },
    });
    return NextResponse.json({ offices });
}
