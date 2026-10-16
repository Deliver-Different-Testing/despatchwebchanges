import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {promisify} from 'node:util';
import type {Plugin, ResolvedConfig} from 'vite';

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

// Matches the extensions PrecompressedStaticFilesMiddleware serves .br/.gz siblings for.
const COMPRESSIBLE = /\.(js|css)$/;

function listFiles(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? listFiles(full) : [full];
    });
}

/** Writes max-level `.br` and `.gz` next to each JS/CSS file in the build output, skipping any that don't shrink. */
export function precompress(): Plugin {
    let outDir = '';
    return {
        name: 'despatchweb-precompress',
        apply: 'build',
        configResolved(config: ResolvedConfig) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        async closeBundle() {
            if (!fs.existsSync(outDir)) return;
            const targets = listFiles(outDir).filter((f) => COMPRESSIBLE.test(f));
            let rawTotal = 0;
            let brTotal = 0;

            await Promise.all(targets.map(async (file) => {
                const raw = await fs.promises.readFile(file);
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
                if (br.length < raw.length) await fs.promises.writeFile(`${file}.br`, br);
                if (gz.length < raw.length) await fs.promises.writeFile(`${file}.gz`, gz);
            }));

            const pct = rawTotal ? ((1 - brTotal / rawTotal) * 100).toFixed(1) : '0.0';
            console.log(
                `[precompress] ${targets.length} files: ${(rawTotal / 1024 / 1024).toFixed(2)} MB -> `
                + `${(brTotal / 1024 / 1024).toFixed(2)} MB brotli (-${pct}%)`,
            );
        },
    };
}
