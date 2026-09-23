import { parseBookingDate } from '@/lib/bookingDates';

export const ENIYAN_BOOKING_SERVICES = [
  { id: 'portrait', label: 'Portrait photography' },
  { id: 'editorial', label: 'Editorial photography' },
  { id: 'commercial', label: 'Commercial photography' },
  { id: 'other', label: 'Other photography / event' },
] as const;

export type BookingDraft = {
  name: string; email: string; phone: string; service: string; message: string;
  bookingDate: string; bookingTime: string;
};

export function bookingDetailsError(draft: BookingDraft, requireContact = false) {
  if (!draft.name || draft.name.length > 120) return 'Enter your name (up to 120 characters).';
  if (draft.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return 'Enter a valid email address.';
  if (!draft.service || draft.service.length > 80) return 'Choose a service.';
  if (draft.phone.length > 40 || draft.message.length > 3000) return 'Phone must be at most 40 characters and project details at most 3000 characters.';
  if (requireContact) {
    if (!ENIYAN_BOOKING_SERVICES.some(service => service.id === draft.service)) return 'Choose one of the photography services.';
    if (!/^[+\d\s().-]+$/.test(draft.phone) || draft.phone.replace(/\D/g, '').length < 7 || draft.phone.replace(/\D/g, '').length > 15) return 'Enter a valid contact phone number, including your country code.';
    if (draft.message.length < 5) return 'Tell the studio a little about your project (at least 5 characters).';
  }
  return '';
}

export function bookingSlotError(draft: Pick<BookingDraft, 'bookingDate' | 'bookingTime'>, now = Date.now()) {
  const date = parseBookingDate(draft.bookingDate, draft.bookingTime);
  if (!date) return 'Choose a valid booking date and time.';
  return date.getTime() <= now ? 'Choose a future booking slot.' : '';
}

export function wantsEniyanBooking(text: string) {
  const value = text.toLowerCase();
  // Opening the form is never permission to submit. Existing bookings and art
  // commissions stay in the ordinary guide; the dedicated button is always available.
  if (/\b(cancel|reschedul|refund|receipt|invoice|contract|already|status|gallery|commission|painting|artwork|don'?t|do not)\w*\b/.test(value)) return false;
  return /\b(book|reserve|schedule)\b.{0,50}\b(session|shoot|photography|photoshoot|portrait|appointment)\b/.test(value)
    || /^(?:i (?:want|would like) to )?book(?: a session)?[.!?]*$/.test(value.trim());
}
