import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {openPdf, PDF_FRAME_LOAD_TIMEOUT_MS, PRINT_FRAME_LIFETIME_MS, printPdf} from './printPdf';

const pdf = new Blob(['%PDF']);

function loadFrame(print: () => void) {
    const frame = document.querySelector('iframe')!;
    const view = new EventTarget() as EventTarget & {focus: () => void; print: () => void};
    view.focus = vi.fn();
    view.print = print;
    Object.defineProperty(frame, 'contentWindow', {value: view});
    frame.onload!(new Event('load'));
    return {frame, view};
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
        document.body.replaceChildren();
    });

    it('prints from a hidden frame and keeps it until the print dialog closes', async () => {
        const print = vi.fn();
        const result = printPdf(pdf);
        const {frame, view} = loadFrame(print);

        await expect(result).resolves.toBe(true);
        expect(print).toHaveBeenCalledOnce();
        expect(frame.src).toBe('blob:label');

        vi.advanceTimersByTime(PDF_FRAME_LOAD_TIMEOUT_MS);
        expect(document.querySelector('iframe')).not.toBeNull();

        view.dispatchEvent(new Event('afterprint'));
        expect(document.querySelector('iframe')).toBeNull();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:label');
    });

    it('releases the frame after the backstop when afterprint never fires', async () => {
        const result = printPdf(pdf);
        loadFrame(vi.fn());
        await result;

        vi.advanceTimersByTime(PRINT_FRAME_LIFETIME_MS);
        expect(document.querySelector('iframe')).toBeNull();
    });

    it('falls back to a new tab when the frame cannot print', async () => {
        const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
        const result = printPdf(pdf);
        loadFrame(() => { throw new DOMException('blocked', 'SecurityError'); });

        await expect(result).resolves.toBe(true);
        expect(open).toHaveBeenCalledWith('blob:label', '_blank');
        expect(document.querySelector('iframe')).toBeNull();
    });

    it('falls back when the frame never loads', async () => {
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        const result = printPdf(pdf);

        vi.advanceTimersByTime(PDF_FRAME_LOAD_TIMEOUT_MS);

        await expect(result).resolves.toBe(false);
        expect(open).toHaveBeenCalledOnce();
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
