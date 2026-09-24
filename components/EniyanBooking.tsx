'use client';

import { useEffect, useRef } from 'react';
import { ENIYAN_BOOKING_SERVICES } from '@/lib/bookingRequest';
import type { EniyanBookingFlow } from '@/lib/useEniyanBooking';
import { isCalendarDate } from '@/lib/bookingDates';

export default function EniyanBooking({ flow, isLight }: { flow: EniyanBookingFlow; isLight: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [flow.step]);
  const { draft, step } = flow;
  const field = `mt-2 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-accent ${isLight ? 'border-black/20 bg-[#ffffff] text-[#141414]' : 'border-white/20 bg-[#191919] text-[#ffffff]'}`;
  const secondary = 'min-h-11 rounded-lg border border-current/25 px-3 py-2 text-sm disabled:opacity-40';
  const primary = 'min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#ffffff] disabled:opacity-40';
  const title = step === 'service' ? 'Let’s arrange your session.' : step === 'schedule' ? 'When would you like to come?' : step === 'details' ? 'Who are we booking for?' : step === 'review' ? 'Does everything look right?' : 'Booking request received';
  const dateLabel = isCalendarDate(draft.bookingDate) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'Africa/Lagos' }).format(new Date(`${draft.bookingDate}T12:00:00+01:00`)) : '';
  const serviceLabel = ENIYAN_BOOKING_SERVICES.find(item => item.id === draft.service)?.label || draft.service;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(flow.now));

  return <section aria-label="Book with Ẹnìyàn" className={`min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5 ${isLight ? 'text-[#141414]' : 'text-[#f5f5f5]'}`}>
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest opacity-65">Ẹnìyàn · guided booking · {step === 'service' ? '1 / 4' : step === 'schedule' ? '2 / 4' : step === 'details' ? '3 / 4' : step === 'review' ? '4 / 4' : 'Saved'}</p>
      <h3 ref={heading} tabIndex={-1} className="text-2xl outline-none">{title}</h3>
      {step !== 'complete' && <p className="text-xs leading-relaxed opacity-75">Nothing is submitted until you review your details and press “Confirm booking request”. All times are Lagos time (WAT, UTC+1).</p>}
    </div>
    {flow.error && <p role="alert" className="rounded-lg border border-accent/40 p-3 text-sm leading-relaxed">{flow.error}</p>}
    {step === 'service' && <div className="grid gap-2">{ENIYAN_BOOKING_SERVICES.map(service => <button key={service.id} type="button" onClick={() => flow.chooseService(service.id)} className={`${secondary} text-left`}>{service.label}</button>)}</div>}
    {step === 'schedule' && <form className="space-y-4" onSubmit={event => { event.preventDefault(); flow.go('details'); }}>
      <label className="block text-sm" htmlFor="eniyan-booking-date">Preferred date
        <input id="eniyan-booking-date" type="date" required min={today} max="9999-12-31" value={draft.bookingDate} onChange={event => flow.update('bookingDate', event.target.value)} className={field} />
      </label>
      {isCalendarDate(draft.bookingDate) && <fieldset className="space-y-2"><legend className="text-sm">Available times · WAT</legend>
        {flow.availability.error && flow.availability.date === draft.bookingDate ? <div role="alert" className="text-sm">I couldn’t check availability. <button type="button" className={`${secondary} mt-2`} onClick={flow.retryAvailability}>Retry availability</button></div>
          : !flow.ready ? <p role="status" className="text-sm">Checking the studio calendar…</p>
            : flow.slots.length === 0 ? <p role="status" className="text-sm">No times are available on this date. Please choose another day.</p>
              : <div className="flex flex-wrap gap-2">{flow.slots.map(time => <button type="button" key={time} aria-pressed={draft.bookingTime === time} className={draft.bookingTime === time ? primary : secondary} onClick={() => flow.update('bookingTime', time)}>{time}</button>)}</div>}
      </fieldset>}
      <p className="text-xs opacity-70">Availability can change. The system checks for conflicts again when you submit.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => flow.go('service')}>Back</button><button className={primary} disabled={!flow.ready || !flow.slots.includes(draft.bookingTime)}>Continue</button></div>
    </form>}
    {step === 'details' && <form className="space-y-4" onSubmit={event => { event.preventDefault(); flow.go('review'); }}>
      <p className="text-sm opacity-80">{serviceLabel}<br />{dateLabel} at {draft.bookingTime} WAT</p>
      {([
        ['name', 'Full name', 'text', 'name', 120],
        ['email', 'Email address', 'email', 'email', 254],
        ['phone', 'Phone, including country code', 'tel', 'tel', 40],
      ] as const).map(([key, label, type, autoComplete, maxLength]) => <label key={key} htmlFor={`eniyan-booking-${key}`} className="block text-sm">{label}<input id={`eniyan-booking-${key}`} type={type} autoComplete={autoComplete} required maxLength={maxLength} value={draft[key]} onChange={event => flow.update(key, event.target.value)} className={field} /></label>)}
      <label htmlFor="eniyan-booking-brief" className="block text-sm">Tell us about the project: location, purpose, and anything we should know<textarea id="eniyan-booking-brief" required minLength={5} maxLength={3000} rows={3} value={draft.message} onChange={event => flow.update('message', event.target.value)} className={field} /></label>
      <p className="text-xs leading-relaxed opacity-70">These booking fields go directly to the studio, not to Google Gemini. Please don’t include passwords, access codes or payment details.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => flow.go('schedule')}>Back</button><button className={primary}>Review booking request</button></div>
    </form>}
    {(step === 'review' || step === 'complete') && <div className="space-y-4">
      <dl className="space-y-3 rounded-lg border border-current/20 p-4 text-sm [overflow-wrap:anywhere]">
        {Object.entries({ Service: serviceLabel, Date: dateLabel, Time: `${draft.bookingTime} WAT (UTC+1)`, Name: draft.name, Email: draft.email, Phone: draft.phone, 'Project details': draft.message }).map(([label, value]) => <div key={label}><dt className="text-xs opacity-65">{label}</dt><dd className="mt-1 whitespace-pre-wrap">{value}</dd></div>)}
      </dl>
      {step === 'review' ? <>
        <p className="text-sm leading-relaxed">Confirming sends these details to the studio and requests this slot. Pricing, location and final arrangements still require studio confirmation. This does not make a payment.</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={flow.locked} className={secondary} onClick={() => flow.go('details')}>Edit details</button><button type="button" aria-busy={flow.saving} disabled={flow.saving} className={primary} onClick={() => void flow.confirm()}>{flow.saving ? 'Saving booking request…' : flow.uncertain ? 'Retry same booking request' : 'Confirm booking request'}</button></div>
        {flow.saving && <p role="status" className="text-sm">Checking and saving your request. Please wait.</p>}
      </> : <div role="status" className="space-y-3 text-sm leading-relaxed">
        <p>Your request is saved. Reference: <strong>#{flow.result?.id}</strong>. Status: {flow.result?.status}. The studio will confirm the final arrangements; this is not a payment confirmation.</p>
        <p>{flow.result?.emailSent ? `The booking email was sent to ${draft.email}. Check your inbox and spam folder for the private booking link.` : 'Email delivery has not been confirmed. Please contact ijabikenm@gmail.com with your reference number; do not create another request for this session.'}</p>
        <button type="button" className={primary} onClick={flow.cancel}>Return to chat</button>
      </div>}
    </div>}
    {step !== 'complete' && <button type="button" disabled={flow.locked} onClick={flow.cancel} className={`${secondary} w-full`}>Leave booking without submitting</button>}
    <p className="text-[11px] leading-relaxed opacity-65">Booking details stay in this open tab until you leave the booking flow. <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy</a></p>
  </section>;
}
