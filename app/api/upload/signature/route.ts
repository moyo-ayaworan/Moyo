import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { uploadPublicId } from '@/lib/uploadIdentity';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uploadFolder = 'moyo-admin';

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  let publicId: string;
  try { publicId = uploadPublicId(String(body?.hash || ''), String(body?.filename || ''), String(body?.mimeType || '')); }
  catch { return NextResponse.json({ error: 'Invalid upload fingerprint.' }, { status: 400 }); }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ directUpload: false });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const uploadParams = {
    folder: uploadFolder,
    timestamp,
    public_id: publicId,
    overwrite: false,
  };
  const signature = cloudinary.utils.api_sign_request(
    uploadParams,
    apiSecret
  );

  return NextResponse.json({
    directUpload: true,
    cloudName,
    apiKey,
    ...uploadParams,
    signature,
  });
}
