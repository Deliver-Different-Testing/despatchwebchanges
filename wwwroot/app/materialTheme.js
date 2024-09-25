angular.module('uDispatch')
    .config(['$mdThemingProvider', $mdThemingProvider => {
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

        $mdThemingProvider.definePalette('urgentAccent', {
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


        // Material Theme
        $mdThemingProvider.theme('default')
            .primaryPalette('urgentPrimary')
            .accentPalette('urgentAccent');

        // Register Toast themes
        $mdThemingProvider.theme('success-toast')
        $mdThemingProvider.theme('warning-toast')
        $mdThemingProvider.theme('error-toast')
    }])
