/**
 * useDialogLoader tests — focused on the manifest-driven script + stylesheet loading, since a
 * dialog bundle's own .module.css has silently shipped with nothing loading it before
 * (dfrnt-dialog-design skill). Each test uses a distinct dialog name so the module-level
 * loadPromises/manifestCache singletons never leak between tests.
 */
import {renderHook} from '@testing-library/react';
import {useDialogLoader} from './useDialogLoader';

function mockManifest(manifest: Record<string, string>) {
    global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(manifest),
    }) as unknown as typeof fetch;
}

function clearInjectedTags() {
    document.querySelectorAll('script, link[rel="stylesheet"]').forEach((el) => el.remove());
}

/**
 * jsdom never fires load/error for injected <script>/<link> tags on its own, so both element
 * types are stubbed here to fire `onload` as soon as their src/href is set — <script> also
 * registers the dialog's window global, mimicking the bundle executing.
 */
function stubScriptExecution(globalName: string, value: unknown) {
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'script') {
            Object.defineProperty(el, 'src', {
                set() {
                    (window as any)[globalName] = value;
                    setTimeout(() => (el as HTMLScriptElement).onload?.(new Event('load')));
                },
                get() { return ''; },
            });
        } else if (tag === 'link') {
            let hrefValue = '';
            Object.defineProperty(el, 'href', {
                set(value: string) {
                    hrefValue = value;
                    setTimeout(() => (el as HTMLLinkElement).onload?.(new Event('load')));
                },
                get() { return hrefValue; },
            });
        }
        return el;
    });
}

describe('useDialogLoader', () => {
    afterEach(() => {
        clearInjectedTags();
        jest.restoreAllMocks();
        delete (window as any).ReactVendorLoaderTestGlobal;
        (window as any).React = undefined;
    });

    it('injects the paired stylesheet when the manifest has one for the bundle', async () => {
        mockManifest({
            'vendor-react.js': 'vendor-react.js',
            'splitPricingBreakdownDialogReact.js': 'splitPricingBreakdownDialogReact.abc123.js',
            'splitPricingBreakdownDialogReact.css': 'splitPricingBreakdownDialogReact.abc123.css',
        });
        (window as any).React = {}; // vendor already "loaded"
        stubScriptExecution('ReactSplitPricingBreakdownDialog', {open: jest.fn(), setToastService: jest.fn()});

        const {result} = renderHook(() => useDialogLoader());
        await result.current.ensureSplitPricingBreakdownDialog();

        const link = document.querySelector('link[rel="stylesheet"]') as HTMLLinkElement | null;
        expect(link).not.toBeNull();
        expect(link!.href).toContain('dist/splitPricingBreakdownDialogReact.abc123.css');
    });

    it('does not inject a stylesheet when the manifest has none for the bundle', async () => {
        mockManifest({
            'vendor-react.js': 'vendor-react.js',
            'priceBreakdownDialogReact.js': 'priceBreakdownDialogReact.js',
        });
        (window as any).React = {};
        stubScriptExecution('ReactPriceBreakdownDialog', {open: jest.fn(), setToastService: jest.fn()});

        const {result} = renderHook(() => useDialogLoader());
        await result.current.ensurePriceBreakdownDialog();

        expect(document.querySelector('link[rel="stylesheet"]')).toBeNull();
    });

    it('skips loading entirely once the window global already exists', async () => {
        mockManifest({});
        (window as any).ReactSendPodDialog = {open: jest.fn()};

        const {result} = renderHook(() => useDialogLoader());
        await result.current.ensureSendPodDialog();

        expect(global.fetch).not.toHaveBeenCalled();
        delete (window as any).ReactSendPodDialog;
    });
});
