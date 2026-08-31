// Unified phone-auth provider for Kuvira.
//
// Kuvira supports two auth modes, selected by EXPO_PUBLIC_AUTH_MODE:
//   - "firebase" (production): Firebase Phone Authentication sends & verifies
//     the SMS, and the resulting Firebase ID token is exchanged with the
//     backend for a Kuvira JWT. Requires a native/dev build (Firebase native
//     module is unavailable in Expo Go).
//   - "mock" (preview/dev, default): the backend issues a deterministic OTP
//     (123456) so the full app is usable in Expo Go and the web preview.
//
// This abstraction never imports the Firebase modules at load time; the
// Firebase implementation is required lazily only in firebase mode, so the app
// boots cleanly in Expo Go where the native Firebase package does not exist.
import { api } from '@/src/api';

export type AuthMode = 'firebase' | 'mock';

export const AUTH_MODE: AuthMode =
  process.env.EXPO_PUBLIC_AUTH_MODE === 'firebase' ? 'firebase' : 'mock';

export const IS_MOCK_AUTH = AUTH_MODE === 'mock';

// Pure, dependency-free normalizer (kept local so mock mode never pulls Firebase).
export function normalizeIndianPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return `+${digits}`;
  throw new Error('Enter a valid Indian mobile number');
}

// Start verification: sends the SMS (firebase) or triggers the backend mock OTP.
export async function startVerification(mobile: string): Promise<{ demoOtp?: string }> {
  const phone = normalizeIndianPhone(mobile);
  if (AUTH_MODE === 'firebase') {
    const { startPhoneVerification } = require('@/src/firebase');
    await startPhoneVerification(phone);
    return {};
  }
  const res: any = await api.otpStart(phone);
  return { demoOtp: res?.demo_otp };
}

// Confirm the code. Returns the credential to hand to the backend verify endpoint
// (a Firebase ID token in firebase mode, or the raw OTP code in mock mode) and
// the verified phone number.
export async function confirmVerification(
  mobile: string,
  code: string,
): Promise<{ credential: string; phoneNumber: string }> {
  const phone = normalizeIndianPhone(mobile);
  if (AUTH_MODE === 'firebase') {
    const { confirmPhoneVerification } = require('@/src/firebase');
    const { idToken, phoneNumber } = await confirmPhoneVerification(code);
    return { credential: idToken, phoneNumber };
  }
  return { credential: code.trim(), phoneNumber: phone };
}

export async function resendVerification(mobile: string): Promise<{ demoOtp?: string }> {
  const phone = normalizeIndianPhone(mobile);
  if (AUTH_MODE === 'firebase') {
    const { resendPhoneVerification } = require('@/src/firebase');
    await resendPhoneVerification(phone);
    return {};
  }
  const res: any = await api.otpStart(phone);
  return { demoOtp: res?.demo_otp };
}

export async function signOutAuth(): Promise<void> {
  if (AUTH_MODE === 'firebase') {
    try {
      const { signOutFirebase } = require('@/src/firebase');
      await signOutFirebase();
    } catch {
      /* ignore */
    }
  }
}
