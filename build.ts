import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import {promisify} from "util";
import {lessLoader} from "esbuild-plugin-less";

const reactNamedExports: string[] = Object.keys(require("react")).filter(
    (k) => k !== "default" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)
);

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

type EntryPointName =
    'vendor-core'
    | 'vendor-plugins'
    | 'vendor-react'
    | 'app'
    | 'nationwide'
    | 'taskDashboardReact'
    | 'driverManagementReact'
    | 'settingsReact'
    | 'composeEmailDialogReact'
    | 'courierMapReact'
    | 'dateRangeDialogReact'
    | 'priceBreakdownDialogReact'
    | 'splitPricingBreakdownDialogReact'
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
    | 'jobDetailsReact'
    | 'jobSearchReact'
    | 'nationwideReact'
    | 'dispatchReact'
    | 'dispatchDialogReact';
type EntryPoints = Record<EntryPointName, string>;

const isDev = process.argv.includes("--dev");
const isAnalyze = process.argv.includes("--analyze");
const rootDir = __dirname;
const distPath = path.join(rootDir, "wwwroot/dist");

const entryPoints: EntryPoints = {
    "vendor-core": path.join(rootDir, "wwwroot/app/index.ts"),
    "vendor-plugins": path.join(rootDir, "wwwroot/app/vendor-plugins.ts"),
    "vendor-react": path.join(rootDir, "wwwroot/app/vendor-react.ts"),
    app: path.join(rootDir, "wwwroot/app/app.ts"),
    nationwide: path.join(rootDir, "wwwroot/app/components/Nationwide/nationwide.module.ts"),
    taskDashboardReact: path.join(rootDir, "wwwroot/app/react/pages/task-dashboard/task-dashboard-react.module.tsx"),
    driverManagementReact: path.join(rootDir, "wwwroot/app/react/pages/driver-management/driver-management-react.module.tsx"),
    settingsReact: path.join(rootDir, "wwwroot/app/react/pages/settings/settings-react.module.tsx"),
    composeEmailDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/compose-email-dialog/compose-email-dialog-react.module.tsx"),
    courierMapReact: path.join(rootDir, "wwwroot/app/react/pages/courier-map/courier-map-react.module.tsx"),
    dateRangeDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/date-range-dialog/date-range-dialog-react.module.tsx"),
    priceBreakdownDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/price-breakdown-dialog/price-breakdown-dialog-react.module.tsx"),
    splitPricingBreakdownDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/split-pricing-breakdown-dialog/split-pricing-breakdown-dialog-react.module.tsx"),
    dashboardSettingsDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module.tsx"),
    autoCompleteDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/auto-complete-dialog/auto-complete-dialog-react.module.tsx"),
    voidJobConfirmationDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog-react.module.tsx"),
    editAfterhoursDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-afterhours-dialog/edit-afterhours-dialog-react.module.tsx"),
    editAddressDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-address-dialog/edit-address-dialog-react.module.tsx"),
    editDateTimeDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/edit-date-time-dialog/edit-date-time-dialog-react.module.tsx"),
    flightAgentConfirmationDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/flight-agent-confirmation-dialog/flight-agent-confirmation-dialog-react.module.tsx"),
    dispatchDialogReact: path.join(rootDir, "wwwroot/app/react/components/dialogs/dispatch-dialog/dispatch-dialog-react.module.tsx"),
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
    jobDetailsReact: path.join(rootDir, "wwwroot/app/react/components/common/job-details/job-details-react.module.tsx"),
    jobSearchReact: path.join(rootDir, "wwwroot/app/react/pages/job-search/job-search-react.module.tsx"),
    nationwideReact: path.join(rootDir, "wwwroot/app/react/pages/nationwide/nationwide-react.module.tsx"),
    dispatchReact: path.join(rootDir, "wwwroot/app/react/pages/dispatch/dispatch-react.module.tsx"),
};

let htmlMinifier: typeof import('html-minifier-terser') | null = null;
async function getHtmlMinifier() {
    if (!htmlMinifier) {
        htmlMinifier = await import('html-minifier-terser');
    }
    return htmlMinifier;
}

