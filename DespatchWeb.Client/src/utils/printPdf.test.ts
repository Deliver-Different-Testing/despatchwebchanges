import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {openPdf, PDF_URL_LIFETIME_MS, printPdf} from './printPdf';

const pdf = new Blob(['%PDF'], {type: 'application/pdf'});

function loadFrame(print: () => void) {
    const frame = document.querySelector('iframe')!;
    Object.defineProperty(frame, 'contentWindow', {value: {focus: vi.fn(), print}});
    frame.onload!(new Event('load'));
    return frame;
}

describe('printPdf', () => {
    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        URL.createObjectURL = vi.fn(() => 'blob:label');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('prints from a hidden frame and releases it afterwards', async () => {
        const print = vi.fn();
        const result = printPdf(pdf);
        const frame = loadFrame(print);

        await expect(result).resolves.toBe(true);
        expect(print).toHaveBeenCalledOnce();
        expect(frame.src).toBe('blob:label');

        vi.advanceTimersByTime(PDF_URL_LIFETIME_MS);
        expect(document.querySelector('iframe')).toBeNull();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:label');
    });

    it('falls back to a new tab when the frame cannot print', async () => {
        const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
        const result = printPdf(pdf);
        loadFrame(() => { throw new DOMException('blocked', 'SecurityError'); });

        await expect(result).resolves.toBe(true);
        expect(open).toHaveBeenCalledWith('blob:label', '_blank');
        expect(document.querySelector('iframe')).toBeNull();
    });

    it('reports a blocked fallback so the caller can offer a button', async () => {
        vi.spyOn(window, 'open').mockReturnValue(null);
        const result = printPdf(pdf);
        loadFrame(() => { throw new Error('no print'); });

        await expect(result).resolves.toBe(false);
    });
});

describe('openPdf', () => {
    it('returns false when the popup is blocked', () => {
        URL.createObjectURL = vi.fn(() => 'blob:label');
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(window, 'open').mockReturnValue(null);

        expect(openPdf(pdf)).toBe(false);
        vi.restoreAllMocks();
    });
});
