/**
 * Inter-Courier Charge Dialog React Module Tests
 *
 * Tests for the module's openInterCourierChargeDialog() function.
 */

const mockRender = jest.fn();

jest.mock('react-dom/client', () => ({
    createRoot: jest.fn(() => ({
        render: mockRender,
        unmount: jest.fn(),
    })),
}));


import {openInterCourierChargeDialog} from './inter-courier-charge-dialog-react.module';

describe('InterCourierChargeDialogReactModule', () => {
    beforeEach(() => {
        mockRender.mockClear();
    });

    it('returns a Promise', () => {
        const result = openInterCourierChargeDialog();
        expect(result).toBeInstanceOf(Promise);
    });

    it('calls render when opening', () => {
        openInterCourierChargeDialog();
        expect(mockRender).toHaveBeenCalled();
    });

    it('accepts optional toastService parameter', () => {
        const mockToast = {showToast: jest.fn()};
        const result = openInterCourierChargeDialog(mockToast);
        expect(result).toBeInstanceOf(Promise);
    });

    it('calls render each time open is called', () => {
        mockRender.mockClear();

        openInterCourierChargeDialog();
        openInterCourierChargeDialog();

        expect(mockRender).toHaveBeenCalledTimes(2);
    });
});

export {};
