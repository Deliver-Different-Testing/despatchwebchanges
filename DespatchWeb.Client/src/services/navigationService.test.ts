import type {MockInstance} from 'vitest';
import {openJobInSearch} from './navigationService';

describe('navigationService', () => {
    let windowOpenSpy: MockInstance;

    beforeEach(() => {
        windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        windowOpenSpy.mockRestore();
    });

    describe('openJobInSearch', () => {
        it('opens job search page with jobId query param', () => {
            openJobInSearch(12345);
            expect(windowOpenSpy).toHaveBeenCalledWith('#/jobSearch?jobId=12345', '_blank');
        });

        it('does not open when jobId is 0', () => {
            openJobInSearch(0);
            expect(windowOpenSpy).not.toHaveBeenCalled();
        });
    });

});
