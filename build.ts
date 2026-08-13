import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import {promisify} from "util";
import {lessLoader} from "esbuild-plugin-less";

// Every valid-identifier named export of the installed React, used to generate
// the `react` → window.React shim (see createReactGlobalShimPlugin) so the shim
// tracks whatever React version ships rather than a hand-maintained list.
const reactNamedExports: string[] = Object.keys(require("react")).filter(
    (k) => k !== "default" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)
);

// Mantine barrels shimmed onto the vendor-react window globals. Export lists are
// read off the installed packages so they never drift from the shipped version.
const mantineBarrels: Record<string, {global: string; exports: string[]}> = Object.fromEntries(
    (
        [
            ["@mantine/core", "MantineCore"],
            ["@mantine/hooks", "MantineHooks"],
            ["@mantine/dates", "MantineDates"],
            ["@mantine/notifications", "MantineNotifications"],
        ] as const
    ).map(([specifier, global]) => [
        specifier,
        {
            global,
            exports: Object.keys(require(specifier)).filter(
                (k) => k !== "default" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)
            ),
        },
    ])
);

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
    | 'accessorialChargesDialogReact'
    | 'bulkPriceUploadDialogReact'
    | 'messagingDialogReact'
    | 'sendPodDialogReact'
    | 'aiAssistantDialogReact'
    | 'createJobDialogReact'
    | 'swapPodsDialogReact'
    | 'restoreConfirmDialogReact'
    | 'selectDialogReact'
    | 'editParcelDimensionsDialogReact'
    | 'simplePriceEditDialogReact'
    | 'jobFileUploadDialogReact'
    | 'overviewReact'
    | 'jobListReact'
    | 'currentWorkJobListReact'
    | 'nationwideJobListReact'
    | 'jobSearchJobListReact'
    | 'jobDetailsReact'
    | 'jobSearchReact'
    | 'dispatchReact';
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
    accessorialChargesDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/accessorial-charges-dialog/accessorial-charges-dialog-react.module.tsx"),
    bulkPriceUploadDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/bulk-price-upload-dialog/bulk-price-upload-dialog-react.module.tsx"),
    messagingDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/messaging-dialog/messaging-dialog-react.module.tsx"),
    sendPodDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/send-pod-dialog/send-pod-dialog-react.module.tsx"),
    aiAssistantDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/ai-assistant-dialog/ai-assistant-dialog-react.module.tsx"),
    createJobDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/create-job-dialog/create-job-dialog-react.module.tsx"),
    swapPodsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module.tsx"),
    restoreConfirmDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/restore-confirmation-dialog/restore-confirmation-dialog-react.module.tsx"),
    selectDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/select-dialog/select-dialog-react.module.tsx"),
    editParcelDimensionsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog-react.module.tsx"),
    simplePriceEditDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/simple-price-edit-dialog/simple-price-edit-dialog-react.module.tsx"),
    jobFileUploadDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/job-file-upload-dialog/job-file-upload-dialog-react.module.tsx"),
    overviewReact: path.join(rootDir, "wwwroot/app/react/pages/overview/overview-react.module.tsx"),
    jobListReact: path.join(rootDir, "wwwroot/app/react/components/job-list/job-list-react.module.tsx"),
    currentWorkJobListReact: path.join(rootDir, "wwwroot/app/react/components/job-list/current-work-job-list-react.module.tsx"),
    nationwideJobListReact: path.join(rootDir, "wwwroot/app/react/components/job-list/nationwide-job-list-react.module.tsx"),
    jobSearchJobListReact: path.join(rootDir, "wwwroot/app/react/components/job-list/job-search-job-list-react.module.tsx"),
    jobDetailsReact: path.join(rootDir, "wwwroot/app/react/components/common/job-details/job-details-react.module.tsx"),
    jobSearchReact: path.join(rootDir, "wwwroot/app/react/pages/job-search/job-search-react.module.tsx"),
    dispatchReact: path.join(rootDir, "wwwroot/app/react/pages/dispatch/dispatch-react.module.tsx"),
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
                contents: ["findIana", "findWindows"]
                    .map(k => pureExport(k, `window.windowsIana.${k}`)).join("\n"),
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

