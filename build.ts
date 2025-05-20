import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {lessLoader} from "esbuild-plugin-less";

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

    private generateHash(content: string | Uint8Array): string {
        return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
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
                app: path.join(this.rootDir, "wwwroot/app/app.ts")
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
                this.errorReportingPlugin,
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

        // Create manifest
        const manifest: Record<string, string> = {
            "vendor.js": "vendor.js",
            "app.js": "app.js",
            "vendor.css": "vendor.css",
            "app.css": "app.css"
        };

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

    private async buildProd(): Promise<void> {
        console.log("[PROD] Building production bundles...");
        const startTime = Date.now();

        // First, build the vendor bundle with a consistent filename
        console.log("[PROD] Building vendor bundle...");
        const vendorResult = await esbuild.build({
            ...this.getCommonConfig(),
            entryPoints: [path.join(this.rootDir, "wwwroot/app/index.ts")],
            outfile: path.join(this.distPath, "vendor.js"),
            metafile: true,
        });

        // Extract vendor CSS with a consistent filename
        Object.keys(vendorResult.metafile.outputs).forEach(file => {
            if (file.endsWith('.css')) {
                const cssPath = path.join(this.distPath, "vendor.css");
                // Copy the CSS file to a consistent name
                fs.copyFileSync(file, cssPath);
            }
        });

        // Now build the app bundle with hash in the filename
        console.log("[PROD] Building app bundle...");
        const appResult = await esbuild.build({
            ...this.getCommonConfig(),
            entryPoints: [path.join(this.rootDir, "wwwroot/app/app.ts")],
            outfile: path.join(this.distPath, "app.temp.js"), // Temporary name
            metafile: true,
        });

        // Get app JS and generate hash
        const appJsFile = Object.keys(appResult.metafile.outputs).find(file =>
            file.endsWith('.js')
        );

        if (!appJsFile) {
            throw new Error("App JS file not found in build output");
        }

        const appJsContent = fs.readFileSync(appJsFile);
        const appHash = this.generateHash(appJsContent);
        const appJsFilename = `app.${appHash}.js`;

        // Write app JS with hash
        fs.writeFileSync(
            path.join(this.distPath, appJsFilename),
            appJsContent
        );

        // Remove a temporary app file
        if (fs.existsSync(path.join(this.distPath, "app.temp.js"))) {
            fs.unlinkSync(path.join(this.distPath, "app.temp.js"));
        }

        // Handle app CSS if any
        let appCssFilename = null;
        const appCssFile = Object.keys(appResult.metafile.outputs).find(file =>
            file.endsWith('.css')
        );

        if (appCssFile) {
            const appCssContent = fs.readFileSync(appCssFile);
            appCssFilename = `app.${appHash}.css`;

            // Write app CSS with hash
            fs.writeFileSync(
                path.join(this.distPath, appCssFilename),
                appCssContent
            );

            // Remove a temporary app CSS file
            if (fs.existsSync(path.join(this.distPath, "app.temp.css"))) {
                fs.unlinkSync(path.join(this.distPath, "app.temp.css"));
            }
        }

        // Create manifest
        const manifest: Record<string, string> = {
            "vendor.js": "vendor.js",
            "app.js": appJsFilename,
            "vendor.css": "vendor.css"
        };

        if (appCssFilename) {
            manifest["app.css"] = appCssFilename;
        }

        fs.writeFileSync(
            path.join(this.distPath, "manifest.json"),
            JSON.stringify(manifest, null, 2)
        );

        const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[PROD] Build completed in ${buildTime}s`);
        console.log(`[PROD] Vendor bundle: vendor.js, vendor.css (not hashed)`);
        console.log(`[PROD] App bundle: ${appJsFilename}${appCssFilename ? `, ${appCssFilename}` : ''} (hashed)`);
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
