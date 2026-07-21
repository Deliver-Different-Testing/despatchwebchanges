import {act} from '@testing-library/react';
import {toastColor, mantineToastService} from './mantineToastService';

describe('mantineToastService', () => {
    describe('toastColor', () => {
        it('maps each toast type onto its DFRNT semantic colour', () => {
            expect(toastColor('success')).toBe('green');
            expect(toastColor('warning')).toBe('orange');
            expect(toastColor('error')).toBe('red');
            expect(toastColor('info')).toBe('cyan');
        });
    });

    it('lazily mounts a single notifications root and shows without throwing', () => {
        act(() => {
            expect(() => mantineToastService.showToast('Saved', 'success')).not.toThrow();
        });
        expect(document.getElementById('mantine-notifications-root')).toBeInTheDocument();

        // Second call reuses the same root (no duplicate container).
        act(() => {
            mantineToastService.showErrorToast('Failed');
        });
        expect(document.querySelectorAll('#mantine-notifications-root')).toHaveLength(1);
    });

    it('returns a handle from showLoadingToast with update and dismiss', () => {
        let handle!: ReturnType<typeof mantineToastService.showLoadingToast>;
        act(() => {
            handle = mantineToastService.showLoadingToast('Working…');
        });
        expect(typeof handle.update).toBe('function');
        expect(typeof handle.dismiss).toBe('function');
        act(() => {
            handle.update('Done', 'success');
            handle.dismiss();
        });
    });
});
