// Use via:
//   jest.mock('../../utils/dateUtils', () =>
//       require('../../../tests/mocks/dateUtilsMock').nzDateUtilsMock());
// require() (not import) — jest.mock factories run before top-level imports resolve.
export const nzDateUtilsMock = () => ({
    formatMins: jest.fn((d: any) => d?.format?.('HH:mm') || ''),
    formatShortDate: jest.fn((d: any) => d?.format?.('DD/MMM') || ''),
    getInputDateFormat: jest.fn(() => 'DD/MM/YYYY'),
    parseInputDate: jest.fn((input: string) => {
        const m = input?.match?.(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) return null;
        const [, dd, mm, yyyy] = m;
        return {isValid: () => true, format: () => `${dd}/${mm}/${yyyy}`};
    }),
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
    getTenantTimezone: jest.fn(() => 'New Zealand Standard Time'),
    getTimezoneAbbreviation: jest.fn(() => 'NZST'),
    isUsCustomer: jest.fn(() => false),
});
