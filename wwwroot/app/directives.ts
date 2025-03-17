import app from "./app";

app.directive('ngRightClick', ['$parse', ($parse: angular.IParseService): angular.IDirective => ({
    restrict: 'A',
    link: (scope: angular.IScope, element: angular.IAugmentedJQuery, attrs: angular.IAttributes): void => {
        const fn = $parse(attrs.ngRightClick);

        element.on('contextmenu', (event: JQueryEventObject): boolean => {
            event.preventDefault();

            scope.$apply((): void => {
                fn(scope, { $event: event });
            });

            return false;
        });
    }
})]);
