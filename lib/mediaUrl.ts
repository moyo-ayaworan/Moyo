const cloudinaryUploadPath = /\/(image|video|raw|auto)\/upload\//;
const imageExtensionPattern = /\.(avif|gif|heic|jpeg|jpg|png|webp)(\?.*)?$/i;
const videoExtensionPattern = /\.(m4v|mov|mp4|webm)(\?.*)?$/i;

type ImagePreviewOptions = {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit';
  quality?: 'auto' | number;
};

export function isVideoUrl(src: string) {
  return videoExtensionPattern.test(src);
}

export function isImageUrl(src: string) {
  return imageExtensionPattern.test(src) || src.includes('/image/upload/');
}

export function getCloudinaryPreviewUrl(src: string, options: ImagePreviewOptions = {}) {
  if (src.includes('/s--')) return src;
  if (!src || isVideoUrl(src) || !src.includes('res.cloudinary.com') || !cloudinaryUploadPath.test(src)) {
    return src;
  }

  const width = Math.max(1, Math.round(options.width || 720));
  const height = options.height ? Math.max(1, Math.round(options.height)) : null;
  const quality = options.quality ?? 'auto';
  const crop = options.crop || 'fill';
  const transformation = [
    'f_auto',
    `q_${quality}`,
    `c_${crop}`,
    `w_${width}`,
    height ? `h_${height}` : null,
  ]
    .filter(Boolean)
    .join(',');

  return src.replace(cloudinaryUploadPath, (match) => `${match}${transformation}/`);
}

export function getImagePreviewSrcSet(src: string, widths: number[] = [360, 720, 1080]) {
  if (src.includes('/s--')) return undefined;
  if (!src || isVideoUrl(src) || !isImageUrl(src) || !src.includes('res.cloudinary.com')) return undefined;

  return widths
    .map((width) => `${getCloudinaryPreviewUrl(src, { width, crop: 'fill' })} ${width}w`)
    .join(', ');
}
