/**
 * These helpers style controls that are portaled into a dispatch panel's
 * `PanelHeader` — a plain `'surface'` paper bar. Hardcoded white would be
 * invisible there, so every colour must resolve from the theme.
 */

import {alpha} from '@mui/material/styles';
import {createAppTheme} from '../../../theme/muiTheme';
import {headerIconButtonSx, headerScopeToggleSx, headerTextButtonSx} from './headerScopeToggleSx';

const theme = createAppTheme();
const onHeader = theme.palette.text.primary;

describe('dispatch header control styles', () => {
    it('tints the scope toggle from the theme, not hardcoded white', () => {
        const sx = headerScopeToggleSx(theme);
        expect(sx['& .MuiToggleButton-root'].borderColor).toBe('divider');
        expect(sx['& .MuiToggleButton-root.Mui-selected'].bgcolor).toBe(alpha(onHeader, 0.12));
        expect(sx['& .MuiToggleButton-root.Mui-selected']['&:hover'].bgcolor).toBe(alpha(onHeader, 0.16));
    });

    it('tints the text button and icon button hovers from the theme', () => {
        expect(headerTextButtonSx(theme)['&:hover'].bgcolor).toBe(alpha(onHeader, 0.08));
        expect(headerIconButtonSx(theme)['&:hover'].bgcolor).toBe(alpha(onHeader, 0.08));
    });
});
