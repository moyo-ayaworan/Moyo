import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'node:crypto';
import { uploadPublicId } from '@/lib/uploadIdentity';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);
const cloudinaryUploadTimeoutMs = 110_000;
const maxServerUploadBytes = 100 * 1024 * 1024;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function saveLocalUpload(file: File, buffer: Buffer, hash: string) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const extension = file.name.match(/\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase() || '.bin';
  const filename = `asset-${hash}${extension}`;
  try { await fs.writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return `/uploads/${filename}`;
}

async function uploadFile(file: File) {
  console.log('[upload] file meta', {
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (file.size > maxServerUploadBytes) {
    throw new Error(`${file.name} is larger than ${Math.round(maxServerUploadBytes / (1024 * 1024))}MB`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash('sha256').update(buffer).digest('hex');

  if (!cloudinaryConfigured) {
    if (process.env.VERCEL) throw new Error('Configure Cloudinary before uploading files on the hosted site.');
    const url = await saveLocalUpload(file, buffer, hash);
    console.log('[upload] saved local file', { url });
    return url;
  }

  const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(new Error(`Upload timed out for ${file.name}`));
    }, cloudinaryUploadTimeoutMs);

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'moyo-admin', resource_type: 'auto', public_id: uploadPublicId(hash, file.name, file.type), overwrite: false },
      (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) {
          console.error('[upload] cloudinary error', error);
          reject(error);
        } else if (result) {
          console.log('[upload] cloudinary result', {
            assetId: result.asset_id,
            publicId: result.public_id,
            bytes: result.bytes,
            secureUrl: Boolean(result.secure_url),
          });
          resolve(result);
        } else {
          reject(new Error('Cloudinary returned no upload result'));
        }
      }
    );
    stream.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    stream.end(buffer);
  });

  return upload.secure_url;
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    console.log('[upload] request received', {
      hasAdminHeader: !!req.headers.get('x-admin-key'),
      cloudinaryConfigured,
    });
    const formData = await req.formData();
    const files = [...formData.getAll('file'), ...formData.getAll('files')]
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!files.length) {
      console.warn('[upload] no file in formData');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (files.length > 10) return NextResponse.json({ error: 'Upload no more than 10 files per server request.' }, { status: 400 });
    const results: PromiseSettledResult<string>[] = [];
    for (let index = 0; index < files.length; index += 2) {
      results.push(...await Promise.allSettled(files.slice(index, index + 2).map(uploadFile)));
    }
    const urls = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map((result) => result.value);
    const failures = results
      .map((result, index) => {
        if (result.status !== 'rejected') return null;
        const file = files[index];
        return {
          index,
          name: file?.name || `file-${index + 1}`,
          message: result.reason instanceof Error ? result.reason.message : 'Upload failed',
        };
      })
      .filter((failure): failure is { index: number; name: string; message: string } => Boolean(failure));
    const failedIndexes = failures.map((failure) => failure.index);
    const failedCount = results.length - urls.length;

    if (!urls.length) {
      return NextResponse.json(
        {
          error: failures[0]?.message || 'Upload failed',
          failedCount,
          failedIndexes,
          failures,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { url: urls[0], urls, uploadedCount: urls.length, failedCount, failedIndexes, failures },
      { status: failedCount ? 207 : 200 }
    );
  } catch (error) {
    console.error('[upload] Cloudinary upload failed', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
