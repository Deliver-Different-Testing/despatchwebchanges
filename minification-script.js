const fs = require('fs');
const path = require('path');
const uglifyJs = require('uglify-js');
const glob = require('glob');

const inputDir = path.join(__dirname, 'wwwroot', 'dist');

// Get all JS files recursively
const files = glob.sync('**/*.js', {cwd: inputDir});

files.forEach((file) => {
    // Skip already minified files
    if (file.endsWith('.min.js')) return;

    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(inputDir, file.replace('.js', '.min.js'));

    const code = fs.readFileSync(inputPath, 'utf8');
    try {
        const result = uglifyJs.minify(code, {
            sourceMap: {
                filename: path.basename(file),
                url: path.basename(file) + '.map'
            },
            compress: {
                drop_console: true,
                pure_funcs: ['console.log']
            },
            output: {
                comments: false
            }
        });

        fs.writeFileSync(outputPath, result.code);
        fs.writeFileSync(outputPath + '.map', result.map);
        console.log(`Minified ${file} -> ${path.basename(outputPath)}`);
    } catch (error) {
        console.error(`Error minifying ${file}:`, error);
    }
});
