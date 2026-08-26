import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBa_kmPvlVBKokrpcRnFgkIt0egoaQA6to',
  authDomain: 'kuvira-bc2be.firebaseapp.com',
  projectId: 'kuvira-bc2be',
  storageBucket: 'kuvira-bc2be.firebasestorage.app',
  messagingSenderId: '854169224186',
  appId: '1:854169224186:web:0f692ee347c312e64fda43',
  measurementId: 'G-5LBZ36J5SH',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

export function normalizeIndianPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return `+${digits}`;
  throw new Error('Enter a valid Indian mobile number');
}

function getRecaptchaVerifier(): RecaptchaVerifier {
  if (verifier) return verifier;

  let container = document.getElementById('kuvira-recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'kuvira-recaptcha-container';
    document.body.appendChild(container);
  }

  verifier = new RecaptchaVerifier(auth, container, {
    size: 'invisible',
  });

  return verifier;
}

export async function startPhoneVerification(mobile: string): Promise<void> {
  const phoneNumber = normalizeIndianPhone(mobile);
  confirmation = await signInWithPhoneNumber(auth, phoneNumber, getRecaptchaVerifier());
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
  if (verifier) {
    try {
      await verifier.clear();
    } catch {
      // Ignore cleanup errors and recreate the verifier below.
    }
    verifier = null;
  }
  await startPhoneVerification(mobile);
}

export async function signOutFirebase(): Promise<void> {
  confirmation = null;
  await auth.signOut();
}
