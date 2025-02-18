const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {lessLoader} = require("esbuild-plugin-less");
const {es5Plugin} = require("esbuild-plugin-es5");

// Cross-platform environment configuration
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const rootDir = __dirname;
const distPath = path.join(rootDir, "wwwroot/dist");

/**
 * Generates an MD5 hash of the provided content and returns the first 8 characters.
 * @param {string|Buffer} content - The content to hash
 * @returns {string} The truncated MD5 hash
 */
function generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

async function cleanDistFolder(distPath) {
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        for (const file of files) {
            fs.unlinkSync(path.join(distPath, file));
        }
        console.log("📁 Cleaned dist folder");
    } else {
        fs.mkdirSync(distPath, {recursive: true});
        console.log("📁 Created dist folder");
    }
}

// Error reporting plugin
const errorReportingPlugin = {
    name: 'error-reporting',
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length > 0) {
                console.error('\n🔴 Build errors:');
                result.errors.forEach(error => {
                    console.error(`  ${error.location?.file}:${error.location?.line}: ${error.text}`);
                });
            }
            if (result.warnings.length > 0) {
                console.warn('\n⚠️ Build warnings:');
                result.warnings.forEach(warning => {
                    console.warn(`  ${warning.location?.file}:${warning.location?.line}: ${warning.text}`);
                });
            }
        });
    }
};

// Live reload plugin
const liveReloadPlugin = {
    name: 'live-reload',
    setup(build) {
        if (isDev) {
            build.onEnd(() => {
                console.log('🔄 Build complete - reloading...');
            });
        }
    }
};


/**
 * Main build function that bundles and processes application assets.
 * Performs the following steps:
 * 1. Cleans the distribution folder
 * 2. Performs an initial build to generate content for hashing
 * 3. Creates content-hashed versions of bundle files
 * 4. Generates and writes a manifest file
 * 5. Handles sourcemap generation
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the build process fails
 */
async function build() {
    try {
        await cleanDistFolder(distPath);

        const commonConfig = {
            entryPoints: [path.join(rootDir, "wwwroot/app/index.js")],
            bundle: true,
            sourcemap: true,
            minify: !isDev,
            target: ["es5"],
            metafile: true,
            treeShaking: !isDev,
            legalComments: isDev ? "inline" : "none",
            format: "iife",
            mainFields: ["browser", "module", "main"],
            logLevel: isDev ? 'info' : 'error',
            drop: isDev ? [] : ['console', 'debugger'],
            plugins: [
                lessLoader({
                    javascriptEnabled: true,
                    math: 'always'
                }),
                es5Plugin(),
                errorReportingPlugin,
                liveReloadPlugin
            ],
            define: {
                'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
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
                "ngFileUpload"
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
            minifyIdentifiers: !isDev
        };

        if (isDev) {
            // Development build configuration
            const devConfig = {
                ...commonConfig,
                outfile: path.join(distPath, 'bundle.js'),  // Single output file for development
                splitting: false
            };

            // Create context for development
            const ctx = await esbuild.context(devConfig);

            // Start watching
            await ctx.watch();
            console.log("👀 Watching for changes...");

            // Start development server
            const {host, port} = await ctx.serve({
                servedir: path.join(rootDir, "wwwroot"),
                host: 'localhost',
                port: 3000,
                onRequest: (args) => {
                    console.log(`${args.method} ${args.path}`);
                }
            });

            const manifest = {
                'bundle.js': 'bundle.js',
                'styles.css': 'bundle.css'
            };

            fs.writeFileSync(
                path.join(distPath, "manifest.json"),
                JSON.stringify(manifest, null, 2)
            );

            console.log(`🚀 Development server running at http://${host}:${port}`);
            // Keep the process running
            await new Promise(() => {
            });
        } else {
            // Production build configuration
            const tempResult = await esbuild.build({
                ...commonConfig,
                write: false,
                outfile: path.join(distPath, 'bundle.js')
            });

            const outputFiles = tempResult.outputFiles;
            const jsContent = outputFiles.find(f => f.path.endsWith('.js')).contents;
            const contentHash = generateHash(jsContent);

            const jsFilename = `bundle.${contentHash}.js`;
            const cssFilename = `bundle.${contentHash}.css`;

            // Final production build
            const result = await esbuild.build({
                ...commonConfig,
                outfile: path.join(distPath, jsFilename),
                write: true,
                plugins: [
                    ...commonConfig.plugins,
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

            const manifest = {
                'bundle.js': jsFilename,
                'styles.css': cssFilename
            };

            fs.writeFileSync(
                path.join(distPath, "manifest.json"),
                JSON.stringify(manifest, null, 2)
            );

            console.log("✅ Build completed successfully!");
            console.log("📦 Generated manifest:", manifest);

            if (result.metafile) {
                const analysis = await esbuild.analyzeMetafile(result.metafile);
                console.log("\n📊 Bundle analysis:", analysis);
            }
        }
    } catch (error) {
        console.error("❌ Build failed:", error);
        process.exit(1);
    }
}

// Execute the build based on environment
build();
