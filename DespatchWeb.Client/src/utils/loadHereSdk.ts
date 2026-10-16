const HERE_BASE_URL = 'https://js.api.here.com/v3/3.2/';
const DEPENDENT_MODULES = ['mapsjs-service.js', 'mapsjs-ui.js', 'mapsjs-mapevents.js'];

let pending: Promise<void> | null = null;

function hereGlobal(): any {
    return (window as unknown as Record<string, any>).H;
}

function isSdkReady(): boolean {
    const h = hereGlobal();
    return !!(h?.service && h?.ui && h?.mapevents);
}

function loadScript(file: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HERE_BASE_URL + file;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load HERE Maps SDK module ${file}`));
        document.head.appendChild(script);
    });
}

/** Loads the HERE Maps SDK on first use so pages without a map never pay for it. */
export function loadHereSdk(): Promise<void> {
    if (isSdkReady()) return Promise.resolve();
    if (!pending) {
        pending = loadScript('mapsjs-core.js')
            .then(() => Promise.all(DEPENDENT_MODULES.map(loadScript)))
            .then(() => undefined)
            .catch((error) => {
                pending = null;
                throw error;
            });
    }
    return pending;
}
