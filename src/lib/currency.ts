// Display-only currency + number-format setting (2026-09-14). Amounts stay
// unitless numbers in storage; this just decides which symbol wraps them and
// which locale's grouping/decimal separators toLocaleString uses. There's no
// conversion — the whole ledger is in one currency, whichever this is set to.
export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  // Currencies like JPY/KRW have no minor unit — formatting them with ".00"
  // reads wrong to anyone who uses them.
  decimals: number;
  // Symbol before ("$12.50") or after ("12,50 €") the number.
  position: 'prefix' | 'suffix';
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, position: 'prefix' },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, position: 'suffix' },
  { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, position: 'prefix' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar', decimals: 2, position: 'prefix' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar', decimals: 2, position: 'prefix' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar', decimals: 2, position: 'prefix' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0, position: 'prefix' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2, position: 'prefix' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2, position: 'prefix' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimals: 0, position: 'prefix' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimals: 2, position: 'prefix' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimals: 2, position: 'suffix' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', decimals: 2, position: 'suffix' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', decimals: 2, position: 'suffix' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', decimals: 2, position: 'suffix' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimals: 2, position: 'prefix' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', decimals: 2, position: 'prefix' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', decimals: 2, position: 'prefix' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar', decimals: 2, position: 'prefix' },
  { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar', decimals: 2, position: 'prefix' },
];

// Number-format locales offered alongside the currency. 'system' is the
// device's own (what every toLocaleString(undefined, …) call did before this
// setting existed). The rest cover the separator conventions that actually
// differ: "1,234.56", "1.234,56", "1 234,56", "1'234.56", "12,34,567.89".
export interface LocaleOption {
  tag: string;
  name: string;
}

export const LOCALES: LocaleOption[] = [
  { tag: 'system', name: 'Device default' },
  { tag: 'en-US', name: 'English (US)' },
  { tag: 'en-GB', name: 'English (UK)' },
  { tag: 'en-IN', name: 'English (India)' },
  { tag: 'de-DE', name: 'German' },
  { tag: 'fr-FR', name: 'French' },
  { tag: 'es-ES', name: 'Spanish' },
  { tag: 'it-IT', name: 'Italian' },
  { tag: 'nl-NL', name: 'Dutch' },
  { tag: 'pt-BR', name: 'Portuguese (Brazil)' },
  { tag: 'sv-SE', name: 'Swedish' },
  { tag: 'pl-PL', name: 'Polish' },
  { tag: 'de-CH', name: 'German (Switzerland)' },
  { tag: 'ja-JP', name: 'Japanese' },
  { tag: 'ko-KR', name: 'Korean' },
  { tag: 'zh-CN', name: 'Chinese (Simplified)' },
];

export interface CurrencySettings {
  currency: string; // a CURRENCIES code
  locale: string; // a LOCALES tag, 'system' for the device's own
}

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = { currency: 'USD', locale: 'system' };

export const CURRENCY_STORAGE_KEY = '@budgettracker/currency';

export function currencyOption(code: string): CurrencyOption {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

function resolveLocale(locale: string): string | undefined {
  return locale === 'system' ? undefined : locale;
}

function formatNumber(value: number, locale: string, decimals: number): string {
  try {
    return value.toLocaleString(resolveLocale(locale), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } catch {
    // An unsupported locale tag on a minimal Intl (older Hermes builds)
    // throws RangeError — fall back to the device default rather than crash
    // every amount on screen.
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
}

function wrapSymbol(number: string, option: CurrencyOption): string {
  if (option.position === 'suffix') return `${number} ${option.symbol}`;
  // Multi-letter "symbols" (CHF) read better with a space; single glyphs don't.
  return option.symbol.length > 1 && /^[A-Z]+$/.test(option.symbol) ? `${option.symbol} ${number}` : `${option.symbol}${number}`;
}

// "$1,234.56" / "-$1,234.56" / "1.234,56 €". The sign goes in front of the
// whole thing, not between symbol and digits — toLocaleString on its own
// would render a negative as "$-1,234.56".
export function formatMoney(amount: number, settings: CurrencySettings, opts: { decimals?: number } = {}): string {
  const option = currencyOption(settings.currency);
  const decimals = opts.decimals ?? option.decimals;
  const body = wrapSymbol(formatNumber(Math.abs(amount), settings.locale, decimals), option);
  return amount < 0 ? `-${body}` : body;
}

// "$1.2k" / "$5k" / "$1.5M" for chart axes and calendar cells, where a full
// "$1,234.56" doesn't fit. Whole numbers under 1000 show as-is.
export function formatMoneyCompact(amount: number, settings: CurrencySettings): string {
  const option = currencyOption(settings.currency);
  const abs = Math.abs(amount);
  let body: string;
  if (abs >= 1_000_000) body = `${trimZero((abs / 1_000_000).toFixed(1))}M`;
  else if (abs >= 1000) body = `${trimZero((abs / 1000).toFixed(1))}k`;
  else body = formatNumber(Math.round(abs), settings.locale, 0);
  const wrapped = wrapSymbol(body, option);
  return amount < 0 ? `-${wrapped}` : wrapped;
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
