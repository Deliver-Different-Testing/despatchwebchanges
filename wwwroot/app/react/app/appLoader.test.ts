import {hideAppLoader} from './appLoader';

describe('hideAppLoader', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="appLoader" class="app-loader"></div>';
        document.documentElement.setAttribute('data-dd-boot-scheme', 'dark');
    });
    afterEach(() => {
        jest.useRealTimers();
        document.documentElement.removeAttribute('data-dd-boot-scheme');
        document.documentElement.removeAttribute('data-mantine-color-scheme');
    });

    it('fades the loader, removes it after the transition and drops the boot scheme', () => {
        hideAppLoader();
        expect(document.getElementById('appLoader')).toHaveClass('hidden');

        jest.advanceTimersByTime(400);
        expect(document.getElementById('appLoader')).toBeNull();
        expect(document.documentElement).not.toHaveAttribute('data-dd-boot-scheme');
    });

    it('keeps the boot scheme when Mantine owns the colour scheme', () => {
        document.documentElement.setAttribute('data-mantine-color-scheme', 'dark');
        hideAppLoader();
        jest.advanceTimersByTime(400);
        expect(document.documentElement).toHaveAttribute('data-dd-boot-scheme', 'dark');
    });

    it('is a no-op when the loader is already gone', () => {
        document.body.innerHTML = '';
        expect(() => hideAppLoader()).not.toThrow();
    });
});
