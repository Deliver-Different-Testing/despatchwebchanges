import {alpha, createTheme, Theme} from '@mui/material/styles';

/**
 * MUI Theme - Matching AngularJS Material Theme
 *
 * This theme is designed to match the existing AngularJS Material theme
 * defined in materialTheme.ts for visual consistency across the application.
 *
 * Supports two themes:
 * - US customers: Blue (professionalPrimary)
 * - Non-US customers: Yellow (urgentPrimary)
 */

// Primary palette for US customers - matches professionalPrimary from AngularJS theme
export const dfrntPrimaryPalette = {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3',  // Main color
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
    A100: '#82b1ff',
    A200: '#448aff',
    A400: '#2979ff',
    A700: '#2962ff',
};

// Primary palette for non-US customers - warm amber/gold (softened from original yellow)
export const urgentPrimaryPalette = {
    50: '#fef9e7',
    100: '#fcefc4',
    200: '#fae49d',
    300: '#f8d976',
    400: '#f6d058',
    500: '#f4c430',  // Main color - warm amber gold
    600: '#e5b52a',
    700: '#d4a324',
    800: '#c3911e',
    900: '#a87614',
    A100: '#fff8e1',
    A200: '#ffecb3',
    A400: '#ffd54f',
    A700: '#ffc107',
};

// Accent palette - matches accent from AngularJS theme (warm grays)
export const accentPalette = {
    50: '#fafaf9',   // Warm white
    100: '#f5f5f4',  // Very light warm gray
    200: '#e7e5e4',  // Light warm gray
    300: '#d6d3d1',  // Medium-light warm gray
    400: '#a8a29e',  // Medium warm gray
    500: '#78716c',  // Balanced warm gray - MAIN COLOR
    600: '#57534e',  // Dark warm gray - TOOLBAR COLOR
    700: '#44403c',  // Darker warm gray
    800: '#292524',  // Very dark warm gray
    900: '#1c1917',  // Deepest warm gray
};

// Design tokens
export const tokens = {
    radius: {
        xs: 2,
        sm: 4,
        md: 4,   // Angular Material default
        lg: 8,
        xl: 16,
        full: 9999,
    },
    duration: {
        instant: 100,
        fast: 150,
        normal: 280,  // Angular Material standard
        slow: 400,
    },
    shadow: {
        // Matching Angular Material elevation shadows
        sm: '0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12)',
        md: '0 3px 3px -2px rgba(0,0,0,.2), 0 3px 4px 0 rgba(0,0,0,.14), 0 1px 8px 0 rgba(0,0,0,.12)',
        lg: '0 5px 5px -3px rgba(0,0,0,.2), 0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12)',
        xl: '0 8px 10px -5px rgba(0,0,0,.2), 0 16px 24px 2px rgba(0,0,0,.14), 0 6px 30px 5px rgba(0,0,0,.12)',
    },
};

// Shared colors (non-primary)
export const sharedColors = {
    success: {
        main: '#4CAF50',
        light: '#81C784',
        dark: '#388E3C',
        lighter: '#E8F5E9',
        contrast: '#FFFFFF',
    },
    warning: {
        main: '#FF9800',
        light: '#FFB74D',
        dark: '#F57C00',
        lighter: '#FFF3E0',
        contrast: '#000000',
    },
    error: {
        main: '#F44336',
        light: '#E57373',
        dark: '#D32F2F',
        lighter: '#FFEBEE',
        contrast: '#FFFFFF',
    },
    info: {
        main: '#2196F3',
        light: '#64B5F6',
        dark: '#1976D2',
        lighter: '#E3F2FD',
        contrast: '#FFFFFF',
    },
    // Surface colors - matching Angular Material
    surface: {
        default: '#FAFAFA',
        paper: '#FFFFFF',
        elevated: '#FFFFFF',
    },
    // Text hierarchy
    text: {
        primary: 'rgba(0, 0, 0, 0.87)',
        secondary: 'rgba(0, 0, 0, 0.54)',
        disabled: 'rgba(0, 0, 0, 0.38)',
        hint: 'rgba(0, 0, 0, 0.38)',
    },
    // Dividers
    divider: 'rgba(0, 0, 0, 0.12)',
};

/**
 * Creates a theme based on the customer region
 * @param isUsCustomer - true for US customers (blue theme), false for non-US (yellow theme)
 */
