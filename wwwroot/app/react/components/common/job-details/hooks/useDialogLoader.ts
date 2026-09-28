/**
 * useDialogLoader - Lazy-loads React dialog bundles on demand
 *
 * Replicates the AngularJS $ocLazyLoad pattern for dialog modules.
 * Each dialog is a separate JS bundle that registers a window global when loaded.
 */

import {useCallback} from 'react';

type DialogName =
    | 'selectDialogReact'
    | 'editDateTimeDialogReact'
    | 'autoCompleteDialogReact'
    | 'editAddressDialogReact'
    | 'voidJobConfirmationDialogReact'
    | 'priceBreakdownDialogReact'
    | 'splitPricingBreakdownDialogReact'
    | 'simplePriceEditDialogReact'
    | 'editParcelDimensionsDialogReact'
    | 'sendPodDialogReact'
    | 'jobFileUploadDialogReact'
    | 'dateRangeDialogReact';

/** Map dialog name to its window global check */
const DIALOG_GLOBALS: Record<DialogName, () => boolean> = {
    selectDialogReact: () => !!window.ReactSelectDialog,
    editDateTimeDialogReact: () => !!window.ReactEditDateTimeDialog,
    autoCompleteDialogReact: () => !!window.ReactAutoCompleteDialog,
    editAddressDialogReact: () => !!window.ReactEditAddressDialog,
    voidJobConfirmationDialogReact: () => !!window.ReactVoidJobConfirmationDialog,
    priceBreakdownDialogReact: () => !!window.ReactPriceBreakdownDialog,
    splitPricingBreakdownDialogReact: () => !!window.ReactSplitPricingBreakdownDialog,
    simplePriceEditDialogReact: () => !!window.ReactSimplePriceEditDialog,
    editParcelDimensionsDialogReact: () => !!window.ReactEditParcelDimensionsDialog,
    sendPodDialogReact: () => !!window.ReactSendPodDialog,
    jobFileUploadDialogReact: () => !!window.ReactJobFileUploadDialog,
    dateRangeDialogReact: () => !!window.ReactDateRangeDialog,
};

let manifestCache: Record<string, string> | null = null;
const loadPromises = new Map<DialogName, Promise<void>>();

async function fetchManifest(): Promise<Record<string, string>> {
    if (manifestCache) return manifestCache;
    try {
        const resp = await fetch('dist/manifest.json');
        manifestCache = await resp.json();
        return manifestCache!;
    } catch {
        console.warn('[DialogLoader] Failed to load manifest, using fallback names');
        manifestCache = {};
        return manifestCache;
    }
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if script is already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Injects the bundle's stylesheet, if the manifest has one — a dialog's own `.module.css`
 * only ever ships via the script bundle's paired CSS asset. Never throws: a missing
 * stylesheet fails the dialog silently-unstyled rather than blocking it from opening.
 */
function loadStylesheet(href: string): Promise<void> {
    return new Promise((resolve) => {
        if (document.querySelector(`link[href="${href}"]`)) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => resolve();
        document.head.appendChild(link);
    });
}

async function ensureVendorReact(): Promise<void> {
    if ((window as any).React) return;
    const manifest = await fetchManifest();
    const vendorFile = manifest['vendor-react.js'] || 'vendor-react.js';
    await loadScript(`dist/${vendorFile}`);
}

async function loadDialogBundle(name: DialogName): Promise<void> {
    // Already loaded?
    if (DIALOG_GLOBALS[name]()) return;

    // Already loading?
    const existing = loadPromises.get(name);
    if (existing) return existing;

    const promise = (async () => {
        try {
            await ensureVendorReact();
            const manifest = await fetchManifest();
            const filename = `${name}.js`;
            const assetPath = `dist/${manifest[filename] || filename}`;

            const cssKey = `${name}.css`;
            if (manifest[cssKey]) {
                await loadStylesheet(`dist/${manifest[cssKey]}`);
            }

            await loadScript(assetPath);

            if (!DIALOG_GLOBALS[name]()) {
                throw new Error(`${name}.js loaded but window global not available`);
            }
        } catch (error) {
            loadPromises.delete(name);
            throw error;
        }
    })();

    loadPromises.set(name, promise);
    return promise;
}

export function useDialogLoader() {
    const ensureSelectDialog = useCallback(async () => {
        await loadDialogBundle('selectDialogReact');
    }, []);

    const ensureDateTimeDialog = useCallback(async () => {
        await loadDialogBundle('editDateTimeDialogReact');
    }, []);

    const ensureAutoCompleteDialog = useCallback(async () => {
        await loadDialogBundle('autoCompleteDialogReact');
    }, []);

    const ensureAddressDialog = useCallback(async () => {
        await loadDialogBundle('editAddressDialogReact');
    }, []);

    const ensureVoidDialog = useCallback(async () => {
        await loadDialogBundle('voidJobConfirmationDialogReact');
    }, []);

    const ensurePriceBreakdownDialog = useCallback(async () => {
        await loadDialogBundle('priceBreakdownDialogReact');
    }, []);

    const ensureSplitPricingBreakdownDialog = useCallback(async () => {
        await loadDialogBundle('splitPricingBreakdownDialogReact');
    }, []);

    const ensureSimplePriceEditDialog = useCallback(async () => {
        await loadDialogBundle('simplePriceEditDialogReact');
    }, []);

    const ensureParcelDimensionsDialog = useCallback(async () => {
        await loadDialogBundle('editParcelDimensionsDialogReact');
    }, []);

    const ensureSendPodDialog = useCallback(async () => {
        await loadDialogBundle('sendPodDialogReact');
    }, []);

    const ensureJobFileUploadDialog = useCallback(async () => {
        await loadDialogBundle('jobFileUploadDialogReact');
    }, []);

    const ensureDateRangeDialog = useCallback(async () => {
        await loadDialogBundle('dateRangeDialogReact');
    }, []);

    return {
        ensureSelectDialog,
        ensureDateTimeDialog,
        ensureAutoCompleteDialog,
        ensureAddressDialog,
        ensureVoidDialog,
        ensurePriceBreakdownDialog,
        ensureSplitPricingBreakdownDialog,
        ensureSimplePriceEditDialog,
        ensureParcelDimensionsDialog,
        ensureSendPodDialog,
        ensureJobFileUploadDialog,
        ensureDateRangeDialog,
    };
}
