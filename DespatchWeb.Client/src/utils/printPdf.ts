/** How long a new tab's object URL lives; the tab has its own copy once loaded. */
export const PDF_URL_LIFETIME_MS = 60_000;
/** A PDF frame that never loads (e.g. the browser downloads PDFs instead) falls back after this. */
export const PDF_FRAME_LOAD_TIMEOUT_MS = 10_000;
/** Backstop for releasing the print frame when the browser never fires `afterprint`. */
export const PRINT_FRAME_LIFETIME_MS = 10 * 60_000;

/** Opens the PDF in a new tab; false when the browser blocked it. */
export function openPdf(blob: Blob): boolean {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank') !== null;
    setTimeout(() => URL.revokeObjectURL(url), opened ? PDF_URL_LIFETIME_MS : 0);
    return opened;
}

/**
 * Prints a PDF from a hidden same-origin iframe, so the print dialog opens over the page. Where the
 * browser won't load or print a PDF frame it falls back to a new tab. Resolves false when that was
 * blocked too: by then the click's user activation may have lapsed, so offer a button that calls `openPdf`.
 */
export function printPdf(blob: Blob): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    // Off-screen rather than 0x0 / hidden, so the browser's PDF viewer still lays the document out to print.
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';

    let released = false;
    let backstop: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
        if (released) return;
        released = true;
        clearTimeout(backstop);
        frame.remove();
        URL.revokeObjectURL(url);
    };

    return new Promise(resolve => {
        let settled = false;
        const settle = (printed: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(loadTimeout);
            if (printed) {
                resolve(true);
                return;
            }
            release();
            resolve(openPdf(blob));
        };

        const loadTimeout = setTimeout(() => settle(false), PDF_FRAME_LOAD_TIMEOUT_MS);

        frame.onload = () => {
            frame.onload = null;
            try {
                const view = frame.contentWindow!;
                // Some browsers return from print() while the dialog is still open; keep the frame until it closes.
                view.addEventListener('afterprint', release, {once: true});
                backstop = setTimeout(release, PRINT_FRAME_LIFETIME_MS);
                view.focus();
                view.print();
                settle(true);
            } catch {
                settle(false);
            }
        };
        frame.src = url;
        document.body.appendChild(frame);
    });
}
