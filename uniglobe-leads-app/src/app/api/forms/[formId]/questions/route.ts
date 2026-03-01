import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


export async function GET(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;

    // Find form and its active questions
    const form = await prisma.form.findUnique({
      where: { form_id: formId, status: 'ACTIVE' },
      include: {
        questions: {
          where: { enabled: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: 'Form not found or inactive.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      form: {
        id: form.id,
        form_id: form.form_id,
        form_name: form.form_name,
        theme_color: form.theme_color,
        background_style: form.background_style,
        success_title: form.success_title,
        success_description: form.success_description,
        whatsapp_number: form.whatsapp_number,
      },
      questions: form.questions,
    });
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
