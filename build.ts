import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import {lessLoader} from "esbuild-plugin-less";

// Type definitions
type EntryPointName =
    'vendor-core'
    | 'vendor-plugins'
    | 'vendor-react'
    | 'app'
    | 'home'
    | 'nationwide'
    | 'jobSearch'
    | 'taskDashboardReact'
    | 'driverManagementReact'
    | 'composeEmailDialogReact'
    | 'courierMapReact'
    | 'dateRangeDialogReact'
    | 'priceBreakdownDialogReact'
    | 'dashboardSettingsDialogReact'
    | 'autoCompleteDialogReact'
    | 'voidJobConfirmationDialogReact'
    | 'editAfterhoursDialogReact'
    | 'editAddressDialogReact'
    | 'editDateTimeDialogReact'
    | 'flightAgentConfirmationDialogReact'
    | 'flightDetailsDialogReact'
    | 'appShellReact'
    | 'errorPageReact'
    | 'recurringJobsReact'
    | 'additionalServicesDialogReact'
    | 'accessorialChargesDialogReact'
    | 'bulkPriceUploadDialogReact'
    | 'messagingDialogReact'
    | 'sendPodDialogReact'
    | 'aiAssistantDialogReact'
    | 'createJobDialogReact'
    | 'swapPodsDialogReact'
    | 'selectDialogReact'
    | 'editParcelDimensionsDialogReact'
    | 'simplePriceEditDialogReact'
    | 'overviewReact';
type EntryPoints = Record<EntryPointName, string>;

// Configuration
const isDev = process.argv.includes("--dev");
const isAnalyze = process.argv.includes("--analyze");
const rootDir = __dirname;
const distPath = path.join(rootDir, "wwwroot/dist");

// Entry points configuration
const entryPoints: EntryPoints = {
    "vendor-core": path.join(rootDir, "wwwroot/app/index.ts"),
    "vendor-plugins": path.join(rootDir, "wwwroot/app/vendor-plugins.ts"),
    "vendor-react": path.join(rootDir, "wwwroot/app/vendor-react.ts"),
    app: path.join(rootDir, "wwwroot/app/app.ts"),
    home: path.join(rootDir, "wwwroot/app/components/home/home.module.ts"),
    nationwide: path.join(rootDir, "wwwroot/app/components/Nationwide/nationwide.module.ts"),
    jobSearch: path.join(rootDir, "wwwroot/app/components/jobSearch/jobSearch.module.ts"),
    taskDashboardReact: path.join(rootDir, "wwwroot/app/react/pages/task-dashboard/task-dashboard-react.module.tsx"),
    driverManagementReact: path.join(rootDir, "wwwroot/app/react/pages/driver-management/driver-management-react.module.tsx"),
    composeEmailDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/compose-email-dialog/compose-email-dialog-react.module.tsx"),
    courierMapReact: path.join(rootDir, "wwwroot/app/react/pages/courier-map/courier-map-react.module.tsx"),
    dateRangeDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/date-range-dialog/date-range-dialog-react.module.tsx"),
    priceBreakdownDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/price-breakdown-dialog/price-breakdown-dialog-react.module.tsx"),
    dashboardSettingsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module.tsx"),
    autoCompleteDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/auto-complete-dialog/auto-complete-dialog-react.module.tsx"),
    voidJobConfirmationDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog-react.module.tsx"),
    editAfterhoursDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-afterhours-dialog/edit-afterhours-dialog-react.module.tsx"),
    editAddressDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-address-dialog/edit-address-dialog-react.module.tsx"),
    editDateTimeDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-date-time-dialog/edit-date-time-dialog-react.module.tsx"),
    flightAgentConfirmationDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/flight-agent-confirmation-dialog/flight-agent-confirmation-dialog-react.module.tsx"),
    flightDetailsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/flight-details-dialog/flight-details-dialog-react.module.tsx"),
    appShellReact: path.join(rootDir, "wwwroot/app/react/components/common/app-shell/app-shell-react.module.tsx"),
    errorPageReact: path.join(rootDir, "wwwroot/app/react/pages/error-page/error-page-react.module.tsx"),
    recurringJobsReact: path.join(rootDir, "wwwroot/app/react/pages/recurring-jobs/recurring-jobs-react.module.tsx"),
    additionalServicesDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/additional-services-dialog/additional-services-dialog-react.module.tsx"),
    accessorialChargesDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/accessorial-charges-dialog/accessorial-charges-dialog-react.module.tsx"),
    bulkPriceUploadDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/bulk-price-upload-dialog/bulk-price-upload-dialog-react.module.tsx"),
    messagingDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/messaging-dialog/messaging-dialog-react.module.tsx"),
    sendPodDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/send-pod-dialog/send-pod-dialog-react.module.tsx"),
    aiAssistantDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/ai-assistant-dialog/ai-assistant-dialog-react.module.tsx"),
    createJobDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/create-job-dialog/create-job-dialog-react.module.tsx"),
    swapPodsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module.tsx"),
    selectDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/select-dialog/select-dialog-react.module.tsx"),
    editParcelDimensionsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog-react.module.tsx"),
    simplePriceEditDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/simple-price-edit-dialog/simple-price-edit-dialog-react.module.tsx"),
    overviewReact: path.join(rootDir, "wwwroot/app/react/pages/overview/overview-react.module.tsx"),
};

