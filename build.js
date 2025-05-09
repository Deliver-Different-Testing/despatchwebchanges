"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const esbuild_1 = __importDefault(require("esbuild"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const esbuild_plugin_less_1 = require("esbuild-plugin-less");
const esbuild_plugin_es5_1 = require("esbuild-plugin-es5");
const esbuild_plugin_tsc_1 = __importDefault(require("esbuild-plugin-tsc"));
// Cross-platform environment configuration
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const rootDir = __dirname;
const distPath = path_1.default.join(rootDir, "wwwroot/dist");
// File change tracking
const changedFiles = new Set();
function generateHash(content) {
    return crypto_1.default.createHash('md5').update(content).digest('hex').slice(0, 8);
}
function cleanDistFolder(distPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (fs_1.default.existsSync(distPath)) {
            const files = fs_1.default.readdirSync(distPath);
            for (const file of files) {
                fs_1.default.unlinkSync(path_1.default.join(distPath, file));
            }
            console.log("[INFO] Cleaned dist folder");
        }
        else {
            fs_1.default.mkdirSync(distPath, { recursive: true });
            console.log("[INFO] Created dist folder");
        }
    });
}
// Convert absolute path to relative for cleaner console output
function toRelativePath(filePath) {
    return path_1.default.relative(rootDir, filePath);
}
// HTML tracking plugin
const htmlTrackingPlugin = {
    name: 'html-tracking',
    setup(build) {
        const htmlFiles = new Set();
        build.onResolve({ filter: /\.html$/ }, args => {
            if (args.path.startsWith('.') || args.path.startsWith('/')) {
                const resolvedPath = path_1.default.resolve(args.resolveDir, args.path);
                htmlFiles.add(resolvedPath);
            }
            else {
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
                }
                else {
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
    setup(build) {
        if (!isDev)
            return;
        // Track file changes for multiple file types
        const trackedExtensions = ['.ts', '.js', '.html', '.less', '.css'];
        trackedExtensions.forEach(ext => {
            build.onResolve({ filter: new RegExp(`\\${ext}$`) }, args => {
                if (args.path.startsWith('.') || args.path.startsWith('/')) {
                    const resolvedPath = path_1.default.resolve(args.resolveDir, args.path);
                    changedFiles.add(resolvedPath);
                }
                else {
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
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length > 0) {
                console.error('\n[ERROR] Build errors:');
                result.errors.forEach(error => {
                    var _a, _b;
                    const file = ((_a = error.location) === null || _a === void 0 ? void 0 : _a.file) ? toRelativePath(error.location.file) : 'unknown';
                    console.error(`  ${file}:${((_b = error.location) === null || _b === void 0 ? void 0 : _b.line) || 0}: ${error.text}`);
                });
            }
            if (result.warnings.length > 0) {
                console.warn('\n[WARN] Build warnings:');
                result.warnings.forEach(warning => {
                    var _a, _b;
                    const file = ((_a = warning.location) === null || _a === void 0 ? void 0 : _a.file) ? toRelativePath(warning.location.file) : 'unknown';
                    console.warn(`  ${file}:${((_b = warning.location) === null || _b === void 0 ? void 0 : _b.line) || 0}: ${warning.text}`);
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
                console.log('[DEV] Build complete - reloading...');
            });
        }
    }
};
function build() {
    return __awaiter(this, void 0, void 0, function* () {
        const startTime = Date.now();
        try {
            yield cleanDistFolder(distPath);
            const commonConfig = {
                entryPoints: [path_1.default.join(rootDir, "wwwroot/app/index.ts")],
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
                    esbuild_plugin_tsc_1.default(),
                    esbuild_plugin_less_1.lessLoader({
                        math: 'always'
                    }),
                    esbuild_plugin_es5_1.es5Plugin(),
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
                    '@swc/helpers': path_1.default.dirname(require.resolve("@swc/helpers/package.json")),
                },
                minifyIdentifiers: !isDev
            };
            if (isDev) {
                // Development build configuration
                const devConfig = Object.assign(Object.assign({}, commonConfig), { outfile: path_1.default.join(distPath, 'bundle.js'), splitting: false });
                // Create context for development
                const ctx = yield esbuild_1.default.context(devConfig);
                // Start watching
                yield ctx.watch();
                console.log("[DEV] Watching for changes...");
                // Start development server
                const { host, port } = yield ctx.serve({
                    servedir: path_1.default.join(rootDir, "wwwroot"),
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
                fs_1.default.writeFileSync(path_1.default.join(distPath, "manifest.json"), JSON.stringify(manifest, null, 2));
                console.log(`[DEV] Development server running at http://${host}:${port}`);
                // Keep the process running
                yield new Promise(() => { });
            }
            else {
                // Production build configuration
                console.log("[PROD] Starting production build...");
                const tempResult = yield esbuild_1.default.build(Object.assign(Object.assign({}, commonConfig), { write: false, outfile: path_1.default.join(distPath, 'bundle.js') }));
                const outputFiles = tempResult.outputFiles;
                const jsContent = outputFiles.find(f => f.path.endsWith('.js')).contents;
                const contentHash = generateHash(jsContent);
                const jsFilename = `bundle.${contentHash}.js`;
                const cssFilename = `bundle.${contentHash}.css`;
                // Final production build
                const result = yield esbuild_1.default.build(Object.assign(Object.assign({}, commonConfig), { outfile: path_1.default.join(distPath, jsFilename), write: true, plugins: [
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
                                            fs_1.default.writeFileSync(path_1.default.join(distPath, cssFilename), cssContent);
                                        }
                                    }
                                });
                            }
                        }
                    ] }));
                const manifest = {
                    'bundle.js': jsFilename,
                    'styles.css': cssFilename
                };
                fs_1.default.writeFileSync(path_1.default.join(distPath, "manifest.json"), JSON.stringify(manifest, null, 2));
                const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[PROD] Build completed successfully in ${buildTime}s`);
                console.log("[PROD] Generated manifest:", manifest);
                if (result.metafile) {
                    // Print bundle analysis
                    const analysis = yield esbuild_1.default.analyzeMetafile(result.metafile);
                    console.log("\n[PROD] Bundle analysis:", analysis);
                    // Additional detailed reporting
                    console.log("\n[PROD] Bundle composition:");
                    const metafile = result.metafile;
                    // Count and display file types
                    const fileTypes = {};
                    let totalJsSize = 0;
                    let totalCssSize = 0;
                    let totalHtmlSize = 0;
                    Object.entries(metafile.inputs).forEach(([file, info]) => {
                        const ext = path_1.default.extname(file).toLowerCase();
                        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                        if (ext === '.js' || ext === '.ts' || ext === '.tsx') {
                            totalJsSize += info.bytes;
                        }
                        else if (ext === '.css' || ext === '.less') {
                            totalCssSize += info.bytes;
                        }
                        else if (ext === '.html') {
                            totalHtmlSize += info.bytes;
                        }
                    });
                }
            }
        }
        catch (error) {
            console.error("[ERROR] Build failed:", error);
            process.exit(1);
        }
    });
}
// Execute the build based on environment
build();
