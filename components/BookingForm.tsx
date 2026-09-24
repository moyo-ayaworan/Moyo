'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Mail, Phone, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslate } from '@/lib/translations';
import GlareHover from '@/components/GlareHover';
import { useSiteSettings } from '@/lib/useSiteSettings';
import { parseBookingDate } from '@/lib/bookingDates';
import { BOOKING_PACKAGES, DEFAULT_BOOKING_OPTIONS, calculateBookingEstimate, formatNaira, getBookingPackage, type BookingOptions } from '@/lib/bookingRates';

type BookingFormProps = {
    embedded?: boolean;
};

type BookingStatus = 'idle' | 'loading' | 'success' | 'error';

const SLOT_TIMES = [
    { id: '09:00', label: '9:00 AM' },
    { id: '11:00', label: '11:00 AM' },
    { id: '13:00', label: '1:00 PM' },
    { id: '15:00', label: '3:00 PM' },
    { id: '17:00', label: '5:00 PM' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: dateKey(start), end: dateKey(end) };
}

function buildMonthDays(date: Date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const blanks = Array.from({ length: first.getDay() }, () => null);
    const days = Array.from({ length: total }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1));
    return [...blanks, ...days];
}

export default function BookingForm({ embedded = false }: BookingFormProps) {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', service: 'portrait', packageId: 'portrait-one', message: '' });
    const [bookingOptions, setBookingOptions] = useState<BookingOptions>({ ...DEFAULT_BOOKING_OPTIONS });
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const [month, setMonth] = useState(() => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })));
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
    const [availability, setAvailability] = useState<{ month: string; error: boolean }>({ month: '', error: false });
    const [availabilityRetry, setAvailabilityRetry] = useState(0);
    const [status, setStatus] = useState<BookingStatus>('idle');
    const [notice, setNotice] = useState('');
    const [contact, setContact] = useState({ email: 'ijabikenm@gmail.com', phone: '+2348148192201' });
    const { language } = useLanguage();
    const { t, translateText } = useTranslate(language);
    const settings = useSiteSettings();

    const estimate = useMemo(() => calculateBookingEstimate(formData.packageId, bookingOptions), [formData.packageId, bookingOptions]);

    const today = useMemo(() => startOfDay(new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))), [now]);
    const days = useMemo(() => buildMonthDays(month), [month]);
    const monthLabel = useMemo(() => (
        new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)
    ), [month]);
    const selectedDateLabel = useMemo(() => {
        if (!selectedDate) return 'Pick a date';
        return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${selectedDate}T12:00:00`));
    }, [selectedDate]);
    const activeBookedSlots = bookedSlots[selectedDate] || [];
    const availabilityReady = availability.month === monthRange(month).start && !availability.error;
    const selectedSlotIsPast = !!selectedDate && !!selectedTime && (parseBookingDate(selectedDate, selectedTime)?.getTime() ?? 0) <= now;

    useEffect(() => {
        fetch('/api/contact')
            .then((res) => res.json())
            .then((data) => {
                setContact({
                    email: data.contact?.email || 'ijabikenm@gmail.com',
                    phone: data.contact?.phone || '+2348148192201',
                });
            })
            .catch(() => null);
    }, []);

    useEffect(() => {
        const range = monthRange(month);
        const controller = new AbortController();
        fetch(`/api/bookings?start=${range.start}&end=${range.end}`, { signal: controller.signal })
            .then((res) => res.ok ? res.json() : Promise.reject())
            .then((data) => {
                if (controller.signal.aborted) return;
                setBookedSlots(data.booked || {});
                setAvailability({ month: range.start, error: false });
            })
            .catch(() => {
                if (!controller.signal.aborted) setAvailability({ month: range.start, error: true });
            });
        return () => controller.abort();
    }, [month, availabilityRetry]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status === 'loading') return;
        if (!availabilityReady || !selectedDate || !selectedTime || (parseBookingDate(selectedDate, selectedTime)?.getTime() ?? 0) <= Date.now() || activeBookedSlots.includes(selectedTime)) {
            setStatus('error');
            setNotice('Please choose an available date and time.');
            return;
        }
        setStatus('loading');
        setNotice('');

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    options: bookingOptions,
                    bookingDate: selectedDate,
                    bookingTime: selectedTime,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                setStatus('success');
                setNotice(data.emailSent ? 'Booking request saved. A confirmation email has been sent.' : 'Booking request saved. The confirmation email could not be sent. Please contact the studio for confirmation.');
                setBookedSlots((current) => ({
                    ...current,
                    [selectedDate]: [...(current[selectedDate] || []), selectedTime],
                }));
                setFormData({ name: '', email: '', phone: '', service: 'portrait', packageId: 'portrait-one', message: '' });
                setBookingOptions({ ...DEFAULT_BOOKING_OPTIONS });
                setSelectedDate('');
                setSelectedTime('');
            } else {
                if (res.status === 409) {
                    setBookedSlots((current) => ({ ...current, [selectedDate]: [...(current[selectedDate] || []), selectedTime] }));
                    setSelectedTime('');
                }
                setStatus('error');
                setNotice(typeof data.error === 'string' ? data.error : 'Could not send this booking request. Please try another slot.');
            }
        } catch {
            setStatus('error');
            setNotice('Could not send this booking request. Please try again.');
        }
    };

    const goToMonth = (offset: number) => {
        setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
        setSelectedDate('');
        setSelectedTime('');
    };

    const form = (
        <form onSubmit={handleSubmit} className="min-w-0 space-y-7 md:space-y-9">
            {!availabilityReady && <p role="status" className="text-sm text-foreground/60">
                {availability.error ? 'Availability could not be loaded.' : 'Loading available dates…'}
                {availability.error && <button type="button" className="ml-2 underline" onClick={() => { setAvailability({ month: '', error: false }); setAvailabilityRetry((value) => value + 1); }}>Try again</button>}
            </p>}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 group">
                    <label htmlFor="booking-name" className="block text-[10px] uppercase tracking-widest text-foreground/40">{t('booking.yourName')}</label>
                    <input id="booking-name" type="text" value={formData.name} required onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-transparent border-b border-foreground/10 py-3 text-foreground focus:outline-none focus:border-accent transition-colors font-body" />
                </div>
                <div className="space-y-2 group">
                    <label htmlFor="booking-email" className="block text-[10px] uppercase tracking-widest text-foreground/40">{t('booking.emailAddress')}</label>
                    <input id="booking-email" type="email" value={formData.email} required onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-transparent border-b border-foreground/10 py-3 text-foreground focus:outline-none focus:border-accent transition-colors font-body" />
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                <div className="space-y-4">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2 text-foreground">
                            <CalendarDays size={16} className="shrink-0 text-accent" />
                            <span className="truncate text-xs font-medium uppercase tracking-[0.18em]">{monthLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => goToMonth(-1)} className="grid size-9 place-items-center border border-foreground/10 text-foreground/50 transition hover:border-accent hover:text-accent" aria-label="Previous month"><ChevronLeft size={16} /></button>
                            <button type="button" onClick={() => goToMonth(1)} className="grid size-9 place-items-center border border-foreground/10 text-foreground/50 transition hover:border-accent hover:text-accent" aria-label="Next month"><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-foreground/30">
                        {WEEKDAYS.map((day) => <span key={day} className="py-2">{day}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => {
                            if (!day) return <span key={`blank-${index}`} className="aspect-square" />;
                            const key = dateKey(day);
                            const disabled = startOfDay(day) < today;
                            const isSelected = selectedDate === key;
                            const fullyBooked = (bookedSlots[key] || []).length >= SLOT_TIMES.length;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    disabled={!availabilityReady || disabled || fullyBooked}
                                    onClick={() => {
                                        setSelectedDate(key);
                                        setSelectedTime('');
                                    }}
                                    className={`aspect-square min-w-0 border text-sm transition ${isSelected ? 'border-accent bg-accent text-background' : disabled || fullyBooked ? 'border-transparent text-foreground/15' : 'border-foreground/10 text-foreground/60 hover:border-accent hover:text-accent'}`}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-4 border-t border-foreground/10 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                    <div className="flex min-w-0 items-center gap-2 text-foreground">
                        <Clock size={16} className="shrink-0 text-accent" />
                        <span className="truncate text-xs font-medium uppercase tracking-[0.18em]">{selectedDateLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {SLOT_TIMES.map((slot) => {
                            const past = !!selectedDate && (parseBookingDate(selectedDate, slot.id)?.getTime() ?? 0) <= now;
                            const booked = selectedDate ? activeBookedSlots.includes(slot.id) || past : false;
                            const isActive = selectedTime === slot.id && !booked;
                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    disabled={!availabilityReady || !selectedDate || booked}
                                    onClick={() => setSelectedTime(slot.id)}
                                    className={`min-h-11 border px-3 text-xs uppercase tracking-[0.16em] transition ${isActive ? 'border-accent bg-accent text-background' : !selectedDate || booked ? 'border-foreground/5 text-foreground/20' : 'border-foreground/10 text-foreground/55 hover:border-accent hover:text-accent'}`}
                                >
                                    {past ? 'Unavailable' : booked ? 'Booked' : slot.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/35">
                        Studio time, Lagos. Confirmation email is sent immediately; reminders are sent the day before and again on the booking day.
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                <label className="block text-[10px] uppercase tracking-widest text-foreground/40 font-medium">Choose a package</label>
                <div className="grid gap-3 sm:grid-cols-2">
                    {BOOKING_PACKAGES.map((service) => (
                        <button key={service.id} type="button" onClick={() => setFormData({ ...formData, packageId: service.id, service: service.category })} className={`border p-4 text-left transition-all duration-300 ${formData.packageId === service.id ? 'border-accent text-accent bg-accent/5' : 'border-foreground/10 text-foreground/60 hover:border-foreground/30 hover:text-foreground'}`}>
                            <span className="block text-xs font-medium uppercase tracking-wider">{service.label}</span>
                            <span className="mt-2 block text-lg">{service.price === null ? 'Quote required' : formatNaira(service.price)}</span>
                            <span className="mt-1 block text-xs leading-relaxed opacity-65">{service.details}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-5 border border-foreground/10 p-4 sm:p-6">
                <div><p className="text-[10px] uppercase tracking-widest text-foreground/40">Adjust your booking</p><p className="mt-1 text-xs text-foreground/45">Travel, rush work and custom additions are confirmed by the studio before payment.</p></div>
                <div className="grid gap-5 md:grid-cols-2">
                    <label className="text-xs text-foreground/60">Location<select value={bookingOptions.locationType} onChange={(e) => setBookingOptions({ ...bookingOptions, locationType: e.target.value as BookingOptions['locationType'] })} className="mt-2 min-h-11 w-full border border-foreground/10 bg-background px-3 text-foreground"><option value="lagos-studio">Lagos studio · included</option><option value="lagos-location">On-location in Lagos · quote</option><option value="outside-lagos">Outside Lagos · travel quote</option><option value="international">International · travel quote</option></select></label>
                    <label className="text-xs text-foreground/60">Delivery<select value={bookingOptions.deliverySpeed} onChange={(e) => setBookingOptions({ ...bookingOptions, deliverySpeed: e.target.value as BookingOptions['deliverySpeed'] })} className="mt-2 min-h-11 w-full border border-foreground/10 bg-background px-3 text-foreground"><option value="standard">Standard delivery</option><option value="rush">Rush delivery · quote</option></select></label>
                </div>
                {bookingOptions.locationType !== 'lagos-studio' && <label className="block text-xs text-foreground/60">Location / address<input required maxLength={300} value={bookingOptions.locationAddress} onChange={(e) => setBookingOptions({ ...bookingOptions, locationAddress: e.target.value })} className="mt-2 min-h-11 w-full border border-foreground/10 bg-transparent px-3 text-foreground" /></label>}
                <div className="grid grid-cols-3 gap-3">{([['extraImages', 'Extra images'], ['extraOutfits', 'Extra outfits'], ['extraHours', 'Extra hours']] as const).map(([key, label]) => <label key={key} className="text-xs text-foreground/60">{label}<input type="number" min="0" max="100" value={bookingOptions[key]} onChange={(e) => setBookingOptions({ ...bookingOptions, [key]: Number(e.target.value) })} className="mt-2 min-h-11 w-full border border-foreground/10 bg-transparent px-3 text-foreground" /></label>)}</div>
                <label className="flex gap-3 text-sm text-foreground/70"><input type="checkbox" checked={bookingOptions.extraShooter} onChange={(e) => setBookingOptions({ ...bookingOptions, extraShooter: e.target.checked })} />Extra photographer {getBookingPackage(formData.packageId)?.category === 'wedding' ? '· ₦100,000' : '· quote'}</label>
                <label className="flex gap-3 text-sm text-foreground/70"><input type="checkbox" checked={bookingOptions.productionNeeds} onChange={(e) => setBookingOptions({ ...bookingOptions, productionNeeds: e.target.checked })} />Production, permits or accommodation needed</label>
                <div className="border-t border-foreground/10 pt-4"><p className="text-lg text-foreground">Current estimate: <strong>{formatNaira(estimate.estimatedTotal)}</strong></p>{estimate.quoteRequired && <p className="mt-1 text-xs leading-relaxed text-foreground/50">Final quote required for {estimate.quoteReasons.join(', ')}. Your request will save these choices for the studio.</p>}</div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 group">
                    <label className="block text-[10px] uppercase tracking-widest text-foreground/40">Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-transparent border-b border-foreground/10 py-3 text-foreground focus:outline-none focus:border-accent transition-colors font-body" />
                </div>
                <div className="space-y-2 group">
                    <label className="block text-[10px] uppercase tracking-widest text-foreground/40">Selected Slot</label>
                    <div className="min-h-[49px] border-b border-foreground/10 py-3 text-sm text-foreground/60">
                        {selectedDate && selectedTime ? `${selectedDateLabel}, ${SLOT_TIMES.find((slot) => slot.id === selectedTime)?.label}` : 'Choose a date and time'}
                    </div>
                </div>
            </div>

            <div className="space-y-2 group">
                <label htmlFor="booking-message" className="block text-[10px] uppercase tracking-widest text-foreground/40">{t('booking.projectBrief')}</label>
                <textarea id="booking-message" rows={4} value={formData.message} required onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full bg-transparent border-b border-white/10 py-3 text-foreground focus:outline-none focus:border-accent transition-colors font-body resize-none" />
            </div>

            <button type="submit" aria-busy={status === 'loading'} disabled={!availabilityReady || selectedSlotIsPast || status === 'loading' || !selectedDate || !selectedTime || activeBookedSlots.includes(selectedTime)} className="flex min-h-14 w-full items-center justify-center gap-3 bg-white px-4 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-background transition-colors duration-300 hover:bg-accent hover:text-background disabled:opacity-50 sm:tracking-[0.35em]">
                <Sparkles size={16} />
                {status === 'loading' ? t('ui.sending') : 'Request Booking'}
            </button>
            {notice && <p role="status" className={`text-center text-xs leading-relaxed tracking-widest uppercase ${status === 'success' ? 'text-green-500' : 'text-red-500'}`}>{notice}</p>}
        </form>
    );

    const aside = (
        <div className="min-w-0 space-y-8 lg:space-y-12">
            <div className="space-y-4">
                <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-accent [overflow-wrap:anywhere] md:tracking-[0.5em]">
                    {translateText(settings.booking.eyebrow || t('booking.collaboration'))}
                </span>
                <h2 className="text-3xl font-heading font-light italic leading-tight text-foreground [overflow-wrap:anywhere] sm:text-4xl md:text-5xl">
                    {translateText(settings.booking.title || t('booking.heading'))}
                </h2>
            </div>

            <p className="max-w-md text-base leading-relaxed tracking-wide text-foreground/40 [overflow-wrap:anywhere] md:text-lg">
                {translateText(settings.booking.description || t('booking.description'))}
            </p>

            <div className="space-y-5 border-t border-foreground/5 pt-8 md:pt-12">
                <a href={`mailto:${contact.email}`} className="flex min-w-0 items-center gap-3 text-foreground/55 transition hover:text-accent">
                    <Mail size={16} className="shrink-0" />
                    <span className="truncate text-sm">{contact.email}</span>
                </a>
                <a href={`tel:${contact.phone}`} className="flex min-w-0 items-center gap-3 text-foreground/55 transition hover:text-accent">
                    <Phone size={16} className="shrink-0" />
                    <span className="truncate text-sm">{contact.phone}</span>
                </a>
            </div>
        </div>
    );

    if (embedded) {
        return (
            <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
                {aside}
                <GlareHover width="100%" height="auto" background="var(--glass-bg)" borderRadius="2px" borderColor="var(--glass-border)" glareOpacity={0.16} glareAngle={-30} glareSize={170} transitionDuration={780} className="glass" contentClassName="min-w-0 p-4 sm:p-8 md:p-10">
                    {form}
                </GlareHover>
            </div>
        );
    }

    return (
        <section id="contact" className="border-t border-foreground/5 bg-background py-24 md:py-32 lg:py-40">
            <div className="container mx-auto px-6 md:px-12 max-w-6xl">
                <div className="grid min-w-0 gap-14 lg:grid-cols-2 lg:gap-24">
                    {aside}
                    <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 1 }} className="min-w-0 rounded-sm">
                        <GlareHover width="100%" height="auto" background="var(--glass-bg)" borderRadius="2px" borderColor="var(--glass-border)" glareOpacity={0.16} glareAngle={-30} glareSize={170} transitionDuration={780} className="glass" contentClassName="min-w-0 p-4 sm:p-8 md:p-12 lg:p-14">
                            {form}
                        </GlareHover>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
