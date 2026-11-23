/** Stable, gallery-scoped references: never send source file URLs to clients. */
export function galleryPreviewUrl(id: number, index: number, collection = 'proofs') {
  return `/api/galleries/preview?galleryId=${id}&index=${index}&collection=${collection}`;
}
