import app from "./app";

app.directive('ngRightClick', ['$parse', ($parse: angular.IParseService): angular.IDirective => ({
    restrict: 'A',
    link: (scope: angular.IScope, element: angular.IAugmentedJQuery, attrs: angular.IAttributes): void => {
        const fn = $parse(attrs.ngRightClick);

        element.on('contextmenu', (event: JQueryEventObject): boolean => {
            event.preventDefault();

            scope.$apply((): void => {
                fn(scope, {$event: event});
            });

            return false;
        });
    }
})]);

interface IMdAutocompleteController extends angular.IController {
    matches: any[];

    select(index: number): void;

    index: number;
}

app.directive('mdAutocompleteEnterSelect', ['$timeout',
    ($timeout: angular.ITimeoutService): angular.IDirective => ({
        restrict: 'A',
        require: '^mdAutocomplete',
        link: (
            scope: angular.IScope,
            element: angular.IAugmentedJQuery,
            _: angular.IAttributes,
            controller: angular.IController | IMdAutocompleteController[] | undefined
        ): void => {
            const ctrl = controller as IMdAutocompleteController;

            element.on('keydown', (event: JQueryEventObject): void => {
                if (event.key === 'Enter') {
                    $timeout((): void => {
                        const suggestions = ctrl.matches;

                        if (suggestions && suggestions.length > 0) {
                            ctrl.select(ctrl.index === -1 ? 0 : ctrl.index);
                            if (!scope.$root.$$phase) {
                                scope.$apply();
                            }
                        }
                    }, 0);
                }
            });
        }
    })
]);
