import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand, GetObjectCommand } from '@aws-sdk/client-s3';

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

function resolveEndpoint() {
    const rawEndpoint = (process.env.MINIO_ENDPOINT || '').trim();
    const rawPort = (process.env.MINIO_PORT || '').trim();
    const fallback = 'http://localhost:9000';

    const withProtocol = rawEndpoint
        ? (/^https?:\/\//i.test(rawEndpoint) ? rawEndpoint : `http://${rawEndpoint}`)
        : fallback;

    const parsed = new URL(withProtocol);
    if (rawPort && !parsed.port) {
        parsed.port = rawPort;
    }

    return parsed;
}

function createMinioClient() {
    const endpoint = resolveEndpoint().origin;
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

function resolvePublicBaseUrl() {
    const explicitPublic = (process.env.MINIO_PUBLIC_URL || '').trim();
    if (explicitPublic) {
        const withProtocol = /^https?:\/\//i.test(explicitPublic) ? explicitPublic : `http://${explicitPublic}`;
        return new URL(withProtocol).origin;
    }

    const endpoint = resolveEndpoint();
    const isDockerInternalHost = endpoint.hostname === 'minio';

    if (isDockerInternalHost) {
        endpoint.hostname = 'localhost';
    }

    return endpoint.origin;
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

    // Ensure public read access so browser <img src="http://..."> works.
    const policy = {
        Version: '2012-10-17',
        Statement: [
            {
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${BUCKET}/*`],
            },
        ],
    };

    await s3.send(new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify(policy),
    }));

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
            ACL: 'public-read',
        }));

        // Return app-proxied URL so private MinIO objects still render in browser.
        const publicBase = resolvePublicBaseUrl();
        const directUrl = `${publicBase}/${BUCKET}/${key}`;
        const url = `/api/admin/upload?key=${encodeURIComponent(key)}`;

        return NextResponse.json({ url, key, directUrl });
    } catch (error: any) {
        console.error('MinIO upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Upload failed. Is MinIO running?' },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const key = (searchParams.get('key') || '').trim();

        if (!key) {
            return NextResponse.json({ error: 'Missing key' }, { status: 400 });
        }

        const s3 = createMinioClient();
        let result;
        try {
            result = await s3.send(new GetObjectCommand({
                Bucket: BUCKET,
                Key: key,
            }));
        } catch (error: any) {
            const shouldRetryLowercase =
                (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) &&
                key !== key.toLowerCase();

            if (!shouldRetryLowercase) {
                throw error;
            }

            result = await s3.send(new GetObjectCommand({
                Bucket: BUCKET,
                Key: key.toLowerCase(),
            }));
        }

        const body = result.Body;
        if (!body) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const stream = typeof (body as any).transformToWebStream === 'function'
            ? (body as any).transformToWebStream()
            : (body as any);

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': result.ContentType || 'application/octet-stream',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error: any) {
        if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        console.error('MinIO fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch object' }, { status: 500 });
    }
}
