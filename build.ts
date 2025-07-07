import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {lessLoader} from "esbuild-plugin-less";
import {esbuildPluginVersionInjector} from "esbuild-plugin-version-injector";

class Bundler {
    private readonly isDev: boolean;
    private readonly rootDir: string;
    private readonly distPath: string;

    constructor() {
        this.isDev =
            process.argv.includes("--dev") || process.env.NODE_ENV === "development";
        this.rootDir = __dirname;
        this.distPath = path.join(this.rootDir, "wwwroot/dist");
    }

    private async cleanDistFolder(): Promise<void> {
        if (fs.existsSync(this.distPath)) {
            const files = fs.readdirSync(this.distPath);
            for (const file of files) {
                fs.unlinkSync(path.join(this.distPath, file));
            }
        } else {
            fs.mkdirSync(this.distPath, {recursive: true});
        }
    }

    private toRelativePath(filePath: string): string {
        return path.relative(this.rootDir, filePath);
    }

    private generateFileHash(entryName: string): string {
        const entryPoints = this.getCommonConfig().entryPoints! as Record<string, string>;
        const entryPath = entryPoints[entryName];

        if (!entryPath || !fs.existsSync(entryPath)) {
            return 'fallback';
        }

        const sourceBuffer = fs.readFileSync(entryPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(sourceBuffer);
        return hashSum.digest('hex').substring(0, 8);
    }

    private get htmlMinifierPlugin(): esbuild.Plugin {
        const isDev = this.isDev;

        return {
            name: "html-minifier",
            setup(build: esbuild.PluginBuild) {
                build.onLoad({ filter: /\.html$/ }, async (args) => {
                    const html = await fs.promises.readFile(args.path, 'utf8');

                    let minified = html;
                    if (!isDev) {
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
                                preventAttributesEscaping: true
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

    private get errorReportingPlugin(): esbuild.Plugin {
        const toRelativePath = this.toRelativePath.bind(this);

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

    private getCommonConfig(): esbuild.BuildOptions {
        return {
            entryPoints: {
                vendor: path.join(this.rootDir, "wwwroot/app/index.ts"),
                app: path.join(this.rootDir, "wwwroot/app/app.ts"),
                home: path.join(this.rootDir, "wwwroot/app/components/home/home.module.ts"),
                nationwide: path.join(this.rootDir, "wwwroot/app/components/Nationwide/nationwide.module.ts"),
                overview: path.join(this.rootDir, "wwwroot/app/components/overview/overview.module.ts"),
                jobSearch: path.join(this.rootDir, "wwwroot/app/components/jobSearch/jobSearch.module.ts"),
                megaMap: path.join(this.rootDir, "wwwroot/app/components/mega-map/mega-map.module.ts"),
                taskDashboard: path.join(this.rootDir, "wwwroot/app/components/task-dashboard/task-dashboard.module.ts"),
                recurringJobs: path.join(this.rootDir, "wwwroot/app/components/recurringJobs/recurringJobs.module.ts"),
            },
            bundle: true,
            sourcemap: this.isDev,
            minify: !this.isDev,
            minifyWhitespace: !this.isDev,
            minifyIdentifiers: !this.isDev,
            minifySyntax: !this.isDev,
            target: ["es2015"],
            metafile: !this.isDev,
            treeShaking: !this.isDev,
            legalComments: this.isDev ? "inline" : "none",
            format: "iife",
            mainFields: ["browser", "module", "main"],
            logLevel: this.isDev ? "info" : "error",
            plugins: [
                lessLoader({
                    math: "always",
                }),
                this.htmlMinifierPlugin,
                this.errorReportingPlugin,
                esbuildPluginVersionInjector(),
            ],
            define: {
                "process.env.NODE_ENV": this.isDev ? '"development"' : '"production"',
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

    private generateManifest(): Record<string, string> {
        const manifest: Record<string, string> = {};

        // Get entry points from config
        const entryPoints = this.getCommonConfig().entryPoints! as Record<string, string>;

        // For each entry point, assume standard output names
        for (const entryName of Object.keys(entryPoints)) {
            manifest[`${entryName}.js`] = `${entryName}.js`;
            manifest[`${entryName}.css`] = `${entryName}.css`;
        }

        return manifest;
    }

    private generateManifestWithHashes(): Record<string, string> {
        const manifest: Record<string, string> = {};
        const entryPoints = this.getCommonConfig().entryPoints! as Record<string, string>;
        const filesToHash = ['vendor', 'app'];

        // Scan the dist folder for generated files
        const files = fs.readdirSync(this.distPath);

        for (const entryName of Object.keys(entryPoints)) {
            if (filesToHash.includes(entryName)) {
                // For hashed files, find the actual hashed filename
                const jsFile = files.find(file => file.startsWith(entryName) && file.endsWith('.js'));
                if (jsFile) {
                    manifest[`${entryName}.js`] = jsFile;
                }

                const cssFile = files.find(file => file.startsWith(entryName) && file.endsWith('.css'));
                if (cssFile) {
                    manifest[`${entryName}.css`] = cssFile;
                }
            } else {
                // For non-hashed files, use original names
                manifest[`${entryName}.js`] = `${entryName}.js`;
                manifest[`${entryName}.css`] = `${entryName}.css`;
            }
        }

        return manifest;
    }

    private renameFilesWithHashes(): void {
        const filesToHash = ['vendor', 'app'];

        for (const entryName of filesToHash) {
            // Generate hash using entry name (not file path)
            const hash = this.generateFileHash(entryName);

            // Handle JS files
            const jsPath = path.join(this.distPath, `${entryName}.js`);
            if (fs.existsSync(jsPath)) {
                const newJsName = `${entryName}.${hash}.js`;
                const newJsPath = path.join(this.distPath, newJsName);
                fs.renameSync(jsPath, newJsPath);
                console.log(`[HASH] Renamed ${entryName}.js to ${newJsName}`);
            }

            // Handle CSS files
            const cssPath = path.join(this.distPath, `${entryName}.css`);
            if (fs.existsSync(cssPath)) {
                const newCssName = `${entryName}.${hash}.css`;
                const newCssPath = path.join(this.distPath, newCssName);
                fs.renameSync(cssPath, newCssPath);
                console.log(`[HASH] Renamed ${entryName}.css to ${newCssName}`);
            }

            // Handle source maps
            const jsMapPath = path.join(this.distPath, `${entryName}.js.map`);
            if (fs.existsSync(jsMapPath)) {
                const newJsMapName = `${entryName}.${hash}.js.map`;
                const newJsMapPath = path.join(this.distPath, newJsMapName);
                fs.renameSync(jsMapPath, newJsMapPath);

                // Update the source map reference in the JS file
                const jsFilePath = path.join(this.distPath, `${entryName}.${hash}.js`);
                const jsContent = fs.readFileSync(jsFilePath, 'utf8');
                const updatedJsContent = jsContent.replace(
                    `//# sourceMappingURL=${entryName}.js.map`,
                    `//# sourceMappingURL=${newJsMapName}`
                );
                fs.writeFileSync(jsFilePath, updatedJsContent);
            }
        }
    }
    
    private async buildDev(): Promise<void> {
        console.log("[DEV] Building development bundles with file watching...");

        const devConfig: esbuild.BuildOptions = {
            ...this.getCommonConfig(),
            outdir: this.distPath,
        };

        // Create context for watching
        const ctx = await esbuild.context(devConfig);

        // Start watching for file changes
        await ctx.watch();

        // Create manifest (no hashing in dev mode)
        const manifest = this.generateManifest();

        fs.writeFileSync(
            path.join(this.distPath, "manifest.json"),
            JSON.stringify(manifest, null, 2)
        );

        console.log(`[DEV] Build complete. Watching for changes...`);
        console.log(`Files are being output to ${this.distPath}`);
        console.log("[DEV] Serve these files with IIS for debugging");

        // Keep the process running for watching
        await new Promise(() => {});
    }

    private incrementVersion(): void {
        if (process.env.CI && fs.existsSync(path.join(this.distPath, "manifest.json"))) {
            console.log("[VERSION] Skipping version increment - already built in CI");
            return;
        }

        try {
            const packageJsonPath = path.join(this.rootDir, "package.json");
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            const currentVersion = packageJson.version;
            const versionParts = currentVersion.split('.');
            const patch = parseInt(versionParts[2]) + 1;
            const newVersion = `${versionParts[0]}.${versionParts[1]}.${patch}`;

            packageJson.version = newVersion;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

            console.log(`[VERSION] Updated version from ${currentVersion} to ${newVersion}`);
        } catch (error) {
            console.error("[ERROR] Failed to increment version:", error);
        }
    }

    private async buildProd(): Promise<void> {
        console.log("[PROD] Building production bundles...");
        const startTime = Date.now();

        // Check if we've already built (useful for CI environments)
        const manifestPath = path.join(this.distPath, "manifest.json");
        if (process.env.CI && fs.existsSync(manifestPath)) {
            console.log("[PROD] Build already completed, skipping...");
            return;
        }

        this.incrementVersion();

        // Build all entry points
        console.log("[PROD] Building all bundles...");
        await esbuild.build({
            ...this.getCommonConfig(),
            outdir: this.distPath,
            metafile: true,
        });

        // Add hash keys to filenames for cache busting
        console.log("[PROD] Adding hash keys to filenames...");
        this.renameFilesWithHashes();

        // Create a manifest with hashed filenames
        const manifest = this.generateManifestWithHashes();

        fs.writeFileSync(
            manifestPath,
            JSON.stringify(manifest, null, 2)
        );

        const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[PROD] Build completed in ${buildTime}s`);
        console.log(`[PROD] Manifest created with ${Object.keys(manifest).length} entries`);
    }
    
    async build(): Promise<void> {
        const startTime = Date.now();

        try {
            await this.cleanDistFolder();

            if (this.isDev) {
                await this.buildDev();
            } else {
                await this.buildProd();
                const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[PROD] Build completed in ${buildTime}s`);
            }
        } catch (error) {
            console.error("[ERROR] Build failed:", error);
            process.exit(1);
        }
    }
}

// Create and run the bundler
const bundler = new Bundler();
bundler.build().then(() => console.log("Build process initialized"));