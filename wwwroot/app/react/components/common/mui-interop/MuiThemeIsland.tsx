/**
 * Temporary MUI island inside a migrated Mantine tree.
 *
 * During the MUI → Mantine migration a Mantine surface sometimes still renders
 * a subtree that has not been migrated yet. MUI components do not throw without
 * a `ThemeProvider` — they silently fall back to MUI's stock blue theme — so the
 * subtree has to be re-parented under the app's MUI theme or it renders
 * off-brand.
 *
 * Wrap only the unmigrated subtree, never a whole page. Every usage is
 * scaffolding: when the wrapped component is migrated, delete the wrapper with
 * it. When there are no usages left, delete this file (migration Phase 9).
 */

import React from 'react';
import {ThemeProvider} from '@mui/material/styles';
import {getTheme} from '../../../theme/muiTheme';

export const MuiThemeIsland: React.FC<{children: React.ReactNode}> = ({children}) => (
    <ThemeProvider theme={getTheme()}>{children}</ThemeProvider>
);

export default MuiThemeIsland;
