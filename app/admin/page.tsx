'use client';
import DocumentManager, { type ManagedDocument } from '@/components/admin/DocumentManager';
import BillingOptions from '@/components/admin/BillingOptions';
import { normalizeBilling } from '@/lib/documentPayments';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GalleryMedia from '@/components/GalleryMedia';
import { defaultSiteSettings, type SiteSettings } from '@/lib/siteSettings';
import { getCloudinaryPreviewUrl, getImagePreviewSrcSet } from '@/lib/mediaUrl';
import { fileFingerprint, uploadAdminFile } from '@/lib/adminUpload';
import { uploadPublicId } from '@/lib/uploadIdentity';
import { createSeoImageFilename } from '@/lib/imageSeo';
import { createDocumentSaveSession, enteredInvoiceItems, invoiceItemIssues, loadInvoiceWorkspace, mergeInvoiceDraftItems } from '@/lib/adminDocuments';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiChevronDown,
  FiCheckCircle,
  FiEdit3,
  FiImage,
  FiLock,
  FiTrash2,
  FiUnlock,
  FiUpload,
  FiXCircle,
} from 'react-icons/fi';

type Artwork = {
  id: number;
  title: string;
  price: number;
  image: string;
  category: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  is_featured: boolean;
  is_available: boolean;
};

type ArtworkEditForm = {
  title: string;
  price: string;
  image: string;
  category: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  isFeatured: boolean;
  isAvailable: boolean;
};

const createArtworkEditForm = (artwork: Artwork): ArtworkEditForm => ({
  title: artwork.title || '',
  price: String(artwork.price || ''),
  image: artwork.image || '',
  category: artwork.category || '',
  year: artwork.year || '',
  medium: artwork.medium || '',
  dimensions: artwork.dimensions || '',
  description: artwork.description || '',
  isFeatured: artwork.is_featured,
  isAvailable: artwork.is_available,
});

const createEmptyArtworkEditForm = (): ArtworkEditForm => ({
  title: '',
  price: '',
  image: '',
  category: '',
  year: '',
  medium: '',
  dimensions: '',
  description: '',
  isFeatured: false,
  isAvailable: false,
});

type DigitalProduct = {
  id: number;
  title: string;
  price: string;
  details: string;
  image: string;
  product_url: string;
  display_order: number;
  is_active: boolean;
};

type Gallery = {
  id: number;
  slug: string;
  access_code: string;
  client_name: string;
  images: string[];
  approved_images: string[];
  finished_images: string[];
  payment_verified: boolean;
  payment_url: string;
  review_rating: number | null;
  review_text: string;
  review_submitted_at: string | null;
  review_featured: boolean;
  gallery_design: 'editorial' | 'classic' | 'proofing';
  is_locked: boolean;
};

type GalleryDocument = ManagedDocument & {
  id: number;
  gallery_id: number;
  document_type: 'invoice' | 'contract';
  title: string;
  client_email: string;
  amount: string | number;
  currency: string;
  due_date: string;
  line_items: string;
  terms: string;
  sent_at: string | null;
  paid_at?: string | null;
  receipt_sent_at?: string | null;
  created_at: string;
};

type GalleryDocumentForm = {
  documentType: 'invoice' | 'contract';
  depositType: 'fixed' | 'percent';
  depositValue: string;
  sessionDate: string;
  addAgreement: boolean;
  agreementScope: string;
  agreementTerms: string;
  clientEmail: string;
  title: string;
  currency: string;
  dueDate: string;
  items: InvoiceLineItemForm[];
  discountType: 'fixed' | 'percent';
  discountValue: string;
  taxRate: string;
  lineItems: string;
  terms: string;
};

type InvoiceLineItemForm = {
  description: string;
  quantity: string;
  unitPrice: string;
};

type PhotographyCatalogImage = {
  id: number;
  category_id: number;
  image_url: string;
  title: string;
  alt_text: string;
  display_order: number;
};

type PhotographyCatalogCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  cover_image_url: string;
  display_order: number;
  is_active: boolean;
  images: PhotographyCatalogImage[];
};

type Content = {
  homepage: { heroText: string; heroImage: string };
  about: { text: string; image: string };
  settings: SiteSettings;
};

type Contact = { phone: string; email: string; address: string };
type Social = { id: number; platform: string; url: string; icon?: string };
type Order = { id: number; items: unknown[]; total_price: number; status: string; customer_email: string };
type Booking = {
  id: number;
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  booking_date: string;
  booking_time: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  manage_token: string;
  client_notes: string;
  internal_notes: string;
  gallery_id: number | null;
  confirmation_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_day_sent_at: string | null;
  created_at: string;
};
type BookingEditForm = {
  status: string;
  clientNotes: string;
  internalNotes: string;
  galleryId: string;
};
type AdminSection = 'invoices' | 'bookings' | 'artwork' | 'digital-products' | 'catalog' | 'galleries' | 'content-contact' | 'orders';
type UploadBatchResult = { urls: string[]; failedFiles: File[] };
type UploadProgress = { current: number; total: number; percent: number; phase: 'preparing' | 'uploading' | 'processing' | 'saving' };

const defaultAdminContent: Content = {
  homepage: { heroText: '', heroImage: '' },
  about: { text: '', image: '' },
  settings: defaultSiteSettings,
};

const defaultAdminContact: Contact = { phone: '', email: '', address: '' };

const adminSections: Array<{
  id: AdminSection;
  title: string;
  description: string;
  href: string;
}> = [
  { id: 'invoices', title: 'Invoices', description: 'Create, find, and send invoices across all clients.', href: '/admin/invoices' },
  { id: 'bookings', title: 'Bookings', description: 'Run client requests, reminders, portal notes, and project handoff.', href: '/admin/bookings' },
  { id: 'artwork', title: 'Artwork', description: 'Create and manage fine art catalogue entries.', href: '/admin/artwork' },
  { id: 'digital-products', title: 'Digital Products', description: 'Manage downloadable products and assets.', href: '/admin/digital-products' },
  { id: 'catalog', title: 'Photography Catalog', description: 'Upload and organize portfolio categories.', href: '/admin/catalog' },
  { id: 'galleries', title: 'Client Galleries', description: 'Manage client images, delivery, and gallery access.', href: '/admin/galleries' },
  { id: 'content-contact', title: 'Content & Contact', description: 'Update homepage copy, contact details, and socials.', href: '/admin/content-contact' },
  { id: 'orders', title: 'Orders', description: 'Review and update customer order status.', href: '/admin/orders' },
];

const sectionCard = 'min-w-0 bg-black/20 p-5 sm:p-7 md:p-9 border border-white/10 space-y-7';
const label = 'text-[10px] uppercase tracking-[0.18em] text-white/40 sm:tracking-widest';
const inputClass =
  'min-w-0 w-full rounded-sm bg-white/[0.05] border border-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:border-accent focus:bg-white/[0.07] outline-none transition-colors';
const mediaAccept = 'image/*,video/*';
const uploadConcurrency = 2;
const uploadSaveChunkSize = 25;
const maxCloudinaryFreeUploadBytes = 10 * 1024 * 1024;
const compressedImageQuality = 0.82;
const compressedImageMaxDimension = 2400;

const defaultDocumentForm: GalleryDocumentForm = {
  documentType: 'invoice',
  depositType: 'fixed',
  depositValue: '',
  sessionDate: '',
  addAgreement: false,
  agreementScope: '',
  agreementTerms: '',
  clientEmail: '',
  title: '',
  currency: 'NGN',
  dueDate: '',
  items: [{ description: '', quantity: '1', unitPrice: '' }],
  discountType: 'fixed',
  discountValue: '',
  taxRate: '',
  lineItems: '',
  terms: '',
};

function getDefaultInvoiceItems(form?: Partial<GalleryDocumentForm>) {
  return form?.items?.length ? form.items : defaultDocumentForm.items;
}

function normalizeDocumentLines(value: string, fallback: string) {
  return (value || fallback)
    .replace(/\\n/g, '\n')
    .replace(/\s+[-•]\s+/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function toFiniteNumber(value: string | number) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isValidDateInput(value: string) {
  if (!value) return true;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
}

function formatBookingDateTime(value: string) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value));
}

function getBookingPortalUrl(token: string) {
  if (!token) return '/client/booking';
  if (typeof window === 'undefined') return `/client/booking/${token}`;
  return `${window.location.origin}/client/booking/${token}`;
}

function createBookingEditForm(booking: Booking): BookingEditForm {
  return {
    status: booking.status || 'pending',
    clientNotes: booking.client_notes || '',
    internalNotes: booking.internal_notes || '',
    galleryId: booking.gallery_id ? String(booking.gallery_id) : '',
  };
}

async function readJsonResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => ({})) as { error?: unknown };
  if (!res.ok) {
    const error = typeof data.error === 'string' ? data.error : fallbackMessage;
    throw new Error(error);
  }
  return data as T;
}

