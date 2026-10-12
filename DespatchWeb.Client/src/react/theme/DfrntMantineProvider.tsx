/**
 * DFRNT Mantine provider stack — the single wrapper every React island mounts
 * through during (and after) the MUI → Mantine migration.
 *
 * It converges the ~54 island entry modules on one provider tree so the theme,
 * colour mode, date handling and query cache are wired identically everywhere.
 * Replaces the per-island `<ThemeProvider theme={getTheme()}><CssBaseline/>` stack.
 *
 * Mantine's component stylesheet is imported once in react/app/main.tsx, so this provider only injects the theme CSS variables.
 */
import React, {useEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MantineProvider} from '@mantine/core';
import {DatesProvider} from '@mantine/dates';
import {GlassProvider} from '@deliver-different/glass';
import {dfrntTheme, dfrntCssVariablesResolver} from './dfrntMantineTheme';
import {ColorModeProvider, useColorMode} from '../hooks/useColorMode';
import {ReactQueryProvider} from '../query';
import {useLiquidGlassEnabled} from '../hooks/useLiquidGlassPreference';

interface DfrntMantineProviderProps {
    children: React.ReactNode;
}

const ThemedSubtree: React.FC<DfrntMantineProviderProps> = ({children}) => {
    const {mode} = useColorMode();
    const glassEnabled = useLiquidGlassEnabled();
    // Native controls and scrollbars follow the scheme.
    useEffect(() => {
        document.documentElement.style.colorScheme = mode;
    }, [mode]);
    return (
        <MantineProvider
            theme={dfrntTheme}
            cssVariablesResolver={dfrntCssVariablesResolver}
            forceColorScheme={mode}
        >
            {/*
              * Date values in this app are wall-clock (stored and shown as-entered,
              * no conversion — see the `timezone-audit` skill). `DatesProvider` is
              * deliberately left without a `timezone` so it does not convert.
              */}
            <DatesProvider settings={{}}>
                <ReactQueryProvider>
                    <GlassProvider enabled={glassEnabled}>
                        {children}
                    </GlassProvider>
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
