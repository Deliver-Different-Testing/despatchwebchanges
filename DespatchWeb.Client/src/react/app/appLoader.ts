const REMOVE_DELAY_MS = 400;

/** Fades out the pre-paint loader from index.html, then removes it. */
export function hideAppLoader(): void {
    const loader = document.getElementById('appLoader');
    if (!loader || loader.classList.contains('hidden')) return;
    loader.classList.add('hidden');
    setTimeout(() => {
        loader.parentNode?.removeChild(loader);
        const root = document.documentElement;
        if (!root.hasAttribute('data-mantine-color-scheme')) root.removeAttribute('data-dd-boot-scheme');
    }, REMOVE_DELAY_MS);
}
