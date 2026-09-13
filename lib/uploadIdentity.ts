/** Content identity stays stable across retries, renames, and upload transports. */
export function uploadPublicId(hash: string, filename: string, mimeType: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid upload fingerprint.');
  const extension = filename.match(/\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase() || '';
  const media = /^(image|video|audio)\//.test(mimeType) || /\.(jpe?g|png|webp|gif|avif|heic|mp4|mov|webm|mp3|wav)$/i.test(filename);
  return `asset-${hash}${media ? '' : extension}`;
}
