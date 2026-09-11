export const BOOKING_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00'];

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseBookingDate(date: string, time: string) {
  if (!isCalendarDate(date) || !BOOKING_TIMES.includes(time)) return null;
  return new Date(`${date}T${time}:00+01:00`);
}
