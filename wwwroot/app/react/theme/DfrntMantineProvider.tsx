/**
 * DFRNT Mantine provider stack — the single wrapper every React island mounts
 * through during (and after) the MUI → Mantine migration.
 *
 * It converges the ~54 island entry modules on one provider tree so the theme,
 * date handling and query cache are wired identically everywhere. Replaces the
 * per-island `<ThemeProvider theme={getTheme()}><CssBaseline/>` MUI stack.
 *
 * `forceColorScheme="light"` — the app is light-only (dark Ink-Blue chrome lives
 * inside a light theme; there is no dark mode). Mantine's global stylesheet is
 * loaded once via `vendor-react.css` (see vendor-react.ts), so this provider only
 * injects the theme CSS variables, not the component styles.
 */
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MantineProvider} from '@mantine/core';
import {DatesProvider} from '@mantine/dates';
import {dfrntTheme} from './dfrntMantineTheme';
import {ReactQueryProvider} from '../query';

interface DfrntMantineProviderProps {
    children: React.ReactNode;
}

/**
 * Wraps children in the DFRNT Mantine theme, dates context and the shared React
 * Query cache.
 *
 * NB: date values in this app are wall-clock (stored and shown as-entered, no
 * conversion — see the `timezone-audit` skill). `DatesProvider` is intentionally
 * left without a `timezone` so it does not convert; per-picker locale/first-day
 * settings are applied where needed.
 */
export const DfrntMantineProvider: React.FC<DfrntMantineProviderProps> = ({children}) => (
    <MantineProvider theme={dfrntTheme} forceColorScheme="light">
        <DatesProvider settings={{}}>
            <ReactQueryProvider>
                {children}
            </ReactQueryProvider>
        </DatesProvider>
    </MantineProvider>
);

/**
 * Create a React root on `container` and render `node` inside the full DFRNT
 * provider stack. Returns the root so callers can `unmount()` on teardown
 * (AngularJS `$onDestroy`, dialog close, etc.).
 */
export function mountReactIsland(container: Element | DocumentFragment, node: React.ReactNode): Root {
    const root = createRoot(container);
    root.render(<DfrntMantineProvider>{node}</DfrntMantineProvider>);
    return root;
}

export default DfrntMantineProvider;
