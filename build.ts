import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {lessLoader} from "esbuild-plugin-less";
import {es5Plugin} from "esbuild-plugin-es5";
import esbuildPluginTsc from 'esbuild-plugin-tsc';

// Cross-platform environment configuration
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const rootDir = __dirname;
const distPath = path.join(rootDir, "wwwroot/dist");

// File change tracking
const changedFiles = new Set<string>();

function generateHash(content: string | Uint8Array): string {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

async function cleanDistFolder(distPath: string): Promise<void> {
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        for (const file of files) {
            fs.unlinkSync(path.join(distPath, file));
        }
        console.log("[INFO] Cleaned dist folder");
    } else {
        fs.mkdirSync(distPath, {recursive: true});
        console.log("[INFO] Created dist folder");
    }
}

// Convert absolute path to relative for cleaner console output
function toRelativePath(filePath: string): string {
    return path.relative(rootDir, filePath);
}

// HTML tracking plugin
const htmlTrackingPlugin = {
    name: 'html-tracking',
    setup(build: esbuild.PluginBuild) {
        const htmlFiles = new Set<string>();

        build.onResolve({ filter: /\.html$/ }, args => {
            if (args.path.startsWith('.') || args.path.startsWith('/')) {
                const resolvedPath = path.resolve(args.resolveDir, args.path);
                htmlFiles.add(resolvedPath);
            } else {
                htmlFiles.add(args.path);
            }
            return null;
        });

        build.onEnd(() => {
            // Only show HTML template info in production mode
            if (!isDev) {
                console.log("\n[INFO] HTML Templates included in bundle:");
                if (htmlFiles.size === 0) {
                    console.log("  No HTML templates found in bundle");
                } else {
                    const sortedHtmlFiles = Array.from(htmlFiles).sort();
                    sortedHtmlFiles.forEach(file => {
                        console.log(`  ${toRelativePath(file)}`);
                    });
                    console.log(`  Total: ${htmlFiles.size} HTML templates`);
                }
            }
        });
    }
};

// File change tracking plugin
const fileChangeTrackingPlugin = {
    name: 'file-change-tracking',
    setup(build: esbuild.PluginBuild) {
        if (!isDev) return;

        // Track file changes for multiple file types
        const trackedExtensions = ['.ts', '.js', '.html', '.less', '.css'];

        trackedExtensions.forEach(ext => {
            build.onResolve({ filter: new RegExp(`\\${ext}$`) }, args => {
                if (args.path.startsWith('.') || args.path.startsWith('/')) {
                    const resolvedPath = path.resolve(args.resolveDir, args.path);
                    changedFiles.add(resolvedPath);
                } else {
                    changedFiles.add(args.path);
                }
                return null;
            });
        });

        build.onEnd(() => {
            if (changedFiles.size > 0) {
                console.log("\n[DEV] Changed files:");
                const sortedFiles = Array.from(changedFiles).sort();
                sortedFiles.forEach(file => {
                    console.log(`  ${toRelativePath(file)}`);
                });
                console.log(`  Total: ${changedFiles.size} files changed`);

                // Clear the set for the next build
                changedFiles.clear();
            }
        });
    }
};

// Error reporting plugin
const errorReportingPlugin = {
    name: 'error-reporting',
    setup(build: esbuild.PluginBuild) {
        build.onEnd(result => {
            if (result.errors.length > 0) {
                console.error('\n[ERROR] Build errors:');
                result.errors.forEach(error => {
                    const file = error.location?.file ? toRelativePath(error.location.file) : 'unknown';
                    console.error(`  ${file}:${error.location?.line || 0}: ${error.text}`);
                });
            }
            if (result.warnings.length > 0) {
                console.warn('\n[WARN] Build warnings:');
                result.warnings.forEach(warning => {
                    const file = warning.location?.file ? toRelativePath(warning.location.file) : 'unknown';
                    console.warn(`  ${file}:${warning.location?.line || 0}: ${warning.text}`);
                });
            }
        });
    }
};

