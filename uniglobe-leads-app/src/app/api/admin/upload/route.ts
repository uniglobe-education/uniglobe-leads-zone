import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

/**
 * MinIO Image Upload
 * Uses @aws-sdk/client-s3 since MinIO is S3-API compatible.
 *
 * Required .env.local vars:
 *   MINIO_ENDPOINT=http://localhost:9000
 *   MINIO_ACCESS_KEY=minioadmin
 *   MINIO_SECRET_KEY=minioadmin
 *   MINIO_BUCKET=uniglobe
 *   MINIO_PUBLIC_URL=http://localhost:9000   (base URL for public image links)
 */

function createMinioClient() {
    const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    return new S3Client({
        endpoint,
        region: 'us-east-1', // MinIO ignores this but SDK requires a value
        credentials: {
            accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        },
        forcePathStyle: true, // REQUIRED for MinIO path-style URLs
    });
}

const BUCKET = process.env.MINIO_BUCKET || 'uniglobe';

// Auto-create bucket if it doesn't exist (runs once per server lifecycle)
let bucketEnsured = false;
async function ensureBucket(s3: S3Client) {
    if (bucketEnsured) return;
    try {
        await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch {
        console.log(`[MinIO] Bucket "${BUCKET}" not found, creating...`);
        await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
        console.log(`[MinIO] Bucket "${BUCKET}" created successfully`);
    }
    bucketEnsured = true;
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate type
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!allowed.includes(file.type)) {
            return NextResponse.json({ error: 'Only JPEG, PNG, WebP, GIF, SVG allowed' }, { status: 400 });
        }

        // Validate size (max 8MB)
        if (file.size > 8 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const s3 = createMinioClient();
        await ensureBucket(s3);
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: file.type,
        }));

        // Build public URL: MinIO serves files at <endpoint>/<bucket>/<key>
        const publicBase = (process.env.MINIO_PUBLIC_URL || process.env.MINIO_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
        const url = `${publicBase}/${BUCKET}/${key}`;

        return NextResponse.json({ url, key });
    } catch (error: any) {
        console.error('MinIO upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Upload failed. Is MinIO running?' },
            { status: 500 }
        );
    }
}
