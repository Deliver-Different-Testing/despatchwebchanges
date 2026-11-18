import type {MockInstance} from 'vitest';
import {openJobInSearch, toHubUrl} from './navigationService';

describe('navigationService', () => {
    let windowOpenSpy: MockInstance;

    beforeEach(() => {
        windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        windowOpenSpy.mockRestore();
    });

    describe('toHubUrl', () => {
        it('swaps despatch for hub in the host only', () => {
            expect(toHubUrl('https://acme.despatch.example.com/despatch/#/jobSearch?return=despatch'))
                .toBe('https://acme.hub.example.com/despatch/#/jobSearch?return=despatch');
        });
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
