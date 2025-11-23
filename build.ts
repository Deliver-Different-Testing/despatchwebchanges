import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { lessLoader } from "esbuild-plugin-less";

// Type definitions
type EntryPointName = 'vendor' | 'app' | 'home' | 'nationwide' | 'overview' | 'jobSearch' | 'megaMap' | 'taskDashboard' | 'recurringJobs' | 'driverManagement';
type EntryPoints = Record<EntryPointName, string>;

// Configuration
const nodeEnv = process.env.NODE_ENV || "development";
const isDev = process.argv.includes("--dev") || nodeEnv === "development";
const isStaging = nodeEnv === "staging" || nodeEnv === "testing";
const isProd = nodeEnv === "production";

const enableVerboseLogging = isDev || isStaging;
const shouldOptimize = isStaging || isProd;
const shouldWatch = process.argv.includes("--dev"); 

const rootDir = __dirname;
const distPath = path.join(rootDir, "wwwroot/dist");

// Entry points configuration
const entryPoints: EntryPoints = {
    vendor: path.join(rootDir, "wwwroot/app/index.ts"),
    app: path.join(rootDir, "wwwroot/app/app.ts"),
    home: path.join(rootDir, "wwwroot/app/components/home/home.module.ts"),
    nationwide: path.join(rootDir, "wwwroot/app/components/Nationwide/nationwide.module.ts"),
    overview: path.join(rootDir, "wwwroot/app/components/overview/overview.module.ts"),
    jobSearch: path.join(rootDir, "wwwroot/app/components/jobSearch/jobSearch.module.ts"),
    megaMap: path.join(rootDir, "wwwroot/app/components/mega-map/mega-map.module.ts"),
    taskDashboard: path.join(rootDir, "wwwroot/app/components/task-dashboard/task-dashboard.module.ts"),
    recurringJobs: path.join(rootDir, "wwwroot/app/components/recurringJobs/recurringJobs.module.ts"),
    driverManagement: path.join(rootDir, "wwwroot/app/components/driver-management-dashboard/driver-management.module.ts"),
};

// Files that should be hashed in production
const filesToHash: EntryPointName[] = ['vendor', 'app', 'home', 'nationwide', 'overview', 'jobSearch', 'megaMap', 'taskDashboard', 'recurringJobs', 'driverManagement'];

// Utility functions
function toRelativePath(filePath: string): string {
    return path.relative(rootDir, filePath);
}

function generateFileHash(entryName: EntryPointName): string {
    const entryPath = entryPoints[entryName];

    if (!entryPath || !fs.existsSync(entryPath)) {
        return 'fallback';
    }

    const sourceBuffer = fs.readFileSync(entryPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(sourceBuffer);
    return hashSum.digest('hex').substring(0, 8);
}

function cleanDistFolder(): void {
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        for (const file of files) {
            fs.unlinkSync(path.join(distPath, file));
        }
    } else {
        fs.mkdirSync(distPath, { recursive: true });
    }
}

// ESBuild plugins
function createHtmlMinifierPlugin(): esbuild.Plugin {
    return {
        name: "html-minifier",
        setup(build: esbuild.PluginBuild) {
            build.onLoad({ filter: /\.html$/ }, async (args) => {
                const html = await fs.promises.readFile(args.path, 'utf8');

                let minified = html;
                if (!shouldOptimize) {
                    try {
                        const { minify } = require('html-minifier-terser');
                        minified = await minify(html, {
                            collapseWhitespace: true,
                            removeComments: true,
                            minifyCSS: true,
                            minifyJS: true,
                            removeRedundantAttributes: true,
                            removeScriptTypeAttributes: true,
                            removeStyleLinkTypeAttributes: true,
                            conservativeCollapse: true,
                            preserveLineBreaks: false,
                            preventAttributesEscaping: true,
                            ignoreCustomFragments: [/\{\{[\s\S]*?}}/] 
                        });
                    } catch (error) {
                        console.error(`Error minifying HTML in ${args.path}:`, error);
                    }
                }

                return {
                    contents: minified,
                    loader: 'text'
                };
            });
        },
    };
}

function createErrorReportingPlugin(): esbuild.Plugin {
    return {
        name: "error-reporting",
        setup(build: esbuild.PluginBuild) {
            build.onEnd((result) => {
                if (result.errors.length > 0) {
                    console.error("\n[ERROR] Build errors:");
                    result.errors.forEach((error) => {
                        const file = error.location?.file
                            ? toRelativePath(error.location.file)
                            : "unknown";
                        console.error(
                            `  ${file}:${error.location?.line || 0}: ${error.text}`
                        );
                    });
                }
            });
        },
    };
}

// Build configuration
function getBuildConfig(): esbuild.BuildOptions {
    return {
        entryPoints,
        bundle: true,
        sourcemap: enableVerboseLogging,
        minify: shouldOptimize,
        minifyWhitespace: shouldOptimize,
        minifyIdentifiers: shouldOptimize,
        minifySyntax: shouldOptimize,
        target: ["es2015"],
        metafile: shouldOptimize,
        treeShaking: shouldOptimize,
        legalComments: enableVerboseLogging ? "inline" : "none",
        format: "iife",
        mainFields: ["browser", "module", "main"],
        logLevel: enableVerboseLogging ? "info" : "error",
        plugins: [
            lessLoader({
                math: "always",
            }),
            createHtmlMinifierPlugin(),
            createErrorReportingPlugin(),
        ],
        define: {
            "process.env.NODE_ENV": shouldOptimize ? '"development"' : '"production"',
            global: "window",
            jQuery: "window.jQuery",
            $: "window.$",
            angular: "window.angular",
        },
        external: ["jquery", "jquery-ui"],
        loader: {
            ".js": "js",
            ".html": "text",
            ".css": "css",
            ".less": "css",
        },
        alias: {
            "@swc/helpers": path.dirname(
                require.resolve("@swc/helpers/package.json")
            ),
        },
    };
}