// Live reload plugin
const liveReloadPlugin = {
    name: 'live-reload',
    setup(build: esbuild.PluginBuild) {
        if (isDev) {
            build.onEnd(() => {
                console.log('[DEV] Build complete - reloading...');
            });
        }
    }
};

async function build(): Promise<void> {
    const startTime = Date.now();

    try {
        await cleanDistFolder(distPath);

        const commonConfig: esbuild.BuildOptions = {
            entryPoints: [path.join(rootDir, "wwwroot/app/index.ts")],
            bundle: true,
            sourcemap: true,
            minify: !isDev,
            target: ["es5"],
            metafile: true,
            treeShaking: !isDev,
            legalComments: isDev ? "inline" : "none",
            format: "iife",
            mainFields: ["browser", "module", "main"],
            logLevel: 'info',
            drop: isDev ? [] : ['debugger'],
            plugins: [
                esbuildPluginTsc(),
                lessLoader({
                    math: 'always'
                }),
                es5Plugin(),
                htmlTrackingPlugin,
                fileChangeTrackingPlugin,
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
            const devConfig: esbuild.BuildOptions = {
                ...commonConfig,
                outfile: path.join(distPath, 'bundle.js'),
                splitting: false
            };

            // Create context for development
            const ctx = await esbuild.context(devConfig);

            // Start watching
            await ctx.watch();
            console.log("[DEV] Watching for changes...");

            // Start development server
            const {host, port} = await ctx.serve({
                servedir: path.join(rootDir, "wwwroot"),
                host: 'localhost',
                port: 3000,
                onRequest: (args) => {
                    console.log(`[DEV] ${args.method} ${args.path}`);
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

            console.log(`[DEV] Development server running at http://${host}:${port}`);
            // Keep the process running
            await new Promise(() => {});
        } else {
            // Production build configuration
            console.log("[PROD] Starting production build...");

            const tempResult = await esbuild.build({
                ...commonConfig,
                write: false,
                outfile: path.join(distPath, 'bundle.js')
            });

            const outputFiles = tempResult.outputFiles!;
            const jsContent = outputFiles.find(f => f.path.endsWith('.js'))!.contents;
            const contentHash = generateHash(jsContent);

            const jsFilename = `bundle.${contentHash}.js`;
            const cssFilename = `bundle.${contentHash}.css`;

            // Final production build
            const result = await esbuild.build({
                ...commonConfig,
                outfile: path.join(distPath, jsFilename),
                write: true,
                plugins: [
                    ...commonConfig.plugins!,
                    {
                        name: 'css-output',
                        setup(build: esbuild.PluginBuild) {
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

            const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[PROD] Build completed successfully in ${buildTime}s`);
            console.log("[PROD] Generated manifest:", manifest);

            if (result.metafile) {
                // Print bundle analysis
                const analysis = await esbuild.analyzeMetafile(result.metafile);
                console.log("\n[PROD] Bundle analysis:", analysis);

                // Additional detailed reporting
                console.log("\n[PROD] Bundle composition:");
                const metafile = result.metafile;

                // Count and display file types
                const fileTypes: Record<string, number> = {};
                let totalJsSize = 0;
                let totalCssSize = 0;
                let totalHtmlSize = 0;

                Object.entries(metafile.inputs).forEach(([file, info]) => {
                    const ext = path.extname(file).toLowerCase();
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;

                    if (ext === '.js' || ext === '.ts' || ext === '.tsx') {
                        totalJsSize += info.bytes;
                    } else if (ext === '.css' || ext === '.less') {
                        totalCssSize += info.bytes;
                    } else if (ext === '.html') {
                        totalHtmlSize += info.bytes;
                    }
                });
            }
        }
    } catch (error) {
        console.error("[ERROR] Build failed:", error);
        process.exit(1);
    }
}

// Execute the build based on environment
build();
