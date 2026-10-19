// vite-plugin-pwa's virtual module only exists inside a Vite build; in Jest nothing is ever waiting.
export const useRegisterSW = () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
});