function formatDocumentAmount(amount: string | number, currency: string, zeroLabel = 'To be confirmed') {
  const numeric = toFiniteNumber(amount);
  if (!Number.isFinite(numeric) || numeric < 0) return zeroLabel;
  return `${(currency || 'NGN').trim().toUpperCase()} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function calculateInvoice(form: GalleryDocumentForm) {
  const items = enteredInvoiceItems(getDefaultInvoiceItems(form))
    .map((item) => {
      const description = item.description.trim();
      const quantity = Math.max(0, toFiniteNumber(item.quantity));
      const unitPrice = Math.max(0, toFiniteNumber(item.unitPrice));
      return {
        description,
        quantity,
        unitPrice,
        total: Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100,
      };
    })
    .filter((item) => item.description || item.quantity > 0 || item.unitPrice > 0);

  const subtotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const rawDiscount = Math.max(0, toFiniteNumber(form.discountValue));
  const discountUnrounded =
    form.discountType === 'percent'
      ? Math.min(subtotal, subtotal * Math.min(rawDiscount, 100) / 100)
      : Math.min(subtotal, rawDiscount);
  const discount = Math.round(discountUnrounded * 100) / 100;
  const taxableSubtotal = Math.round(Math.max(0, subtotal - discount) * 100) / 100;
  const taxRate = Math.max(0, toFiniteNumber(form.taxRate));
  const tax = Math.round(taxableSubtotal * taxRate) / 100;
  const total = Math.round((taxableSubtotal + tax) * 100) / 100;

  return { items, subtotal, discount, taxableSubtotal, taxRate, tax, total };
}

function getDocumentFormIssues(form: GalleryDocumentForm) {
  const issues: string[] = [];
  const email = form.clientEmail.trim();
  const currency = form.currency.trim();
  const calculation = calculateInvoice(form);

  if (!email) issues.push('Add client email.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Use a valid client email.');
  if (currency && !/^[A-Z]{3,5}$/.test(currency.toUpperCase())) issues.push('Currency should be 3 to 5 letters.');
  if (!isValidDateInput(form.dueDate)) issues.push('Choose a valid due date.');
  if (form.title.length > 140) issues.push('Keep the title under 140 characters.');
  if (form.lineItems.length > 3000) issues.push('Line items are too long.');
  if (form.terms.length > 3000) issues.push('Terms are too long.');
  if (form.documentType === 'contract') {
    if (!form.lineItems.trim()) issues.push('Add the contract scope.');
    if (!form.terms.trim()) issues.push('Add the contract terms.');
  }
  if (form.documentType === 'invoice') {
    if (!Number.isFinite(Number(form.discountValue)) || !Number.isFinite(Number(form.taxRate))) issues.push('Enter valid discount and tax numbers.');
    if (form.discountType === 'fixed' && Number(form.discountValue) > calculation.subtotal) issues.push('Discount cannot exceed the subtotal.');
    if (!Number.isFinite(calculation.total) || calculation.subtotal > Number.MAX_SAFE_INTEGER / 100 || calculation.total > Number.MAX_SAFE_INTEGER / 100) issues.push('Invoice amounts are too large.');
    issues.push(...invoiceItemIssues(getDefaultInvoiceItems(form)));
    try { normalizeBilling(form, calculation.total); } catch (error) { issues.push((error as Error).message); }
    if (Number(form.taxRate) > 100) issues.push('Tax cannot exceed 100%.');
    if (form.discountValue && toFiniteNumber(form.discountValue) < 0) issues.push('Discount cannot be negative.');
    if (form.taxRate && toFiniteNumber(form.taxRate) < 0) issues.push('Tax cannot be negative.');
    if (form.discountType === 'percent' && toFiniteNumber(form.discountValue) > 100) issues.push('Percent discount cannot exceed 100%.');
  }

  return issues;
}

function DocumentPreview({ gallery, form }: { gallery: Gallery; form: GalleryDocumentForm }) {
  const labelText = form.documentType === 'contract' ? 'Contract' : 'Invoice';
  const label = labelText.toUpperCase();
  const calculation = calculateInvoice(form);
  const amount = formatDocumentAmount(calculation.total, form.currency);
  const lines = form.documentType === 'invoice'
    ? calculation.items
    : (form.lineItems || 'Photography service agreement and creative usage terms.').split('\n').map((line) => ({ description: line, quantity: 1, unitPrice: 0, total: 0 }));
  const dueDate = form.dueDate || 'On receipt';
  const title = form.title.trim() || `Photography ${labelText}`;
  const email = form.clientEmail.trim() || 'client@email.com';
  const terms = form.terms.trim() || 'Contract terms, usage rights, payment, and delivery notes will appear here.';

  return (
    <aside className="min-w-0 overflow-hidden border border-white/10 bg-[#151618] text-[#eeeae5] shadow-2xl" style={{ colorScheme: 'dark' }}>
      <div className="h-1 bg-[#920110]" />
      <div className="flex min-w-0 flex-col gap-7 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6 pb-3">
          <div>
            <p className="text-sm font-semibold">MOYO AYAWORAN<span className="text-[#d44958]">.</span></p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#a5a5ab]">Photography & Fine Art<br />ijabikenm@gmail.com</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-light tracking-[0.18em] sm:text-3xl">{label}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#a5a5ab]">Draft · Live preview</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5 border-y border-white/10 py-5 text-xs">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#a5a5ab]">{form.documentType === 'contract' ? 'Prepared for' : 'Billed to'}</p>
            <p className="mt-2 font-semibold [overflow-wrap:anywhere]">{gallery.client_name || 'Client'}</p>
            <p className="mt-1 text-[#a5a5ab] [overflow-wrap:anywhere]">{email}</p>
          </div>
          {form.documentType === 'invoice' && <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[9px] uppercase tracking-[0.2em] text-[#a5a5ab]">Currency</p><p className="mt-2">{form.currency || 'NGN'}</p></div>
            <div><p className="text-[9px] uppercase tracking-[0.2em] text-[#a5a5ab]">Due by</p><p className="mt-2 [overflow-wrap:anywhere]">{dueDate}</p></div>
          </div>}
        </div>
        <div className="min-w-0">
          <p className="mb-4 text-xs text-[#a5a5ab] [overflow-wrap:anywhere]">{title}</p>
          {form.documentType === 'contract' ? <div className="space-y-3 text-xs leading-relaxed [overflow-wrap:anywhere]"><p className="text-[9px] uppercase tracking-[0.2em] text-[#a5a5ab]">Scope of work</p>{lines.map((line, index) => <p key={index}>{line.description}</p>)}</div> : <table className="w-full table-fixed text-left text-[11px]">
            <thead className="border-b border-white/10 text-[8px] uppercase tracking-[0.16em] text-[#a5a5ab]">
              <tr><th className="w-[40%] pb-3 font-normal">Item</th><th className="w-[10%] pb-3 text-right font-normal">Qty</th><th className="w-[25%] pb-3 text-right font-normal">Rate</th><th className="w-[25%] pb-3 text-right font-normal">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {lines.map((line, index) => (
                <tr key={index} className="align-top">
                  <td className="py-4 pr-3 leading-relaxed [overflow-wrap:anywhere]">{line.description || 'Untitled item'}</td>
                  <td className="py-4 text-right tabular-nums [overflow-wrap:anywhere]">{form.documentType === 'invoice' ? line.quantity : '—'}</td>
                  <td className="py-4 pl-2 text-right tabular-nums text-[#a5a5ab] [overflow-wrap:anywhere]">{form.documentType === 'invoice' ? formatDocumentAmount(line.unitPrice, form.currency) : '—'}</td>
                  <td className="py-4 pl-2 text-right tabular-nums [overflow-wrap:anywhere]">{form.documentType === 'invoice' ? formatDocumentAmount(line.total, form.currency) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
        {form.documentType === 'invoice' && (
          <div className="ml-auto grid w-full max-w-[280px] gap-3 text-xs tabular-nums text-[#a5a5ab]">
            <div className="flex justify-between gap-4"><span>Subtotal</span><span>{formatDocumentAmount(calculation.subtotal, form.currency)}</span></div>
            <div className="flex justify-between gap-4"><span>Discount</span><span>-{formatDocumentAmount(calculation.discount, form.currency, `${form.currency || 'NGN'} 0`)}</span></div>
            <div className="flex justify-between gap-4"><span>Tax {calculation.taxRate ? `(${calculation.taxRate}%)` : ''}</span><span>{formatDocumentAmount(calculation.tax, form.currency, `${form.currency || 'NGN'} 0`)}</span></div>
            <div className="flex justify-between gap-4 border-t border-[#920110] pt-4 text-base text-[#eeeae5]"><span>Total due</span><span className="font-semibold">{amount}</span></div>
            {Number(form.depositValue) > 0 && <><div className="flex justify-between gap-4"><span>Booking deposit</span><span>{formatDocumentAmount(form.depositType === 'percent' ? Math.round(calculation.total * Number(form.depositValue)) / 100 : Number(form.depositValue), form.currency)}</span></div><p className="text-[11px] leading-relaxed">This deposit is part of the total. Booking is confirmed after the required payment is received and the session date is agreed.</p></>}
            {form.sessionDate && <p>Agreed session: {form.sessionDate}</p>}
            {form.addAgreement && <p>Separate agreement attached when emailed.</p>}
          </div>
        )}
        <div className="mt-3 border-t border-white/10 pt-5">
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#a5a5ab]">{form.documentType === 'contract' ? 'Terms' : 'Payment & Terms'}</p>
          {form.documentType === 'invoice' && <p className="mt-2 text-xs text-[#eeeae5]">Bank transfer / studio confirmation</p>}
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-[#a5a5ab] [overflow-wrap:anywhere]">{terms}</p>
        </div>
        <p className="pt-6 text-[9px] uppercase tracking-[0.2em] text-[#a5a5ab]">Thank you for creating with Moyo Ayaworan.<br /><br />Ijabiken Moyosoreoluwa<br />Creative Director, MOYO AYAWORAN</p>
      </div>
    </aside>
  );
}

function fileIdentity(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeSelectedFiles(existing: File[] | undefined, incoming: File[]) {
  const seen = new Set((existing || []).map(fileIdentity));
  return [...(existing || []), ...incoming.filter((file) => {
    const key = fileIdentity(file);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isCompressibleImage(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

function loadUploadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not prepare ${file.name}`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function prepareUploadFile(file: File, options: { preserveOriginal?: boolean } = {}) {
  if (options.preserveOriginal) {
    return { file, changed: false };
  }

  if (!isCompressibleImage(file)) {
    return { file, changed: false };
  }

  try {
    const image = await loadUploadImage(file);
    const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
    const shouldResize = maxSide > compressedImageMaxDimension;
    const shouldCompress = file.size > maxCloudinaryFreeUploadBytes || shouldResize;

    if (!shouldCompress) {
      return { file, changed: false };
    }

    const scale = shouldResize ? compressedImageMaxDimension / maxSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      return { file, changed: false };
    }

    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/jpeg', compressedImageQuality);
    if (!blob || blob.size >= file.size) {
      return { file, changed: false };
    }

    const preparedName = file.name.replace(/\.[^.]+$/, '') || 'upload';
    return {
      file: new File([blob], `${preparedName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified }),
      changed: true,
      originalSize: file.size,
      preparedSize: blob.size,
    };
  } catch (error) {
    console.warn('[admin] upload preparation skipped', error);
    return { file, changed: false };
  }
}

function renameFileForSeo(file: File, parts: Array<string | number | null | undefined>, index: number) {
  const filename = createSeoImageFilename(file.name, parts, index);
  if (filename === file.name) return file;
  return new File([file], filename, { type: file.type, lastModified: file.lastModified });
}

const adminToggleClass = 'flex min-w-0 items-center justify-between gap-4 border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/60';

function AdminAccordionPanel({
  id,
  title,
  summary,
  openSection,
  onOpen,
  children,
}: {
  id: AdminSection;
  title: string;
  summary: string;
  openSection: AdminSection | null;
  onOpen: (section: AdminSection | null) => void;
  children: React.ReactNode;
}) {
  const isOpen = openSection === id;
  const panelId = `admin-panel-${id}`;
  const buttonId = `admin-panel-${id}-button`;

  return (
    <div className={`min-w-0 overflow-hidden border transition-colors ${isOpen ? 'border-accent/35 bg-accent/[0.03]' : 'border-white/10 bg-white/[0.02]'}`}>
      <button
        type="button"
        id={buttonId}
        aria-controls={panelId}
        aria-expanded={isOpen}
        onClick={() => onOpen(isOpen ? null : id)}
        className="flex w-full items-center justify-between gap-4 px-4 py-5 text-left transition-colors hover:bg-white/[0.04] sm:gap-6 sm:px-5 md:px-7"
      >
        <span className="min-w-0 space-y-1">
          <span className={`block break-words font-heading text-xl italic sm:text-2xl ${isOpen ? 'text-accent' : 'text-white'}`}>
            {title}
          </span>
          <span className="block break-words text-[9px] uppercase tracking-[0.18em] text-white/35 sm:text-[10px] sm:tracking-[0.3em]">
            {summary}
          </span>
        </span>
        <FiChevronDown
          className={`shrink-0 text-xl transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : 'text-white/40'}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="min-w-0 border-t border-white/10 px-4 py-6 sm:px-5 sm:py-8 md:px-7">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminPreviewImage({
  src,
  srcSet,
  alt,
  className,
}: {
  src: string;
  srcSet?: string;
  alt: string;
  className: string;
}) {
  return (
    // Admin previews accept arbitrary pasted image URLs, so Next image optimization is intentionally bypassed here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={srcSet} alt={alt} className={className} loading="lazy" decoding="async" />
  );
}

export default function AdminPage() {
  const pathname = usePathname();
  const activeRouteSection = useMemo(() => {
    const slug = pathname.split('/').filter(Boolean)[1];
    return adminSections.find((section) => section.id === slug)?.id || null;
  }, [pathname]);
  const isSectionRoute = Boolean(activeRouteSection);
  const [adminKey, setAdminKey] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [uploadingTargets, setUploadingTargets] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const activeTransfers = useRef(new Set<string>());
  const activeUploadActions = useRef(new Set<string>());
  const uploadedAssets = useRef(new Map<string, Promise<string>>());
  const [updatingGalleryIds, setUpdatingGalleryIds] = useState<Record<number, boolean>>({});
  const [openAdminSection, setOpenAdminSection] = useState<AdminSection | null>(null);
  const displayedOpenSection = activeRouteSection || openAdminSection;
  const setDisplayedOpenSection = isSectionRoute ? (() => {}) : setOpenAdminSection;
  const shouldShowSection = (section: AdminSection) => activeRouteSection === section;

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [digitalProducts, setDigitalProducts] = useState<DigitalProduct[]>([]);
  const [documentFeedback, setDocumentFeedback] = useState<Record<number, { text: string; type: 'success' | 'error' }>>({});
  const documentSaveSessions = useRef(new Map<number, ReturnType<typeof createDocumentSaveSession>>());
  const activeDocumentSaves = useRef(new Set<number>());
  const [uncertainDocumentSaves, setUncertainDocumentSaves] = useState<Record<number, boolean>>({});
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceLoadError, setInvoiceLoadError] = useState('');
  const [invoiceGalleryId, setInvoiceGalleryId] = useState('');
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<PhotographyCatalogCategory[]>([]);
  const [content, setContent] = useState<Content>(defaultAdminContent);
  const [contact, setContact] = useState<Contact>(defaultAdminContact);
  const [socials, setSocials] = useState<Social[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [artForm, setArtForm] = useState({
    title: '',
    price: '',
    category: '',
    year: '',
    medium: '',
    dimensions: '',
    description: '',
    image: '',
    isFeatured: false,
    isAvailable: false,
  });
  const [editingArtworks, setEditingArtworks] = useState<Record<number, ArtworkEditForm>>({});
  const [editingBookings, setEditingBookings] = useState<Record<number, BookingEditForm>>({});
  const [editingArtworkId, setEditingArtworkId] = useState<number | null>(null);
  const [digitalProductForm, setDigitalProductForm] = useState({
    title: '',
    price: '',
    details: '',
    image: '',
    productUrl: '',
    displayOrder: '',
    isActive: true,
  });
  const [editingDigitalProducts, setEditingDigitalProducts] = useState<Record<number, {
    title: string;
    price: string;
    details: string;
    image: string;
    productUrl: string;
    displayOrder: string;
    isActive: boolean;
  }>>({});

  const [galleryForm, setGalleryForm] = useState({ clientName: '', slug: '', access_code: '', galleryDesign: 'editorial' });
  const [catalogCategoryForm, setCatalogCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    cover_image_url: '',
    display_order: '',
  });
  const [catalogImageForm, setCatalogImageForm] = useState({
    category_id: '',
    title: '',
    alt_text: '',
    image_url: '',
    display_order: '',
  });
  const [contentForm, setContentForm] = useState(content);
  const [contactForm, setContactForm] = useState(contact);
  const [socialForm, setSocialForm] = useState({ platform: '', url: '', icon: '' });
  const [editingSocials, setEditingSocials] = useState<Record<number, Social>>({});
  const [artworkFiles, setArtworkFiles] = useState<File[]>([]);
  const [digitalProductFile, setDigitalProductFile] = useState<File | null>(null);
  const [digitalProductAssetFile, setDigitalProductAssetFile] = useState<File | null>(null);
  const [catalogImageFiles, setCatalogImageFiles] = useState<File[]>([]);
  const [galleryUploads, setGalleryUploads] = useState<Record<string, File[]>>({});
  const [finishedGalleryUploads, setFinishedGalleryUploads] = useState<Record<string, File[]>>({});
  const [galleryPaymentUrls, setGalleryPaymentUrls] = useState<Record<string, string>>({});
  const [galleryDocuments, setGalleryDocuments] = useState<Record<number, GalleryDocument[]>>({});
  const [galleryDocumentForms, setGalleryDocumentForms] = useState<Record<number, GalleryDocumentForm>>({});
  const [documentActionIds, setDocumentActionIds] = useState<Record<string, boolean>>({});
  const [isAuthed, setIsAuthed] = useState(true);
  const [authChecking, setAuthChecking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [digitalProductPreview, setDigitalProductPreview] = useState<string | null>(null);
  const [catalogImagePreview, setCatalogImagePreview] = useState<string | null>(null);
  const artworkInputRef = useRef<HTMLInputElement | null>(null);
  const catalogImageInputRef = useRef<HTMLInputElement | null>(null);
  const isUploading = (target: string) => Boolean(uploadingTargets[target]);
  const getUploadTargetLabel = (target: string) => {
    if (target.startsWith('gallery-')) {
      const galleryId = Number(target.match(/^gallery-(\d+)/)?.[1]);
      const name = galleries.find((gallery) => gallery.id === galleryId)?.client_name || 'Client gallery';
      return `${name} · ${target.endsWith('-finished') ? 'Finished work' : 'Client media'}`;
    }
    return ({ 'artwork-image': 'Fine art catalogue', 'catalog-image': 'Photography catalogue', 'digital-product-image': 'Product image', 'digital-product-file': 'Product file' } as Record<string, string>)[target] || target.replace(/^content-/, '').replace(/-/g, ' ');
  };
  const getUploadProgressLabel = (target: string, label: string) => {
    const progress = uploadProgress[target];
    if (!progress) return label;
    const phase = progress.phase === 'saving' ? 'Saving' : progress.phase === 'processing' ? 'Processing' : progress.phase === 'preparing' ? 'Preparing' : label;
    return `${phase} ${progress.percent}% (${progress.current}/${progress.total})`;
  };
  const setTargetUploading = (target: string, value: boolean) => {
    setUploadingTargets((prev) => {
      const next = { ...prev };
      if (value) {
        next[target] = true;
      } else {
        delete next[target];
      }
      return next;
    });
    if (!value) {
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[target];
        return next;
      });
    }
  };
  const runUploadAction = async (target: string, action: () => Promise<void>) => {
    if (activeUploadActions.current.has(target) || activeTransfers.current.has(target)) return;
    activeUploadActions.current.add(target);
    setTargetUploading(target, true);
    try { await action(); }
    catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Unable to save. Please retry.', type: 'error' }); }
    finally { activeUploadActions.current.delete(target); setTargetUploading(target, false); }
  };

  const getUploadFilenameParts = (target: string) => {
    if (target === 'artwork-image') {
      return [artForm.title, artForm.medium, artForm.category, 'Moyo Ayaworan artwork'];
    }

    if (target === 'catalog-image') {
      const category = catalogCategories.find((item) => item.id === Number(catalogImageForm.category_id));
      return [
        catalogImageForm.alt_text || catalogImageForm.title,
        category?.name,
        'Moyo Ayaworan photograph',
      ];
    }

    if (target === 'digital-product-image') {
      return [digitalProductForm.title, digitalProductForm.details, 'Moyo Ayaworan digital product'];
    }

    if (target.startsWith('content-')) {
      return [target.replace(/^content-/, '').replace(/-/g, ' '), 'Moyo Ayaworan'];
    }

    if (target.startsWith('gallery-')) {
      const galleryId = Number(target.match(/^gallery-(\d+)/)?.[1]);
      const gallery = galleries.find((item) => item.id === galleryId);
      return [gallery?.client_name, target.includes('finished') ? 'finished work' : 'client gallery', 'Moyo Ayaworan'];
    }

    return ['Moyo Ayaworan image'];
  };

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-admin-key': adminKey || '',
    }),
    [adminKey]
  );

  const fetchAll = useCallback(async () => {
    if (!isAuthed) return;
    // Invoices must not depend on the shop, catalogue, or any unrelated endpoint.
    if (activeRouteSection === 'invoices') {
      setInvoiceLoading(true); setInvoiceLoadError('');
      try {
        const data = await loadInvoiceWorkspace<Gallery, GalleryDocument>(headers);
        setGalleries(data.galleries);
        setGalleryDocuments(data.documents.reduce<Record<number, GalleryDocument[]>>((acc, doc) => {
          (acc[doc.gallery_id] ||= []).push(doc); return acc;
        }, {}));
      } catch (error) {
        setInvoiceLoadError(error instanceof Error ? error.message : 'Could not load invoices. Please retry.');
      } finally { setInvoiceLoading(false); }
      return;
    }
    try {
      const [artRes, bookingRes, digitalRes, galRes, documentRes, contentRes, contactRes, socialRes, orderRes] = await Promise.all([
        fetch('/api/artworks'),
        fetch('/api/bookings?view=admin', { headers, credentials: 'same-origin' }),
        fetch('/api/digital-products'),
        fetch('/api/galleries', { headers, credentials: 'same-origin' }),
        fetch('/api/galleries/documents', { headers, credentials: 'same-origin' }),
        fetch('/api/content'),
        fetch('/api/contact'),
        fetch('/api/socials'),
        fetch('/api/orders', { headers, credentials: 'same-origin' }),
      ]);
      const catalogRes = await fetch('/api/photography-catalog/categories', { headers, credentials: 'same-origin' });

      const artData = await readJsonResponse<{ artworks?: Artwork[] }>(artRes, 'Failed to load artworks');
      const bookingData = await readJsonResponse<{ bookings?: Booking[] }>(bookingRes, 'Failed to load bookings');
      const digitalData = await readJsonResponse<{ products?: DigitalProduct[] }>(digitalRes, 'Failed to load digital products');
      const galData = await readJsonResponse<{ galleries?: Gallery[] }>(galRes, 'Failed to load galleries');
      const documentData = await readJsonResponse<{ documents?: GalleryDocument[] }>(documentRes, 'Failed to load documents');
      const conData = await readJsonResponse<{ content?: Content }>(contentRes, 'Failed to load content');
      const contactData = await readJsonResponse<{ contact?: Contact }>(contactRes, 'Failed to load contact');
      const socialData = await readJsonResponse<{ socials?: Social[] }>(socialRes, 'Failed to load socials');
      const orderData = await readJsonResponse<{ orders?: Order[] }>(orderRes, 'Failed to load orders');
      const catalogData = await readJsonResponse<{ categories?: PhotographyCatalogCategory[] }>(catalogRes, 'Failed to load catalog');

      setArtworks(artData.artworks || []);
      setBookings(bookingData.bookings || []);
      setEditingBookings(
        (bookingData.bookings || []).reduce((acc: Record<number, BookingEditForm>, booking: Booking) => {
          acc[booking.id] = createBookingEditForm(booking);
          return acc;
        }, {})
      );
      setEditingArtworks(
        (artData.artworks || []).reduce((acc: Record<number, ArtworkEditForm>, artwork: Artwork) => {
          acc[artwork.id] = createArtworkEditForm(artwork);
          return acc;
        }, {})
      );
      setDigitalProducts(digitalData.products || []);
      setEditingDigitalProducts(
        (digitalData.products || []).reduce((acc: Record<number, {
          title: string;
          price: string;
          details: string;
          image: string;
          productUrl: string;
          displayOrder: string;
          isActive: boolean;
        }>, product: DigitalProduct) => {
          acc[product.id] = {
            title: product.title || '',
            price: product.price || '',
            details: product.details || '',
            image: product.image || '',
            productUrl: product.product_url || '',
            displayOrder: String(product.display_order || 0),
            isActive: product.is_active,
          };
          return acc;
        }, {})
      );
      setGalleries(galData.galleries || []);
      setGalleryPaymentUrls(
        (galData.galleries || []).reduce((acc: Record<string, string>, gallery: Gallery) => {
          acc[gallery.id] = gallery.payment_url || '';
          return acc;
        }, {})
      );
      setGalleryDocuments(
        (documentData.documents || []).reduce((acc: Record<number, GalleryDocument[]>, document: GalleryDocument) => {
          acc[document.gallery_id] = [...(acc[document.gallery_id] || []), document];
          return acc;
        }, {})
      );
      setCatalogCategories(catalogData.categories || []);
      setContent(conData.content || defaultAdminContent);
      setContact(contactData.contact || defaultAdminContact);
      setSocials(socialData.socials || []);
      setOrders(orderData.orders || []);
      setContentForm(conData.content || defaultAdminContent);
      setContactForm(contactData.contact || defaultAdminContact);
      setEditingSocials(
        (socialData.socials || []).reduce((acc: Record<number, Social>, social: Social) => {
          if (social.id) acc[social.id] = { ...social };
          return acc;
        }, {})
      );
    } catch (error) {
      console.error(error);
      setMessage({ text: error instanceof Error ? error.message : 'Failed to load data', type: 'error' });
    }
  }, [headers, isAuthed, activeRouteSection]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const verifyAdminKey = async (keyToVerify: string) => {
    const submittedKey = keyToVerify.trim();
    setAuthError(null);
    setMessage(null);

    if (!submittedKey) {
      setIsAuthed(false);
      setAuthError('Enter the admin password');
      return false;
    }

    setAuthChecking(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': submittedKey,
        },
      });
      if (!res.ok) {
        setIsAuthed(false);
        setAuthError('Invalid admin password');
        return false;
      }
      setAdminKey(submittedKey);
      setIsAuthed(true);
      setMessage({ text: 'Admin unlocked', type: 'success' });
      return true;
    } catch {
      setIsAuthed(false);
      setAuthError('Unable to verify password');
      return false;
    } finally {
      setAuthChecking(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyAdminKey(adminKey);
  };

  const generateAccessCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  const uploadFiles = async (files: File[], target = 'upload'): Promise<UploadBatchResult> => {
    if (!files.length) return { urls: [], failedFiles: [] };
    if (activeTransfers.current.has(target)) return { urls: [], failedFiles: files };
    activeTransfers.current.add(target);
    const preserveOriginal = target.endsWith('-finished') || target === 'digital-product-file';
    setTargetUploading(target, true);
    const fractions = files.map(() => 0);
    let completedCount = 0;
    const report = (phase: UploadProgress['phase'] = 'uploading') => {
      const percent = Math.min(completedCount === files.length ? 100 : 99, Math.floor(fractions.reduce((sum, value) => sum + value, 0) / files.length));
      setUploadProgress((prev) => ({ ...prev, [target]: { current: completedCount, total: files.length, percent, phase } }));
    };
    report('preparing');
    const uploadedUrls: string[] = [];
    const failedFiles: File[] = [];
    const errors: string[] = [];
    try {
      const uploadSingleFile = async (file: File, index: number) => {
        try {
          if (!file.size) throw new Error('This file is empty.');
          if (file.size > 100 * 1024 * 1024) throw new Error('This file exceeds 100 MB. Export a smaller file.');
          const seoNamedFile = renameFileForSeo(file, getUploadFilenameParts(target), index);
          const prepared = await prepareUploadFile(seoNamedFile, { preserveOriginal });
          const hash = await fileFingerprint(prepared.file);
          const cacheKey = uploadPublicId(hash, prepared.file.name, prepared.file.type);
          let transfer = uploadedAssets.current.get(cacheKey);
          if (!transfer) {
            transfer = uploadAdminFile(prepared.file, adminKey, hash, (percent) => {
              fractions[index] = percent;
              report(percent === 100 ? 'processing' : 'uploading');
            });
            uploadedAssets.current.set(cacheKey, transfer);
            transfer.catch(() => uploadedAssets.current.delete(cacheKey));
          }
          const url = await transfer;
          fractions[index] = 100;
          return { url, file };
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`);
          return { url: null, file };
        } finally {
          completedCount += 1;
          report();
        }
      };
      for (let start = 0; start < files.length; start += uploadConcurrency) {
        const results = await Promise.all(files.slice(start, start + uploadConcurrency).map((file, index) => uploadSingleFile(file, start + index)));
        for (const result of results) {
          if (result.url) uploadedUrls.push(result.url);
          else failedFiles.push(result.file);
        }
      }
      if (errors.length) setMessage({ text: errors.join(' '), type: 'error' });
      report('saving');
      return { urls: uniqueStrings(uploadedUrls), failedFiles };
    } finally {
      activeTransfers.current.delete(target);
      if (!activeUploadActions.current.has(target)) setTargetUploading(target, false);
    }
  };

  const handleUpload = async (file: File, target?: string) => {
    const { urls } = await uploadFiles([file], target);
    return urls[0] || null;
  };

  const getSelectedFileLabel = (files: File[] | undefined, fallback: string) => {
    if (!files?.length) return fallback;
    if (files.length === 1) return files[0].name;
    return `${files.length} files selected`;
  };

  const handleArtworkFileChange = (files: File[]) => {
    const nextFiles = mergeSelectedFiles(artworkFiles, files);
    setArtworkFiles(nextFiles);
    if (!nextFiles.length) {
      setImagePreview(artForm.image || null);
      return;
    }

    const localPreview = URL.createObjectURL(nextFiles[0]);
    setImagePreview(localPreview);
  };

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    return () => {
      if (digitalProductPreview && digitalProductPreview.startsWith('blob:')) {
        URL.revokeObjectURL(digitalProductPreview);
      }
    };
  }, [digitalProductPreview]);

  useEffect(() => {
    return () => {
      if (catalogImagePreview && catalogImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(catalogImagePreview);
      }
    };
  }, [catalogImagePreview]);

  const handleCatalogImageFileChange = async (files: File[]) => {
    const nextFiles = mergeSelectedFiles(catalogImageFiles, files);
    setCatalogImageFiles(nextFiles);
    if (!nextFiles.length) {
      setCatalogImagePreview(catalogImageForm.image_url || null);
      return;
    }
    const localPreview = URL.createObjectURL(nextFiles[0]);
    setCatalogImagePreview(localPreview);

    if (!isAuthed) {
      setMessage({ text: 'Add admin password first', type: 'error' });
      return;
    }
  };

  const handleDigitalProductFileChange = async (file: File | null) => {
    setDigitalProductFile(file);
    if (!file) {
      setDigitalProductPreview(digitalProductForm.image || null);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setDigitalProductPreview(localPreview);

    if (!isAuthed) {
      setMessage({ text: 'Add admin password first', type: 'error' });
      return;
    }

    const url = await handleUpload(file, 'digital-product-image');
    if (url) {
      setDigitalProductForm((prev) => ({ ...prev, image: url }));
      setDigitalProductPreview(url);
      setMessage({ text: 'Digital product image uploaded', type: 'success' });
    }
  };

  const handleDigitalProductAssetChange = async (file: File | null) => {
    setDigitalProductAssetFile(file);
    if (!file) return;

    if (!isAuthed) {
      setMessage({ text: 'Add admin password first', type: 'error' });
      return;
    }

    const url = await handleUpload(file, 'digital-product-file');
    if (url) {
      setDigitalProductForm((prev) => ({ ...prev, productUrl: url }));
      setMessage({ text: 'Digital product file uploaded', type: 'success' });
    }
  };

  const uploadContentAsset = async (
    file: File | null,
    target: string,
    onUploaded: (url: string) => void,
    successMessage: string
  ) => {
    if (!file) return;
    if (!isAuthed) {
      setMessage({ text: 'Add admin password first', type: 'error' });
      return;
    }

    const url = await handleUpload(file, target);
    if (url) {
      onUploaded(url);
      setMessage({ text: successMessage, type: 'success' });
    }
  };

  const renderContentUploadField = ({
    labelText,
    value,
    target,
    onChange,
  }: {
    labelText: string;
    value: string;
    target: string;
    onChange: (url: string) => void;
  }) => (
    <div className="space-y-2">
      <label className={label}>{labelText}</label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL or upload a file"
        />
        <label
          className={`inline-flex cursor-pointer items-center justify-center gap-2 border border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent ${
            isUploading(target) ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <FiUpload aria-hidden="true" />
          <span>{isUploading(target) ? getUploadProgressLabel(target, 'Uploading') : 'Upload'}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading(target)}
            onChange={(e) => {
              void uploadContentAsset(
                e.target.files?.[0] || null,
                target,
                onChange,
                `${labelText} uploaded`
              );
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      {value && (
        <div className="overflow-hidden border border-white/10 bg-white/[0.04]">
          <AdminPreviewImage
            src={getCloudinaryPreviewUrl(value, { width: 720 })}
            srcSet={getImagePreviewSrcSet(value, [360, 720, 1080])}
            alt={`${labelText} preview`}
            className="h-40 w-full object-cover"
          />
          <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Preview</div>
        </div>
      )}
    </div>
  );

  const handleArtworkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    return runUploadAction('artwork-image', () => handleArtworkSubmitInternal(e));
  };

  const handleArtworkSubmitInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!isAuthed) return setMessage({ text: 'Sign in to the admin first', type: 'error' });

    let imageUrls = artForm.image.trim() ? [artForm.image.trim()] : [];
    let failedFiles: File[] = [];

    if (artworkFiles.length) {
      const uploaded = await uploadFiles(artworkFiles, 'artwork-image');
      imageUrls = [...imageUrls, ...uploaded.urls];
      failedFiles = uploaded.failedFiles;
    }

    imageUrls = uniqueStrings(imageUrls);
    if (!imageUrls.length) {
      return setMessage({ text: 'Upload artwork files or paste an image URL', type: 'error' });
    }

    const artworksPayload = imageUrls.map((imageUrl, index) => ({
      ...artForm,
      title:
        imageUrls.length > 1 && artForm.title
          ? `${artForm.title} ${index + 1}`
          : artForm.title || `Artwork ${artworks.length + index + 1}`,
      price: Number(artForm.price || 0),
      image: imageUrl,
    }));

    const res = await fetch('/api/artworks', {
      method: 'POST',
      headers,
      body: JSON.stringify(
        artworksPayload.length === 1 ? artworksPayload[0] : { artworks: artworksPayload }
      ),
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ text: data.error || 'Failed', type: 'error' });
    const createdArtworks = data.artworks || (data.artwork ? [data.artwork] : []);
    setArtworks((prev) => [...createdArtworks, ...prev].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index));
    setEditingArtworks((prev) => ({
      ...createdArtworks.reduce((acc: Record<number, ArtworkEditForm>, artwork: Artwork) => {
        acc[artwork.id] = createArtworkEditForm(artwork);
        return acc;
      }, {}),
      ...prev,
    }));
    setArtForm({
      title: '',
      price: '',
      category: '',
      year: '',
      medium: '',
      dimensions: '',
      description: '',
      image: '',
      isFeatured: false,
      isAvailable: false,
    });
    setArtworkFiles(failedFiles);
    if (artworkInputRef.current && !failedFiles.length) artworkInputRef.current.value = '';
    setImagePreview(failedFiles[0] ? URL.createObjectURL(failedFiles[0]) : null);
    setMessage({
      text: `${createdArtworks.length} ${createdArtworks.length === 1 ? 'artwork' : 'artworks'} saved${
        failedFiles.length ? `, ${failedFiles.length} ${failedFiles.length === 1 ? 'upload failed' : 'uploads failed'}` : ''
      }`,
      type: failedFiles.length ? 'error' : 'success',
    });
  };

  const toggleArtwork = async (id: number, field: 'isFeatured' | 'isAvailable', value: boolean) => {
    const res = await fetch('/api/artworks', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ id, [field]: value }),
    });
    const data = await res.json();
    if (res.ok) {
      setArtworks((prev) => prev.map((a) => (a.id === id ? data.artwork : a)));
      setEditingArtworks((prev) => ({ ...prev, [id]: createArtworkEditForm(data.artwork) }));
    }
  };

  const startEditingArtwork = (artwork: Artwork) => {
    setEditingArtworks((prev) => ({ ...prev, [artwork.id]: createArtworkEditForm(artwork) }));
    setEditingArtworkId(artwork.id);
  };

  const cancelEditingArtwork = (artwork: Artwork) => {
    setEditingArtworks((prev) => ({ ...prev, [artwork.id]: createArtworkEditForm(artwork) }));
    setEditingArtworkId(null);
  };

  const updateArtworkDraft = (id: number, updates: Partial<ArtworkEditForm>) => {
    setEditingArtworks((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || createEmptyArtworkEditForm()), ...updates },
    }));
  };

  const saveArtworkDetails = async (id: number) => {
    const draft = editingArtworks[id];
    if (!draft) return;

    const res = await fetch('/api/artworks', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        id,
        title: draft.title,
        price: Number(draft.price || 0),
        image: draft.image,
        category: draft.category,
        year: draft.year,
        medium: draft.medium,
        dimensions: draft.dimensions,
        description: draft.description,
        isFeatured: draft.isFeatured,
        isAvailable: draft.isAvailable,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setArtworks((prev) => prev.map((artwork) => (artwork.id === id ? data.artwork : artwork)));
      setEditingArtworks((prev) => ({ ...prev, [id]: createArtworkEditForm(data.artwork) }));
      setEditingArtworkId(null);
      setMessage({ text: 'Artwork details updated', type: 'success' });
    } else {
      setMessage({ text: data.error || 'Failed to update artwork', type: 'error' });
    }
  };

  const deleteArtwork = async (id: number) => {
    const res = await fetch(`/api/artworks?id=${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      setArtworks((prev) => prev.filter((a) => a.id !== id));
      setEditingArtworks((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (editingArtworkId === id) setEditingArtworkId(null);
    }
  };

  const createDigitalProduct = (e: React.FormEvent) => {
    e.preventDefault();
    return runUploadAction('digital-product-image', () => createDigitalProductInternal(e));
  };

  const createDigitalProductInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!isAuthed) return setMessage({ text: 'Sign in to the admin first', type: 'error' });

    let imageUrl = digitalProductForm.image;
    if (digitalProductFile && !imageUrl) {
      const url = await handleUpload(digitalProductFile, 'digital-product-image');
      if (!url) return;
      imageUrl = url;
    }

    if (!imageUrl) return setMessage({ text: 'Upload an image or paste an image URL', type: 'error' });

    const res = await fetch('/api/digital-products', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...digitalProductForm,
        image: imageUrl,
        displayOrder: Number(digitalProductForm.displayOrder || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ text: data.error || 'Failed to save digital product', type: 'error' });

    setDigitalProducts((prev) => [data.product, ...prev.filter((item) => item.id !== data.product.id)]);
    setEditingDigitalProducts((prev) => ({
      ...prev,
      [data.product.id]: {
        title: data.product.title || '',
        price: data.product.price || '',
        details: data.product.details || '',
        image: data.product.image || '',
        productUrl: data.product.product_url || '',
        displayOrder: String(data.product.display_order || 0),
        isActive: data.product.is_active,
      },
    }));
    setDigitalProductForm({ title: '', price: '', details: '', image: '', productUrl: '', displayOrder: '', isActive: true });
    setDigitalProductFile(null);
    setDigitalProductAssetFile(null);
    setDigitalProductPreview(null);
    setMessage({ text: 'Digital product saved', type: 'success' });
  };

  const updateDigitalProduct = async (id: number, updates?: Partial<{
    title: string;
    price: string;
    details: string;
    image: string;
    productUrl: string;
    displayOrder: string | number;
    isActive: boolean;
  }>) => {
    const current = editingDigitalProducts[id];
    if (!current && !updates) return;

    const payload = {
      id,
      ...(current || {}),
      ...(updates || {}),
    };

    const res = await fetch('/api/digital-products', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...payload,
        displayOrder: Number(payload.displayOrder || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ text: data.error || 'Failed to update digital product', type: 'error' });

    setDigitalProducts((prev) => prev.map((product) => (product.id === id ? data.product : product)));
    setEditingDigitalProducts((prev) => ({
      ...prev,
      [id]: {
        title: data.product.title || '',
        price: data.product.price || '',
        details: data.product.details || '',
        image: data.product.image || '',
        productUrl: data.product.product_url || '',
        displayOrder: String(data.product.display_order || 0),
        isActive: data.product.is_active,
      },
    }));
    setMessage({ text: 'Digital product updated', type: 'success' });
  };

  const deleteDigitalProduct = async (id: number) => {
    const res = await fetch(`/api/digital-products?id=${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      setDigitalProducts((prev) => prev.filter((product) => product.id !== id));
      setEditingDigitalProducts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMessage({ text: 'Digital product deleted', type: 'success' });
    }
  };

  const createGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) return setMessage({ text: 'Sign in to the admin first', type: 'error' });
    const res = await fetch('/api/galleries', {
      method: 'POST',
      headers,
      body: JSON.stringify(galleryForm),
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ text: data.error || 'Failed', type: 'error' });
    setGalleries((prev) => [data.gallery, ...prev]);
    setGalleryPaymentUrls((prev) => ({ ...prev, [data.gallery.id]: data.gallery.payment_url || '' }));
    setGalleryForm({ clientName: '', slug: '', access_code: '', galleryDesign: 'editorial' });
    setMessage({ text: 'Gallery created', type: 'success' });
  };

  const updateGallery = async (id: string, action: string, payload?: Record<string, unknown>) => {
    const galleryId = Number(id);
    setUpdatingGalleryIds((prev) => ({ ...prev, [galleryId]: true }));
    try {
      const res = await fetch('/api/galleries', {
        method: 'PUT',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ id, action, payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.gallery) {
        setMessage({ text: data.error || 'Unable to update gallery', type: 'error' });
        return null;
      }

      setGalleries((prev) => prev.map((g) => (g.id === galleryId ? data.gallery : g)));
      setGalleryPaymentUrls((prev) => ({ ...prev, [id]: data.gallery.payment_url || '' }));
      if (action === 'lock' || action === 'unlock') {
        setMessage({ text: data.gallery.is_locked ? 'Gallery locked' : 'Gallery unlocked', type: 'success' });
      }
      return data.gallery as Gallery;
    } catch (error) {
      console.error('[admin] gallery update error', error);
      setMessage({ text: 'Unable to update gallery', type: 'error' });
      return null;
    } finally {
      setUpdatingGalleryIds((prev) => ({ ...prev, [galleryId]: false }));
    }
  };

  const updateGalleryImagesInChunks = async (id: number, action: 'addImages' | 'addFinishedImages', urls: string[]) => {
    let updatedGallery: Gallery | null = null;

    for (let start = 0; start < urls.length; start += uploadSaveChunkSize) {
      const chunk = urls.slice(start, start + uploadSaveChunkSize);
      const nextGallery = await updateGallery(id.toString(), action, { images: chunk });
      if (!nextGallery) return null;
      updatedGallery = nextGallery;
    }

    return updatedGallery;
  };

  const uploadGalleryImage = (id: number) => runUploadAction(`gallery-${id}-media`, () => uploadGalleryImageInternal(id));

  const uploadGalleryImageInternal = async (id: number) => {
    const files = galleryUploads[id] || [];
    if (!files.length) return setMessage({ text: 'Choose client media files first', type: 'error' });
    const target = `gallery-${id}-media`;
    const { urls, failedFiles } = await uploadFiles(files, target);
    if (!urls.length) return;
    const updatedGallery = await updateGalleryImagesInChunks(id, 'addImages', urls);
    if (!updatedGallery) return;
    setGalleryUploads((prev) => ({ ...prev, [id]: failedFiles }));
    if (!failedFiles.length) setMessage({
      text: `${urls.length} client media ${urls.length === 1 ? 'file' : 'files'} uploaded${failedFiles.length ? `, ${failedFiles.length} failed` : ''}`,
      type: failedFiles.length ? 'error' : 'success',
    });
  };

  const uploadFinishedGalleryImage = (id: number) => runUploadAction(`gallery-${id}-finished`, () => uploadFinishedGalleryImageInternal(id));

  const uploadFinishedGalleryImageInternal = async (id: number) => {
    const files = finishedGalleryUploads[id] || [];
    if (!files.length) return setMessage({ text: 'Choose finished work files first', type: 'error' });
    const target = `gallery-${id}-finished`;
    const { urls, failedFiles } = await uploadFiles(files, target);
    if (!urls.length) return;
    const updatedGallery = await updateGalleryImagesInChunks(id, 'addFinishedImages', urls);
    if (!updatedGallery) return;
    setFinishedGalleryUploads((prev) => ({ ...prev, [id]: failedFiles }));
    if (!failedFiles.length) setMessage({
      text: `${urls.length} finished work ${urls.length === 1 ? 'file' : 'files'} uploaded${failedFiles.length ? `, ${failedFiles.length} failed` : ''}`,
      type: failedFiles.length ? 'error' : 'success',
    });
  };

  const deleteGalleryUpload = async (id: number, image: string) => {
    const updatedGallery = await updateGallery(id.toString(), 'removeImages', { images: [image] });
    if (!updatedGallery) return;
    setMessage({ text: 'Gallery upload deleted', type: 'success' });
  };

  const saveGalleryPayment = async (gallery: Gallery, paymentVerified = gallery.payment_verified) => {
    await updateGallery(gallery.id.toString(), 'payment', {
      paymentVerified,
      paymentUrl: galleryPaymentUrls[gallery.id] ?? gallery.payment_url ?? '',
    });
  };

  const getGalleryDocumentForm = (gallery: Gallery): GalleryDocumentForm => ({
    ...defaultDocumentForm,
    ...galleryDocumentForms[gallery.id],
    title:
      galleryDocumentForms[gallery.id]?.title ||
      `Photography ${galleryDocumentForms[gallery.id]?.documentType === 'contract' ? 'Contract' : 'Invoice'}`,
  });

  const getGalleryDocumentFormById = (galleryId: number): GalleryDocumentForm => ({
    ...defaultDocumentForm,
    ...galleryDocumentForms[galleryId],
    title:
      galleryDocumentForms[galleryId]?.title ||
      `Photography ${galleryDocumentForms[galleryId]?.documentType === 'contract' ? 'Contract' : 'Invoice'}`,
  });

  const updateGalleryDocumentForm = (galleryId: number, patch: Partial<GalleryDocumentForm>) => {
    if (activeDocumentSaves.current.has(galleryId) || documentSaveSessions.current.get(galleryId)?.uncertain) return;
    setDocumentFeedback(prev => { const next = { ...prev }; delete next[galleryId]; return next; });
    setGalleryDocumentForms((prev) => ({
      ...prev,
      [galleryId]: {
        ...defaultDocumentForm,
        ...(prev[galleryId] || {}),
        ...patch,
      },
    }));
  };

  const updateGalleryDocumentItem = (galleryId: number, index: number, patch: Partial<InvoiceLineItemForm>) => {
    const form = getGalleryDocumentFormById(galleryId);
    const items = getDefaultInvoiceItems(form).map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    updateGalleryDocumentForm(galleryId, { items });
  };

  const addGalleryDocumentItem = (galleryId: number) => {
    const form = getGalleryDocumentFormById(galleryId);
    updateGalleryDocumentForm(galleryId, {
      items: [...getDefaultInvoiceItems(form), { description: '', quantity: '1', unitPrice: '' }],
    });
  };

  const removeGalleryDocumentItem = (galleryId: number, index: number) => {
    const gallery = galleries.find((item) => item.id === galleryId);
    if (!gallery) return;
    const form = getGalleryDocumentForm(gallery);
    const items = getDefaultInvoiceItems(form).filter((_, itemIndex) => itemIndex !== index);
    updateGalleryDocumentForm(galleryId, {
      items: items.length ? items : [{ description: '', quantity: '1', unitPrice: '' }],
    });
  };

  const updateSavedDocument = (document: GalleryDocument) => {
    setGalleryDocuments(prev => ({ ...prev, [document.gallery_id]: (prev[document.gallery_id] || []).map(item => item.id === document.id ? document : item) }));
  };

  const createGalleryDocument = async (gallery: Gallery) => {
    if (activeDocumentSaves.current.has(gallery.id)) return;
    const feedback = (value: { text: string; type: 'success' | 'error' }) => setDocumentFeedback(prev => ({ ...prev, [gallery.id]: value }));
    const form = getGalleryDocumentForm(gallery);
    const issues = getDocumentFormIssues(form);
    if (issues.length) return feedback({ text: issues[0], type: 'error' });

    const actionId = `create-${gallery.id}`;
    activeDocumentSaves.current.add(gallery.id);
    if (!documentSaveSessions.current.has(gallery.id)) documentSaveSessions.current.set(gallery.id, createDocumentSaveSession());
    const session = documentSaveSessions.current.get(gallery.id)!;
    setDocumentActionIds((prev) => ({ ...prev, [actionId]: true }));
    try {
      const document = await session.save<GalleryDocument>({
          galleryId: gallery.id,
          ...form,
          amount: form.documentType === 'invoice' ? calculateInvoice(form).total : 0,
          items: enteredInvoiceItems(getDefaultInvoiceItems(form)),
          lineItems: form.documentType === 'invoice' ? '' : form.lineItems,
        }, headers);
      setGalleryDocuments((prev) => ({
        ...prev,
        [gallery.id]: [document, ...(prev[gallery.id] || []).filter(item => item.id !== document.id)],
      }));
      setGalleryDocumentForms((prev) => ({ ...prev, [gallery.id]: defaultDocumentForm }));
      feedback({ text: `${form.documentType === 'contract' ? 'Contract' : 'Invoice'} created`, type: 'success' });
      setMessage({ text: `${form.documentType === 'contract' ? 'Contract' : 'Invoice'} Moyo-${document.id} saved. It has not been emailed yet.`, type: 'success' });
    } catch (error) {
      feedback({ text: error instanceof Error ? error.message : 'Unable to create document. Check your connection and try again.', type: 'error' });
    } finally {
      activeDocumentSaves.current.delete(gallery.id);
      setUncertainDocumentSaves(prev => ({ ...prev, [gallery.id]: session.uncertain }));
      setDocumentActionIds((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
    }
  };

  const generateGalleryDocumentDraft = async (gallery: Gallery) => {
    const form = getGalleryDocumentForm(gallery);
    const actionId = `generate-${gallery.id}`;
    setDocumentActionIds((prev) => ({ ...prev, [actionId]: true }));
    try {
      const res = await fetch('/api/galleries/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'generate',
          galleryId: gallery.id,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.draft) return setMessage({ text: data.error || 'Unable to draft with Gemini', type: 'error' });
      updateGalleryDocumentForm(gallery.id, {
        title: data.draft.title || form.title,
        ...(form.documentType === 'invoice'
          ? {
              items: mergeInvoiceDraftItems(getDefaultInvoiceItems(form), normalizeDocumentLines(data.draft.lineItems || form.lineItems, 'Photography services.')),
            }
          : { lineItems: data.draft.lineItems || form.lineItems }),
        terms: data.draft.terms || form.terms,
      });
      setMessage({ text: 'Gemini draft added. Review it before sending.', type: 'success' });
    } catch {
      setMessage({ text: 'Unable to draft document right now.', type: 'error' });
    } finally {
      setDocumentActionIds((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
    }
  };

  const sendGalleryDocument = async (document: GalleryDocument) => {
    const actionId = `send-${document.id}`;
    setDocumentActionIds((prev) => ({ ...prev, [actionId]: true }));
    try {
      const res = await fetch('/api/galleries/documents', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id: document.id, action: 'send', kind: document.viewKind, paymentId: document.paymentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.document) return setMessage({ text: data.error || 'Unable to send document', type: 'error' });
      setGalleryDocuments((prev) => ({
        ...prev,
        [document.gallery_id]: (prev[document.gallery_id] || []).map((item) =>
          item.id === document.id ? data.document : item
        ),
      }));
      setMessage({ text: 'Document accepted by the mail server for delivery', type: 'success' });
    } catch {
      setMessage({ text: 'Unable to send document. Check email settings and try again.', type: 'error' });
    } finally {
      setDocumentActionIds((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
    }
  };

  const downloadGalleryDocument = async (document: GalleryDocument) => {
    const actionId = `download-${document.id}`;
    setDocumentActionIds((prev) => ({ ...prev, [actionId]: true }));
    try {
      const res = await fetch(`/api/galleries/documents?id=${document.id}&format=pdf&kind=${document.viewKind || ''}&paymentId=${document.paymentId || ''}`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return setMessage({ text: data.error || 'Unable to download PDF', type: 'error' });
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFilename(`${document.viewKind || document.document_type}-${document.id}-${document.paymentId || document.title}`)}.pdf`;
      link.style.display = 'none';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage({ text: 'Unable to download PDF. Try again.', type: 'error' });
    } finally {
      setDocumentActionIds((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
    }
  };

  const deleteGalleryDocument = async (document: GalleryDocument) => {
    if (!window.confirm(`Permanently delete Moyo-${document.id}: ${document.title}? This also removes it from the client portal and cannot be undone.`)) return;
    const actionId = `delete-${document.id}`;
    setDocumentActionIds((prev) => ({ ...prev, [actionId]: true }));
    try {
      const res = await fetch(`/api/galleries/documents?id=${document.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) return setMessage({ text: data.error || 'Unable to delete document', type: 'error' });
      setGalleryDocuments((prev) => ({
        ...prev,
        [document.gallery_id]: (prev[document.gallery_id] || []).filter((item) => item.id !== document.id),
      }));
      setMessage({ text: 'Document deleted', type: 'success' });
    } catch {
      setMessage({ text: 'Unable to delete document. Try again.', type: 'error' });
    } finally {
      setDocumentActionIds((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
    }
  };

  const createCatalogCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) return setMessage({ text: 'Sign in to the admin first', type: 'error' });

    const res = await fetch('/api/photography-catalog/categories', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...catalogCategoryForm,
        display_order: Number(catalogCategoryForm.display_order || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ text: data.error || 'Failed to create category', type: 'error' });

    setCatalogCategories((prev) => [data.category, ...prev]);
    setCatalogCategoryForm({ name: '', slug: '', description: '', cover_image_url: '', display_order: '' });
    setMessage({ text: 'Photography category created', type: 'success' });
  };

  const updateCatalogCategoryCover = async (
    category: PhotographyCatalogCategory,
    coverImageUrl: string,
    options: { silent?: boolean } = {}
  ) => {
    const res = await fetch('/api/photography-catalog/categories', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...category, cover_image_url: coverImageUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (!options.silent) setMessage({ text: data.error || 'Failed to update display image', type: 'error' });
      return null;
    }

    setCatalogCategories((prev) =>
      prev.map((item) =>
        item.id === category.id
          ? { ...item, ...data.category, images: item.images }
          : item
      )
    );
    if (!options.silent) {
      setMessage({
        text: coverImageUrl ? 'Category display image updated' : 'Category display image cleared',
        type: 'success',
      });
    }
    return data.category as PhotographyCatalogCategory;
  };

  const toggleCatalogCategory = async (category: PhotographyCatalogCategory) => {
    const res = await fetch('/api/photography-catalog/categories', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...category, is_active: !category.is_active }),
    });
    const data = await res.json();
    if (res.ok) {
      setCatalogCategories((prev) =>
        prev.map((item) => (item.id === category.id ? { ...item, ...data.category } : item))
      );
    }
  };

  const deleteCatalogCategory = async (id: number) => {
    const res = await fetch(`/api/photography-catalog/categories?id=${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      setCatalogCategories((prev) => prev.filter((category) => category.id !== id));
      if (catalogImageForm.category_id === String(id)) {
        setCatalogImageForm((prev) => ({ ...prev, category_id: '' }));
      }
      setMessage({ text: 'Photography category deleted', type: 'success' });
    }
  };

  const createCatalogImage = (e: React.FormEvent) => {
    e.preventDefault();
    return runUploadAction('catalog-image', () => createCatalogImageInternal(e));
  };

  const createCatalogImageInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) return setMessage({ text: 'Sign in to the admin first', type: 'error' });
    if (!catalogImageForm.category_id) {
      return setMessage({ text: 'Choose a category first', type: 'error' });
    }

    let imageUrls = catalogImageForm.image_url.trim() ? [catalogImageForm.image_url.trim()] : [];
    let failedFiles: File[] = [];

    if (catalogImageFiles.length) {
      const uploaded = await uploadFiles(catalogImageFiles, 'catalog-image');
      imageUrls = [...imageUrls, ...uploaded.urls];
      failedFiles = uploaded.failedFiles;
    }
    imageUrls = uniqueStrings(imageUrls);

    if (!imageUrls.length) return setMessage({ text: 'Upload images or paste an image URL', type: 'error' });

    const selectedCategory = catalogCategories.find((category) => category.id === Number(catalogImageForm.category_id));
    const existingUrls = new Set((selectedCategory?.images || []).map((image) => image.image_url));
    const newImageUrls = imageUrls.filter((imageUrl) => !existingUrls.has(imageUrl));

    if (!newImageUrls.length) {
      setCatalogImageFiles(failedFiles);
      return setMessage({
        text: failedFiles.length
          ? `No new catalog images were added. ${failedFiles.length} ${failedFiles.length === 1 ? 'upload failed' : 'uploads failed'}.`
          : 'Those catalog images are already in this category.',
        type: 'error',
      });
    }

    const createdImages: PhotographyCatalogImage[] = [];
    let failedSaves = 0;
    for (const [index, imageUrl] of newImageUrls.entries()) {
      try {
        const res = await fetch('/api/photography-catalog/images', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...catalogImageForm,
            category_id: Number(catalogImageForm.category_id),
            title:
              newImageUrls.length > 1 && catalogImageForm.title
                ? `${catalogImageForm.title} ${index + 1}`
                : catalogImageForm.title,
            image_url: imageUrl,
            display_order: Number(catalogImageForm.display_order || 0) + index,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add image');
        createdImages.push(data.image);
      } catch (error) {
        console.error('[admin] catalog image save error', error);
        failedSaves += 1;
      }
    }

    if (!createdImages.length) {
      return setMessage({
        text: failedSaves ? 'Images uploaded, but none could be saved to the catalog' : 'No catalog images were added',
        type: 'error',
      });
    }

    setCatalogCategories((prev) =>
      prev.map((category) =>
        category.id === Number(catalogImageForm.category_id)
          ? {
              ...category,
              cover_image_url: category.cover_image_url || createdImages[0]?.image_url || '',
              images: [...(category.images || []), ...createdImages].filter(
                (image, index, images) =>
                  images.findIndex((item) => item.category_id === image.category_id && item.image_url === image.image_url) === index
              ),
            }
          : category
      )
    );
    if (selectedCategory && !selectedCategory.cover_image_url && createdImages[0]) {
      await updateCatalogCategoryCover(selectedCategory, createdImages[0].image_url, { silent: true });
    }
    setCatalogImageForm({ category_id: catalogImageForm.category_id, title: '', alt_text: '', image_url: '', display_order: '' });
    setCatalogImageFiles(failedSaves ? catalogImageFiles : failedFiles);
    if (catalogImageInputRef.current && !failedFiles.length && !failedSaves) catalogImageInputRef.current.value = '';
    setCatalogImagePreview(null);
    setMessage({
      text: `${createdImages.length} catalog ${createdImages.length === 1 ? 'image' : 'images'} added${
        failedFiles.length ? `, ${failedFiles.length} ${failedFiles.length === 1 ? 'upload failed' : 'uploads failed'}` : ''
      }${failedSaves ? `, ${failedSaves} ${failedSaves === 1 ? 'save failed' : 'saves failed'}` : ''}`,
      type: failedFiles.length || failedSaves ? 'error' : 'success',
    });
  };

  const deleteCatalogImage = async (id: number) => {
    const currentCategory = catalogCategories.find((category) => category.images.some((image) => image.id === id));
    const currentImage = currentCategory?.images.find((image) => image.id === id);
    const res = await fetch(`/api/photography-catalog/images?id=${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      const remainingImages = currentCategory?.images.filter((image) => image.id !== id) || [];
      setCatalogCategories((prev) =>
        prev.map((category) => ({
          ...category,
          cover_image_url:
            category.id === currentCategory?.id && category.cover_image_url === currentImage?.image_url
              ? remainingImages[0]?.image_url || ''
              : category.cover_image_url,
          images: category.images.filter((image) => image.id !== id),
        }))
      );
      if (currentCategory && currentCategory.cover_image_url === currentImage?.image_url) {
        await updateCatalogCategoryCover(currentCategory, remainingImages[0]?.image_url || '', { silent: true });
      }
      setMessage({ text: 'Catalog image deleted', type: 'success' });
    }
  };

  const saveContent = async () => {
    const res = await fetch('/api/content', { method: 'PUT', headers, body: JSON.stringify(contentForm) });
    const data = await res.json();
    if (res.ok) {
      setContent(data.content);
      setMessage({ text: 'Content saved', type: 'success' });
    } else setMessage({ text: data.error || 'Failed', type: 'error' });
  };

  const saveContact = async () => {
    const res = await fetch('/api/contact', { method: 'PUT', headers, body: JSON.stringify(contactForm) });
    const data = await res.json();
    if (res.ok) {
      setContact(data.contact);
      setMessage({ text: 'Contact saved', type: 'success' });
    } else setMessage({ text: data.error || 'Failed', type: 'error' });
  };

  const addSocial = async () => {
    const res = await fetch('/api/socials', { method: 'POST', headers, body: JSON.stringify(socialForm) });
    const data = await res.json();
    if (res.ok) {
      setSocials((p) => [data.social, ...p]);
      setEditingSocials((prev) => ({ ...prev, [data.social.id]: data.social }));
      setSocialForm({ platform: '', url: '', icon: '' });
    }
  };

  const updateSocial = async (id: number) => {
    const draft = editingSocials[id];
    if (!draft) return;
    const res = await fetch('/api/socials', { method: 'PUT', headers, body: JSON.stringify(draft) });
    const data = await res.json();
    if (res.ok) {
      setSocials((prev) => prev.map((social) => (social.id === id ? data.social : social)));
      setEditingSocials((prev) => ({ ...prev, [id]: data.social }));
      setMessage({ text: 'Social link updated', type: 'success' });
    } else {
      setMessage({ text: data.error || 'Failed to update social link', type: 'error' });
    }
  };

  const deleteSocial = async (id: string) => {
    const res = await fetch(`/api/socials?id=${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      setSocials((p) => p.filter((s) => s.id !== Number(id)));
      setEditingSocials((prev) => {
        const next = { ...prev };
        delete next[Number(id)];
        return next;
      });
    }
  };

  const updateOrder = async (id: string, status: string) => {
    const res = await fetch('/api/orders', { method: 'PUT', headers, body: JSON.stringify({ id, status }) });
    const data = await res.json();
    if (res.ok) setOrders((p) => p.map((o) => (o.id === Number(id) ? data.order : o)));
  };

  const updateBookingDraft = (id: number, patch: Partial<BookingEditForm>) => {
    const booking = bookings.find((item) => item.id === id);
    setEditingBookings((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          status: booking?.status || 'pending',
          clientNotes: booking?.client_notes || '',
          internalNotes: booking?.internal_notes || '',
          galleryId: booking?.gallery_id ? String(booking.gallery_id) : '',
        }),
        ...patch,
      },
    }));
  };

  const saveBooking = async (booking: Booking) => {
    const draft = editingBookings[booking.id] || createBookingEditForm(booking);
    const res = await fetch('/api/bookings', {
      method: 'PUT',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        id: booking.id,
        status: draft.status,
        clientNotes: draft.clientNotes,
        internalNotes: draft.internalNotes,
        galleryId: draft.galleryId ? Number(draft.galleryId) : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.booking) return setMessage({ text: data.error || 'Unable to update booking', type: 'error' });
    setBookings((prev) => prev.map((item) => (item.id === booking.id ? data.booking : item)));
    setEditingBookings((prev) => ({ ...prev, [booking.id]: createBookingEditForm(data.booking) }));
    setMessage({ text: 'Booking updated', type: 'success' });
  };

  const copyBookingPortal = async (booking: Booking) => {
    try {
      await navigator.clipboard.writeText(getBookingPortalUrl(booking.manage_token));
      setMessage({ text: 'Client portal link copied', type: 'success' });
    } catch {
      setMessage({ text: 'Unable to copy portal link', type: 'error' });
    }
  };

  const createGalleryFromBooking = async (booking: Booking) => {
    const accessCode = generateAccessCode();
    const slugBase = `${booking.name || 'client'}-${booking.id}`;
    const res = await fetch('/api/galleries', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        clientName: booking.name,
        slug: slugBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        access_code: accessCode,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.gallery) return setMessage({ text: data.error || 'Unable to create gallery', type: 'error' });
    setGalleries((prev) => [data.gallery, ...prev]);
    setGalleryPaymentUrls((prev) => ({ ...prev, [data.gallery.id]: data.gallery.payment_url || '' }));
    const draft = editingBookings[booking.id] || createBookingEditForm(booking);
    const bookingRes = await fetch('/api/bookings', {
      method: 'PUT',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        id: booking.id,
        status: draft.status === 'pending' ? 'confirmed' : draft.status,
        clientNotes: draft.clientNotes,
        internalNotes: draft.internalNotes,
        galleryId: data.gallery.id,
      }),
    });
    const bookingData = await bookingRes.json().catch(() => ({}));
    if (bookingRes.ok && bookingData.booking) {
      setBookings((prev) => prev.map((item) => (item.id === booking.id ? bookingData.booking : item)));
      setEditingBookings((prev) => ({ ...prev, [booking.id]: createBookingEditForm(bookingData.booking) }));
    }
    setMessage({ text: `Gallery created for ${booking.name}`, type: 'success' });
  };

  const renderDocumentEditor = (gal: Gallery) => {
    const docForm = getGalleryDocumentForm(gal);
    const saveLocked = Boolean(documentActionIds[`create-${gal.id}`] || documentActionIds[`generate-${gal.id}`] || uncertainDocumentSaves[gal.id]);
    return (
<div className="grid min-w-0 gap-4 border border-white/10 bg-white/[0.02] p-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)] xl:items-start">
                            <div className="grid min-w-0 gap-3">
                              <fieldset disabled={saveLocked} className="grid min-w-0 gap-3 disabled:opacity-65">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <p className="self-center text-sm text-white/75">Invoice · optional agreement below</p>
                                <input
                                  className={inputClass}
                                  type="email"
                                  aria-label="Client email"
                                  placeholder="Client email"
                                  value={docForm.clientEmail}
                                  onChange={(e) => updateGalleryDocumentForm(gal.id, { clientEmail: e.target.value })}
                                />
                              </div>
                              <input
                                className={inputClass}
                                maxLength={140}
                                placeholder="Document title"
                                value={docForm.title}
                                onChange={(e) => updateGalleryDocumentForm(gal.id, { title: e.target.value })}
                              />
                              <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                                {docForm.documentType === 'invoice' && <><input
                                  className={inputClass}
                                  aria-label="Invoice currency"
                                  maxLength={5}
                                  placeholder="NGN"
                                  value={docForm.currency}
                                  onChange={(e) => updateGalleryDocumentForm(gal.id, { currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
                                />
                                <input
                                  className={inputClass}
                                  type="date"
                                  aria-label="Invoice due date"
                                  value={docForm.dueDate}
                                  onChange={(e) => updateGalleryDocumentForm(gal.id, { dueDate: e.target.value })}
                                /></>}
                              </div>
                              {docForm.documentType === 'invoice' ? (
                                <div className="min-w-0 space-y-3 border border-white/10 bg-black/20 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Invoice items</p>
                                    <button
                                      type="button"
                                      onClick={() => addGalleryDocumentItem(gal.id)}
                                      className="border border-white/15 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:border-accent hover:text-accent"
                                    >
                                      Add item
                                    </button>
                                  </div>
                                  <div className="space-y-3">
                                    <p className="text-xs text-white/65">Describe each charged item. Completely blank extra rows are ignored.</p>
                                    {getDefaultInvoiceItems(docForm).map((item, index) => {
                                      const rowTotal = Math.max(0, toFiniteNumber(item.quantity)) * Math.max(0, toFiniteNumber(item.unitPrice));
                                      return (
                                        <div key={index} className="grid min-w-0 gap-2 border border-white/10 bg-white/[0.025] p-3">
                                          <div className="grid min-w-0 gap-3">
                                            <label className="block min-w-0 space-y-1 text-xs text-white/75">
                                              <span>Item {index + 1} description · required</span>
                                            <input
                                              className={inputClass}
                                              placeholder="e.g. Portrait session"
                                              aria-label={`Item ${index + 1} description`}
                                              maxLength={220}
                                              value={item.description}
                                              onChange={(e) => updateGalleryDocumentItem(gal.id, index, { description: e.target.value })}
                                            />
                                            </label>
                                            <div className="grid min-w-0 grid-cols-2 gap-3">
                                            <label className="block min-w-0 space-y-1 text-xs text-white/75">
                                              <span>Quantity · required</span>
                                            <input
                                              className={inputClass}
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              inputMode="decimal"
                                              placeholder="Qty"
                                              aria-label={`Item ${index + 1} quantity`}
                                              value={item.quantity}
                                              onChange={(e) => updateGalleryDocumentItem(gal.id, index, { quantity: e.target.value })}
                                            />
                                            </label>
                                            <label className="block min-w-0 space-y-1 text-xs text-white/75">
                                              <span>Unit price · required</span>
                                            <input
                                              className={inputClass}
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              inputMode="decimal"
                                              placeholder="Unit price"
                                              aria-label={`Item ${index + 1} unit price`}
                                              value={item.unitPrice}
                                              onChange={(e) => updateGalleryDocumentItem(gal.id, index, { unitPrice: e.target.value })}
                                            />
                                            </label>
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
                                            <span>Total: {formatDocumentAmount(rowTotal, docForm.currency, `${docForm.currency || 'NGN'} 0`)}</span>
                                            <button
                                              type="button"
                                              onClick={() => removeGalleryDocumentItem(gal.id, index)}
                                              className="text-[9px] uppercase tracking-[0.16em] text-red-300 transition-colors hover:text-red-200"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="grid min-w-0 gap-3">
                                    <BillingOptions value={docForm} onChange={change => updateGalleryDocumentForm(gal.id, change)} total={calculateInvoice(docForm).total} currency={docForm.currency} />
                                    <p className="text-xs text-white/65">Discount and tax are optional. Leave them blank for zero.</p>
                                    <label className="block min-w-0 space-y-1 text-xs text-white/75">
                                      <span>Discount type</span>
                                    <select
                                      className={inputClass}
                                      value={docForm.discountType}
                                      onChange={(e) => updateGalleryDocumentForm(gal.id, { discountType: e.target.value === 'percent' ? 'percent' : 'fixed' })}
                                    >
                                      <option value="fixed">Fixed discount</option>
                                      <option value="percent">Percent discount</option>
                                    </select>
                                    </label>
                                    <div className="grid min-w-0 grid-cols-2 gap-3">
                                    <label className="block min-w-0 space-y-1 text-xs text-white/75">
                                      <span>Discount{docForm.discountType === 'percent' ? ' %' : ''} · optional</span>
                                    <input
                                      className={inputClass}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={docForm.discountValue}
                                      onChange={(e) => updateGalleryDocumentForm(gal.id, { discountValue: e.target.value })}
                                    />
                                    </label>
                                    <label className="block min-w-0 space-y-1 text-xs text-white/75">
                                      <span>Tax % · optional</span>
                                    <input
                                      className={inputClass}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={docForm.taxRate}
                                      onChange={(e) => updateGalleryDocumentForm(gal.id, { taxRate: e.target.value })}
                                    />
                                    </label>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 border-t border-white/10 pt-3 text-xs text-white/55">
                                    <div className="flex justify-between gap-4">
                                      <span>Subtotal</span>
                                      <span>{formatDocumentAmount(calculateInvoice(docForm).subtotal, docForm.currency, `${docForm.currency || 'NGN'} 0`)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>Discount</span>
                                      <span>-{formatDocumentAmount(calculateInvoice(docForm).discount, docForm.currency, `${docForm.currency || 'NGN'} 0`)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>Tax</span>
                                      <span>{formatDocumentAmount(calculateInvoice(docForm).tax, docForm.currency, `${docForm.currency || 'NGN'} 0`)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-sm font-bold text-white">
                                      <span>Total due</span>
                                      <span className="text-accent">{formatDocumentAmount(calculateInvoice(docForm).total, docForm.currency)}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <textarea
                                  className={`${inputClass} min-h-28 resize-y`}
                                  maxLength={3000}
                                  placeholder="Contract terms / scope"
                                  value={docForm.lineItems}
                                  onChange={(e) => updateGalleryDocumentForm(gal.id, { lineItems: e.target.value })}
                                />
                              )}
                              <textarea
                                className={`${inputClass} min-h-24 resize-y`}
                                maxLength={3000}
                                placeholder="Contract terms, usage rights, payment terms, delivery notes..."
                                value={docForm.terms}
                                onChange={(e) => updateGalleryDocumentForm(gal.id, { terms: e.target.value })}
                              />
                              </fieldset>
                              {getDocumentFormIssues(docForm).length > 0 && (
                                <div className="space-y-1 border border-yellow-400/25 bg-yellow-400/[0.06] p-3 text-xs leading-relaxed text-yellow-100/80">
                                  {getDocumentFormIssues(docForm).map((issue) => (
                                    <p key={issue}>{issue}</p>
                                  ))}
                                </div>
                              )}
                              {documentFeedback[gal.id] && <p role={documentFeedback[gal.id].type === 'error' ? 'alert' : 'status'} className={`rounded border p-3 text-sm ${documentFeedback[gal.id].type === 'error' ? 'border-red-400/40 text-red-200' : 'border-green-400/40 text-green-200'}`}>{documentFeedback[gal.id].text}</p>}
                              <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                  type="button"
                                  disabled={saveLocked || Boolean(documentActionIds[`generate-${gal.id}`])}
                                  onClick={() => generateGalleryDocumentDraft(gal)}
                                  className="border border-accent/55 bg-accent/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {documentActionIds[`generate-${gal.id}`] ? 'Drafting...' : 'Draft with Gemini'}
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(documentActionIds[`create-${gal.id}`] || documentActionIds[`generate-${gal.id}`])}
                                  onClick={() => createGalleryDocument(gal)}
                                  className="bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-black transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {documentActionIds[`create-${gal.id}`] ? 'Saving...' : uncertainDocumentSaves[gal.id] ? 'Retry same document' : `Create ${docForm.documentType === 'contract' ? 'contract' : 'invoice'}`}
                                </button>
                              </div>
                            </div>
                            <DocumentPreview gallery={gal} form={docForm} />
                          </div>
    );
  };

  const getAdminSectionMetric = (section: AdminSection) => {
    if (section === 'bookings') return `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`;
    if (section === 'artwork') return `${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}`;
    if (section === 'digital-products') return `${digitalProducts.length} products`;
    if (section === 'catalog') return `${catalogCategories.length} categories`;
    if (section === 'invoices') return `${Object.values(galleryDocuments).flat().filter(doc => doc.document_type === 'invoice').length} invoices`;
    if (section === 'galleries') return `${galleries.length} galleries`;
    if (section === 'content-contact') return `${socials.length} social links`;
    return `${orders.length} orders`;
  };

  return (
    <>
      {!isAuthed && (
        <main className="min-h-screen bg-background text-foreground flex flex-col">
          <Navbar />
          <section className="flex-1 flex items-center justify-center px-6 pt-36 md:pt-52">
            <form
              onSubmit={handleAuthSubmit}
              className="w-full max-w-md space-y-6 bg-surface/40 border border-white/10 p-8 backdrop-blur-md"
            >
              <div className="space-y-2 text-center">
                <p className="text-accent text-[10px] tracking-[0.28em] uppercase sm:tracking-[0.5em]">Admin Access</p>
                <h1 className="text-3xl font-heading italic text-white">Enter page password</h1>
                <p className="text-white/50 text-sm">Required to unlock the control panel.</p>
              </div>
              <input
                type="password"
                className={`${inputClass}`}
                placeholder="Page password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
              />
              {authError && <p className="text-red-400 text-xs text-center">{authError}</p>}
              <button
                type="submit"
                disabled={authChecking}
                className="w-full bg-accent text-black py-3 text-[11px] uppercase tracking-[0.24em] font-semibold disabled:opacity-50 sm:tracking-[0.4em]"
              >
                {authChecking ? 'Checking...' : 'Unlock'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminKey('');
                  setIsAuthed(false);
                  setAuthError(null);
                }}
                className="w-full text-white/60 hover:text-white text-xs underline"
              >
                Clear password
              </button>
            </form>
          </section>
        </main>
      )}
      {isAuthed && (
    <main className="bg-background min-h-screen text-foreground font-body">
      <Navbar />

      <section className="container mx-auto min-w-0 px-4 pb-20 pt-32 sm:px-6 md:px-12 md:pt-52">
        <header className="mb-12 min-w-0 space-y-4 md:mb-16">
          <span className="text-accent text-[10px] tracking-[0.28em] uppercase sm:tracking-[0.5em]">Control Panel</span>
          <h1 className="text-4xl md:text-5xl font-heading text-white italic">
            {activeRouteSection ? adminSections.find((section) => section.id === activeRouteSection)?.title : 'Admin'}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/40 [overflow-wrap:anywhere]">
            Manage artworks, digital products, galleries, site copy, contact, socials and orders. All changes persist to the database and
            reflect on the live site.
          </p>
        </header>

        <div className="mb-10 grid min-w-0 gap-4 md:grid-cols-4">
          <div className="flex min-w-0 flex-wrap gap-3 text-xs text-white/50 md:col-span-3">
            <span className="px-3 py-2 border border-white/10 bg-white/5 uppercase tracking-[0.16em] sm:tracking-[0.25em]">
              Connected to PostgreSQL
            </span>
            <span className="px-3 py-2 border border-white/10 bg-white/5 uppercase tracking-[0.16em] sm:tracking-[0.25em]">
              Cloudinary uploads
            </span>
            <span className="px-3 py-2 border border-white/10 bg-white/5 uppercase tracking-[0.16em] sm:tracking-[0.25em]">
              API protected
            </span>
            <Link
              href="/admin/newsletter"
              className="px-3 py-2 border border-accent/30 bg-accent/10 text-accent uppercase tracking-[0.16em] hover:border-accent hover:bg-accent hover:text-black transition-colors sm:tracking-[0.25em]"
            >
              Newsletter Studio
            </Link>
            <Link
              href="/admin/catalog"
              className="inline-flex items-center gap-2 px-3 py-2 border border-accent/30 bg-accent/10 text-accent uppercase tracking-[0.16em] hover:border-accent hover:bg-accent hover:text-black transition-colors sm:tracking-[0.25em]"
            >
              <FiImage aria-hidden="true" />
              Upload Catalogue
            </Link>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="password"
              className={`${inputClass} text-xs`}
              placeholder="Admin key"
              value={adminKey}
              onChange={(e) => {
                setAdminKey(e.target.value);
                setIsAuthed(false);
              }}
            />
            <button
              onClick={async () => {
                await fetch('/api/admin/logout', { method: 'POST' }).catch(() => null);
                setAdminKey('');
                setIsAuthed(false);
                setAuthError(null);
                setMessage(null);
                window.location.href = '/admin/login';
              }}
              className="text-[10px] uppercase tracking-[0.2em] px-3 py-2 border border-white/10 text-white/60 hover:text-white sm:tracking-[0.3em]"
            >
              Lock
            </button>
          </div>
        </div>

        {Object.entries(uploadProgress).length > 0 && (
          <aside aria-label="Upload progress" className="sticky top-24 z-50 mb-6 space-y-4 border border-accent/30 bg-background p-5 shadow-lg">
            {Object.entries(uploadProgress).map(([target, progress]) => (
              <div key={target} className="space-y-2">
                <div className="flex justify-between gap-4 text-xs">
                  <span>{getUploadTargetLabel(target)}</span>
                  <span role="status">{getUploadProgressLabel(target, 'Uploading')}</span>
                </div>
                <div role="progressbar" aria-label={`${getUploadTargetLabel(target)} upload`} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden bg-surface">
                  <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress.percent}%` }} />
                </div>
                {progress.phase === 'saving' && <p className="text-xs text-foreground/60">Saving files to your collection. Please keep this page open.</p>}
              </div>
            ))}
          </aside>
        )}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-10 p-4 text-[10px] uppercase tracking-widest flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {message.type === 'success' ? <FiCheckCircle /> : <FiXCircle />}
            {message.text}
          </motion.div>
        )}

        <div className={isSectionRoute ? "mb-6 flex flex-wrap gap-2" : "mb-12 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4"}>
          {adminSections.map((section) => {
            const isActive = activeRouteSection === section.id;
            return (
              <Link
                key={section.id}
                href={section.href}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative min-w-0 overflow-hidden border transition duration-300 ${isSectionRoute ? 'rounded px-4 py-3 text-sm' : 'min-h-44 p-5 sm:p-6'} ${
                  isActive
                    ? 'border-accent bg-accent/12 text-white shadow-2xl shadow-accent/10'
                    : 'border-white/10 bg-white/[0.035] text-white/76 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {isSectionRoute ? section.title : <>
                <span className="absolute right-5 top-5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                  {getAdminSectionMetric(section.id)}
                </span>
                <span className="block pr-24 text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">
                  {section.title}
                </span>
                <span className="mt-8 block max-w-sm font-heading text-2xl italic leading-tight text-white">
                  {section.title}
                </span>
                <span className="mt-4 block max-w-sm text-sm leading-relaxed text-white/48">
                  {section.description}
                </span>
                <span className="mt-8 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45 transition-colors group-hover:text-accent">
                  Open workspace
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">&rarr;</span>
                </span>
                </>}
              </Link>
            );
          })}
        </div>

        {isSectionRoute && (
          <div className="mb-6">
            <Link href="/admin" className="text-[10px] uppercase tracking-[0.22em] text-white/45 transition-colors hover:text-accent">
              Back to admin overview
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {shouldShowSection('invoices') && (invoiceLoading ? <p role="status">Loading clients and documents…</p> : invoiceLoadError ? <div role="alert" className="space-y-3 rounded border border-red-400/40 p-4 text-red-200"><p>{invoiceLoadError}</p><button type="button" onClick={() => void fetchAll()} className="rounded border px-4 py-2">Retry loading invoices</button></div> : (
            <DocumentManager galleries={galleries} documents={Object.values(galleryDocuments).flat()} actions={documentActionIds} onSend={sendGalleryDocument} onDownload={downloadGalleryDocument} onDelete={deleteGalleryDocument} headers={headers} onUpdated={updateSavedDocument} onNew={() => {
              const selected = galleries.find(gal => String(gal.id) === invoiceGalleryId);
              if (selected) updateGalleryDocumentForm(selected.id, { documentType: 'invoice', title: 'Photography Invoice' });
            }}>
              <div className="mb-5 space-y-2">
                <label htmlFor="invoice-client" className="block text-sm font-medium text-white">Client / project</label>
                <select id="invoice-client" className={inputClass} value={invoiceGalleryId} onChange={e => setInvoiceGalleryId(e.target.value)}>
                  <option value="" className="bg-[#151618]">Choose a client to create an invoice</option>
                  {galleries.map(gal => <option className="bg-[#151618]" key={gal.id} value={gal.id}>{gal.client_name} · Project {gal.id}</option>)}
                </select>
                {!galleries.length && <p className="text-sm text-white/60">Add a client project in <Link className="text-white underline" href="/admin/galleries">Client Galleries</Link> to create their first invoice.</p>}
              </div>
              {(() => { const selected = galleries.find(gal => String(gal.id) === invoiceGalleryId); return selected ? renderDocumentEditor(selected) : null; })()}
            </DocumentManager>
          ))}
          {/* Bookings */}
          {shouldShowSection('bookings') && (
          <AdminAccordionPanel
            id="bookings"
            title="Bookings"
            summary={`${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className="space-y-8">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ['Pending', bookings.filter((booking) => booking.status === 'pending').length],
                ['Confirmed', bookings.filter((booking) => booking.status === 'confirmed').length],
                ['Documents', bookings.filter((booking) => ['contract-sent', 'invoiced'].includes(booking.status)).length],
                ['Completed', bookings.filter((booking) => booking.status === 'completed').length],
              ].map(([title, value]) => (
                <div key={title} className="border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">{title}</p>
                  <p className="mt-3 font-heading text-3xl italic text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              {bookings.map((booking) => {
                const draft = editingBookings[booking.id] || createBookingEditForm(booking);
                const portalUrl = getBookingPortalUrl(booking.manage_token);
                const matchingGallery = galleries.find((gallery) =>
                  gallery.id === booking.gallery_id ||
                  gallery.client_name.toLowerCase().trim() === booking.name.toLowerCase().trim()
                );
                return (
                  <div key={booking.id} className="grid gap-5 border border-white/10 bg-black/20 p-4 md:p-5 xl:grid-cols-[0.85fr_1.15fr]">
                    <div className="min-w-0 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-heading text-2xl italic text-white [overflow-wrap:anywhere]">{booking.name}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40 [overflow-wrap:anywhere]">
                            {booking.email} {booking.phone ? `• ${booking.phone}` : ''}
                          </p>
                        </div>
                        <span className="border border-accent/35 bg-accent/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-accent">
                          {booking.status}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Booked for</p>
                          <p className="mt-2 text-sm text-white/75">{formatBookingDateTime(booking.scheduled_at)}</p>
                        </div>
                        <div className="border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Service</p>
                          <p className="mt-2 text-sm capitalize text-white/75">{booking.service}</p>
                        </div>
                      </div>

                      <div className="border border-white/10 bg-white/[0.025] p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Brief</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/55">{booking.message || 'No brief added.'}</p>
                      </div>

                      <div className="grid gap-2 text-[10px] uppercase tracking-[0.16em] text-white/35 sm:grid-cols-3">
                        <span className={booking.confirmation_sent_at ? 'text-green-300' : ''}>
                          {booking.confirmation_sent_at ? 'Confirmed email' : 'No confirmation'}
                        </span>
                        <span className={booking.reminder_24h_sent_at ? 'text-green-300' : ''}>
                          {booking.reminder_24h_sent_at ? '24h sent' : '24h pending'}
                        </span>
                        <span className={booking.reminder_day_sent_at ? 'text-green-300' : ''}>
                          {booking.reminder_day_sent_at ? 'Day sent' : 'Day pending'}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <select
                          className={inputClass}
                          value={draft.status}
                          onChange={(e) => updateBookingDraft(booking.id, { status: e.target.value })}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="contract-sent">Contract sent</option>
                          <option value="invoiced">Invoiced</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <input
                          className={`${inputClass} text-xs`}
                          value={portalUrl}
                          readOnly
                          aria-label="Client portal URL"
                        />
                      </div>

                      <label className="block space-y-2">
                        <span className="block text-[10px] uppercase tracking-[0.2em] text-white/35">Linked gallery</span>
                        <select
                          className={inputClass}
                          value={draft.galleryId}
                          onChange={(e) => updateBookingDraft(booking.id, { galleryId: e.target.value })}
                        >
                          <option value="">No gallery linked</option>
                          {galleries.map((gallery) => (
                            <option key={gallery.id} value={gallery.id}>
                              {gallery.client_name} / {gallery.slug}
                            </option>
                          ))}
                        </select>
                      </label>

                      <textarea
                        className={`${inputClass} min-h-24 resize-y`}
                        maxLength={2000}
                        placeholder="Client-facing note. This appears in their private booking portal."
                        value={draft.clientNotes}
                        onChange={(e) => updateBookingDraft(booking.id, { clientNotes: e.target.value })}
                      />
                      <textarea
                        className={`${inputClass} min-h-24 resize-y`}
                        maxLength={2000}
                        placeholder="Internal notes for call time, contract needs, invoice status, crew, or delivery."
                        value={draft.internalNotes}
                        onChange={(e) => updateBookingDraft(booking.id, { internalNotes: e.target.value })}
                      />

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <button
                          type="button"
                          onClick={() => saveBooking(booking)}
                          className="bg-white px-3 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-accent"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => copyBookingPortal(booking)}
                          className="border border-accent/45 px-3 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent hover:text-black"
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          onClick={() => createGalleryFromBooking(booking)}
                          className="border border-white/15 px-3 py-3 text-[9px] uppercase tracking-[0.16em] text-white/65 transition-colors hover:border-accent hover:text-accent"
                        >
                          Create Gallery
                        </button>
                        <Link
                          href={matchingGallery ? '/admin/galleries' : '/admin/galleries'}
                          className="border border-white/15 px-3 py-3 text-center text-[9px] uppercase tracking-[0.16em] text-white/65 transition-colors hover:border-accent hover:text-accent"
                        >
                          {matchingGallery ? 'Open Gallery' : 'Galleries'}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {bookings.length === 0 && (
                <div className="border border-white/10 bg-white/[0.03] p-8 text-sm text-white/45">
                  No bookings yet. New calendar requests from the public booking form will appear here.
                </div>
              )}
            </div>
          </section>
          </AdminAccordionPanel>
          )}

          {/* Artwork */}
          {shouldShowSection('artwork') && (
          <AdminAccordionPanel
            id="artwork"
            title="Artwork"
            summary={`${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div className={sectionCard}>
              <h2 className="text-2xl font-heading text-white italic">Artwork</h2>
              <form className="space-y-4" onSubmit={handleArtworkSubmit}>
                <div className="space-y-2">
                  <label className={label}>Title</label>
                  <input
                    className={inputClass}
                    value={artForm.title}
                    onChange={(e) => setArtForm({ ...artForm, title: e.target.value })}
                    placeholder="Base title, or leave blank to auto-name a batch"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={label}>Internal Price (optional)</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={artForm.price}
                      onChange={(e) => setArtForm({ ...artForm, price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Category</label>
                    <input
                      className={inputClass}
                      value={artForm.category}
                      onChange={(e) => setArtForm({ ...artForm, category: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className={label}>Year</label>
                    <input
                      className={inputClass}
                      value={artForm.year}
                      onChange={(e) => setArtForm({ ...artForm, year: e.target.value })}
                      placeholder="2026"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Medium</label>
                    <input
                      className={inputClass}
                      value={artForm.medium}
                      onChange={(e) => setArtForm({ ...artForm, medium: e.target.value })}
                      placeholder="Photography / manipulation"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Dimensions</label>
                    <input
                      className={inputClass}
                      value={artForm.dimensions}
                      onChange={(e) => setArtForm({ ...artForm, dimensions: e.target.value })}
                      placeholder="24 x 36 in"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={label}>Archive Note</label>
                  <textarea
                    className={`${inputClass} min-h-[90px]`}
                    value={artForm.description}
                    onChange={(e) => setArtForm({ ...artForm, description: e.target.value })}
                    placeholder="Context, series note, exhibition note, or process detail"
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Artwork Files</label>
                  <div className="relative group">
                    <input
                      ref={artworkInputRef}
                      type="file"
                      multiple
                      onChange={(e) => {
                        handleArtworkFileChange(Array.from(e.target.files || []));
                        e.currentTarget.value = '';
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept="image/*"
                    />
                    <div className="w-full bg-white/5 border-2 border-dashed border-white/10 p-6 flex flex-col items-center justify-center gap-3 group-hover:border-accent/50 transition-colors">
                      <FiUpload className="text-xl text-white/20 group-hover:text-accent transition-colors" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        {getSelectedFileLabel(artworkFiles, 'Choose one or many artwork files')}
                      </span>
                      <span className="text-xs text-white/30">Batch uploads create one catalogue entry per file.</span>
                    </div>
                  </div>
                  <input
                    placeholder="or paste one image URL"
                    className={inputClass}
                    value={artForm.image}
                    onChange={(e) => {
                      setArtForm({ ...artForm, image: e.target.value });
                      if (!artworkFiles.length) setImagePreview(e.target.value || null);
                    }}
                  />
                  {imagePreview && (
                    <div className="mt-3 rounded-lg border border-white/10 overflow-hidden bg-white/5">
                      <AdminPreviewImage src={imagePreview} alt="Artwork preview" className="w-full h-48 object-cover" />
                      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/60">
                        Preview
                      </div>
                    </div>
                  )}
                  {artworkFiles.length > 0 && (
                    <button
                      type="button"
                      disabled={isUploading('artwork-image')}
                      onClick={() => {
                        setArtworkFiles([]);
                        if (artworkInputRef.current) artworkInputRef.current.value = '';
                        setImagePreview(artForm.image || null);
                      }}
                      className="w-full border border-white/10 py-3 text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50 sm:tracking-[0.3em]"
                    >
                      Clear Selected Artwork Files
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs text-white/70">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={artForm.isFeatured}
                      onChange={(e) => setArtForm({ ...artForm, isFeatured: e.target.checked })}
                    />
                    Featured
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={artForm.isAvailable}
                      onChange={(e) => setArtForm({ ...artForm, isAvailable: e.target.checked })}
                    />
                    Print option
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isUploading('artwork-image')}
                  className="w-full bg-accent hover:bg-white text-black py-4 px-5 text-[10px] uppercase tracking-[0.22em] font-medium transition-all flex items-center justify-center gap-4 disabled:opacity-50 sm:px-8 sm:tracking-[0.4em]"
                >
                  {isUploading('artwork-image') ? getUploadProgressLabel('artwork-image', 'Uploading') : 'Save Catalogue Work'}
                </button>
              </form>
            </div>
            <div className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.28em] text-accent sm:tracking-[0.5em]">Existing</h3>
              {artworks.map((art) => {
                const draft = editingArtworks[art.id] || createArtworkEditForm(art);
                const isEditing = editingArtworkId === art.id;

                return (
                  <div key={art.id} className="bg-surface/20 border border-white/5 p-4">
                    <div className="flex gap-4 items-center group">
                      <div className="w-20 h-20 shrink-0 bg-neutral-950 overflow-hidden">
                        <AdminPreviewImage src={art.image} alt={art.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-heading italic">{art.title}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">
                          {[art.category, art.year].filter(Boolean).join(' / ')}
                        </p>
                        {(art.medium || art.dimensions) && (
                          <p className="mt-1 text-xs text-white/45">
                            {[art.medium, art.dimensions].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        {art.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/35">
                            {art.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => startEditingArtwork(art)}
                          className={`px-3 py-2 border ${isEditing ? 'border-accent text-accent' : 'border-white/10 text-white/60 hover:border-accent hover:text-accent'}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <FiEdit3 />
                            Edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArtwork(art.id, 'isFeatured', !art.is_featured)}
                          className={`px-3 py-2 border ${art.is_featured ? 'border-accent text-accent' : 'border-white/10 text-white/60'}`}
                        >
                          Featured
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArtwork(art.id, 'isAvailable', !art.is_available)}
                          className={`px-3 py-2 border ${art.is_available ? 'border-white/10 text-white/60' : 'border-red-500/40 text-red-300'}`}
                        >
                          {art.is_available ? 'Print option' : 'No print'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteArtwork(art.id)}
                          className="p-2 text-red-400 hover:text-red-200 border border-white/10"
                          aria-label={`Delete ${art.title}`}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className={label}>Title</label>
                            <input
                              className={inputClass}
                              value={draft.title}
                              onChange={(e) => updateArtworkDraft(art.id, { title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={label}>Category</label>
                            <input
                              className={inputClass}
                              value={draft.category}
                              onChange={(e) => updateArtworkDraft(art.id, { category: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <label className={label}>Year</label>
                            <input
                              className={inputClass}
                              value={draft.year}
                              onChange={(e) => updateArtworkDraft(art.id, { year: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={label}>Medium</label>
                            <input
                              className={inputClass}
                              value={draft.medium}
                              onChange={(e) => updateArtworkDraft(art.id, { medium: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={label}>Dimensions</label>
                            <input
                              className={inputClass}
                              value={draft.dimensions}
                              onChange={(e) => updateArtworkDraft(art.id, { dimensions: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className={label}>Archive Note</label>
                          <textarea
                            className={`${inputClass} min-h-[88px]`}
                            value={draft.description}
                            onChange={(e) => updateArtworkDraft(art.id, { description: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                          <div className="space-y-2">
                            <label className={label}>Image URL</label>
                            <input
                              className={inputClass}
                              value={draft.image}
                              onChange={(e) => updateArtworkDraft(art.id, { image: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={label}>Internal Price</label>
                            <input
                              type="number"
                              className={inputClass}
                              value={draft.price}
                              onChange={(e) => updateArtworkDraft(art.id, { price: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 text-xs text-white/70 sm:grid-cols-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.isFeatured}
                              onChange={(e) => updateArtworkDraft(art.id, { isFeatured: e.target.checked })}
                            />
                            Featured
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.isAvailable}
                              onChange={(e) => updateArtworkDraft(art.id, { isAvailable: e.target.checked })}
                            />
                            Print option
                          </label>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => saveArtworkDetails(art.id)}
                            className="flex-1 bg-accent px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-black transition-colors hover:bg-white"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEditingArtwork(art)}
                            className="flex-1 border border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-white/50 transition-colors hover:border-white/30 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          </AdminAccordionPanel>
          )}

          {/* Digital Products */}
          {shouldShowSection('digital-products') && (
          <AdminAccordionPanel
            id="digital-products"
            title="Digital Products"
            summary={`${digitalProducts.length} ${digitalProducts.length === 1 ? 'product' : 'products'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div className={sectionCard}>
              <h2 className="text-2xl font-heading text-white italic">Digital Products</h2>
              <form className="space-y-4" onSubmit={createDigitalProduct}>
                <div className="space-y-2">
                  <label className={label}>Title</label>
                  <input
                    className={inputClass}
                    value={digitalProductForm.title}
                    onChange={(e) => setDigitalProductForm({ ...digitalProductForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className={label}>Price</label>
                    <input
                      className={inputClass}
                      placeholder="$45.00"
                      value={digitalProductForm.price}
                      onChange={(e) => setDigitalProductForm({ ...digitalProductForm, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Display Order</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={digitalProductForm.displayOrder}
                      onChange={(e) => setDigitalProductForm({ ...digitalProductForm, displayOrder: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={label}>Details</label>
                  <input
                    className={inputClass}
                    placeholder="10 Lightroom Presets"
                    value={digitalProductForm.details}
                    onChange={(e) => setDigitalProductForm({ ...digitalProductForm, details: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Purchase / Download URL</label>
                  <label className="relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-white/10 bg-white/[0.04] p-6 text-center transition-colors hover:border-accent/50">
                    <input
                      type="file"
                      disabled={isUploading('digital-product-file')}
                      onChange={(e) => handleDigitalProductAssetChange(e.target.files?.[0] || null)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <FiUpload className="text-xl text-white/25" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                      {isUploading('digital-product-file')
                        ? getUploadProgressLabel('digital-product-file', 'Uploading product file')
                        : digitalProductAssetFile
                          ? digitalProductAssetFile.name
                          : 'Upload product file'}
                    </span>
                    <span className="text-xs text-white/30">Presets, PDF, ZIP, video, or delivery file</span>
                  </label>
                  <input
                    className={inputClass}
                    placeholder="uploaded file URL, checkout, Gumroad, Dropbox..."
                    value={digitalProductForm.productUrl}
                    onChange={(e) => setDigitalProductForm({ ...digitalProductForm, productUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Product Image</label>
                  <label className="relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-white/10 bg-white/[0.04] p-6 text-center transition-colors hover:border-accent/50">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploading('digital-product-image')}
                      onChange={(e) => handleDigitalProductFileChange(e.target.files?.[0] || null)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <FiUpload className="text-xl text-white/25" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                      {isUploading('digital-product-image')
                        ? getUploadProgressLabel('digital-product-image', 'Uploading image')
                        : digitalProductFile
                          ? digitalProductFile.name
                          : 'Upload product image'}
                    </span>
                  </label>
                  <input
                    className={inputClass}
                    placeholder="or paste image URL"
                    value={digitalProductForm.image}
                    onChange={(e) => {
                      setDigitalProductForm({ ...digitalProductForm, image: e.target.value });
                      if (!digitalProductFile) setDigitalProductPreview(e.target.value || null);
                    }}
                  />
                  {digitalProductPreview && (
                    <div className="overflow-hidden border border-white/10 bg-white/[0.04]">
                      <AdminPreviewImage src={digitalProductPreview} alt="Digital product preview" className="h-48 w-full object-cover" />
                      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
                        Product preview
                      </div>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={digitalProductForm.isActive}
                    onChange={(e) => setDigitalProductForm({ ...digitalProductForm, isActive: e.target.checked })}
                  />
                  Show on homepage and shop
                </label>
                <button
                  type="submit"
                  disabled={isUploading('digital-product-image')}
                  className="flex w-full items-center justify-center gap-4 bg-accent px-5 py-4 text-[10px] font-medium uppercase tracking-[0.22em] text-black transition-all hover:bg-white disabled:opacity-50 sm:px-8 sm:tracking-[0.4em]"
                >
                  {isUploading('digital-product-image') ? getUploadProgressLabel('digital-product-image', 'Uploading') : 'Save Digital Product'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.28em] text-accent sm:tracking-[0.5em]">Existing Products</h3>
              {digitalProducts.map((product) => {
                const draft = editingDigitalProducts[product.id] || {
                  title: product.title || '',
                  price: product.price || '',
                  details: product.details || '',
                  image: product.image || '',
                  productUrl: product.product_url || '',
                  displayOrder: String(product.display_order || 0),
                  isActive: product.is_active,
                };

                return (
                  <div key={product.id} className="space-y-4 border border-white/5 bg-surface/20 p-4">
                    <div className="grid gap-4 sm:grid-cols-[112px_1fr]">
                      <div className="h-32 overflow-hidden bg-neutral-950 sm:h-28">
                        <AdminPreviewImage src={draft.image || product.image} alt={draft.title || product.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="grid gap-3">
                        <input
                          className={inputClass}
                          value={draft.title}
                          onChange={(e) =>
                            setEditingDigitalProducts((prev) => ({
                              ...prev,
                              [product.id]: { ...draft, title: e.target.value },
                            }))
                          }
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            className={inputClass}
                            value={draft.price}
                            onChange={(e) =>
                              setEditingDigitalProducts((prev) => ({
                                ...prev,
                                [product.id]: { ...draft, price: e.target.value },
                              }))
                            }
                          />
                          <input
                            type="number"
                            className={inputClass}
                            value={draft.displayOrder}
                            onChange={(e) =>
                              setEditingDigitalProducts((prev) => ({
                                ...prev,
                                [product.id]: { ...draft, displayOrder: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <input
                      className={inputClass}
                      placeholder="Details"
                      value={draft.details}
                      onChange={(e) =>
                        setEditingDigitalProducts((prev) => ({
                          ...prev,
                          [product.id]: { ...draft, details: e.target.value },
                        }))
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Image URL"
                      value={draft.image}
                      onChange={(e) =>
                        setEditingDigitalProducts((prev) => ({
                          ...prev,
                          [product.id]: { ...draft, image: e.target.value },
                        }))
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Purchase / Download URL"
                      value={draft.productUrl}
                      onChange={(e) =>
                        setEditingDigitalProducts((prev) => ({
                          ...prev,
                          [product.id]: { ...draft, productUrl: e.target.value },
                        }))
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                      <button
                        type="button"
                        onClick={() => updateDigitalProduct(product.id)}
                        className="border border-accent/50 px-3 py-2 text-accent transition-colors hover:bg-accent hover:text-black"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDigitalProduct(product.id, { isActive: !draft.isActive })}
                        className={`border px-3 py-2 transition-colors ${
                          draft.isActive ? 'border-accent text-accent' : 'border-white/10 text-white/50'
                        }`}
                      >
                        {draft.isActive ? 'Visible' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDigitalProduct(product.id)}
                        className="ml-auto inline-flex items-center gap-2 border border-red-500/40 px-3 py-2 text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                      >
                        <FiTrash2 aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {digitalProducts.length === 0 && (
                <p className="border border-white/10 p-6 text-xs text-white/40">No digital products yet.</p>
              )}
            </div>
          </section>
          </AdminAccordionPanel>
          )}

          {/* Photography Catalog */}
          {shouldShowSection('catalog') && (
          <AdminAccordionPanel
            id="catalog"
            title="Photography Catalog"
            summary={`${catalogCategories.length} ${catalogCategories.length === 1 ? 'category' : 'categories'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className="grid gap-8 xl:grid-cols-[0.78fr_1.22fr] xl:items-start">
            <div className={sectionCard}>
              <h2 className="text-2xl font-heading text-white italic">Photography Catalog</h2>
              <form className="space-y-4" onSubmit={createCatalogCategory}>
                <div className="space-y-2">
                  <label className={label}>Category Name</label>
                  <input
                    className={inputClass}
                    placeholder="Wedding, Portrait, Editorial..."
                    value={catalogCategoryForm.name}
                    onChange={(e) => setCatalogCategoryForm({ ...catalogCategoryForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={label}>Slug (optional)</label>
                    <input
                      className={inputClass}
                      placeholder="wedding"
                      value={catalogCategoryForm.slug}
                      onChange={(e) => setCatalogCategoryForm({ ...catalogCategoryForm, slug: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Order</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={catalogCategoryForm.display_order}
                      onChange={(e) => setCatalogCategoryForm({ ...catalogCategoryForm, display_order: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={label}>Description</label>
                  <textarea
                    className={`${inputClass} min-h-[90px]`}
                    value={catalogCategoryForm.description}
                    onChange={(e) => setCatalogCategoryForm({ ...catalogCategoryForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Display Image URL (optional)</label>
                  <input
                    className={inputClass}
                    placeholder="Choose from uploaded images later, or paste a URL now"
                    value={catalogCategoryForm.cover_image_url}
                    onChange={(e) => setCatalogCategoryForm({ ...catalogCategoryForm, cover_image_url: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-accent hover:bg-white text-black py-4 px-5 text-[10px] uppercase tracking-[0.22em] font-medium transition-all sm:px-8 sm:tracking-[0.4em]"
                >
                  Create Category
                </button>
              </form>

              <form className="pt-6 border-t border-white/5 space-y-4" onSubmit={createCatalogImage}>
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Add Image To Category</h3>
                <div className="space-y-2">
                  <label className={label}>Category</label>
                  <select
                    className={inputClass}
                    value={catalogImageForm.category_id}
                    onChange={(e) => setCatalogImageForm({ ...catalogImageForm, category_id: e.target.value })}
                    required
                  >
                    <option value="">Choose category</option>
                    {catalogCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={label}>Title</label>
                    <input
                      className={inputClass}
                      value={catalogImageForm.title}
                      onChange={(e) => setCatalogImageForm({ ...catalogImageForm, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Order</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={catalogImageForm.display_order}
                      onChange={(e) => setCatalogImageForm({ ...catalogImageForm, display_order: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={label}>Alt Text</label>
                  <input
                    className={inputClass}
                    value={catalogImageForm.alt_text}
                    onChange={(e) => setCatalogImageForm({ ...catalogImageForm, alt_text: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Image</label>
                  <input
                    ref={catalogImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleCatalogImageFileChange(Array.from(e.target.files || []));
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => catalogImageInputRef.current?.click()}
                    disabled={isUploading('catalog-image')}
                    className="flex w-full flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-white/10 bg-white/[0.04] p-6 text-center transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiUpload className="text-xl text-white/25" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                      {isUploading('catalog-image')
                        ? getUploadProgressLabel('catalog-image', 'Uploading catalogue')
                        : getSelectedFileLabel(catalogImageFiles, 'Upload multiple from this device')}
                    </span>
                    <span className="text-xs text-white/30">Desktop, phone gallery, or camera roll. Multiple images supported.</span>
                  </button>
                  <input
                    className={inputClass}
                    placeholder="or paste one image URL"
                    value={catalogImageForm.image_url}
                    onChange={(e) => {
                      setCatalogImageForm({ ...catalogImageForm, image_url: e.target.value });
                      if (!catalogImageFiles.length) setCatalogImagePreview(e.target.value || null);
                    }}
                  />
                  {catalogImagePreview && (
                    <div className="overflow-hidden border border-white/10 bg-white/[0.04]">
                      <AdminPreviewImage
                        src={getCloudinaryPreviewUrl(catalogImagePreview, { width: 720 })}
                        srcSet={getImagePreviewSrcSet(catalogImagePreview, [360, 720, 1080])}
                        alt="Catalogue preview"
                        className="h-48 w-full object-cover"
                      />
                      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
                        {catalogImageFiles.length > 1 ? `First preview of ${catalogImageFiles.length} selected images` : 'Catalogue preview'}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isUploading('catalog-image')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-3 text-[10px] uppercase tracking-[0.2em] disabled:opacity-50 sm:tracking-[0.3em]"
                >
                  {isUploading('catalog-image') ? getUploadProgressLabel('catalog-image', 'Uploading') : 'Add Catalog Images'}
                </button>
                {catalogImageFiles.length > 0 && (
                  <button
                    type="button"
                    disabled={isUploading('catalog-image')}
                    onClick={() => {
                      setCatalogImageFiles([]);
                      setCatalogImagePreview(catalogImageForm.image_url || null);
                    }}
                    className="w-full border border-white/10 py-3 text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50 sm:tracking-[0.3em]"
                  >
                    Clear Selected Images
                  </button>
                )}
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.28em] text-accent sm:tracking-[0.5em]">Catalog Categories</h3>
              {catalogCategories.map((category) => (
                <div key={category.id} className="bg-surface/20 border border-white/5 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-heading italic">{category.name}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">
                        slug: {category.slug} • images: {category.images?.length || 0}
                      </p>
                      {category.description && (
                        <p className="mt-2 text-xs text-white/50 leading-relaxed">{category.description}</p>
                      )}
                      {(category.cover_image_url || category.images?.[0]?.image_url) && (
                        <div className="mt-4 flex items-center gap-3 border border-white/10 bg-white/[0.03] p-2">
                          <AdminPreviewImage
                            src={getCloudinaryPreviewUrl(category.cover_image_url || category.images?.[0]?.image_url, {
                              width: 160,
                              height: 160,
                            })}
                            srcSet={getImagePreviewSrcSet(category.cover_image_url || category.images?.[0]?.image_url, [80, 160, 240])}
                            alt={`${category.name} display image`}
                            className="h-14 w-14 shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-accent">Display image</p>
                            <p className="mt-1 truncate text-xs text-white/35">
                              {category.cover_image_url ? 'Chosen manually' : 'Using first image until you choose one'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCatalogCategory(category)}
                        className={`px-3 py-2 border text-[10px] uppercase tracking-[0.2em] ${
                          category.is_active ? 'border-accent text-accent' : 'border-white/10 text-white/50'
                        }`}
                      >
                        {category.is_active ? 'Active' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCatalogCategory(category.id)}
                        className="p-2 text-red-400 hover:text-red-200 border border-white/10"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      className={inputClass}
                      placeholder="Paste or replace display image URL"
                      value={category.cover_image_url || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCatalogCategories((prev) =>
                          prev.map((item) => (item.id === category.id ? { ...item, cover_image_url: value } : item))
                        );
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateCatalogCategoryCover(category, category.cover_image_url || '')}
                      className="border border-accent/40 px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-accent transition-colors hover:bg-accent hover:text-black"
                    >
                      Save Display
                    </button>
                  </div>

                  {category.images?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {category.images.map((image) => (
                        <div key={image.id} className="relative group overflow-hidden border border-white/10 bg-black">
                          <AdminPreviewImage
                            src={getCloudinaryPreviewUrl(image.image_url, { width: 360, height: 280 })}
                            srcSet={getImagePreviewSrcSet(image.image_url, [180, 360, 540])}
                            alt={image.alt_text || image.title || category.name}
                            className="h-28 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => deleteCatalogImage(image.id)}
                            className="absolute right-2 top-2 bg-black/70 p-2 text-red-300 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Delete catalog image"
                          >
                            <FiTrash2 />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCatalogCategoryCover(category, image.image_url)}
                            className={`absolute left-2 top-2 flex items-center gap-1 border px-2 py-1 text-[9px] uppercase tracking-[0.16em] transition-colors ${
                              category.cover_image_url === image.image_url
                                ? 'border-accent bg-accent text-black'
                                : 'border-white/20 bg-black/70 text-white/70 hover:border-accent hover:text-accent'
                            }`}
                            aria-label={`Use ${image.title || category.name} as display image`}
                          >
                            <FiImage aria-hidden="true" />
                            {category.cover_image_url === image.image_url ? 'Display' : 'Set'}
                          </button>
                          {image.title && (
                            <p className="px-2 py-2 text-[10px] text-white/60 truncate">{image.title}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/35">No images in this category yet.</p>
                  )}
                </div>
              ))}
              {catalogCategories.length === 0 && (
                <p className="border border-white/10 p-6 text-xs text-white/40">No photography catalog categories yet.</p>
              )}
            </div>
          </section>
          </AdminAccordionPanel>
          )}

          {/* Galleries */}
          {shouldShowSection('galleries') && (
          <AdminAccordionPanel
            id="galleries"
            title="Galleries"
            summary={`${galleries.length} ${galleries.length === 1 ? 'gallery' : 'galleries'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className="grid gap-8 xl:grid-cols-[0.68fr_1.32fr] xl:items-start">
            <div className={sectionCard}>
              <h2 className="text-2xl font-heading text-white italic">Galleries</h2>
              <form className="space-y-4" onSubmit={createGallery}>
                <div className="space-y-2">
                  <label className={label}>Client Name</label>
                  <input
                    className={inputClass}
                    value={galleryForm.clientName}
                    onChange={(e) => setGalleryForm({ ...galleryForm, clientName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={label}>Slug (optional)</label>
                    <input
                      className={inputClass}
                      value={galleryForm.slug}
                      onChange={(e) => setGalleryForm({ ...galleryForm, slug: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Access Code (optional)</label>
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        value={galleryForm.access_code}
                        onChange={(e) => setGalleryForm({ ...galleryForm, access_code: e.target.value.toUpperCase() })}
                      />
                      <button
                        type="button"
                        onClick={() => setGalleryForm((prev) => ({ ...prev, access_code: generateAccessCode() }))}
                        className="shrink-0 border border-white/10 px-3 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
                <fieldset className="space-y-3">
                  <legend className={label}>Gallery design</legend>
                  <p className="text-xs leading-relaxed text-white/40">Choose the first impression and browsing layout. You can change it later without affecting the photos.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      { id: 'editorial', name: 'Editorial', note: 'Cinematic cover', pattern: 'grid-cols-[1fr_1.6fr]' },
                      { id: 'classic', name: 'Classic', note: 'Balanced grid', pattern: 'grid-cols-2' },
                      { id: 'proofing', name: 'Proofing', note: 'Fast selection', pattern: 'grid-cols-3' },
                    ] as const).map((design) => {
                      const active = galleryForm.galleryDesign === design.id;
                      return (
                        <button
                          key={design.id}
                          type="button"
                          onClick={() => setGalleryForm({ ...galleryForm, galleryDesign: design.id })}
                          aria-pressed={active}
                          className={`p-2 text-left transition-colors ${active ? 'bg-accent text-black ring-1 ring-accent' : 'border border-white/10 bg-black text-white hover:border-white/35'}`}
                        >
                          <span className={`mb-3 grid h-16 gap-1 overflow-hidden ${design.pattern}`} aria-hidden="true">
                            {Array.from({ length: design.id === 'proofing' ? 6 : 4 }).map((_, index) => (
                              <span key={index} className={`${active ? 'bg-black/25' : 'bg-white/15'} ${design.id === 'editorial' && index === 1 ? 'row-span-2' : ''}`} />
                            ))}
                          </span>
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em]">{design.name}</span>
                          <span className={`mt-1 block text-[9px] ${active ? 'text-black/60' : 'text-white/35'}`}>{design.note}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <button
                  type="submit"
                  className="w-full bg-accent hover:bg-white text-black py-4 px-5 text-[10px] uppercase tracking-[0.22em] font-medium transition-all sm:px-8 sm:tracking-[0.4em]"
                >
                  Create Gallery
                </button>
              </form>
            </div>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-[10px] uppercase tracking-[0.28em] text-accent sm:tracking-[0.5em]">Existing</h3>
                <button
                  type="button"
                  onClick={fetchAll}
                  className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:border-accent hover:text-accent"
                >
                  Refresh
                </button>
              </div>
              {galleries.map((gal) => (
                <div key={gal.id} className="bg-surface/20 border border-white/5 p-4 space-y-5">
                  {(() => {
                    const mediaTarget = `gallery-${gal.id}-media`;
                    const finishedTarget = `gallery-${gal.id}-finished`;
                    const isMediaUploading = isUploading(`gallery-${gal.id}-media`);
                    const isFinishedUploading = isUploading(`gallery-${gal.id}-finished`);
                    const isUpdatingGallery = Boolean(updatingGalleryIds[gal.id]);
                    return (
                      <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-white font-heading italic">{gal.client_name}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">
                        slug: {gal.slug} • code: {gal.access_code}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateGallery(gal.id.toString(), gal.is_locked ? 'unlock' : 'lock')}
                      disabled={isUpdatingGallery}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        gal.is_locked
                          ? 'border-red-300/35 bg-red-500/10 text-red-200 hover:border-red-200 hover:text-white'
                          : 'border-green-300/30 bg-green-500/10 text-green-200 hover:border-green-200 hover:text-white'
                      }`}
                      aria-label={gal.is_locked ? 'Unlock gallery' : 'Lock gallery'}
                    >
                      {gal.is_locked ? <FiUnlock aria-hidden="true" /> : <FiLock aria-hidden="true" />}
                      {isUpdatingGallery ? 'Saving' : gal.is_locked ? 'Locked' : 'Unlocked'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-white/60">
                    <span>Uploads: {gal.images.length}</span>
                    <span>Selected for retouching: {gal.approved_images.length}</span>
                    <span>Finished: {gal.finished_images?.length || 0}</span>
                    <span className={gal.review_submitted_at ? 'text-accent' : 'text-white/35'}>
                      {gal.review_submitted_at ? `Reviewed: ${gal.review_rating || 0}/5` : 'No review yet'}
                    </span>
                    {gal.review_featured && <span className="text-green-300">Featured on home</span>}
                    <span className={gal.payment_verified ? 'text-green-300' : 'text-white/40'}>
                      {gal.payment_verified ? 'Payment verified' : 'Payment pending'}
                    </span>
                    <span className={gal.is_locked ? 'text-red-200' : 'text-green-300'}>
                      {gal.is_locked ? 'Client access locked' : 'Client access open'}
                    </span>
                  </div>
                  <div className="space-y-3 border border-white/10 bg-black/20 p-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">Gallery design</p>
                      <p className="mt-1 text-xs text-white/35">Pick a look for this client. Changes appear the next time the gallery opens.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([
                        { id: 'editorial', name: 'Editorial', note: 'Video-inspired cinematic cover' },
                        { id: 'classic', name: 'Classic', note: 'Spacious balanced grid' },
                        { id: 'proofing', name: 'Proofing', note: 'More photos, faster choices' },
                      ] as const).map((design) => {
                        const active = (gal.gallery_design || 'editorial') === design.id;
                        return (
                          <button
                            key={design.id}
                            type="button"
                            disabled={isUpdatingGallery}
                            onClick={() => updateGallery(gal.id.toString(), 'design', { design: design.id })}
                            aria-pressed={active}
                            className={`min-h-20 p-3 text-left transition-colors disabled:opacity-50 ${active ? 'border border-accent bg-accent/10 text-accent' : 'border border-white/10 text-white/55 hover:border-white/35 hover:text-white'}`}
                          >
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]">{active ? '✓ ' : ''}{design.name}</span>
                            <span className="mt-2 block text-[10px] leading-relaxed opacity-65">{design.note}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {gal.review_submitted_at && (
                    <div className="space-y-3 border border-accent/25 bg-accent/[0.04] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                          Client review
                        </p>
                        <div className="flex flex-wrap items-center justify-end gap-3 text-[10px] uppercase tracking-[0.18em] text-white/45">
                          <div className="flex items-center gap-3">
                            <span className="text-accent">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <span key={index} className={index < (gal.review_rating || 0) ? 'opacity-100' : 'opacity-25'}>
                                  &#9733;
                                </span>
                              ))}
                            </span>
                            <span>{new Date(gal.review_submitted_at).toLocaleDateString()}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateGallery(gal.id.toString(), 'featureReview', { featured: !gal.review_featured })
                            }
                            className={`border px-3 py-2 transition-colors ${
                              gal.review_featured
                                ? 'border-green-400/40 text-green-300 hover:border-white hover:text-white'
                                : 'border-accent/50 text-accent hover:bg-accent hover:text-black'
                            }`}
                          >
                            {gal.review_featured ? 'Remove from home' : 'Add to home'}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-white/70">
                        &quot;{gal.review_text}&quot;
                      </p>
                    </div>
                  )}
                  {gal.approved_images.length > 0 && (
                    <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">
                          Client selected
                        </p>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                          {gal.approved_images.length} {gal.approved_images.length === 1 ? 'image' : 'images'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                        {gal.approved_images.map((img, index) => (
                          <a
                            key={`${img}-selected-${index}`}
                            href={img}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block overflow-hidden border border-white/10 bg-black transition-colors hover:border-white/25"
                            aria-label={`Open selected image ${index + 1}`}
                          >
                            <GalleryMedia
                              src={img}
                              alt={`${gal.client_name} selected image ${index + 1}`}
                              className="h-20 w-full object-cover"
                              sizes="(min-width: 1280px) 96px, (min-width: 640px) 33vw, 50vw"
                              previewWidth={240}
                              previewHeight={200}
                            />
                            <span className="absolute left-1.5 top-1.5 h-4 w-4 rounded-full border border-white bg-white shadow-[0_0_12px_rgba(255,255,255,0.18)]">
                              <span className="sr-only">Pick {index + 1}</span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {gal.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                      {gal.images.map((img, index) => {
                        const isSelected = gal.approved_images.includes(img);
                        return (
                          <div key={`${img}-${index}`} className="space-y-1">
                            <div className="relative">
                              <GalleryMedia
                                src={img}
                                alt={`${gal.client_name} gallery upload ${index + 1}`}
                                className="h-20 w-full border border-white/10 object-cover"
                                sizes="(min-width: 1280px) 96px, (min-width: 640px) 33vw, 50vw"
                                previewWidth={240}
                                previewHeight={200}
                              />
                              <span
                                className={`absolute left-1.5 top-1.5 h-4 w-4 rounded-full border transition-colors ${
                                  isSelected ? 'border-white bg-white' : 'border-white/65 bg-black/20'
                                }`}
                              >
                                <span className="sr-only">{isSelected ? 'Selected' : 'Not selected'}</span>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteGalleryUpload(gal.id, img)}
                              className="flex w-full items-center justify-center gap-1 border border-red-500/50 bg-red-500/10 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                              aria-label={`Delete gallery upload ${index + 1}`}
                            >
                              <FiTrash2 aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                    <label className="relative block cursor-pointer border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/45 transition-colors hover:border-accent/50">
                      <input
                        type="file"
                        accept={mediaAccept}
                        multiple
                        disabled={isMediaUploading}
                        onChange={(e) => {
                          const selectedFiles = Array.from(e.currentTarget.files || []);
                          setGalleryUploads((prev) => ({
                            ...prev,
                            [gal.id]: mergeSelectedFiles(prev[gal.id], selectedFiles),
                          }));
                          e.currentTarget.value = '';
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      {getSelectedFileLabel(galleryUploads[gal.id], 'Choose client media files')}
                    </label>
                    <button
                      type="button"
                      disabled={isMediaUploading || !(galleryUploads[gal.id]?.length)}
                      onClick={() => uploadGalleryImage(gal.id)}
                      className="px-4 py-3 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isMediaUploading ? getUploadProgressLabel(mediaTarget, 'Uploading media') : 'Upload Media'}
                    </button>
                    <button
                      type="button"
                      disabled={isMediaUploading || !(galleryUploads[gal.id]?.length)}
                      onClick={() => setGalleryUploads((prev) => ({ ...prev, [gal.id]: [] }))}
                      className="px-4 py-3 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:border-red-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Clear Queue
                    </button>
                  </div>
                  {gal.approved_images.length > 0 && (
                    <button
                      onClick={() =>
                        updateGallery(
                          gal.id.toString(),
                          'reject',
                          { images: gal.approved_images }
                        )
                      }
                      className="text-[10px] uppercase tracking-[0.18em] px-3 py-2 border border-white/10 text-white/45 transition-colors hover:border-red-500 hover:text-red-300 sm:tracking-[0.3em]"
                    >
                      Clear Client Selection
                    </button>
                  )}
                  <div className="space-y-3 border-t border-white/5 pt-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <label className="relative block cursor-pointer border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/45 transition-colors hover:border-accent/50">
                        <input
                          type="file"
                          accept={mediaAccept}
                          multiple
                          disabled={isFinishedUploading}
                          onChange={(e) => {
                            const selectedFiles = Array.from(e.currentTarget.files || []);
                            setFinishedGalleryUploads((prev) => ({
                              ...prev,
                              [gal.id]: mergeSelectedFiles(prev[gal.id], selectedFiles),
                            }));
                            e.currentTarget.value = '';
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        {getSelectedFileLabel(finishedGalleryUploads[gal.id], 'Choose finished work files')}
                      </label>
                      <button
                        type="button"
                        disabled={isFinishedUploading || !(finishedGalleryUploads[gal.id]?.length)}
                        onClick={() => uploadFinishedGalleryImage(gal.id)}
                        className="px-4 py-3 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isFinishedUploading ? getUploadProgressLabel(finishedTarget, 'Uploading finished') : 'Upload Finished'}
                      </button>
                      <button
                        type="button"
                        disabled={isFinishedUploading || !(finishedGalleryUploads[gal.id]?.length)}
                        onClick={() => setFinishedGalleryUploads((prev) => ({ ...prev, [gal.id]: [] }))}
                        className="px-4 py-3 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:border-red-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Clear Queue
                      </button>
                    </div>
                    {gal.finished_images?.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                        {gal.finished_images.map((img, index) => (
                          <div key={img} className="space-y-1">
                            <div className="relative">
                              <GalleryMedia
                                src={img}
                                alt={`${gal.client_name} finished work ${index + 1}`}
                                className="h-20 w-full object-cover border border-white/10"
                                sizes="(min-width: 1280px) 96px, (min-width: 640px) 33vw, 50vw"
                                previewWidth={240}
                                previewHeight={200}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateGallery(gal.id.toString(), 'removeFinishedImage', { images: [img] })
                              }
                              className="flex w-full items-center justify-center gap-1 border border-red-500/50 bg-red-500/10 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                              aria-label={`Delete finished work ${index + 1}`}
                            >
                              <FiTrash2 aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <input
                        className={`${inputClass} text-xs`}
                        placeholder="Payment link for client"
                        value={galleryPaymentUrls[gal.id] ?? gal.payment_url ?? ''}
                        onChange={(e) =>
                          setGalleryPaymentUrls((prev) => ({ ...prev, [gal.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => saveGalleryPayment(gal)}
                        className="px-4 py-3 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-accent hover:text-accent"
                      >
                        Save Link
                      </button>
                      <button
                        type="button"
                        onClick={() => saveGalleryPayment(gal, !gal.payment_verified)}
                        className={`px-4 py-3 border text-[10px] uppercase tracking-[0.2em] transition-colors ${
                          gal.payment_verified
                            ? 'border-green-400/40 text-green-300 hover:border-white hover:text-white'
                            : 'border-accent/50 text-accent hover:bg-accent hover:text-black'
                        }`}
                      >
                        {gal.payment_verified ? 'Mark Unpaid' : 'Verify Payment'}
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-4 border-t border-white/5 pt-4">
                    {(() => {
                      const docs = galleryDocuments[gal.id] || [];
                      return (
                        <>
                          <DocumentManager gallery={gal} documents={docs} actions={documentActionIds} onSend={sendGalleryDocument} onDownload={downloadGalleryDocument} onDelete={deleteGalleryDocument} headers={headers} onUpdated={updateSavedDocument} onNew={() => updateGalleryDocumentForm(gal.id, { documentType: 'invoice', title: 'Photography Invoice' })}>
                          {renderDocumentEditor(gal)}

                          </DocumentManager>
                        </>
                      );
                    })()}
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </section>
          </AdminAccordionPanel>
          )}

          {/* Content & Contact */}
          {shouldShowSection('content-contact') && (
          <AdminAccordionPanel
            id="content-contact"
            title="Homepage & Contact"
            summary={`${socials.length} social ${socials.length === 1 ? 'link' : 'links'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
            <div className={sectionCard}>
              <h2 className="text-2xl font-heading text-white italic">Homepage & About</h2>
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Entry Page</h3>
                <label className={label}>Entry Title</label>
                <input
                  className={inputClass}
                  value={contentForm.settings.entry.title}
                  onChange={(e) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        entry: { ...contentForm.settings.entry, title: e.target.value },
                      },
                    })
                  }
                />
                <label className={label}>Entry Tagline</label>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={contentForm.settings.entry.tagline}
                  onChange={(e) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        entry: { ...contentForm.settings.entry, tagline: e.target.value },
                      },
                    })
                  }
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className={label}>Desktop Background</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.entry.desktopImage}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            entry: { ...contentForm.settings.entry, desktopImage: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Mobile Background</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.entry.mobileImage}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            entry: { ...contentForm.settings.entry, mobileImage: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className={label}>Philosophy Label</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.entry.philosophyLabel}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            entry: { ...contentForm.settings.entry, philosophyLabel: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Philosophy Text</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.entry.philosophyText}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            entry: { ...contentForm.settings.entry, philosophyText: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Location Label</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.entry.locationLabel}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            entry: { ...contentForm.settings.entry, locationLabel: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Location Text</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.entry.locationText}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            entry: { ...contentForm.settings.entry, locationText: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Photography Hero</h3>
                <label className={label}>Hero Text</label>
                <textarea
                  className={`${inputClass} min-h-[120px]`}
                  value={contentForm.homepage.heroText}
                  onChange={(e) => setContentForm({ ...contentForm, homepage: { ...contentForm.homepage, heroText: e.target.value } })}
                />
                <label className={label}>Hero Image</label>
                <input
                  className={inputClass}
                  value={contentForm.homepage.heroImage}
                  onChange={(e) => setContentForm({ ...contentForm, homepage: { ...contentForm.homepage, heroImage: e.target.value } })}
                />
                <label className={label}>Hero Subtext</label>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={contentForm.settings.photography.heroSubtext}
                  onChange={(e) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        photography: { ...contentForm.settings.photography, heroSubtext: e.target.value },
                      },
                    })
                  }
                />
                <label className={label}>Hero Button</label>
                <input
                  className={inputClass}
                  value={contentForm.settings.photography.heroCta}
                  onChange={(e) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        photography: { ...contentForm.settings.photography, heroCta: e.target.value },
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">About Section</h3>
                <label className={label}>About Text</label>
                <textarea
                  className={`${inputClass} min-h-[120px]`}
                  value={contentForm.about.text}
                  onChange={(e) => setContentForm({ ...contentForm, about: { ...contentForm.about, text: e.target.value } })}
                />
                <label className={label}>About Image</label>
                <input
                  className={inputClass}
                  value={contentForm.about.image}
                  onChange={(e) => setContentForm({ ...contentForm, about: { ...contentForm.about, image: e.target.value } })}
                />
              </div>
              <div className="space-y-3 border-t border-white/5 pt-6">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Art Profile Assets</h3>
                {renderContentUploadField({
                  labelText: 'Art Hero Image',
                  value: contentForm.settings.art.heroImage,
                  target: 'content-art-hero-image',
                  onChange: (url) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        art: { ...contentForm.settings.art, heroImage: url },
                      },
                    }),
                })}
                {renderContentUploadField({
                  labelText: 'Art About Image',
                  value: contentForm.settings.art.aboutImage,
                  target: 'content-art-about-image',
                  onChange: (url) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        art: { ...contentForm.settings.art, aboutImage: url },
                      },
                    }),
                })}
                <div className="grid gap-4 md:grid-cols-2">
                  {renderContentUploadField({
                    labelText: 'Selected Work Preview 1',
                    value: contentForm.settings.art.previewImageOne,
                    target: 'content-art-preview-image-one',
                    onChange: (url) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          art: { ...contentForm.settings.art, previewImageOne: url },
                        },
                      }),
                  })}
                  {renderContentUploadField({
                    labelText: 'Selected Work Preview 2',
                    value: contentForm.settings.art.previewImageTwo,
                    target: 'content-art-preview-image-two',
                    onChange: (url) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          art: { ...contentForm.settings.art, previewImageTwo: url },
                        },
                      }),
                  })}
                </div>
              </div>
              <div className="space-y-3 border-t border-white/5 pt-6">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Photography Page Visibility</h3>
                {[
                  ['showPortfolio', 'Portfolio'],
                  ['showAbout', 'About'],
                  ['showDigitalProducts', 'Digital Products'],
                  ['showBooking', 'Booking'],
                  ['showReviews', 'Reviews'],
                  ['showNewsletter', 'Newsletter'],
                ].map(([key, text]) => (
                  <label key={key} className={adminToggleClass}>
                    <span className="min-w-0 break-words uppercase tracking-[0.16em] sm:tracking-[0.22em]">{text}</span>
                    <input
                      type="checkbox"
                      checked={contentForm.settings.photography[key as keyof SiteSettings['photography']] as boolean}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            photography: {
                              ...contentForm.settings.photography,
                              [key]: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-4 border-t border-white/5 pt-6">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Section Copy</h3>
                <div className="space-y-2">
                  <label className={label}>Portfolio Eyebrow</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.portfolio.eyebrow}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          portfolio: { ...contentForm.settings.portfolio, eyebrow: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Portfolio Title</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.portfolio.title}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          portfolio: { ...contentForm.settings.portfolio, title: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Portfolio Description</label>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={contentForm.settings.portfolio.description}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          portfolio: { ...contentForm.settings.portfolio, description: e.target.value },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Digital Product Eyebrow</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.digitalProducts.eyebrow}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          digitalProducts: { ...contentForm.settings.digitalProducts, eyebrow: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Digital Product Title</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.digitalProducts.title}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          digitalProducts: { ...contentForm.settings.digitalProducts, title: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Digital Product Description</label>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={contentForm.settings.digitalProducts.description}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          digitalProducts: { ...contentForm.settings.digitalProducts, description: e.target.value },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Booking Eyebrow</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.booking.eyebrow}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          booking: { ...contentForm.settings.booking, eyebrow: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Booking Title</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.booking.title}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          booking: { ...contentForm.settings.booking, title: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Booking Description</label>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={contentForm.settings.booking.description}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          booking: { ...contentForm.settings.booking, description: e.target.value },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className={label}>Newsletter Eyebrow</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.newsletter.eyebrow}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          newsletter: { ...contentForm.settings.newsletter, eyebrow: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Newsletter Title</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.newsletter.photographyTitle}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          newsletter: { ...contentForm.settings.newsletter, photographyTitle: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Newsletter Description</label>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={contentForm.settings.newsletter.photographyDescription}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          newsletter: { ...contentForm.settings.newsletter, photographyDescription: e.target.value },
                        },
                      })
                    }
                  />
                  <label className={label}>Newsletter Button</label>
                  <input
                    className={inputClass}
                    value={contentForm.settings.newsletter.photographyButton}
                    onChange={(e) =>
                      setContentForm({
                        ...contentForm,
                        settings: {
                          ...contentForm.settings,
                          newsletter: { ...contentForm.settings.newsletter, photographyButton: e.target.value },
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-3 border-t border-white/5 pt-6">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Footer</h3>
                <label className={label}>Footer Tagline</label>
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={contentForm.settings.footer.tagline}
                  onChange={(e) =>
                    setContentForm({
                      ...contentForm,
                      settings: {
                        ...contentForm.settings,
                        footer: { ...contentForm.settings.footer, tagline: e.target.value },
                      },
                    })
                  }
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className={label}>Privacy Label</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.footer.privacyLabel}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            footer: { ...contentForm.settings.footer, privacyLabel: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={label}>Terms Label</label>
                    <input
                      className={inputClass}
                      value={contentForm.settings.footer.termsLabel}
                      onChange={(e) =>
                        setContentForm({
                          ...contentForm,
                          settings: {
                            ...contentForm.settings,
                            footer: { ...contentForm.settings.footer, termsLabel: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={saveContent}
                className="w-full bg-accent hover:bg-white text-black py-4 px-5 text-[10px] uppercase tracking-[0.24em] font-medium transition-all sm:px-8 sm:tracking-[0.4em]"
              >
                Save Content
              </button>
            </div>

            <div className={sectionCard}>
              <h2 className="text-2xl font-heading text-white italic">Contact & Social</h2>
              <div className="space-y-3">
                <label className={label}>Phone</label>
                <input
                  className={inputClass}
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                />
                <label className={label}>Email</label>
                <input
                  className={inputClass}
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
                <label className={label}>Address</label>
                <input
                  className={inputClass}
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                />
                <button
                  onClick={saveContact}
                  className="w-full bg-accent hover:bg-white text-black py-4 px-5 text-[10px] uppercase tracking-[0.24em] font-medium transition-all sm:px-8 sm:tracking-[0.4em]"
                >
                  Save Contact
                </button>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-accent sm:tracking-[0.4em]">Social Links</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    className={inputClass}
                    placeholder="Platform"
                    value={socialForm.platform}
                    onChange={(e) => setSocialForm({ ...socialForm, platform: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="URL"
                    value={socialForm.url}
                    onChange={(e) => setSocialForm({ ...socialForm, url: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Icon (optional)"
                    value={socialForm.icon}
                    onChange={(e) => setSocialForm({ ...socialForm, icon: e.target.value })}
                  />
                </div>
                <button
                  onClick={addSocial}
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-3 text-[10px] uppercase tracking-[0.22em] sm:tracking-[0.3em]"
                >
                  Add Social
                </button>
                <div className="space-y-2">
                  {socials.map((s) => (
                    <div key={s.id} className="grid min-w-0 gap-2 border border-white/10 p-3 text-xs lg:grid-cols-[1fr_1.5fr_0.8fr_auto]">
                      <input
                        className={`${inputClass} py-2 text-xs`}
                        value={editingSocials[s.id]?.platform || ''}
                        onChange={(e) =>
                          setEditingSocials((prev) => ({
                            ...prev,
                            [s.id]: { ...(prev[s.id] || s), platform: e.target.value },
                          }))
                        }
                      />
                      <input
                        className={`${inputClass} py-2 text-xs`}
                        value={editingSocials[s.id]?.url || ''}
                        onChange={(e) =>
                          setEditingSocials((prev) => ({
                            ...prev,
                            [s.id]: { ...(prev[s.id] || s), url: e.target.value },
                          }))
                        }
                      />
                      <input
                        className={`${inputClass} py-2 text-xs`}
                        placeholder="instagram"
                        value={editingSocials[s.id]?.icon || ''}
                        onChange={(e) =>
                          setEditingSocials((prev) => ({
                            ...prev,
                            [s.id]: { ...(prev[s.id] || s), icon: e.target.value },
                          }))
                        }
                      />
                      <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
                        <a href={editingSocials[s.id]?.url || s.url} className="break-all text-accent underline" target="_blank" rel="noreferrer">
                          View
                        </a>
                        <button onClick={() => updateSocial(s.id)} className="text-white/70 hover:text-white">
                          Save
                        </button>
                        <button onClick={() => deleteSocial(s.id.toString())} className="text-red-400 hover:text-red-200">
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          </AdminAccordionPanel>
          )}

          {/* Orders */}
          {shouldShowSection('orders') && (
          <AdminAccordionPanel
            id="orders"
            title="Orders"
            summary={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
            openSection={displayedOpenSection}
            onOpen={setDisplayedOpenSection}
          >
          <section className={sectionCard}>
            <h2 className="text-2xl font-heading text-white italic mb-4">Orders</h2>
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-white">
                    <span>{order.customer_email}</span>
                    <span className="text-white/50">Total: ${order.total_price}</span>
                  </div>
                  <div className="text-xs text-white/60">Items: {order.items?.length || 0}</div>
                  <select
                    className={`${inputClass} text-xs`}
                    value={order.status}
                    onChange={(e) => updateOrder(order.id.toString(), e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
              {orders.length === 0 && <p className="text-white/40 text-xs">No orders yet.</p>}
            </div>
          </section>
          </AdminAccordionPanel>
          )}
        </div>
      </section>

      <Footer />
    </main>
      )}
    </>
  );
}
