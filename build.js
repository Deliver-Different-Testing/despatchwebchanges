const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { lessLoader } = require("esbuild-plugin-less");
const { es5Plugin } = require("esbuild-plugin-es5");

// Helper to generate content hash
function generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

// Helper to clean dist folder
async function cleanDistFolder(distPath) {
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        for (const file of files) {
            fs.unlinkSync(path.join(distPath, file));
        }
        console.log("Cleaned dist folder");
    } else {
        fs.mkdirSync(distPath, { recursive: true });
        console.log("Created dist folder");
    }
}

async function build() {
    const rootDir = __dirname;
    const distPath = path.join(rootDir, "wwwroot/dist");

    try {
        // Clean dist folder first
        await cleanDistFolder(distPath);

        // Common build configuration
        const buildConfig = {
            entryPoints: [path.join(rootDir, "wwwroot/app/index.js")],
            bundle: true,
            sourcemap: true,
            minify: true,
            target: ["es5"],
            metafile: true,
            treeShaking: true,
            legalComments: "none",
            format: "iife",
            mainFields: ["browser", "module", "main"],
            plugins: [
                lessLoader({
                    javascriptEnabled: true,
                    math: 'always'
                }),
                es5Plugin()
            ],
            define: {
                'process.env.NODE_ENV': '"production"',
                'global': "window",
                'angular': "window.angular",
                '$': "window.jQuery",
                'moment': "window.moment"
            },
            external: [
                "angular",
                "angular-aria",
                "angular-animate",
                "angular-material",
                "angular-material-data-table",
                "jquery",
                "moment",
                "leaflet",
                "angularResizable",
                "ui.sortable",
                "ui.bootstrap",
                "ui.timepicker",
                "pickadate",
                "ngMap",
                "ngMapAutocomplete",
                "heremaps",
                "angularPromiseButtons",
                "angularMoment",
                "ngFileUpload",
                "moment"
            ],
            loader: {
                '.js': "js",
                '.html': "text",
                '.css': 'css',
                '.less': 'css'
            },
            alias: {
                '@swc/helpers': path.dirname(require.resolve("@swc/helpers/package.json")),
            },
            minifyIdentifiers: false
        };

        // First build to get content for hashing
        const tempResult = await esbuild.build({
            ...buildConfig,
            write: false,
            outdir: distPath
        });

        // Generate hash from the output content
        const outputFiles = tempResult.outputFiles;
        const jsContent = outputFiles.find(f => f.path.endsWith('.js')).contents;
        const contentHash = generateHash(jsContent);

        // Use content-based hash for filenames
        const jsFilename = `bundle.${contentHash}.js`;
        const cssFilename = `bundle.${contentHash}.css`;

        // Second build with proper filenames
        const result = await esbuild.build({
            ...buildConfig,
            outfile: path.join(distPath, jsFilename),
            write: true,
            plugins: [
                ...buildConfig.plugins,
                {
                    name: 'css-output',
                    setup(build) {
                        build.onEnd(result => {
                            if (result.outputFiles) {
                                const cssContent = result.outputFiles
                                    .filter(file => file.path.endsWith('.css'))
                                    .map(file => file.text)
                                    .join('\n');

                                if (cssContent) {
                                    fs.writeFileSync(
                                        path.join(distPath, cssFilename),
                                        cssContent
                                    );
                                }
                            }
                        });
                    }
                }
            ]
        });

        // Create and write the manifest
        const manifest = {
            'bundle.js': jsFilename,
            'styles.css': cssFilename
        };

        fs.writeFileSync(
            path.join(distPath, "manifest.json"),
            JSON.stringify(manifest, null, 2)
        );

        // Write sourcemap files with matching hashes
        outputFiles
            .filter(f => f.path.endsWith('.map'))
            .forEach(f => {
                const filename = path.basename(f.path).replace('bundle', `bundle.${contentHash}`);
                fs.writeFileSync(path.join(distPath, filename), f.contents);
            });

        console.log("Build completed successfully!");
        console.log("Generated manifest:", manifest);

        // Log bundle analysis if available
        if (result.metafile) {
            const analysis = await esbuild.analyzeMetafile(result.metafile);
            console.log("\nBundle analysis:", analysis);
        }

    } catch (error) {
        console.error("Build failed:", error);
        process.exit(1);
    }
}

// Execute the build
build();