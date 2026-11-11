/**
 * Inter-courier charge Dialog React Module Tests
 *
 * Tests for the module's openInterCourierChargeDialog() function.
 */

const mockRender = vi.fn();

vi.mock('react-dom/client', () => ({
    createRoot: vi.fn(() => ({
        render: mockRender,
        unmount: vi.fn(),
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
        const mockToast = {showToast: vi.fn()};
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
