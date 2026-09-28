/**
 * Tests for the job-search-react module (mount/unmount lifecycle).
 *
 * The module calls (window as any).angular.module() at load time,
 * so we set up the mock in a jest.mock factory which runs before imports.
 */

const mockUnmount = jest.fn();
const mockRender = jest.fn();

jest.mock('react-dom/client', () => {
    (window as any).angular = (window as any).angular || {
        module: jest.fn(() => ({})),
    };

    return {
        createRoot: jest.fn(() => ({
            render: mockRender,
            unmount: mockUnmount,
        })),
    };
});

jest.mock('./JobSearchPage', () => ({
    JobSearchPage: () => null,
}));


jest.mock('../../query', () => ({
    ReactQueryProvider: ({children}: {children: any}) => children,
}));

import {createRoot} from 'react-dom/client';
import {mountJobSearchPage, unmountJobSearchPage} from './job-search-react.module';

const baseConfig = {
    showToast: jest.fn(),
    isUsCustomer: false,
    timeZone: 'New Zealand Standard Time',
};

describe('job-search-react.module', () => {
    beforeEach(() => {
        unmountJobSearchPage();
        document.body.innerHTML = '';
        mockUnmount.mockClear();
        mockRender.mockClear();
        (createRoot as jest.Mock).mockClear();
    });

    it('creates a fallback container when the requested id is missing', () => {
        mountJobSearchPage('react-job-search', baseConfig);
        expect(document.getElementById('react-job-search')).not.toBeNull();
        expect(createRoot).toHaveBeenCalledTimes(1);
        expect(mockRender).toHaveBeenCalledTimes(1);
    });

    it('reuses the same root on a second mount into the same container', () => {
        const container = document.createElement('div');
        container.id = 'react-job-search';
        document.body.appendChild(container);

        mountJobSearchPage('react-job-search', baseConfig);
        mountJobSearchPage('react-job-search', baseConfig);

        expect(createRoot).toHaveBeenCalledTimes(1);
        expect(mockRender).toHaveBeenCalledTimes(2);
    });

    it('unmounts the previous root when mounting into a different container', () => {
        const a = document.createElement('div');
        a.id = 'first';
        const b = document.createElement('div');
        b.id = 'second';
        document.body.append(a, b);

        mountJobSearchPage('first', baseConfig);
        mountJobSearchPage('second', baseConfig);

        expect(mockUnmount).toHaveBeenCalledTimes(1);
        expect(createRoot).toHaveBeenCalledTimes(2);
    });

    it('unmount() tears down the root', () => {
        mountJobSearchPage('react-job-search', baseConfig);
        unmountJobSearchPage();
        expect(mockUnmount).toHaveBeenCalledTimes(1);
    });

    it('exposes the API on window.ReactJobSearch', () => {
        expect(window.ReactJobSearch?.mount).toBe(mountJobSearchPage);
        expect(window.ReactJobSearch?.unmount).toBe(unmountJobSearchPage);
    });
});
