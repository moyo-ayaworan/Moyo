export const BOOKING_PACKAGES = [
  { id: 'portrait-one', category: 'portrait', label: 'Portrait · One outfit', price: 50000, details: '4 high-end images · Online gallery' },
  { id: 'portrait-two', category: 'portrait', label: 'Portrait · Two outfits', price: 70000, details: '6 high-end images · Online gallery' },
  { id: 'family-one', category: 'family', label: 'Family portraits · One outfit', price: 80000, details: '4 high-end images · Online gallery' },
  { id: 'family-two', category: 'family', label: 'Family portraits · Two outfits', price: 100000, details: '6 high-end images · Online gallery' },
  { id: 'wedding-one-day', category: 'wedding', label: 'Wedding · One day, one shooter', price: 400000, details: 'Photobook · 16×20 frame · 20 high-end retouched images · 100 edited images on a flash drive' },
  { id: 'wedding-two-day', category: 'wedding', label: 'Wedding · Two days, one shooter', price: 600000, details: 'Pre-wedding shoot · Photobook · 20×24 frame · 30 high-end retouched images · 200 edited images on a flash drive' },
  { id: 'custom-project', category: 'custom', label: 'Editorial, commercial or custom project', price: null, details: 'A tailored quote will be prepared from your brief.' },
] as const;

export type BookingPackageId = typeof BOOKING_PACKAGES[number]['id'];
export type LocationType = 'lagos-studio' | 'lagos-location' | 'outside-lagos' | 'international';
export type DeliverySpeed = 'standard' | 'rush';

export type BookingOptions = {
  locationType: LocationType;
  locationAddress: string;
  deliverySpeed: DeliverySpeed;
  extraShooter: boolean;
  extraImages: number;
  extraOutfits: number;
  extraHours: number;
  productionNeeds: boolean;
};

export const DEFAULT_BOOKING_OPTIONS: BookingOptions = {
  locationType: 'lagos-studio', locationAddress: '', deliverySpeed: 'standard',
  extraShooter: false, extraImages: 0, extraOutfits: 0, extraHours: 0, productionNeeds: false,
};

export function getBookingPackage(id: string) {
  return BOOKING_PACKAGES.find(item => item.id === id);
}

function boundedCount(value: unknown) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= 100 ? count : 0;
}

export function normalizeBookingOptions(value: unknown): BookingOptions {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const locationTypes: LocationType[] = ['lagos-studio', 'lagos-location', 'outside-lagos', 'international'];
  const locationType = locationTypes.includes(source.locationType as LocationType) ? source.locationType as LocationType : 'lagos-studio';
  return {
    locationType,
    locationAddress: typeof source.locationAddress === 'string' ? source.locationAddress.trim().slice(0, 300) : '',
    deliverySpeed: source.deliverySpeed === 'rush' ? 'rush' : 'standard',
    extraShooter: source.extraShooter === true,
    extraImages: boundedCount(source.extraImages), extraOutfits: boundedCount(source.extraOutfits), extraHours: boundedCount(source.extraHours),
    productionNeeds: source.productionNeeds === true,
  };
}

export function calculateBookingEstimate(packageId: string, rawOptions: unknown) {
  const selectedPackage = getBookingPackage(packageId);
  const options = normalizeBookingOptions(rawOptions);
  const basePrice = selectedPackage?.price ?? 0;
  const wedding = selectedPackage?.category === 'wedding';
  const extraShooterPrice = wedding && options.extraShooter ? 100000 : 0;
  const quoteReasons: string[] = [];
  if (!selectedPackage || selectedPackage.price === null) quoteReasons.push('custom project');
  if (options.locationType !== 'lagos-studio') quoteReasons.push('location and travel');
  if (options.deliverySpeed === 'rush') quoteReasons.push('rush delivery');
  if (options.extraImages) quoteReasons.push(`${options.extraImages} extra retouched image${options.extraImages === 1 ? '' : 's'}`);
  if (options.extraOutfits) quoteReasons.push(`${options.extraOutfits} extra outfit${options.extraOutfits === 1 ? '' : 's'}`);
  if (options.extraHours) quoteReasons.push(`${options.extraHours} extra shooting hour${options.extraHours === 1 ? '' : 's'}`);
  if (options.productionNeeds) quoteReasons.push('production, permit or accommodation needs');
  if (options.extraShooter && !wedding) quoteReasons.push('extra photographer');
  return { selectedPackage, options, basePrice, extraShooterPrice, estimatedTotal: basePrice + extraShooterPrice, quoteRequired: quoteReasons.length > 0, quoteReasons };
}

export function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);
}
