// Unified phone-auth provider for Kuvira.
// Firebase is loaded lazily so Expo Go/web preview can use mock auth.
import { api } from '@/src/api';

export type AuthMode = 'firebase' | 'mock';
export const AUTH_MODE: AuthMode = process.env.EXPO_PUBLIC_AUTH_MODE === 'firebase' ? 'firebase' : 'mock';
export const IS_MOCK_AUTH = AUTH_MODE === 'mock';

export function normalizeIndianPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return `+${digits}`;
  throw new Error('Enter a valid Indian mobile number');
}

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

export async function confirmVerification(mobile: string, code: string): Promise<{ credential: string; phoneNumber: string }> {
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
    } catch {}
  }
}
