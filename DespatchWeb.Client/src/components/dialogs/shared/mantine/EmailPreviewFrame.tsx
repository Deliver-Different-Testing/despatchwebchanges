/**
 * Shows server-rendered email HTML exactly as it will be sent.
 *
 * `sandbox="allow-same-origin"` without `allow-scripts`: the email can run no script, and the parent may still read
 * the frame's document to size it to its content and to make links inert (a click would otherwise navigate the
 * preview itself). Never add `allow-scripts` here — together with `allow-same-origin` it lets the framed document
 * remove its own sandbox.
 */

import React, {useCallback, useRef} from 'react';

interface EmailPreviewFrameProps {
    html: string;
    title: string;
    minHeight?: number;
}

export const EmailPreviewFrame: React.FC<EmailPreviewFrameProps> = ({html, title, minHeight = 240}) => {
    const frameRef = useRef<HTMLIFrameElement>(null);

    const fit = useCallback(() => {
        const doc = frameRef.current?.contentDocument;
        if (!frameRef.current || !doc?.body) return;
        // Reset first: documentElement.scrollHeight never reports less than the frame's current height.
        frameRef.current.style.height = `${minHeight}px`;
        frameRef.current.style.height = `${Math.max(minHeight, doc.documentElement.scrollHeight)}px`;
    }, [minHeight]);

    const handleLoad = useCallback(() => {
        const doc = frameRef.current?.contentDocument;
        if (!doc) return;
        doc.addEventListener('click', (e) => {
            if ((e.target as Element | null)?.closest?.('a')) e.preventDefault();
        }, true);
        doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', fit));
        fit();
    }, [fit]);

    return (
        <iframe
            ref={frameRef}
            title={title}
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={handleLoad}
            style={{width: '100%', minHeight, border: 0, display: 'block'}}
        />
    );
};

export default EmailPreviewFrame;
