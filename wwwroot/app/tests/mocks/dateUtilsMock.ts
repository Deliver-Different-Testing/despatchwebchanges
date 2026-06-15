// Use via:
//   jest.mock('../../utils/dateUtils', () =>
//       require('../../../tests/mocks/dateUtilsMock').nzDateUtilsMock());
// require() (not import) — jest.mock factories run before top-level imports resolve.
export const nzDateUtilsMock = () => ({
    formatMins: jest.fn((d: any) => d?.format?.('HH:mm') || ''),
    formatShortDate: jest.fn((d: any) => d?.format?.('DD/MMM') || ''),
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
    getTenantTimezone: jest.fn(() => 'New Zealand Standard Time'),
    getTimezoneAbbreviation: jest.fn(() => 'NZST'),
    isUsCustomer: jest.fn(() => false),
});
