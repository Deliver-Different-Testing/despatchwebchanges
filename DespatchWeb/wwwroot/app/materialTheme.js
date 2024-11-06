/**
 * @fileoverview Angular Material theme configuration for uDispatch module
 * @module uDispatch
 */
angular.module('uDispatch')
    .config(['$mdThemingProvider', 'APP_CONFIG', ($mdThemingProvider, APP_CONFIG) => {
        const isUsCustomer = APP_CONFIG.US_Customer;

        /**
         * Define custom color palette for Urgent primary colors
         */
        $mdThemingProvider.definePalette('urgentPrimary', {
            '50': 'fffbe0',
            '100': 'fef5b3',
            '200': 'feee80',
            '300': 'fee74d',
            '400': 'fde226',
            '500': 'fddd00',
            '600': 'fdd900',
            '700': 'fcd400',
            '800': 'fccf00',
            '900': 'fcc700',
            'A100': 'ffffff',
            'A200': 'fffbef',
            'A400': 'ffefbc',
            'A700': 'ffe9a2',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': []
        });

        /**
         * Define custom color palette for accent color
         */
        $mdThemingProvider.definePalette('accent', {
            '50': 'ececec',
            '100': 'cecece',
            '200': 'aeaeae',
            '300': '8e8e8e',
            '400': '757575',
            '500': '5d5d5d',
            '600': '555555',
            '700': '4b4b4b',
            '800': '414141',
            '900': '303030',
            'A100': '070406',
            'A200': '070406',
            'A400': '070406',
            'A700': '000000',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': ['50', '100', '200', '300', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': ['400', '500', '600', '700', '800', '900']
        });

        /**
         * Define custom color palette for DFRNT primary colors
         */
        $mdThemingProvider.definePalette('dfrntPrimary', {
            '50': '#e8f6f8',
            '100': '#c5e8ed',
            '200': '#9fd9e2',
            '300': '#79c9d6',
            '400': '#5cbccd',
            '500': '#3EAFC2',
            '600': '#38a8bc',
            '700': '#309fb4',
            '800': '#2896ac',
            '900': '#1b869f',
            'A100': '#e3f9ff',
            'A200': '#b0eeff',
            'A400': '#7de3ff',
            'A700': '#64ddff',
            'contrastDefaultColor': 'dark',
            'contrastDarkColors': ['50', '100', '200', '300', '400', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': ['500', '600', '700', '800', '900']
        });

        /**
         * Configure the default theme with custom palettes
         */
        if (isUsCustomer) {
            $mdThemingProvider.theme('default')
                .primaryPalette('dfrntPrimary')
                .accentPalette('accent');
        } else {
            $mdThemingProvider.theme('default')
                .primaryPalette('urgentPrimary')
                .accentPalette('accent');
        }

        /**
         * Register additional themes for toasts
         */
        $mdThemingProvider.theme('success-toast').primaryPalette('green');
        $mdThemingProvider.theme('warning-toast').primaryPalette('orange');
        $mdThemingProvider.theme('error-toast').primaryPalette('red');
    }])
