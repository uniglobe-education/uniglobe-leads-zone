import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Resetting Database...');

    // Clean up
    await prisma.lead.deleteMany();
    await prisma.question.deleteMany();
    await prisma.form.deleteMany();

    console.log('Seeding Database...');

    // 1. Create a Bachelors form
    const bachelorsForm = await prisma.form.create({
        data: {
            form_id: 'BACHELORS_UG',
            form_name: 'Bachelors Lead Form',
            status: 'ACTIVE',
        }
    });

    // 1a. Add questions to Bachelors Form
    await prisma.question.createMany({
        data: [
            {
                form_id: bachelorsForm.id,
                key: 'first_name',
                label: 'What is your First Name?',
                type: 'short_text',
                required: true,
                order: 1,
            },
            {
                form_id: bachelorsForm.id,
                key: 'phone',
                label: 'What is your Phone Number?',
                type: 'phone',
                required: true,
                order: 2,
            },
            {
                form_id: bachelorsForm.id,
                key: 'preferred_destination',
                label: 'Preferred Destination?',
                type: 'mcq',
                required: true,
                options: 'UK|Canada|Australia|Other',
                order: 3,
            },
            {
                form_id: bachelorsForm.id,
                key: 'hsc_gpa',
                label: 'What is your HSC GPA?',
                type: 'short_text',
                required: true,
                placeholder: 'e.g. 4.5',
                order: 4,
            }
        ]
    });

    // 2. Create a Masters form
    const mastersForm = await prisma.form.create({
        data: {
            form_id: 'MASTERS_UK',
            form_name: 'Masters Lead Form',
            status: 'ACTIVE',
        }
    });

    // 2a. Add questions to Masters Form
    await prisma.question.createMany({
        data: [
            {
                form_id: mastersForm.id,
                key: 'first_name',
                label: 'First Name',
                type: 'short_text',
                required: true,
                order: 1,
            },
            {
                form_id: mastersForm.id,
                key: 'phone',
                label: 'Phone Number',
                type: 'phone',
                required: true,
                order: 2,
            },
            {
                form_id: mastersForm.id,
                key: 'english_proficiency',
                label: 'What is your English proficiency?',
                type: 'dropdown',
                required: true,
                options: 'IELTS|PTE|Duolingo|Not yet',
                order: 3,
            },
            {
                form_id: mastersForm.id,
                key: 'highest_qualification',
                label: 'Highest Qualification Background?',
                type: 'dropdown',
                required: true,
                options: 'BBA|BSc|BA|Other',
                order: 4,
            }
        ]
    });

    console.log('Seeding Complete! 🎉');
    console.log(`Created form: ${bachelorsForm.form_id}`);
    console.log(`Created form: ${mastersForm.form_id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