/**
 * Emits a tree-shakable `export const <name> = <expr>`.
 *
 * A bare `export const Button = M.Button` is NOT droppable: esbuild has to
 * assume the property read might invoke a getter, so it keeps every generated
 * export even when the island imports two of them. Wrapping the read in a
 * `/* @__PURE__ *\/` call makes it provably side-effect free, so unused exports
 * vanish — and the minifier inlines the IIFE, leaving `var t = window.X, o =
 * t.Button` for the ones that are used. Without this, each island importing the
 * `@mantine/core` barrel carried all ~440 assignments (~6 KB).
 */
function pureExport(name: string, expr: string): string {
    return `export const ${name} = /* @__PURE__ */ (() => ${expr})();`;
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

            // Re-export EVERY named export of the installed React off window.React,
            // generated from React's own export list. This avoids hand-maintaining
            // the set (React 19 added `use`, `useEffectEvent`, `Activity`, … and
            // Mantine imports them) — the shim now tracks whatever React ships.
            build.onLoad({filter: /.*/, namespace: "react-shim"}, () => ({
                contents: `const React = window.React;\nexport default React;\n`
                    + reactNamedExports.map(k => pureExport(k, `React.${k}`)).join('\n'),
                loader: "js",
            }));

            // Shim react-dom to use window.ReactDOM
            build.onResolve({filter: /^react-dom$/}, () => ({
                path: "react-dom",
                namespace: "react-dom-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-dom-shim"}, () => ({
                contents: `const ReactDOM = window.ReactDOM;\nexport default ReactDOM;\n`
                    + ["createRoot", "createPortal", "flushSync"]
                        .map(k => pureExport(k, `ReactDOM.${k}`)).join("\n"),
                loader: "js",
            }));

            // Shim react-dom/client
            build.onResolve({filter: /^react-dom\/client$/}, () => ({
                path: "react-dom/client",
                namespace: "react-dom-client-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-dom-client-shim"}, () => ({
                contents: `const ReactDOM = window.ReactDOM;\n`
                    + ["createRoot", "hydrateRoot"].map(k => pureExport(k, `ReactDOM.${k}`)).join("\n"),
                loader: "js",
            }));

            // Shim react/jsx-runtime - use the actual jsx-runtime from vendor
            build.onResolve({filter: /^react\/jsx-runtime$/}, () => ({
                path: "react/jsx-runtime",
                namespace: "jsx-runtime-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "jsx-runtime-shim"}, () => ({
                contents: `const jsxRuntime = window.ReactJsxRuntime;\n`
                    + ["jsx", "jsxs", "Fragment"].map(k => pureExport(k, `jsxRuntime.${k}`)).join("\n"),
                loader: "js",
            }));

            // Shim @tanstack/react-query
            build.onResolve({filter: /^@tanstack\/react-query$/}, () => ({
                path: "@tanstack/react-query",
                namespace: "react-query-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-query-shim"}, () => ({
                contents: [
                    "QueryClient", "QueryClientProvider", "keepPreviousData", "useQuery",
                    "useInfiniteQuery", "useMutation", "useQueryClient",
                ].map(k => pureExport(k, `window.${k}`)).join("\n"),
                loader: "js",
            }));

            // ── Mantine: redirect the barrels to the vendor-react globals for the
            // same reason as MUI below — otherwise every migrated island embeds its
            // own copy of Mantine core. Export lists are generated from the
            // installed packages (see mantineBarrels), so they track whatever
            // version ships rather than a hand-maintained list.
            for (const [specifier, {global, exports}] of Object.entries(mantineBarrels)) {
                const namespace = `mantine-shim:${specifier}`;
                build.onResolve({filter: new RegExp(`^${specifier.replace("/", "\\/")}$`)}, () => ({
                    path: specifier,
                    namespace,
                }));
                build.onLoad({filter: /.*/, namespace}, () => ({
                    contents: `const M = window.${global};\n`
                        + exports.map(k => pureExport(k, `M.${k}`)).join("\n"),
                    loader: "js",
                }));
            }

            // ── MUI: redirect to the vendor-react globals so module bundles don't
            // each embed their own copy of MUI + Emotion. vendor-react exposes
            // window.MUI (@mui/material barrel), window.MUIStyles
            // (@mui/material/styles) and window.MUIXDatePickers.

            // @mui/material/styles — named utilities (register before the general
            // component handler so it wins the resolve for this exact specifier).
            build.onResolve({filter: /^@mui\/material\/styles$/}, () => ({
                path: "@mui/material/styles",
                namespace: "mui-styles-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "mui-styles-shim"}, () => ({
                contents: `const S = window.MUIStyles;\n` + [
                    "alpha", "useTheme", "createTheme", "ThemeProvider", "styled", "useThemeProps",
                    "responsiveFontSizes", "StyledEngineProvider", "useColorScheme", "emphasize",
                    "darken", "lighten", "hexToRgb", "rgbToHex", "decomposeColor", "recomposeColor",
                    "css", "keyframes",
                ].map(k => pureExport(k, `S.${k}`)).join("\n"),
                loader: "js",
            }));

            // @mui/material/<Component> — every such import in the app is a default
            // import, exposed on the barrel by its (Pascal-cased) last segment.
            build.onResolve({filter: /^@mui\/material\/[^/]+$/}, (args) => {
                if (args.path === "@mui/material/styles") return null;
                return {path: args.path, namespace: "mui-component-shim"};
            });

            build.onLoad({filter: /.*/, namespace: "mui-component-shim"}, (args) => {
                const name = args.path.slice("@mui/material/".length);
                // SvgIcon also exposes named exports (createSvgIcon, svgIconClasses)
                // that @mui/icons-material depends on and the barrel doesn't carry.
                if (name === "SvgIcon") {
                    return {
                        contents: `const S = window.MUISvgIcon;\nexport default S.default;\n`
                            + ["createSvgIcon", "svgIconClasses"]
                                .map(k => pureExport(k, `S.${k}`)).join("\n"),
                        loader: "js",
                    };
                }
                return {contents: `export default window.MUI.${name};`, loader: "js"};
            });

            // @mui/x-date-pickers/<Export> — named import matching the last segment
            // (LocalizationProvider, AdapterDayjs, DatePicker, DateCalendar, ...).
            build.onResolve({filter: /^@mui\/x-date-pickers\/[^/]+$/}, (args) => ({
                path: args.path,
                namespace: "muix-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "muix-shim"}, (args) => {
                const name = args.path.slice("@mui/x-date-pickers/".length);
                return {
                    contents: pureExport(name, `window.MUIXDatePickers.${name}`),
                    loader: "js",
                };
            });
        },
    };
}

// Base build options (shared between vendor and modules)
const baseBuildOptions: esbuild.BuildOptions = {
    bundle: true,
    format: "iife",
    target: ["es2020"],
    // Emit real UTF-8 rather than escaping every non-ASCII character to \uXXXX.
    // The UI strings use ·, →, — and friends; the served files declare UTF-8.
    charset: "utf8",
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
type BundleType = "vendor-core" | "vendor-plugins" | "vendor-react" | "app-modules";

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
    } else if (bundleType === "app-modules") {
        // Every non-vendor entry — the Angular route modules and the React islands
        // alike — takes dayjs/windows-iana plus React/Mantine/MUI from the vendor
        // bundles. The Angular modules need the React shim too because app.ts and
        // the route modules pull in island entries; without it each of
        // app/home/jobSearch/nationwide embeds its own copy of all three.
        // _Layout.cshtml loads vendor-react.js ahead of app.js so the globals exist
        // by the time any of these bundles evaluate.
        plugins.unshift(createGlobalShimPlugin(false));
        plugins.unshift(createReactGlobalShimPlugin());
    } else if (bundleType === "vendor-react") {
        // vendor-react bundles MUI (incl. x-date-pickers' AdapterDayjs); redirect
        // dayjs to the single window.dayjs configured in vendor-core so the date
        // pickers share the app's dayjs plugins/timezone setup rather than a
        // second, unconfigured dayjs instance.
        plugins.unshift(createGlobalShimPlugin(false));
    }
    // vendor-core doesn't need shims - it bundles its own dependencies

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
            metafile: true,
            legalComments: "none",
            logLevel: "warning",
            // No production sourcemaps: they added ~14 MB to the published image for a
            // symbolication path nothing currently consumes. Dev builds still emit them.
            // The islands narrate their mount/unmount lifecycle through console.log,
            // which is what the old drop:["console"] was really targeting. `pure`
            // strips exactly those while leaving console.error/warn intact — dropping
            // the whole console object made production failures silent.
            drop: ["debugger"],
            pure: ["console.log", "console.debug", "console.info", "console.trace"],
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

// Size budgets, in bytes, for the production JS outputs worth guarding. Seeded from a
// known-good build with ~10% headroom. These exist to catch the class of regression
// where a bundle silently stops using a vendor shim and re-embeds React/Mantine/MUI —
// historically worth megabytes, and invisible until someone looks at the dist folder.
// Raise a number deliberately when a bundle legitimately grows; don't raise it to make
// a build go green.
const TOTAL_JS_BUDGET = 10_500_000;
const bundleBudgets: Partial<Record<EntryPointName, number>> = {
    "vendor-react": 1_930_000,
    "vendor-core": 1_000_000,
    app: 580_000,
    home: 465_000,
    dispatchReact: 445_000,
    jobSearchReact: 430_000,
    nationwide: 425_000,
    recurringJobsReact: 415_000,
    jobSearch: 410_000,
    taskDashboardReact: 395_000,
    jobDetailsReact: 350_000,
    jobSearchJobListReact: 270_000,
    nationwideJobListReact: 270_000,
    currentWorkJobListReact: 270_000,
    jobListReact: 270_000,
};

// Fails the build when an output exceeds its budget, so a size regression surfaces here
// rather than in production.
function checkBudgets(metafile: esbuild.Metafile): void {
    const jsOutputs = Object.entries(metafile.outputs).filter(
        ([name]) => name.endsWith(".js")
    );

    const breaches: string[] = [];

    for (const [outputPath, output] of jsOutputs) {
        const fileName = path.basename(outputPath);
        for (const [entryName, budget] of Object.entries(bundleBudgets)) {
            if (!fileName.match(new RegExp(`^${entryName}\\.[a-zA-Z0-9]+\\.js$`))) continue;
            if (output.bytes > budget) {
                const over = (((output.bytes - budget) / budget) * 100).toFixed(1);
                breaches.push(
                    `  ${entryName}: ${output.bytes} bytes exceeds budget ${budget} (+${over}%)`
                );
            }
        }
    }

    const totalJs = jsOutputs.reduce((sum, [, output]) => sum + output.bytes, 0);
    if (totalJs > TOTAL_JS_BUDGET) {
        const over = (((totalJs - TOTAL_JS_BUDGET) / TOTAL_JS_BUDGET) * 100).toFixed(1);
        breaches.push(
            `  [total JS]: ${totalJs} bytes exceeds budget ${TOTAL_JS_BUDGET} (+${over}%)`
        );
    }

    if (breaches.length > 0) {
        console.error("\n[ERROR] Bundle size budget exceeded:");
        breaches.forEach((b) => console.error(b));
        console.error(
            "\nRun `npm run build -- --analyze` to see what grew, or adjust the budget in build.ts if the growth is intended.\n"
        );
        process.exit(1);
    }
}

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

/**
 * Pre-compresses the production bundles to .br and .gz siblings.
 *
 * Doing this at build time rather than through ASP.NET's response-compression
 * middleware is a straight win here: dist filenames are content-hashed and therefore
 * immutable, so the expensive maximum-quality pass happens once per build instead of
 * once per request, and the runtime spends no CPU on it at all. Program.cs serves these
 * when the client advertises the matching Accept-Encoding.
 */
async function compressDist(): Promise<void> {
    const targets = fs
        .readdirSync(distPath)
        .filter((f) => f.endsWith(".js") || f.endsWith(".css"));

    let rawTotal = 0;
    let brTotal = 0;

    await Promise.all(
        targets.map(async (fileName) => {
            const filePath = path.join(distPath, fileName);
            const raw = await fs.promises.readFile(filePath);

            const [br, gz] = await Promise.all([
                brotliCompress(raw, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
                        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
                    },
                }),
                gzipCompress(raw, {level: zlib.constants.Z_BEST_COMPRESSION}),
            ]);

            rawTotal += raw.length;
            brTotal += br.length;

            // A compressed copy that isn't smaller would only cost a round trip.
            if (br.length < raw.length) {
                await fs.promises.writeFile(`${filePath}.br`, br);
            }
            if (gz.length < raw.length) {
                await fs.promises.writeFile(`${filePath}.gz`, gz);
            }
        })
    );

    const pct = ((1 - brTotal / rawTotal) * 100).toFixed(1);
    console.log(
        `[PROD] Pre-compressed ${targets.length} files: `
        + `${(rawTotal / 1024 / 1024).toFixed(2)} MB -> ${(brTotal / 1024 / 1024).toFixed(2)} MB brotli (-${pct}%)`
    );
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

// Everything that isn't a vendor bundle: the Angular route modules and the React
// islands. These used to be two separate esbuild invocations, but their configs are
// identical (same shims, same options), so building them together lets esbuild parse
// the shared module graph — the React shims, the icon packages, the common
// components — once instead of twice. Output is byte-for-byte the same: iife entries
// don't share code, and the content hashes are unchanged by the grouping.
const appModuleEntries = Object.fromEntries(
    Object.entries(entryPoints).filter(([name]) => !name.startsWith("vendor"))
) as Record<string, string>;

// Build functions
async function buildDev(): Promise<void> {
    console.log("[DEV] Building development bundles...");

    // Build all bundle types with watch contexts
    const contexts = await Promise.all([
        esbuild.context(getBuildConfig(false, { "vendor-core": vendorEntries["vendor-core"] }, "vendor-core")),
        esbuild.context(getBuildConfig(false, { "vendor-plugins": vendorEntries["vendor-plugins"] }, "vendor-plugins")),
        esbuild.context(getBuildConfig(false, {"vendor-react": vendorEntries["vendor-react"]}, "vendor-react")),
        esbuild.context(getBuildConfig(false, appModuleEntries, "app-modules")),
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
    const results = await Promise.all([
        esbuild.build(getBuildConfig(true, {"vendor-core": vendorEntries["vendor-core"]}, "vendor-core")),
        esbuild.build(getBuildConfig(true, {"vendor-plugins": vendorEntries["vendor-plugins"]}, "vendor-plugins")),
        esbuild.build(getBuildConfig(true, {"vendor-react": vendorEntries["vendor-react"]}, "vendor-react")),
        esbuild.build(getBuildConfig(true, appModuleEntries, "app-modules")),
    ]);

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

    // Persist the metafile so a bundle can be analysed (or diffed against a previous
    // build) without having to re-run with --analyze.
    await fs.promises.writeFile(
        path.join(distPath, "meta.json"),
        JSON.stringify(mergedMetafile)
    );

    // Show bundle analysis if requested
    if (isAnalyze) {
        analyzeBundle(mergedMetafile);
    }

    checkBudgets(mergedMetafile);

    await compressDist();

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