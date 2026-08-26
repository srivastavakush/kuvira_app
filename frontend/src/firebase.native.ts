import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

let confirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

export function normalizeIndianPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return `+${digits}`;
  throw new Error('Enter a valid Indian mobile number');
}

export async function startPhoneVerification(mobile: string): Promise<void> {
  const phoneNumber = normalizeIndianPhone(mobile);
  confirmation = await auth().signInWithPhoneNumber(phoneNumber);
}

export async function confirmPhoneVerification(code: string): Promise<{ idToken: string; phoneNumber: string }> {
  if (!confirmation) throw new Error('OTP session expired. Please request a new OTP.');
  const credential = await confirmation.confirm(code.trim());
  const idToken = await credential.user.getIdToken(true);
  const phoneNumber = credential.user.phoneNumber;
  confirmation = null;
  if (!phoneNumber) throw new Error('Firebase did not return a verified phone number.');
  return { idToken, phoneNumber };
}

export async function resendPhoneVerification(mobile: string): Promise<void> {
  await startPhoneVerification(mobile);
}

export async function signOutFirebase(): Promise<void> {
  confirmation = null;
  await auth().signOut();
}