// Manifest generation
function generateSimpleManifest(): Record<string, string> {
    const manifest: Record<string, string> = {};

    for (const entryName of Object.keys(entryPoints) as EntryPointName[]) {
        manifest[`${entryName}.js`] = `${entryName}.js`;
        manifest[`${entryName}.css`] = `${entryName}.css`;
    }

    return manifest;
}

function generateHashedManifest(): Record<string, string> {
    const manifest: Record<string, string> = {};
    const files = fs.readdirSync(distPath);

    for (const entryName of Object.keys(entryPoints) as EntryPointName[]) {
        const shouldHash = filesToHash.includes(entryName as EntryPointName);

        if (shouldHash) {
            // Find hashed filenames
            const jsFile = files.find(file => file.startsWith(entryName) && file.endsWith('.js'));
            if (jsFile) {
                manifest[`${entryName}.js`] = jsFile;
            }

            const cssFile = files.find(file => file.startsWith(entryName) && file.endsWith('.css'));
            if (cssFile) {
                manifest[`${entryName}.css`] = cssFile;
            }
        } else {
            // Use original names for non-hashed files
            manifest[`${entryName}.js`] = `${entryName}.js`;
            manifest[`${entryName}.css`] = `${entryName}.css`;
        }
    }

    return manifest;
}

// File hashing functions
function renameFilesWithHashes(): void {
    for (const entryName of filesToHash) {
        const hash = generateFileHash(entryName);

        // Handle JS files
        const jsPath = path.join(distPath, `${entryName}.js`);
        if (fs.existsSync(jsPath)) {
            const newJsName = `${entryName}.${hash}.js`;
            const newJsPath = path.join(distPath, newJsName);
            fs.renameSync(jsPath, newJsPath);
            console.log(`[HASH] Renamed ${entryName}.js to ${newJsName}`);
        }

        // Handle CSS files
        const cssPath = path.join(distPath, `${entryName}.css`);
        if (fs.existsSync(cssPath)) {
            const newCssName = `${entryName}.${hash}.css`;
            const newCssPath = path.join(distPath, newCssName);
            fs.renameSync(cssPath, newCssPath);
            console.log(`[HASH] Renamed ${entryName}.css to ${newCssName}`);
        }

        // Handle source maps
        const jsMapPath = path.join(distPath, `${entryName}.js.map`);
        if (fs.existsSync(jsMapPath)) {
            const newJsMapName = `${entryName}.${hash}.js.map`;
            const newJsMapPath = path.join(distPath, newJsMapName);
            fs.renameSync(jsMapPath, newJsMapPath);

            // Update source map reference in a JS file
            const jsFilePath = path.join(distPath, `${entryName}.${hash}.js`);
            const jsContent = fs.readFileSync(jsFilePath, 'utf8');
            const updatedJsContent = jsContent.replace(
                `//# sourceMappingURL=${entryName}.js.map`,
                `//# sourceMappingURL=${newJsMapName}`
            );
            fs.writeFileSync(jsFilePath, updatedJsContent);
        }
    }
}

// Build functions
async function buildDev(): Promise<void> {
    console.log("[DEV] Building development bundles...");

    const config: esbuild.BuildOptions = {
        ...getBuildConfig(),
        outdir: distPath,
    };

    if (shouldWatch) {
        // Only watch when --dev flag is passed
        console.log("[DEV] Starting file watcher...");
        const ctx = await esbuild.context(config);
        await ctx.watch();

        console.log(`[DEV] Build complete. Watching for changes...`);
        console.log(`Files are being output to ${distPath}`);
        console.log("[DEV] Serve these files with IIS for debugging");

        // Keep the process running for watching
        await new Promise(() => {});
    } else {
        // Just build once without watching
        await esbuild.build(config);
        console.log("[DEV] Build complete (no watching)");
    }

    // Create a simple manifest (no hashing in dev mode)
    const manifest = generateSimpleManifest();
    fs.writeFileSync(
        path.join(distPath, "manifest.json"),
        JSON.stringify(manifest, null, 2)
    );
}

async function buildProd(): Promise<void> {
    console.log("[PROD] Building production bundles...");
    const startTime = Date.now();

    // Check if we've already built (useful for CI environments)
    const manifestPath = path.join(distPath, "manifest.json");
    if (process.env.CI && fs.existsSync(manifestPath)) {
        console.log("[PROD] Build already completed, skipping...");
        return;
    }

    // Build all entry points
    console.log("[PROD] Building all bundles...");
    await esbuild.build({
        ...getBuildConfig(),
        outdir: distPath,
        metafile: true,
    });

    // Add hash keys to filenames for cache busting
    console.log("[PROD] Adding hash keys to filenames...");
    renameFilesWithHashes();

    // Create a manifest with hashed filenames
    const manifest = generateHashedManifest();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PROD] Build completed in ${buildTime}s`);
    console.log(`[PROD] Manifest created with ${Object.keys(manifest).length} entries`);
}

// Main build function
async function build(): Promise<void> {
    try {
        cleanDistFolder();

        if (isDev) {
            await buildDev();
        } else {
            await buildProd();
        }
    } catch (error) {
        console.error("[ERROR] Build failed:", error);
        process.exit(1);
    }
}

// Run the build
build().then(() => console.log("Build process completed successfully."));