const fs = require('fs');
const path = require('path');

// Read the current version from package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = require(packageJsonPath);
const currentVersion = packageJson.version;

// Increment the version (this is a simple increment, you might want a more sophisticated versioning strategy)
const versionParts = currentVersion.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Update version.js
const versionJsPath = path.join(__dirname, 'wwwroot', 'app', 'version.js');
const versionFileContent = `// version.js
angular.module('uDispatch')
    .constant('APP_VERSION', '${newVersion}');`;

fs.writeFileSync(versionJsPath, versionFileContent);

console.log(`Updated version to ${newVersion}`);
