// This versioning controllers the caching for html, tpl and js files throughout the application.
// update-version.js controls this, and it bumped up each build to ensure browsers load the latest changes
angular.module('uDispatch')
    .constant('APP_VERSION', 'Version Number Here');
