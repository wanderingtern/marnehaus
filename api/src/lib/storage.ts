import fs from 'fs';
import path from 'path';

const USE_S3 = !!(process.env.STORAGE_ENDPOINT || process.env.AWS_S3_BUCKET);
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!USE_S3) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (USE_S3) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: process.env.AWS_REGION ?? 'auto',
      endpoint: process.env.STORAGE_ENDPOINT,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        : undefined,
    });
    const bucket = process.env.AWS_S3_BUCKET!;
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
    return key;
  }

  // Local fallback
  const filePath = path.join(LOCAL_UPLOAD_DIR, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return key;
}

export async function getFileUrl(key: string): Promise<string> {
  if (USE_S3) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({
      region: process.env.AWS_REGION ?? 'auto',
      endpoint: process.env.STORAGE_ENDPOINT,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        : undefined,
    });
    const bucket = process.env.AWS_S3_BUCKET!;
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: 3600,
    });
  }

  // Local: return an internal download URL
  return `/api/files/${encodeURIComponent(key)}`;
}

export function getLocalFilePath(key: string): string {
  return path.join(LOCAL_UPLOAD_DIR, key);
}