export function createAppTheme(isUsCustomer: boolean): Theme {
    const primaryPalette = isUsCustomer ? dfrntPrimaryPalette : urgentPrimaryPalette;

    // For yellow theme, contrast colors need to be dark
    const primaryContrastText = isUsCustomer ? '#FFFFFF' : 'rgba(0, 0, 0, 0.87)';

    const colors = {
        primary: {
            main: primaryPalette[500],
            light: primaryPalette[300],
            dark: primaryPalette[700],
            darker: primaryPalette[900],
            lighter: primaryPalette[50],
            contrast: primaryContrastText,
        },
        secondary: {
            main: accentPalette[500],
            light: accentPalette[300],
            dark: accentPalette[600],
            darker: accentPalette[800],
            lighter: accentPalette[50],
            contrast: '#FFFFFF',
        },
        ...sharedColors,
    };

    return createTheme({
        palette: {
            mode: 'light',
            primary: {
                main: colors.primary.main,
                light: colors.primary.light,
                dark: colors.primary.dark,
                contrastText: colors.primary.contrast,
            },
            secondary: {
                main: colors.secondary.main,
                light: colors.secondary.light,
                dark: colors.secondary.dark,
                contrastText: colors.secondary.contrast,
            },
            success: {
                main: colors.success.main,
                light: colors.success.light,
                dark: colors.success.dark,
                contrastText: colors.success.contrast,
            },
            warning: {
                main: colors.warning.main,
                light: colors.warning.light,
                dark: colors.warning.dark,
                contrastText: colors.warning.contrast,
            },
            error: {
                main: colors.error.main,
                light: colors.error.light,
                dark: colors.error.dark,
                contrastText: colors.error.contrast,
            },
            info: {
                main: colors.info.main,
                light: colors.info.light,
                dark: colors.info.dark,
                contrastText: colors.info.contrast,
            },
            background: {
                default: colors.surface.default,
                paper: colors.surface.paper,
            },
            text: {
                primary: colors.text.primary,
                secondary: colors.text.secondary,
                disabled: colors.text.disabled,
            },
            divider: colors.divider,
            grey: accentPalette,
        },
        typography: {
            fontFamily: 'Roboto, "Helvetica Neue", sans-serif',
            fontSize: 14,
            fontWeightLight: 300,
            fontWeightRegular: 400,
            fontWeightMedium: 500,
            fontWeightBold: 700,
            h1: {
                fontSize: '2.125rem',
                fontWeight: 400,
                lineHeight: 1.2,
                letterSpacing: '-0.01562em',
            },
            h2: {
                fontSize: '1.5rem',
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '0em',
            },
            h3: {
                fontSize: '1.25rem',
                fontWeight: 500,
                lineHeight: 1.3,
                letterSpacing: '0.0075em',
            },
            h4: {
                fontSize: '1.125rem',
                fontWeight: 500,
                lineHeight: 1.35,
                letterSpacing: '0.00735em',
            },
            h5: {
                fontSize: '1rem',
                fontWeight: 500,
                lineHeight: 1.4,
                letterSpacing: '0em',
            },
            h6: {
                fontSize: '0.875rem',
                fontWeight: 500,
                lineHeight: 1.4,
                letterSpacing: '0.0075em',
            },
            subtitle1: {
                fontSize: '1rem',
                fontWeight: 400,
                lineHeight: 1.75,
                letterSpacing: '0.00938em',
            },
            subtitle2: {
                fontSize: '0.875rem',
                fontWeight: 500,
                lineHeight: 1.57,
                letterSpacing: '0.00714em',
            },
            body1: {
                fontSize: '0.875rem',
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '0.00938em',
            },
            body2: {
                fontSize: '0.8125rem',
                fontWeight: 400,
                lineHeight: 1.43,
                letterSpacing: '0.01071em',
            },
            caption: {
                fontSize: '0.75rem',
                fontWeight: 400,
                lineHeight: 1.4,
                letterSpacing: '0.03333em',
            },
            overline: {
                fontSize: '0.625rem',
                fontWeight: 500,
                lineHeight: 2.5,
                letterSpacing: '0.08333em',
                textTransform: 'uppercase',
            },
            button: {
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.02857em',
            },
        },
        shape: {
            borderRadius: tokens.radius.md,
        },
        spacing: 8,
        shadows: [
            'none',
            tokens.shadow.sm,
            tokens.shadow.sm,
            tokens.shadow.md,
            tokens.shadow.md,
            tokens.shadow.md,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.lg,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
            tokens.shadow.xl,
        ],
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${accentPalette[400]} transparent`,
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: false,
                },
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.sm,
                        padding: '6px 16px',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02857em',
                        minHeight: 36,
                        transition: `all ${tokens.duration.normal}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                    },
                    sizeSmall: {
                        padding: '4px 10px',
                        fontSize: '0.8125rem',
                        minHeight: 32,
                    },
                    sizeLarge: {
                        padding: '8px 22px',
                        fontSize: '0.9375rem',
                        minHeight: 42,
                    },
                    contained: {
                        boxShadow: tokens.shadow.sm,
                        '&:hover': {
                            boxShadow: tokens.shadow.md,
                        },
                        '&:active': {
                            boxShadow: tokens.shadow.lg,
                        },
                    },
                    outlined: {
                        borderColor: colors.divider,
                        '&:hover': {
                            borderColor: colors.primary.main,
                            backgroundColor: alpha(colors.primary.main, 0.04),
                        },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '50%',
                        transition: `background-color ${tokens.duration.fast}ms`,
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                    },
                },
            },
            MuiPaper: {
                defaultProps: {
                    elevation: 1,
                },
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                    rounded: {
                        borderRadius: tokens.radius.md,
                    },
                    elevation1: {
                        boxShadow: tokens.shadow.sm,
                    },
                    elevation2: {
                        boxShadow: tokens.shadow.sm,
                    },
                    elevation3: {
                        boxShadow: tokens.shadow.md,
                    },
                    elevation4: {
                        boxShadow: tokens.shadow.md,
                    },
                },
            },
            MuiCard: {
                defaultProps: {
                    elevation: 1,
                },
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.md,
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: tokens.radius.md,
                        boxShadow: tokens.shadow.xl,
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        fontSize: '1.25rem',
                        fontWeight: 500,
                        padding: '16px 24px',
                        // Match Angular Material dialog toolbar style
                        backgroundColor: accentPalette[100],
                        color: colors.text.primary,
                    },
                },
            },
            MuiDialogContent: {
                styleOverrides: {
                    root: {
                        padding: '20px 24px',
                    },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: {
                        padding: '8px 24px 16px',
                        gap: 8,
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: tokens.radius.md,
                            '& fieldset': {
                                borderColor: colors.divider,
                            },
                            '&:hover fieldset': {
                                borderColor: colors.text.secondary,
                            },
                            '&.Mui-focused fieldset': {
                                borderWidth: 2,
                                borderColor: colors.primary.main,
                            },
                        },
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.md,
                        '& fieldset': {
                            borderColor: colors.divider,
                        },
                        '&:hover fieldset': {
                            borderColor: colors.text.secondary,
                        },
                    },
                    input: {
                        padding: '12px 14px',
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        fontSize: '0.875rem',
                        '&.Mui-focused': {
                            color: colors.primary.main,
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        fontWeight: 400,
                        fontSize: '0.8125rem',
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'uppercase',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        letterSpacing: '0.02857em',
                        minHeight: 48,
                        padding: '12px 16px',
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    root: {
                        minHeight: 48,
                    },
                    indicator: {
                        height: 2,
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        fontSize: '0.8125rem',
                        padding: '12px 16px',
                        borderColor: colors.divider,
                    },
                    head: {
                        fontWeight: 500,
                        color: colors.text.secondary,
                        fontSize: '0.75rem',
                    },
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: accentPalette[700],
                        fontSize: '0.625rem',
                        fontWeight: 500,
                        padding: '6px 8px',
                        borderRadius: tokens.radius.sm,
                    },
                },
            },
            MuiDivider: {
                styleOverrides: {
                    root: {
                        borderColor: colors.divider,
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        borderRadius: tokens.radius.md,
                        boxShadow: tokens.shadow.lg,
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        fontSize: '0.875rem',
                        padding: '8px 16px',
                        minHeight: 48,
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                    },
                },
            },
            MuiAutocomplete: {
                styleOverrides: {
                    listbox: {
                        maxHeight: 300,
                        overflow: 'auto',
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        borderRadius: tokens.radius.md,
                    },
                },
            },
            MuiLinearProgress: {
                styleOverrides: {
                    root: {
                        borderRadius: 2,
                        height: 4,
                        backgroundColor: alpha(colors.primary.main, 0.2),
                    },
                },
            },
            MuiCircularProgress: {
                styleOverrides: {
                    root: {
                        strokeLinecap: 'round',
                    },
                },
            },
        },
    });
}

/**
 * Detects if the current user is a US customer
 * Checks the body class 'theme-us' which is set by the AngularJS app
 */
export function isUsCustomer(): boolean {
    return document.body.classList.contains('theme-us');
}

/**
 * Gets the appropriate theme based on customer region
 */
export function getTheme(): Theme {
    return createAppTheme(isUsCustomer());
}

// Default theme (will be determined at runtime)
// For backwards compatibility, default to US theme
export const theme = createAppTheme(true);

export default theme;
