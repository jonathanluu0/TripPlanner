import dayjs from 'dayjs';

/** "Oct 9 – 11, 2026", "Oct 30 – Nov 2, 2026", "Oct 9, 2026", or '' when unset. */
export function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return '';
  const s = start ? dayjs(start) : null;
  const e = end ? dayjs(end) : null;
  if (s && !e) return s.format('MMM D, YYYY');
  if (!s && e) return `Until ${e.format('MMM D, YYYY')}`;
  if (!s || !e) return '';
  if (s.isSame(e, 'day')) return s.format('MMM D, YYYY');
  if (s.year() !== e.year()) return `${s.format('MMM D, YYYY')} – ${e.format('MMM D, YYYY')}`;
  if (s.month() === e.month()) return `${s.format('MMM D')} – ${e.format('D, YYYY')}`;
  return `${s.format('MMM D')} – ${e.format('MMM D, YYYY')}`;
}

/** Absolute invite link for a code, e.g. https://host/join/K7Q2MX */
export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}
