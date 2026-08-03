import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number | string, currency: string = 'GHS') {
  // Determine best locale for the currency
  const localeMap: Record<string, string> = {
    GHS: 'en-GH',
    USD: 'en-US',
    NGN: 'en-NG',
    KES: 'sw-KE',
  };
  const locale = localeMap[currency] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(amount));
}
