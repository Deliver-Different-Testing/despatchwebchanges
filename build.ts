import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { lessLoader } from "esbuild-plugin-less";
import esbuildPluginTsc from "esbuild-plugin-tsc";

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
      fs.mkdirSync(this.distPath, { recursive: true });
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
      entryPoints: [path.join(this.rootDir, "wwwroot/app/index.ts")],
      bundle: true,
      sourcemap: true,
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
        esbuildPluginTsc(),
        lessLoader({
          math: "always",
        }),
        this.errorReportingPlugin,
      ],
      define: {
        "process.env.NODE_ENV": this.isDev ? '"development"' : '"production"',
        global: "window",
        angular: "window.angular",
        $: "window.jQuery",
        moment: "window.moment",
      },
      external: ["leaflet", "ui.sortable", "ui.timepicker", "pickadate"],
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
    console.log("[DEV] Building development bundle with file watching...");

    const devConfig: esbuild.BuildOptions = {
      ...this.getCommonConfig(),
      outfile: path.join(this.distPath, "bundle.js"),
    };

    // Create context for watching
    const ctx = await esbuild.context(devConfig);

    // Start watching for file changes
    await ctx.watch();

    // Create manifest
    const manifest = {
      "bundle.js": "bundle.js",
      "styles.css": "bundle.css",
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
    console.log("[PROD] Building production bundle...");

    const tempResult = await esbuild.build({
      ...this.getCommonConfig(),
      write: false,
      outfile: path.join(this.distPath, "bundle.js"),
    });

    const outputFiles = tempResult.outputFiles!;
    const jsContent = outputFiles.find((f) => f.path.endsWith(".js"))!.contents;
    const contentHash = this.generateHash(jsContent);

    const jsFilename = `bundle.${contentHash}.js`;
    const cssFilename = `bundle.${contentHash}.css`;

    const distributionPath = this.distPath;

    await esbuild.build({
      ...this.getCommonConfig(),
      outfile: path.join(this.distPath, jsFilename),
      write: true,
      plugins: [
        ...this.getCommonConfig().plugins!,
        {
          name: "css-output",
          setup(build: esbuild.PluginBuild) {
            build.onEnd((result) => {
              if (result.outputFiles) {
                const cssContent = result.outputFiles
                  .filter((file) => file.path.endsWith(".css"))
                  .map((file) => file.text)
                  .join("\n");

                if (cssContent) {
                  fs.writeFileSync(
                    path.join(distributionPath, cssFilename),
                    cssContent
                  );
                }
              }
            });
          },
        },
      ],
    });

    const manifest = {
      "bundle.js": jsFilename,
      "styles.css": cssFilename,
    };

    fs.writeFileSync(
      path.join(this.distPath, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`[PROD] Output: ${jsFilename}, ${cssFilename}`);
  }

  public async build(): Promise<void> {
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
