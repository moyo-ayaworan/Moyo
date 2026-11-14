export type ProductSection = 'photography' | 'art';
export function isProductSection(value: unknown): value is ProductSection { return value === 'photography' || value === 'art'; }
export function productShopPath(section: ProductSection) { return section === 'art' ? '/art/shop' : '/photography/shop'; }
