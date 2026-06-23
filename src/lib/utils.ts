import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getFriendlyErrorMessage = (error: any): string => {
  const msg = error?.message || error || 'An unknown error occurred';
  const str = String(msg).toLowerCase();

  // Firebase Auth Errors
  if (str.includes('auth/invalid-credential') || str.includes('auth/wrong-password')) return 'Invalid credentials. Please check your details and try again.';
  if (str.includes('auth/user-not-found')) return 'No account found with this email.';
  if (str.includes('auth/id-token-expired') || str.includes('token has expired')) return 'Your security session has expired. Please refresh the page and log in again.';
  if (str.includes('auth/network-request-failed')) return 'Network connection lost. Please check your internet and try again.';
  if (str.includes('auth/too-many-requests')) return 'Too many attempts. Please try again later.';
  if (str.includes('auth/email-already-in-use')) return 'An account with this email already exists.';
  if (str.includes('auth/weak-password')) return 'Please choose a stronger password (at least 6 characters).';
  if (str.includes('auth/operation-not-allowed')) return 'This operation is not permitted. Please contact support.';
  if (str.includes('auth/requires-recent-login')) return 'For your security, please log out and log back in before doing this.';
  
  // Firestore / General Errors
  if (str.includes('permission-denied')) return 'You do not have permission to perform this action.';
  if (str.includes('not-found')) return 'The requested resource could not be found.';
  if (str.includes('aborted')) return 'The operation was aborted. Please try again.';
  if (str.includes('already-exists')) return 'This record already exists.';
  
  // TOTP specific
  if (str.includes('invalid authenticator code') || str.includes('invalid code') || str.includes('verification failed')) return 'Invalid authenticator code. Please try again.';
  
  // Generic Fallback
  return 'An unexpected error occurred. Please try again or contact support.';
};
