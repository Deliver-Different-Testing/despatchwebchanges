import {openJobDetail, openJobInSearch} from './navigationService';

describe('navigationService', () => {
    let windowOpenSpy: jest.SpyInstance;

    beforeEach(() => {
        windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        windowOpenSpy.mockRestore();
    });

    describe('openJobDetail', () => {
        it('opens home state with jobId by default', () => {
            openJobDetail(123);
            expect(windowOpenSpy).toHaveBeenCalledWith('#!/?jobId=123', '_blank');
        });

        it('opens nationwide state with jobId', () => {
            openJobDetail(456, 'nw');
            expect(windowOpenSpy).toHaveBeenCalledWith('#!/Nationwide?jobId=456', '_blank');
        });

        it('does not open when jobId is falsy', () => {
            openJobDetail(0);
            expect(windowOpenSpy).not.toHaveBeenCalled();
        });

        it('falls back to home for unknown state', () => {
            openJobDetail(789, 'unknown');
            expect(windowOpenSpy).toHaveBeenCalledWith('#!/?jobId=789', '_blank');
        });
    });

    describe('openJobInSearch', () => {
        it('opens job search page with jobId query param', () => {
            openJobInSearch(12345);
            expect(windowOpenSpy).toHaveBeenCalledWith('#!/jobSearch?jobId=12345', '_blank');
        });

        it('does not open when jobId is 0', () => {
            openJobInSearch(0);
            expect(windowOpenSpy).not.toHaveBeenCalled();
        });
    });

});