function toRelativePath(filePath: string): string {
    return path.relative(rootDir, filePath);
}

function cleanDistFolder(): void {
    fs.rmSync(distPath, { recursive: true, force: true });
    fs.mkdirSync(distPath, { recursive: true });
}

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

function createGlobalShimPlugin(includeAngular: boolean): esbuild.Plugin {
    return {
        name: "global-shim",
        setup(build) {
            build.onResolve({ filter: /^dayjs(\/.*)?$/ }, (args) => ({
                path: args.path,
                namespace: "dayjs-shim",
            }));

            build.onLoad({ filter: /.*/, namespace: "dayjs-shim" }, (args) => {
                if (args.path.includes("/plugin/")) {
                    return {
                        contents: `export default function() {}; // Plugin already loaded in vendor`,
                        loader: "js",
                    };
                }
                return {
                    contents: `export default window.dayjs; export const Dayjs = window.dayjs;`,
                    loader: "js",
                };
            });

            build.onResolve({ filter: /^windows-iana$/ }, () => ({
                path: "windows-iana",
                namespace: "windows-iana-shim",
            }));

            build.onLoad({ filter: /.*/, namespace: "windows-iana-shim" }, () => ({
                contents: ["findIana", "findWindows"]
                    .map(k => pureExport(k, `window.windowsIana.${k}`)).join("\n"),
                loader: "js",
            }));

            if (includeAngular) {
                build.onResolve({ filter: /^angular$/ }, () => ({
                    path: "angular",
                    namespace: "angular-shim",
                }));

                build.onLoad({ filter: /.*/, namespace: "angular-shim" }, () => ({
                    contents: `module.exports = window.angular;`,
                    loader: "js",
                }));

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

function pureExport(name: string, expr: string): string {
    return `export const ${name} = /* @__PURE__ */ (() => ${expr})();`;
}

function createReactGlobalShimPlugin(): esbuild.Plugin {
    return {
        name: "react-global-shim",
        setup(build) {
            build.onResolve({filter: /^react$/}, () => ({
                path: "react",
                namespace: "react-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-shim"}, () => ({
                contents: `const React = window.React;\nexport default React;\n`
                    + reactNamedExports.map(k => pureExport(k, `React.${k}`)).join('\n'),
                loader: "js",
            }));

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

            build.onResolve({filter: /^react-dom\/client$/}, () => ({
                path: "react-dom/client",
                namespace: "react-dom-client-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "react-dom-client-shim"}, () => ({
                contents: `const ReactDOM = window.ReactDOM;\n`
                    + ["createRoot", "hydrateRoot"].map(k => pureExport(k, `ReactDOM.${k}`)).join("\n"),
                loader: "js",
            }));

            build.onResolve({filter: /^react\/jsx-runtime$/}, () => ({
                path: "react/jsx-runtime",
                namespace: "jsx-runtime-shim",
            }));

            build.onLoad({filter: /.*/, namespace: "jsx-runtime-shim"}, () => ({
                contents: `const jsxRuntime = window.ReactJsxRuntime;\n`
                    + ["jsx", "jsxs", "Fragment"].map(k => pureExport(k, `jsxRuntime.${k}`)).join("\n"),
                loader: "js",
            }));

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

        },
    };
}

const baseBuildOptions: esbuild.BuildOptions = {
    bundle: true,
    format: "iife",
    target: ["es2020"],
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

type BundleType = "vendor-core" | "vendor-plugins" | "vendor-react" | "app-modules";

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

    if (bundleType === "vendor-plugins") {
        plugins.unshift(createGlobalShimPlugin(true));
    } else if (bundleType === "app-modules") {
        plugins.unshift(createGlobalShimPlugin(false));
        plugins.unshift(createReactGlobalShimPlugin());
    } else if (bundleType === "vendor-react") {
        plugins.unshift(createGlobalShimPlugin(false));
    }

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

function generateManifestFromMetafile(metafile: esbuild.Metafile): Record<string, string> {
    const manifest: Record<string, string> = {};
    const entryNames = Object.keys(entryPoints) as EntryPointName[];

    for (const outputPath of Object.keys(metafile.outputs)) {
        const fileName = path.basename(outputPath);

        for (const entryName of entryNames) {
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
        const cssPath = path.join(distPath, `${entryName}.css`);
        if (fs.existsSync(cssPath)) {
            manifest[`${entryName}.css`] = `${entryName}.css`;
        }
    }
    return manifest;
}

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

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

        const packages: Record<string, number> = {};
        for (const [inputPath, input] of Object.entries(output.inputs)) {
            const match = inputPath.match(/node_modules\/([^/]+)/);
            const pkg = match ? match[1] : inputPath.startsWith('wwwroot') ? '[app code]' : '[other]';
            packages[pkg] = (packages[pkg] || 0) + input.bytesInOutput;
        }

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

const vendorEntries = {
    "vendor-core": entryPoints["vendor-core"],
    "vendor-plugins": entryPoints["vendor-plugins"],
    "vendor-react": entryPoints["vendor-react"],
};

const appModuleEntries = Object.fromEntries(
    Object.entries(entryPoints).filter(([name]) => !name.startsWith("vendor"))
) as Record<string, string>;

async function buildDev(): Promise<void> {
    console.log("[DEV] Building development bundles...");

    const contexts = await Promise.all([
        esbuild.context(getBuildConfig(false, { "vendor-core": vendorEntries["vendor-core"] }, "vendor-core")),
        esbuild.context(getBuildConfig(false, { "vendor-plugins": vendorEntries["vendor-plugins"] }, "vendor-plugins")),
        esbuild.context(getBuildConfig(false, {"vendor-react": vendorEntries["vendor-react"]}, "vendor-react")),
        esbuild.context(getBuildConfig(false, appModuleEntries, "app-modules")),
    ]);

    await Promise.all(contexts.map(ctx => ctx.rebuild()));

    const manifest = generateSimpleManifest();
    await fs.promises.writeFile(
        path.join(distPath, "manifest.json"),
        JSON.stringify(manifest, null, 2)
    );

    await Promise.all(contexts.map(ctx => ctx.watch()));

    console.log("[DEV] Build complete. Watching for changes...");
    console.log(`[DEV] Output: ${distPath}`);

    await new Promise(() => {});
}

async function buildProd(): Promise<void> {
    const startTime = performance.now();
    console.log("[PROD] Building production bundles...");

    const manifestPath = path.join(distPath, "manifest.json");
    if (process.env.CI && fs.existsSync(manifestPath)) {
        console.log("[PROD] Build already exists, skipping...");
        return;
    }

    const results = await Promise.all([
        esbuild.build(getBuildConfig(true, {"vendor-core": vendorEntries["vendor-core"]}, "vendor-core")),
        esbuild.build(getBuildConfig(true, {"vendor-plugins": vendorEntries["vendor-plugins"]}, "vendor-plugins")),
        esbuild.build(getBuildConfig(true, {"vendor-react": vendorEntries["vendor-react"]}, "vendor-react")),
        esbuild.build(getBuildConfig(true, appModuleEntries, "app-modules")),
    ]);

    for (const result of results) {
        if (!result.metafile) {
            throw new Error("Metafile not generated");
        }
    }

    const mergedMetafile: esbuild.Metafile = {
        inputs: Object.assign({}, ...results.map(r => r.metafile!.inputs)),
        outputs: Object.assign({}, ...results.map(r => r.metafile!.outputs)),
    };

    await fs.promises.writeFile(
        path.join(distPath, "meta.json"),
        JSON.stringify(mergedMetafile)
    );

    if (isAnalyze) {
        analyzeBundle(mergedMetafile);
    }
    
    await compressDist();

    const manifest = generateManifestFromMetafile(mergedMetafile);
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const buildTime = ((performance.now() - startTime) / 1000).toFixed(2);
    const fileCount = Object.keys(manifest).length;
    console.log(`[PROD] Build completed in ${buildTime}s (${fileCount} entries)`);
}

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