// Lazy-load html-minifier-terser only when needed (production builds)
let htmlMinifier: typeof import('html-minifier-terser') | null = null;
async function getHtmlMinifier() {
    if (!htmlMinifier) {
        htmlMinifier = await import('html-minifier-terser');
    }
    return htmlMinifier;
}

// Utility functions
function toRelativePath(filePath: string): string {
    return path.relative(rootDir, filePath);
}

function cleanDistFolder(): void {
    fs.rmSync(distPath, { recursive: true, force: true });
    fs.mkdirSync(distPath, { recursive: true });
}

// HTML minification options (cached)
const htmlMinifyOptions = {
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
};

// ESBuild plugins
function createHtmlMinifierPlugin(): esbuild.Plugin {
    return {
        name: "html-minifier",
        setup(build: esbuild.PluginBuild) {
            build.onLoad({ filter: /\.html$/ }, async (args) => {
                const html = await fs.promises.readFile(args.path, 'utf8');

                if (isDev) {
                    return { contents: html, loader: 'text' };
                }

                try {
                    const { minify } = await getHtmlMinifier();
                    const minified = await minify(html, htmlMinifyOptions);
                    return { contents: minified, loader: 'text' };
                } catch (error) {
                    console.error(`[HTML] Failed to minify ${toRelativePath(args.path)}:`, error);
                    return { contents: html, loader: 'text' };
                }
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

// Plugin to redirect shared library imports to window globals (for module bundles)
function createGlobalShimPlugin(includeAngular: boolean): esbuild.Plugin {
    return {
        name: "global-shim",
        setup(build) {
            // Intercept dayjs imports
            build.onResolve({ filter: /^dayjs(\/.*)?$/ }, (args) => ({
                path: args.path,
                namespace: "dayjs-shim",
            }));

            build.onLoad({ filter: /.*/, namespace: "dayjs-shim" }, (args) => {
                // Handle dayjs plugins (dayjs/plugin/utc, etc.)
                if (args.path.includes("/plugin/")) {
                    return {
                        contents: `export default function() {}; // Plugin already loaded in vendor`,
                        loader: "js",
                    };
                }
                // Main dayjs - return window global
                return {
                    contents: `export default window.dayjs; export const Dayjs = window.dayjs;`,
                    loader: "js",
                };
            });

            // Intercept windows-iana imports
            build.onResolve({ filter: /^windows-iana$/ }, () => ({
                path: "windows-iana",
                namespace: "windows-iana-shim",
            }));

            build.onLoad({ filter: /.*/, namespace: "windows-iana-shim" }, () => ({
                contents: `export const findIana = window.windowsIana.findIana; export const findWindows = window.windowsIana.findWindows;`,
                loader: "js",
            }));

            // For vendor-plugins: Vendor-core already loads Angular core
            if (includeAngular) {
                // Shim Angular core modules to use window.angular
                build.onResolve({ filter: /^angular$/ }, () => ({
                    path: "angular",
                    namespace: "angular-shim",
                }));

                build.onLoad({ filter: /.*/, namespace: "angular-shim" }, () => ({
                    contents: `module.exports = window.angular;`,
                    loader: "js",
                }));

                // Angular submodules just need angular to be present
                const angularModules = [
                    "angular-animate",
                    "angular-aria",
                    "angular-messages",
                    "angular-sanitize",
                    "angular-material",
                ];

                for (const mod of angularModules) {
                    build.onResolve({ filter: new RegExp(`^${mod}$`) }, () => ({
                        path: mod,
                        namespace: "angular-module-shim",
                    }));
                }

                build.onLoad({ filter: /.*/, namespace: "angular-module-shim" }, () => ({
                    contents: `// Already loaded by vendor-core`,
                    loader: "js",
                }));
            }
        },
    };
}

// Plugin to redirect React imports to window globals (for react-module bundles)
function createReactGlobalShimPlugin(): esbuild.Plugin {
    return {
        name: "react-global-shim",
        setup(build) {
            // Shim React to use window.React
            build.onResolve({filter: /^react$/}, () => ({
                path: "react",
                namespace: "react-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-shim"}, () => ({
                contents: `
                    const React = window.React;
                    export default React;
                    // Core hooks
                    export const useState = React.useState;
                    export const useEffect = React.useEffect;
                    export const useCallback = React.useCallback;
                    export const useMemo = React.useMemo;
                    export const useRef = React.useRef;
                    export const useContext = React.useContext;
                    export const useReducer = React.useReducer;
                    export const useLayoutEffect = React.useLayoutEffect;
                    export const useImperativeHandle = React.useImperativeHandle;
                    export const useDebugValue = React.useDebugValue;
                    // React 18 hooks
                    export const useId = React.useId;
                    export const useTransition = React.useTransition;
                    export const useDeferredValue = React.useDeferredValue;
                    export const useSyncExternalStore = React.useSyncExternalStore;
                    export const useInsertionEffect = React.useInsertionEffect;
                    // Core APIs
                    export const createContext = React.createContext;
                    export const createElement = React.createElement;
                    export const Fragment = React.Fragment;
                    export const Children = React.Children;
                    export const cloneElement = React.cloneElement;
                    export const isValidElement = React.isValidElement;
                    export const memo = React.memo;
                    export const forwardRef = React.forwardRef;
                    export const lazy = React.lazy;
                    export const Suspense = React.Suspense;
                    export const StrictMode = React.StrictMode;
                    // Additional APIs
                    export const Component = React.Component;
                    export const PureComponent = React.PureComponent;
                    export const createRef = React.createRef;
                    export const version = React.version;
                    export const startTransition = React.startTransition;
                `,
                loader: "js",
            }));

            // Shim react-dom to use window.ReactDOM
            build.onResolve({filter: /^react-dom$/}, () => ({
                path: "react-dom",
                namespace: "react-dom-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-dom-shim"}, () => ({
                contents: `
                    const ReactDOM = window.ReactDOM;
                    export default ReactDOM;
                    export const createRoot = ReactDOM.createRoot;
                    export const createPortal = ReactDOM.createPortal;
                    export const flushSync = ReactDOM.flushSync;
                `,
                loader: "js",
            }));

            // Shim react-dom/client
            build.onResolve({filter: /^react-dom\/client$/}, () => ({
                path: "react-dom/client",
                namespace: "react-dom-client-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-dom-client-shim"}, () => ({
                contents: `
                    const ReactDOM = window.ReactDOM;
                    export const createRoot = ReactDOM.createRoot;
                    export const hydrateRoot = ReactDOM.hydrateRoot;
                `,
                loader: "js",
            }));

            // Shim react/jsx-runtime - use the actual jsx-runtime from vendor
            build.onResolve({filter: /^react\/jsx-runtime$/}, () => ({
                path: "react/jsx-runtime",
                namespace: "jsx-runtime-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "jsx-runtime-shim"}, () => ({
                contents: `
                    const jsxRuntime = window.ReactJsxRuntime;
                    export const jsx = jsxRuntime.jsx;
                    export const jsxs = jsxRuntime.jsxs;
                    export const Fragment = jsxRuntime.Fragment;
                `,
                loader: "js",
            }));

            // Shim @tanstack/react-query
            build.onResolve({filter: /^@tanstack\/react-query$/}, () => ({
                path: "@tanstack/react-query",
                namespace: "react-query-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-query-shim"}, () => ({
                contents: `
                    export const QueryClient = window.QueryClient;
                    export const QueryClientProvider = window.QueryClientProvider;
                    export const useQuery = window.useQuery;
                    export const useMutation = window.useMutation;
                    export const useQueryClient = window.useQueryClient;
                `,
                loader: "js",
            }));
        },
    };
}

// Base build options (shared between vendor and modules)
const baseBuildOptions: esbuild.BuildOptions = {
    bundle: true,
    format: "iife",
    target: ["es2020"],  // Modern browsers - smaller output than es2015
    mainFields: ["browser", "module", "main"],
    loader: {
        ".js": "js",
        ".ts": "ts",
        ".tsx": "tsx",
        ".jsx": "jsx",
        ".html": "text",
        ".css": "css",
        ".less": "css",
    },
    alias: {
        "@swc/helpers": path.dirname(require.resolve("@swc/helpers/package.json")),
    },
};

// Bundle types for different shim configurations
type BundleType = "vendor-core" | "vendor-plugins" | "vendor-react" | "modules" | "react-modules";

// Build configuration for a specific entry or set of entries
function getBuildConfig(
    forProduction: boolean,
    entries: Record<string, string>,
    bundleType: BundleType
): esbuild.BuildOptions {
    const plugins: esbuild.Plugin[] = [
        lessLoader({ math: "always" }),
        createHtmlMinifierPlugin(),
        createErrorReportingPlugin(),
    ];

    // Apply shims based on the bundle type
    if (bundleType === "vendor-plugins") {
        // vendor-plugins uses Angular from vendor-core
        plugins.unshift(createGlobalShimPlugin(true));
    } else if (bundleType === "modules") {
        // Modules use dayjs/windows-iana from the vendor, no Angular shim needed
        plugins.unshift(createGlobalShimPlugin(false));
    } else if (bundleType === "react-modules") {
        // React modules use React/ReactDOM from vendor-react + dayjs from vendor-core
        plugins.unshift(createGlobalShimPlugin(false));
        plugins.unshift(createReactGlobalShimPlugin());
    }
    // vendor-react and vendor-core don't need shims - they bundle their own dependencies

    const define: Record<string, string> = {
        "process.env.NODE_ENV": forProduction ? '"production"' : '"development"',
        global: "window",
        jQuery: "window.jQuery",
        $: "window.$",
        angular: "window.angular",
    };

    const baseConfig: esbuild.BuildOptions = {
        ...baseBuildOptions,
        entryPoints: entries,
        outdir: distPath,
        external: ["jquery", "jquery-ui"],
        define,
        plugins,
    };

    if (forProduction) {
        return {
            ...baseConfig,
            entryNames: "[name].[hash]",
            assetNames: "[name].[hash]",
            minify: true,
            treeShaking: true,
            metafile: true,
            legalComments: "none",
            logLevel: "error",
            drop: ["console", "debugger"],
            keepNames: false,
            ignoreAnnotations: false,
        };
    }

    return {
        ...baseConfig,
        entryNames: "[name]",
        sourcemap: true,
        legalComments: "inline",
        logLevel: "info",
    };
}

// Manifest generation from esbuild metafile (more reliable than file scanning)
function generateManifestFromMetafile(metafile: esbuild.Metafile): Record<string, string> {
    const manifest: Record<string, string> = {};
    const entryNames = Object.keys(entryPoints) as EntryPointName[];

    for (const outputPath of Object.keys(metafile.outputs)) {
        const fileName = path.basename(outputPath);

        // Match output files to entry points
        for (const entryName of entryNames) {
            // Pattern: entryName.HASH.ext or entryName.ext
            const jsMatch = fileName.match(new RegExp(`^${entryName}\\.([a-zA-Z0-9]+)\\.js$`));
            const cssMatch = fileName.match(new RegExp(`^${entryName}\\.([a-zA-Z0-9]+)\\.css$`));
            const simpleJsMatch = fileName === `${entryName}.js`;
            const simpleCssMatch = fileName === `${entryName}.css`;

            if (jsMatch || simpleJsMatch) {
                manifest[`${entryName}.js`] = fileName;
            }
            if (cssMatch || simpleCssMatch) {
                manifest[`${entryName}.css`] = fileName;
            }
        }
    }

    return manifest;
}

function generateSimpleManifest(): Record<string, string> {
    const manifest: Record<string, string> = {};
    for (const entryName of Object.keys(entryPoints) as EntryPointName[]) {
        manifest[`${entryName}.js`] = `${entryName}.js`;
        // Only include CSS if the file actually exists
        const cssPath = path.join(distPath, `${entryName}.css`);
        if (fs.existsSync(cssPath)) {
            manifest[`${entryName}.css`] = `${entryName}.css`;
        }
    }
    return manifest;
}

// Bundle analyzer - shows what's in each bundle
function analyzeBundle(metafile: esbuild.Metafile): void {
    console.log("\n[ANALYZE] Bundle breakdown:\n");

    const outputs = Object.entries(metafile.outputs)
        .filter(([name]) => name.endsWith('.js'))
        .sort((a, b) => b[1].bytes - a[1].bytes);

    for (const [outputPath, output] of outputs) {
        const fileName = path.basename(outputPath);
        const sizeKb = (output.bytes / 1024).toFixed(0);
        console.log(`\n${fileName} (${sizeKb}K):`);

        if (!output.inputs) continue;

        // Group by package
        const packages: Record<string, number> = {};
        for (const [inputPath, input] of Object.entries(output.inputs)) {
            const match = inputPath.match(/node_modules\/([^/]+)/);
            const pkg = match ? match[1] : inputPath.startsWith('wwwroot') ? '[app code]' : '[other]';
            packages[pkg] = (packages[pkg] || 0) + input.bytesInOutput;
        }

        // Show the top 10 contributors
        const sorted = Object.entries(packages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        for (const [pkg, bytes] of sorted) {
            const kb = (bytes / 1024).toFixed(1);
            const pct = ((bytes / output.bytes) * 100).toFixed(1);
            console.log(`  ${kb}K (${pct}%) - ${pkg}`);
        }
    }
}

// Split entry points into vendor (core + plugins + react) and modules
const vendorEntries = {
    "vendor-core": entryPoints["vendor-core"],
    "vendor-plugins": entryPoints["vendor-plugins"],
    "vendor-react": entryPoints["vendor-react"],
};

// Angular modules (not React-based)
const moduleEntries = Object.fromEntries(
    Object.entries(entryPoints).filter(([name]) =>
        !name.startsWith("vendor") && !name.includes("React")
    )
) as Record<string, string>;

// React modules (use React global shims)
const reactModuleEntries = Object.fromEntries(
    Object.entries(entryPoints).filter(([name]) =>
        name.includes("React") && !name.startsWith("vendor")
    )
) as Record<string, string>;

// Build functions
async function buildDev(): Promise<void> {
    console.log("[DEV] Building development bundles...");

    // Build all bundle types with watch contexts
    const contexts = await Promise.all([
        esbuild.context(getBuildConfig(false, { "vendor-core": vendorEntries["vendor-core"] }, "vendor-core")),
        esbuild.context(getBuildConfig(false, { "vendor-plugins": vendorEntries["vendor-plugins"] }, "vendor-plugins")),
        esbuild.context(getBuildConfig(false, {"vendor-react": vendorEntries["vendor-react"]}, "vendor-react")),
        esbuild.context(getBuildConfig(false, moduleEntries, "modules")),
        ...(Object.keys(reactModuleEntries).length > 0
            ? [await esbuild.context(getBuildConfig(false, reactModuleEntries, "react-modules"))]
            : []),
    ]);

    // Initial builds
    await Promise.all(contexts.map(ctx => ctx.rebuild()));

    // Write manifest
    const manifest = generateSimpleManifest();
    await fs.promises.writeFile(
        path.join(distPath, "manifest.json"),
        JSON.stringify(manifest, null, 2)
    );

    // Start watching
    await Promise.all(contexts.map(ctx => ctx.watch()));

    console.log("[DEV] Build complete. Watching for changes...");
    console.log(`[DEV] Output: ${distPath}`);

    // Keep the process alive
    await new Promise(() => {});
}

async function buildProd(): Promise<void> {
    const startTime = performance.now();
    console.log("[PROD] Building production bundles...");

    // Skip if already built in CI
    const manifestPath = path.join(distPath, "manifest.json");
    if (process.env.CI && fs.existsSync(manifestPath)) {
        console.log("[PROD] Build already exists, skipping...");
        return;
    }

    // Build all bundle types in parallel
    const buildPromises = [
        await esbuild.build(getBuildConfig(true, {"vendor-core": vendorEntries["vendor-core"]}, "vendor-core")),
        await esbuild.build(getBuildConfig(true, {"vendor-plugins": vendorEntries["vendor-plugins"]}, "vendor-plugins")),
        await esbuild.build(getBuildConfig(true, {"vendor-react": vendorEntries["vendor-react"]}, "vendor-react")),
        await esbuild.build(getBuildConfig(true, moduleEntries, "modules")),
    ];

    // Add React modules build if there are any
    if (Object.keys(reactModuleEntries).length > 0) {
        buildPromises.push(
           await esbuild.build(getBuildConfig(true, reactModuleEntries, "react-modules"))
        );
    }

    const results = await Promise.all(buildPromises);

    // Verify all metafiles exist
    for (const result of results) {
        if (!result.metafile) {
            throw new Error("Metafile not generated");
        }
    }

    // Merge metafiles for analysis and manifest
    const mergedMetafile: esbuild.Metafile = {
        inputs: Object.assign({}, ...results.map(r => r.metafile!.inputs)),
        outputs: Object.assign({}, ...results.map(r => r.metafile!.outputs)),
    };

    // Show bundle analysis if requested
    if (isAnalyze) {
        analyzeBundle(mergedMetafile);
    }

    // Generate manifest from merged metafile
    const manifest = generateManifestFromMetafile(mergedMetafile);
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const buildTime = ((performance.now() - startTime) / 1000).toFixed(2);
    const fileCount = Object.keys(manifest).length;
    console.log(`[PROD] Build completed in ${buildTime}s (${fileCount} entries)`);
}

// Main entry point
async function build(): Promise<void> {
    try {
        cleanDistFolder();
        await (isDev ? buildDev() : buildProd());
    } catch (error) {
        console.error("[ERROR] Build failed:", error);
        process.exit(1);
    }
}

build().then(_ => console.log("Build completed successfully..."));