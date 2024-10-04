angular.module('uDispatch')
    .config(['$mdThemingProvider', $mdThemingProvider => {
        $mdThemingProvider.definePalette('urgentPrimary', {
            '50': 'e0f8ff',
            '100': 'b3e8ff',
            '200': '80d9ff',
            '300': '4dc9ff',
            '400': '26baff',
            '500': '76EAFE',
            '600': '00a8f3',
            '700': '0099e0',
            '800': '0089cc',
            '900': '0079b8',
            'A100': 'ffffff',
            'A200': 'd1ecff',
            'A400': '9ed8ff',
            'A700': '6bc4ff',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': []
        });

        $mdThemingProvider.definePalette('urgentAccent', {
            '50': 'e0f8ff',
            '100': 'b3e8ff',
            '200': '80d9ff',
            '300': '4dc9ff',
            '400': '26baff',
            '500': '76EAFE',
            '600': '00a8f3',
            '700': '0099e0',
            '800': '0089cc',
            '900': '0079b8',
            'A100': 'ffffff',
            'A200': 'd1ecff',
            'A400': '9ed8ff',
            'A700': '6bc4ff',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': [
                '50', '100', '200', '300', '400', '500',
                '600', '700', '800', '900',
                'A100', 'A200', 'A400', 'A700'
            ],
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
