import { AppConfig } from "./interfaces/app-config.interface";

/**
 * Professional Material Design theme configuration
 * Manages color palettes and theme setup for Angular Material components
 */
class ThemeConfig {
    private readonly isUsCustomer: boolean;

    constructor(
        private readonly $mdThemingProvider: angular.material.IThemingProvider,
        appConfig: AppConfig
    ) {
        this.isUsCustomer = appConfig.US_Customer;
    }

    /**
     * Defines a vibrant yellow primary palette for urgent/warning states
     * Based on Material Design color specifications
     */
    private defineUrgentPrimaryPalette(): void {
        this.$mdThemingProvider.definePalette("urgentPrimary", {
            '50': "#fffbe0",
            '100': "#fef5b3",
            '200': "#feee80",
            '300': "#fee74d",
            '400': "#fde226",
            '500': "#fddd00",
            '600': "#fdd900",
            '700': "#fcd400",
            '800': "#fccf00",
            '900': "#fcc700",
            'A100': "#ffffff",
            'A200': "#fffbef",
            'A400': "#ffefbc",
            'A700': "#ffe9a2",
            'contrastDefaultColor': "light",
            'contrastDarkColors': ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "A100", "A200", "A400", "A700"],
            'contrastLightColors': []
        });
    }

    /**
     * Defines a neutral gray accent palette
     * Provides subtle contrast without competing with primary colors
     */
    private defineAccentPalette(){
        this.$mdThemingProvider.definePalette("accent", {
            '50': "#fafaf9",    // Warm white
            '100': "#f5f5f4",   // Very light warm gray
            '200': "#e7e5e4",   // Light warm gray  
            '300': "#d6d3d1",   // Medium-light warm gray
            '400': "#a8a29e",   // Medium warm gray
            '500': "#78716c",   // Balanced warm gray - MAIN COLOR
            '600': "#57534e",   // Dark warm gray - TOOLBAR COLOR
            '700': "#44403c",   // Darker warm gray
            '800': "#292524",   // Very dark warm gray
            '900': "#1c1917",   // Deepest warm gray
            'A100': "#ffffff",
            'A200': "#f5f5f4",
            'A400': "#a8a29e",
            'A700': "#57534e",
            'contrastDefaultColor': "light",
            'contrastDarkColors': ["50", "100", "200", "300", "A100", "A200"],
            'contrastLightColors': ["400", "500", "600", "700", "800", "900", "A400", "A700"]
        });
    }

    /**
     * Defines a professional blue primary palette for standard branding
     * Inspired by modern corporate design systems
     */
    private defineProfessionalPrimaryPalette(): void {
        this.$mdThemingProvider.definePalette("professionalPrimary", {
            '50': "#e3f2fd",
            '100': "#bbdefb",
            '200': "#90caf9",
            '300': "#64b5f6",
            '400': "#42a5f5",
            '500': "#2196f3",
            '600': "#1e88e5",
            '700': "#1976d2",
            '800': "#1565c0",
            '900': "#0d47a1",
            'A100': "#82b1ff",
            'A200': "#448aff",
            'A400': "#2979ff",
            'A700': "#2962ff",
            'contrastDefaultColor': "light",
            'contrastDarkColors': ["50", "100", "200", "300", "400", "A100"],
            'contrastLightColors': ["500", "600", "700", "800", "900", "A200", "A400", "A700"]
        });
    }

    /**
     * Configures the default theme based on customer region
     * US customers receive professional blue theme, others receive urgent yellow theme
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