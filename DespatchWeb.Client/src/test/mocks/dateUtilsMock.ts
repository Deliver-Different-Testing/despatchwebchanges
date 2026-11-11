// Use via:
//   vi.mock('../../utils/dateUtils', async () =>
//       (await import('../../test/mocks/dateUtilsMock')).nzDateUtilsMock());
// Dynamic import (not a static one): vi.mock factories are hoisted above top-level imports.
export const nzDateUtilsMock = () => ({
    formatMins: vi.fn((d: any) => d?.format?.('HH:mm') || ''),
    formatShortDate: vi.fn((d: any) => d?.format?.('DD/MMM') || ''),
    getInputDateFormat: vi.fn(() => 'DD/MM/YYYY'),
    parseInputDate: vi.fn((input: string) => {
        const m = input?.match?.(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) return null;
        const [, dd, mm, yyyy] = m;
        return {isValid: () => true, format: () => `${dd}/${mm}/${yyyy}`};
    }),
    getIanaTimezone: vi.fn(() => 'Pacific/Auckland'),
    getTenantTimezone: vi.fn(() => 'New Zealand Standard Time'),
    getTimezoneAbbreviation: vi.fn(() => 'NZST'),
    isUsCustomer: vi.fn(() => false),
});
