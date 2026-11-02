import React from 'react';
import type {Components} from 'react-markdown';

// Answers can echo job notes and other untrusted text, so nothing the model writes may make the browser fetch a URL
// on its own (an image) or hide where a click goes (a link).
export const CHAT_MARKDOWN_COMPONENTS: Components = {
    img: () => null,
    a: ({href, children}) => {
        const label = React.Children.toArray(children).join('');
        return <span>{!href || label === href ? children : <>{children} ({href})</>}</span>;
    },
};
