const fs = require('fs');
const path = require('path');

function generateUniqueVersion() {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, -5);
    return `${timestamp}`;
}

function generateVersionFile() {
    const version = generateUniqueVersion();
    const versionJsPath = path.join(__dirname, 'wwwroot', 'app', 'version.js');
    const versionFileContent = `// version.js
angular.module('uDispatch')
    .constant('APP_VERSION', '${version}');`;

    fs.writeFileSync(versionJsPath, versionFileContent);
    console.log(`Generated version.js with version ${version}`);
}

// Only generate the version file if this script is run directly
if (require.main === module) {
    generateVersionFile();
}

module.exports = {generateVersionFile};
