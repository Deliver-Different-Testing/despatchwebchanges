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
    
    // Read the existing source map from Babel
    let sourceMap;
    try {
        sourceMap = fs.readFileSync(inputPath + '.map', 'utf8');
        sourceMap = JSON.parse(sourceMap);
    } catch (err) {
        console.warn(`No source map found for ${file}, creating new one`);
    }

    try {
        const result = uglifyJs.minify(code, {
            sourceMap: {
                content: sourceMap,
                filename: path.basename(file),
                url: path.basename(file.replace('.js', '.min.js')) + '.map',
                includeSources: true,
                root: '../../../app/'  // Adjust this path to match your source file structure
            },
            compress: {
                drop_console: true,
                pure_funcs: ['console.log']
            },
            output: {
                comments: false
            }
        });

        if (result.error) {
            throw result.error;
        }

        fs.writeFileSync(outputPath, result.code);
        fs.writeFileSync(outputPath + '.map', result.map);
        console.log(`Minified ${file} -> ${path.basename(outputPath)}`);
    } catch (error) {
        console.error(`Error minifying ${file}:`, error);
    }
});