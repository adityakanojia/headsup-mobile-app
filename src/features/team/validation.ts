/**
 * Team feature — input sanitisation & validation.
 * Kept pure (no React) so it can be unit-tested and reused by the
 * contractor apply-to-job flow when adding inline members.
 */

export const PHONE_LENGTH = 10;
export const OTP_LENGTH = 6;
export const NAME_MAX_LENGTH = 60;
export const COUNTRY_CODE = '+91';

/** Strip everything except digits and cap at max length. */
export function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Strip digits and symbols, keeping letters in any script plus spaces, dots,
 * apostrophes and hyphens. Uses a denylist rather than \p{L} for Hermes portability.
 */
export function sanitizeName(value: string): string {
  return value
    .replace(/[0-9_@#$%^&*()+=[\]{};:"\\|,<>/?!~`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, NAME_MAX_LENGTH);
}

/** Indian mobile numbers: 10 digits, starting 6–9. Returns an error message or null. */
export function validateIndianMobile(phone: string): string | null {
  if (phone.length !== PHONE_LENGTH) return 'Enter a valid 10-digit mobile number';
  if (!/^[6-9]/.test(phone)) return 'Mobile number must start with 6, 7, 8 or 9';
  return null;
}

export function validateOtp(otp: string): string | null {
  return otp.length === OTP_LENGTH ? null : `Enter the ${OTP_LENGTH}-digit code`;
}

export function toE164(phone: string): string {
  return `${COUNTRY_CODE}${phone}`;
}

/** Display helper: "+919876543210" → "+91 98765 43210". */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > PHONE_LENGTH ? digits.slice(-PHONE_LENGTH) : digits;
  if (local.length !== PHONE_LENGTH) return phone;
  return `${COUNTRY_CODE} ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
