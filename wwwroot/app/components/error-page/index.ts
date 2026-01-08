/**
 * Error Page Module
 *
 * AngularJS module that provides the React Error Page directive.
 */

import * as angular from 'angular';
import reactErrorPageDirective from './react-error-page.directive';

const errorPageModule = angular
    .module('uDispatch.errorPage', [])
    .directive('reactErrorPage', reactErrorPageDirective);

export default errorPageModule;
