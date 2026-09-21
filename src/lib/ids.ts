import { customAlphabet, nanoid } from 'nanoid';

/** Generic entity id. */
export function newId(): string {
  return nanoid(12);
}

/** Uppercase alphabet without ambiguous characters (0/O, 1/I/L). */
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const inviteCode = customAlphabet(INVITE_CODE_ALPHABET, 6);

/** 6-char human-friendly invite code, e.g. "K7Q2MX". */
export function newInviteCode(): string {
  return inviteCode();
}

/** Normalize user-typed codes (trim, uppercase, strip spaces/dashes). */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}
