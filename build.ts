import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {lessLoader} from "esbuild-plugin-less";
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import {es5Plugin} from "esbuild-plugin-es5";

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const rootDir = __dirname;
const distPath = path.join(rootDir, "wwwroot/dist");

function generateHash(content: string | Uint8Array): string {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

async function cleanDistFolder(): Promise<void> {
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        for (const file of files) {
            fs.unlinkSync(path.join(distPath, file));
        }
    } else {
        fs.mkdirSync(distPath, {recursive: true});
    }
}

function toRelativePath(filePath: string): string {
    return path.relative(rootDir, filePath);
}

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
        });
    }
};

async function build(): Promise<void> {
    const startTime = Date.now();

    try {
        await cleanDistFolder();

        const commonConfig: esbuild.BuildOptions = {
            entryPoints: [path.join(rootDir, "wwwroot/app/index.ts")],
            bundle: true,
            sourcemap: isDev,
            minify: !isDev,
            minifyWhitespace: !isDev,
            minifyIdentifiers: !isDev,
            minifySyntax: !isDev,
            target: ["es5"],
            metafile: !isDev,
            treeShaking: !isDev,
            legalComments: isDev ? "inline" : "none",
            format: "iife",
            mainFields: ["browser", "module", "main"],
            logLevel: 'info',
            drop: isDev ? [] : ['debugger', 'console'],
            plugins: [
                esbuildPluginTsc(),
                es5Plugin(),
                lessLoader({
                    math: 'always'
                }),
                errorReportingPlugin
            ],
            define: {
                'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
                'global': "window",
                'angular': "window.angular",
                '$': "window.jQuery",
                'moment': "window.moment"
            },
            external: [
                "angular-material-data-table",
                "leaflet",
                "angularResizable",
                "ui.sortable",
                "ui.bootstrap",
                "ui.timepicker",
                "pickadate",
                "ngMapAutocomplete",
                "heremaps",
                "angularPromiseButtons",
            ],
            loader: {
                '.js': "js",
                '.html': "text",
                '.css': 'css',
                '.less': 'css'
            },
            alias: {
                '@swc/helpers': path.dirname(require.resolve("@swc/helpers/package.json")),
            }
        };

        if (isDev) {
            const devConfig: esbuild.BuildOptions = {
                ...commonConfig,
                outfile: path.join(distPath, 'bundle.js')
            };

            const ctx = await esbuild.context(devConfig);

            await ctx.watch();
            console.log("[DEV] Watching for changes...");

            const {host, port} = await ctx.serve({
                servedir: path.join(rootDir, "wwwroot"),
                host: 'localhost',
                port: 3000
            });

            const manifest = {
                'bundle.js': 'bundle.js',
                'styles.css': 'bundle.css'
            };

            fs.writeFileSync(
                path.join(distPath, "manifest.json"),
                JSON.stringify(manifest, null, 2)
            );

            console.log(`[DEV] Server running at http://${host}:${port}`);
            await new Promise(() => {
            });
        } else {
            console.log("[PROD] Building production bundle...");

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

            await esbuild.build({
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
            console.log(`[PROD] Build completed in ${buildTime}s`);
            console.log(`[PROD] Output: ${jsFilename}, ${cssFilename}`);
        }
    } catch (error) {
        console.error("[ERROR] Build failed:", error);
        process.exit(1);
    }
}

// Execute the build
build()
    .then(_ => console.log("Build completed"));
