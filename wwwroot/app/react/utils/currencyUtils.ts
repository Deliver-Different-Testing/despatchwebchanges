// Cached Intl.NumberFormat instance per currency code
let _cachedFormatter: Intl.NumberFormat | null = null;
let _cachedCurrencyCode: string | null = null;

export const formatCurrency = (amount: number): string => {
    const code = window.CurrencyCode || 'NZD';
    if (_cachedCurrencyCode !== code) {
        _cachedFormatter = new Intl.NumberFormat('en-NZ', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        _cachedCurrencyCode = code;
    }
    return _cachedFormatter!.format(amount);
};

export const formatCurrencyOrDash = (amount: number | null | undefined): string => {
    if (amount == null) return '\u2014';
    return formatCurrency(amount);
};
