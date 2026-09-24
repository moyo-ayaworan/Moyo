'use client';

import { useEffect, useRef, useState } from 'react';
import { BOOKING_TIMES, isCalendarDate, parseBookingDate } from '@/lib/bookingDates';
import { bookingDetailsError, bookingSlotError, type BookingDraft } from '@/lib/bookingRequest';
import { DEFAULT_BOOKING_OPTIONS, getBookingPackage } from '@/lib/bookingRates';

const emptyDraft: BookingDraft = { name: '', email: '', phone: '', service: '', packageId: '', options: DEFAULT_BOOKING_OPTIONS, message: '', bookingDate: '', bookingTime: '' };
type Step = 'service' | 'schedule' | 'details' | 'review' | 'complete';
type Result = { id: number; emailSent: boolean; status: string };

// This hook lives in the chat shell, not its open/closed panel: closing the chat
// must not discard an in-flight submission or its retry key. No PII goes to Gemini.
export function useEniyanBooking() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<Step>('service');
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [availability, setAvailability] = useState<{ date: string; slots: string[]; error: boolean }>({ date: '', slots: [], error: false });
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<AbortController | null>(null);
  const submission = useRef<(BookingDraft & { source: 'eniyan'; confirmed: true; bookingRequestId: string }) | null>(null);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active || !isCalendarDate(draft.bookingDate)) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    const date = draft.bookingDate;
    fetch(`/api/bookings?start=${date}&end=${date}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.booked || typeof data.booked !== 'object' || Array.isArray(data.booked) || !Array.isArray(data.slots)) throw Error('availability');
        const taken = data.booked[date] || [];
        if (!Array.isArray(taken)) throw Error('availability');
        if (!cancelled) setAvailability({ date, slots: BOOKING_TIMES.filter(time => data.slots.includes(time) && !taken.includes(time)), error: false });
      })
      .catch(() => { if (!cancelled) setAvailability({ date, slots: [], error: true }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [active, draft.bookingDate, refresh]);

  const ready = availability.date === draft.bookingDate && !availability.error;
  const slots = ready ? availability.slots.filter(time => (parseBookingDate(draft.bookingDate, time)?.getTime() || 0) > now) : [];
  const locked = saving || uncertain;

  function start() { setActive(true); setError(''); }
  function update<K extends keyof BookingDraft>(field: K, value: BookingDraft[K]) {
    if (locked) return;
    setDraft(current => ({ ...current, [field]: value, ...(field === 'bookingDate' ? { bookingTime: '' } : {}) }));
    setError('');
  }
  function go(next: Step) {
    if (locked) return;
    setError('');
    if (next === 'details' || next === 'review') {
      const problem = bookingSlotError(draft);
      if (problem || !ready || !slots.includes(draft.bookingTime)) { setError(problem || 'Choose an available time first.'); setStep('schedule'); return; }
    }
    if (next === 'review') {
      const clean = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as BookingDraft;
      clean.email = clean.email.toLowerCase();
      const problem = bookingDetailsError(clean, true);
      if (problem) { setError(problem); return; }
      setDraft(clean);
    }
    setStep(next);
  }
  function chooseService(packageId: string) {
    const resolvedId = packageId === 'portrait' ? 'portrait-one' : packageId;
    const selectedPackage = getBookingPackage(resolvedId);
    if (!selectedPackage) return;
    setDraft(current => ({ ...current, packageId: resolvedId, service: selectedPackage.category, options: { ...DEFAULT_BOOKING_OPTIONS } }));
    setError(''); setStep('schedule');
  }
  function retryAvailability() { setAvailability({ date: '', slots: [], error: false }); setRefresh(value => value + 1); }
  function cancel() {
    if (locked) return;
    setActive(false); setDraft(emptyDraft); setStep('service'); setError(''); setResult(null); submission.current = null;
    setAvailability({ date: '', slots: [], error: false });
  }

  async function confirm() {
    if (pending.current || step !== 'review') return;
    if (!uncertain) {
      const problem = bookingDetailsError(draft, true) || bookingSlotError(draft);
      if (problem) { setError(problem); return; }
      submission.current = { ...draft, source: 'eniyan', confirmed: true, bookingRequestId: crypto.randomUUID() };
    }
    if (!submission.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true); setError('');
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission.current), signal: controller.signal,
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'slot_taken') {
        setUncertain(false); submission.current = null;
        setDraft(current => ({ ...current, bookingTime: '' }));
        retryAvailability(); setStep('schedule'); setError('That time was just taken. Your request was not saved; please choose another time.'); return;
      }
      if (response.status === 400) {
        setUncertain(false); submission.current = null; setStep('details');
        setError(typeof data.error === 'string' ? data.error : 'Please check your details.'); return;
      }
      if (!response.ok || !Number.isInteger(data.booking?.id) || data.booking.id <= 0 || typeof data.booking.status !== 'string') throw Error('unverified');
      setResult({ id: data.booking.id, emailSent: data.emailSent === true, status: data.booking.status });
      setUncertain(false); setStep('complete');
    } catch {
      // A timeout can happen after INSERT succeeded. Freeze the payload and retry
      // the same key, never silently turn a retry into a second booking/email.
      setUncertain(true);
      setError('We could not verify the result. Retry this same request to check whether it was saved. Do not create another booking yet.');
    } finally {
      window.clearTimeout(timeout); pending.current = null; setSaving(false);
    }
  }

  return { active, step, draft, ready, slots, availability, error, saving, uncertain, locked, result, now, start, update, go, chooseService, retryAvailability, cancel, confirm };
}

export type EniyanBookingFlow = ReturnType<typeof useEniyanBooking>;
