export type SupportedLocale = 'en' | 'es';

const stripSpaces = (value: string) => value.replace(/\s+/g, '');

function isThousandsGroup(value: string, separator: '.' | ',') {
  return new RegExp(`^\\d{1,3}(${separator}\\d{3})+$$`).test(value);
}

function compactDecimal(value: string) {
  if (!value.includes('.')) return value;
  const result = value.replace(/(\.\d*?[1-9])0+$/g, '$1').replace(/\.0+$/g, '');
  return result === '' ? '0' : result;
}

export function normaliseAmountInput(raw: string, locale: SupportedLocale): string | null {
  const value = stripSpaces(raw);
  if (!value || value === '.' || value === ',' || value === '-' || value === '+') {
    return null;
  }

  if (locale === 'en') {
    if (value.includes(',') && value.includes('.')) {
      if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(value)) return null;
      if (value.lastIndexOf('.') < value.lastIndexOf(',')) return null;
      return compactDecimal(value.replace(/,/g, ''));
    }

    if (value.includes(',')) {
      if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(value)) return null;
      return compactDecimal(value.replace(/,/g, ''));
    }

    if (value.includes('.')) {
      if (value.endsWith('.') || !/^\d*(\.\d+)?$/.test(value) || value === '.') return null;
      return compactDecimal(value);
    }

    return /^\d+$/.test(value) ? value : null;
  }

  if (value.includes('.') && value.includes(',')) {
    if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(value)) return null;
    if (value.lastIndexOf(',') < value.lastIndexOf('.')) return null;
    return compactDecimal(value.replace(/\./g, '').replace(',', '.'));
  }

  if (value.includes('.')) {
    if (isThousandsGroup(value, '.')) return compactDecimal(value.replace(/\./g, ''));
    return null;
  }

  if (value.includes(',')) {
    if (value.endsWith(',') || !/^\d*(,\d+)?$/.test(value) || value === ',') return null;
    return compactDecimal(value.replace(',', '.'));
  }

  return /^\d+$/.test(value) ? value : null;
}
