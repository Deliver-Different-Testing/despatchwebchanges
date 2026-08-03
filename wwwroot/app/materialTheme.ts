import { IAppConfig } from "./interfaces/app-config.interface";
import angular from 'angular';
import {
    dfrntPrimaryPalette,
    urgentPrimaryPalette,
    accentPalette,
} from './react/theme/palettes';

/**
 * Build an AngularJS Material palette from a shared hex palette plus the
 * contrast metadata Material needs. The hex values come from the same
 * framework-free source the MUI theme uses, so the two can't drift.
 */
function toMdPalette(
    base: Record<string, string>,
    contrast: Pick<
        angular.material.IPalette,
        'contrastDefaultColor' | 'contrastDarkColors' | 'contrastLightColors'
    >,
): angular.material.IPalette {
    return {...base, ...contrast} as unknown as angular.material.IPalette;
}

/** Warm-gray accent — shared 50–900 ramp plus the A-keys Material expects. */
export const accentMdPalette = toMdPalette(
    {
        ...(accentPalette as unknown as Record<string, string>),
        A100: '#ffffff',
        A200: '#f5f5f4',
        A400: '#a8a29e',
        A700: '#57534e',
    },
    {
        contrastDefaultColor: 'light',
        contrastDarkColors: ['50', '100', '200', '300', 'A100', 'A200'],
        contrastLightColors: ['400', '500', '600', '700', '800', '900', 'A400', 'A700'],
    },
);

// US (professional) primary = Cyan. Cyan is a light hue, so only its darkest shades
// (700–900) carry white text; everything else (incl. the 500 main) takes dark Ink text.
const cyanContrast = {
    contrastDefaultColor: 'dark' as const,
    contrastDarkColors: ['50', '100', '200', '300', '400', '500', '600', 'A100', 'A200', 'A400', 'A700'],
    contrastLightColors: ['700', '800', '900'],
};

// Non-US (urgent) primary = warm amber-gold. Gold stays light across the whole ramp,
// so every shade takes dark text — white would be illegible even on 700–900.
const goldContrast = {
    contrastDefaultColor: 'dark' as const,
    contrastDarkColors: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'],
    contrastLightColors: [] as string[],
};

export const urgentPrimaryMdPalette = toMdPalette(
    accentValues(urgentPrimaryPalette),
    goldContrast,
);

export const professionalPrimaryMdPalette = toMdPalette(
    accentValues(dfrntPrimaryPalette),
    cyanContrast,
);

/** Coerce a palette's numeric keys to the string-keyed record Material wants. */
function accentValues(palette: Record<string | number, string>): Record<string, string> {
    return palette as unknown as Record<string, string>;
}

class ThemeConfig {
    private readonly isUsCustomer: boolean;

    constructor(
        private readonly $mdThemingProvider: angular.material.IThemingProvider,
        appConfig: IAppConfig
    ) {
        this.isUsCustomer = appConfig.US_Customer;
    }

    /**
     * Defines a warm amber gold primary palette
     * Matches MUI urgentPrimaryPalette for consistency
     */
    private defineUrgentPrimaryPalette(): void {
        this.$mdThemingProvider.definePalette("urgentPrimary", urgentPrimaryMdPalette);
    }

    /**
     * Defines a neutral gray accent palette
     * Provides subtle contrast without competing with primary colors
     */
    private defineAccentPalette(){
        this.$mdThemingProvider.definePalette("accent", accentMdPalette);
    }

    /**
     * Defines a professional blue primary palette for standard branding
     * Inspired by modern corporate design systems
     */
    private defineProfessionalPrimaryPalette(): void {
        this.$mdThemingProvider.definePalette("professionalPrimary", professionalPrimaryMdPalette);
    }

    /**
     * Configures the default theme based on customer region
     * US customers receive a professional blue theme, others receive an urgent yellow theme
     */
    private configureDefaultTheme(): void {
        const themeBuilder = this.$mdThemingProvider.theme("default");

        if (this.isUsCustomer) {
            themeBuilder
                .primaryPalette("professionalPrimary")
                .accentPalette("accent");
        } else {
            themeBuilder
                .primaryPalette("urgentPrimary")
                .accentPalette("accent");
        }
    }

    /**
     * Registers specialized themes for toast notifications
     * Provides semantic color coding for different message types
     */
    private registerNotificationThemes(): void {
        this.$mdThemingProvider
            .theme("success-toast")
            .primaryPalette("green")
            .dark(false);

        this.$mdThemingProvider
            .theme("warning-toast")
            .primaryPalette("orange")
            .dark(false);

        this.$mdThemingProvider
            .theme("error-toast")
            .primaryPalette("red")
            .dark(false);

        this.$mdThemingProvider
            .theme("info-toast")
            .primaryPalette("blue")
            .dark(false);
    }

    /**
     * Initializes all theme configurations
     * Call this method during application bootstrap
     */
    public configure(): void {
        this.defineUrgentPrimaryPalette();
        this.defineAccentPalette();
        this.defineProfessionalPrimaryPalette();
        this.configureDefaultTheme();
        this.registerNotificationThemes();
    }
}

export default ThemeConfig;