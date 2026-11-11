import {vi} from 'vitest';

export function createAccessorialChargesApiMock() {
    return {
        accessorialChargesApi: {
            getAvailableCharges: vi.fn(),
            getAppliedCharges: vi.fn(),
            getJobAmount: vi.fn(),
            addCharges: vi.fn(),
            updateCharge: vi.fn(),
            deleteCharge: vi.fn(),
        },
    };
}
