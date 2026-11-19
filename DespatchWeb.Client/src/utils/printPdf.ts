/** How long the object URL outlives the print dialog or new tab, which may still be reading it. */
export const PDF_URL_LIFETIME_MS = 60_000;

/** Opens the PDF in a new tab; false when the browser blocked it. */
export function openPdf(blob: Blob): boolean {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank') !== null;
    setTimeout(() => URL.revokeObjectURL(url), opened ? PDF_URL_LIFETIME_MS : 0);
    return opened;
}

/**
 * Prints a PDF from a hidden same-origin iframe, so the print dialog opens over the page. Where the
 * browser won't print a PDF frame it falls back to a new tab. Resolves false when that was blocked
 * too: by then the click's user activation may have lapsed, so offer a button that calls `openPdf`.
 */
export function printPdf(blob: Blob): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';

    const cleanup = () => {
        frame.remove();
        URL.revokeObjectURL(url);
    };

    return new Promise(resolve => {
        frame.onload = () => {
            try {
                frame.contentWindow!.focus();
                frame.contentWindow!.print();
                setTimeout(cleanup, PDF_URL_LIFETIME_MS);
                resolve(true);
            } catch {
                cleanup();
                resolve(openPdf(blob));
            }
        };
        frame.src = url;
        document.body.appendChild(frame);
    });
}
