/** Mantine palette names used for member avatars (gray/dark excluded for contrast). */
export const MEMBER_COLORS = [
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

/** Stable color from an id (FNV-1a hash), so a person reads the same everywhere. */
export function colorForId(id: string): MemberColor {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return MEMBER_COLORS[(hash >>> 0) % MEMBER_COLORS.length];
}

/** Up to two initials for an avatar: "Jon Luu" -> "JL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
