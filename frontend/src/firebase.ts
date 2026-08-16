import { Platform } from 'react-native';

let confirmation: any = null;
let authInstance: any = null;
let recaptchaVerifier: any = null;

const firebaseConfig = {
  apiKey: 'AIzaSyBa_kmPvlVBKokrpcRnFgkIt0egoaQA6to',
  authDomain: 'kuvira-bc2be.firebaseapp.com',
  projectId: 'kuvira-bc2be',
  storageBucket: 'kuvira-bc2be.firebasestorage.app',
  messagingSenderId: '854169224186',
  appId: '1:854169224186:web:0f692ee347c312e64fda43',
  measurementId: 'G-5LBZ36J5SH',
};

function getWebAuth() {
  if (Platform.OS !== 'web') throw new Error('Firebase Web Auth is only available on web');
  if (authInstance) return authInstance;

  // Keep the native Firebase package out of the browser initialization path.
  const { getApps, getApp, initializeApp } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  return authInstance;
}

function getWebRecaptchaVerifier() {
  if (recaptchaVerifier) return recaptchaVerifier;

  const { RecaptchaVerifier } = require('firebase/auth');
  const auth = getWebAuth();
  let container = document.getElementById('kuvira-recaptcha-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'kuvira-recaptcha-container';
    document.body.appendChild(container);
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  return recaptchaVerifier;
}

function getNativeAuth() {
  if (Platform.OS === 'web') throw new Error('Native Firebase Auth is not available on web');
  const auth = require('@react-native-firebase/auth').default;
  return auth();
}

export function normalizeIndianPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return `+${digits}`;
  throw new Error('Enter a valid Indian mobile number');
}

export async function startPhoneVerification(mobile: string): Promise<void> {
  const phoneNumber = normalizeIndianPhone(mobile);

  if (Platform.OS === 'web') {
    const { signInWithPhoneNumber } = require('firebase/auth');
    confirmation = await signInWithPhoneNumber(getWebAuth(), phoneNumber, getWebRecaptchaVerifier());
    return;
  }

  confirmation = await getNativeAuth().signInWithPhoneNumber(phoneNumber);
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
  if (Platform.OS === 'web' && recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* ignore */ }
    recaptchaVerifier = null;
  }
  await startPhoneVerification(mobile);
}

export async function signOutFirebase(): Promise<void> {
  confirmation = null;
  if (Platform.OS === 'web') {
    await getWebAuth().signOut();
  } else {
    await getNativeAuth().signOut();
  }
}
