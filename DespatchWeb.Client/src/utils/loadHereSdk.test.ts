import { loadHereSdk } from './loadHereSdk';

describe('loadHereSdk', () => {
    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).H;
        document.head.querySelectorAll('script').forEach((s) => s.remove());
    });

    it('resolves without injecting scripts when the SDK is already present', async () => {
        (window as unknown as Record<string, unknown>).H = { service: {}, ui: {}, mapevents: {} };

        await loadHereSdk();

        expect(document.head.querySelectorAll('script')).toHaveLength(0);
    });

    it('loads core first, then the dependent modules once, and shares the promise', async () => {
        const first = loadHereSdk();
        const second = loadHereSdk();
        expect(second).toBe(first);

        let scripts = Array.from(document.head.querySelectorAll('script'));
        expect(scripts.map((s) => s.src)).toEqual(['https://js.api.here.com/v3/3.2/mapsjs-core.js']);

        scripts[0].dispatchEvent(new Event('load'));
        await Promise.resolve();
        await Promise.resolve();

        scripts = Array.from(document.head.querySelectorAll('script'));
        expect(scripts.map((s) => s.src.split('/').pop())).toEqual([
            'mapsjs-core.js',
            'mapsjs-service.js',
            'mapsjs-ui.js',
            'mapsjs-mapevents.js',
        ]);

        scripts.slice(1).forEach((s) => s.dispatchEvent(new Event('load')));
        await expect(first).resolves.toBeUndefined();
    });
});
