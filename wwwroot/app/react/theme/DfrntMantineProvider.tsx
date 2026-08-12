/**
 * DFRNT Mantine provider stack — the single wrapper every React island mounts
 * through during (and after) the MUI → Mantine migration.
 *
 * It converges the ~54 island entry modules on one provider tree so the theme,
 * colour mode, date handling and query cache are wired identically everywhere.
 * Replaces the per-island `<ThemeProvider theme={getTheme()}><CssBaseline/>` stack.
 *
 * Mantine's component stylesheet is loaded once via `vendor-react.css` (see
 * vendor-react.ts), so this provider only injects the theme CSS variables.
 */
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MantineProvider} from '@mantine/core';
import {DatesProvider} from '@mantine/dates';
import {dfrntTheme, dfrntCssVariablesResolver} from './dfrntMantineTheme';
import {ColorModeProvider, useColorMode} from '../hooks/useColorMode';
import {ReactQueryProvider} from '../query';

/**
 * Dark mode is built but not yet user-selectable.
 *
 * Every unmigrated MUI island, the AngularJS/Angular-Material pages, Bootstrap and
 * `app.css` are light-only, so a dark Mantine subtree on a real page reads as a
 * rendering bug rather than a theme. Flip this on once the app shell, dialogs,
 * dispatch board and job detail are all Mantine (migration Phase 6), and add the
 * `document.documentElement.style.colorScheme` sync at the same time so native
 * controls follow.
 */
export const DARK_MODE_ENABLED = false;

interface DfrntMantineProviderProps {
    children: React.ReactNode;
}

const ThemedSubtree: React.FC<DfrntMantineProviderProps> = ({children}) => {
    const {mode} = useColorMode();
    return (
        <MantineProvider
            theme={dfrntTheme}
            cssVariablesResolver={dfrntCssVariablesResolver}
            forceColorScheme={DARK_MODE_ENABLED ? mode : 'light'}
        >
            {/*
              * Date values in this app are wall-clock (stored and shown as-entered,
              * no conversion — see the `timezone-audit` skill). `DatesProvider` is
              * deliberately left without a `timezone` so it does not convert.
              */}
            <DatesProvider settings={{}}>
                <ReactQueryProvider>
                    {children}
                </ReactQueryProvider>
            </DatesProvider>
        </MantineProvider>
    );
};

/**
 * Wraps children in the DFRNT colour mode, Mantine theme, dates context and the
 * shared React Query cache.
 */
export const DfrntMantineProvider: React.FC<DfrntMantineProviderProps> = ({children}) => (
    <ColorModeProvider>
        <ThemedSubtree>{children}</ThemedSubtree>
    </ColorModeProvider>
);

/**
 * Wraps `node` in the island provider stack, for an existing root's `render()`.
 *
 * Every `*-react.module.tsx` mounts through this (or {@link mountReactIsland},
 * which is built on it). That is not a style preference: `@mantine/core`'s
 * `useStyles` *throws* without a provider — unlike MUI, which silently falls
 * back to its stock theme — so an island that renders a Mantine component
 * without one dies at mount. Routing every root through one helper is what makes
 * that unrepresentable rather than a judgement call repeated per island. An
 * island whose own tree is still MUI nests `<MuiThemeIsland>` *inside* this.
 *
 * Enforced by `islandProviders.spec.ts`.
 */
export function islandTree(node: React.ReactNode): React.ReactElement {
    return <DfrntMantineProvider>{node}</DfrntMantineProvider>;
}

/**
 * Create a React root on `container` and render `node` inside the full DFRNT
 * provider stack. Returns the root so callers can `unmount()` on teardown
 * (AngularJS `$onDestroy`, dialog close, etc.).
 *
 * For an island that re-renders to push new props, keep the root yourself and
 * call `root.render(islandTree(node))` — this helper only covers mount-once.
 */
export function mountReactIsland(container: Element | DocumentFragment, node: React.ReactNode): Root {
    const root = createRoot(container);
    root.render(islandTree(node));
    return root;
}

export default DfrntMantineProvider;
