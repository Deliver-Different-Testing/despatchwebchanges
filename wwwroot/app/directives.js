"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
app_1.default.directive('ngRightClick', ['$parse', ($parse) => ({
        restrict: 'A',
        link: (scope, element, attrs) => {
            const fn = $parse(attrs.ngRightClick);
            element.on('contextmenu', (event) => {
                event.preventDefault();
                scope.$apply(() => {
                    fn(scope, { $event: event });
                });
                return false;
            });
        }
    })]);
