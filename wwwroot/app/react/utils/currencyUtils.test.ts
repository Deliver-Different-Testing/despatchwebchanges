/** @jest-environment jest-environment-jsdom */
import {formatCurrency, formatCurrencyOrDash} from './currencyUtils';

beforeEach(() => {
    window.CurrencyCode = 'NZD';
});

describe('formatCurrency', () => {
    it('formats amount with the configured currency', () => {
        const result = formatCurrency(1234.5);
        expect(result).toContain('1,234.50');
    });

    it('formats with a different currency when CurrencyCode changes', () => {
        window.CurrencyCode = 'USD';
        const result = formatCurrency(100);
        expect(result).toContain('100.00');
        expect(result).toContain('$');
    });

    it('defaults to NZD when CurrencyCode is not set', () => {
        delete (window as any).CurrencyCode;
        const result = formatCurrency(50);
        expect(result).toContain('50.00');
    });
});

describe('formatCurrencyOrDash', () => {
    it('returns em dash for null', () => {
        expect(formatCurrencyOrDash(null)).toBe('\u2014');
    });

    it('returns em dash for undefined', () => {
        expect(formatCurrencyOrDash(undefined)).toBe('\u2014');
    });

    it('formats valid amounts', () => {
        expect(formatCurrencyOrDash(42.5)).toContain('42.50');
    });
});
