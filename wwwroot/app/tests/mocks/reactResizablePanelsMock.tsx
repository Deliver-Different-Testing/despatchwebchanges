import React from 'react';

// react-resizable-panels ships ESM only; mocked here so Jest can render pages
// that use it without transforming the library. The page-level tests assert
// on rendered text/role, not on drag behaviour, so transparent passthroughs
// are sufficient.

export function PanelGroup({children}: {children?: React.ReactNode}) {
    return <>{children}</>;
}

export function Panel({children}: {children?: React.ReactNode}) {
    return <>{children}</>;
}

export function PanelResizeHandle({children}: {children?: React.ReactNode}) {
    return <>{children}</>;
}
