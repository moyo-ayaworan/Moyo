import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function parseAuthenticatedAsset(src: string) {
  let url: URL;
  try { url = new URL(src); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
  if (url.pathname.split('/')[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;
  const match = /^\/(?:[^/]+)\/(image|video|raw)\/authenticated\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+)\.([a-z0-9]+)$/i.exec(url.pathname);
  if (!match) return null;
  try {
  return { resourceType: match[1] as 'image' | 'video' | 'raw', publicId: decodeURIComponent(match[2] + (match[1] === 'raw' ? `.${match[3]}` : '')), format: match[3].toLowerCase() };
  } catch { return null; }
}

export function signedGalleryPreview(src: string) {
  const asset = parseAuthenticatedAsset(src);
  // A preview must never be a signed original archive or full-fidelity vector.
  if (!asset || asset.resourceType !== 'image') return null;
  return cloudinary.url(asset.publicId, {
    secure: true,
    type: 'authenticated',
    resource_type: asset.resourceType,
    sign_url: true,
    format: 'jpg', page: 1, width: 1200, crop: 'limit', quality: 75,
  });
}

export function temporaryOriginalUrl(src: string) {
  const asset = parseAuthenticatedAsset(src);
  if (!asset) return null;
  return cloudinary.utils.private_download_url(asset.publicId, asset.resourceType === 'raw' ? '' : asset.format, {
    resource_type: asset.resourceType,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: true,
  });
}

/** Audio uses signed delivery without the image preview transformations. */
export function signedGallerySoundtrack(src: string) {
  const asset = parseAuthenticatedAsset(src);
  if (!asset || asset.resourceType !== 'video' || !/^(mp3|wav|m4a|ogg|aac|flac)$/i.test(asset.format)) return null;
  return cloudinary.url(asset.publicId, {
    secure: true, type: 'authenticated', resource_type: 'video', sign_url: true, format: asset.format,
  });
}
