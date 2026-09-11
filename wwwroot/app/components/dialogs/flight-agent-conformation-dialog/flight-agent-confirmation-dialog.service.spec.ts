/** @jest-environment jest-environment-jsdom */
/**
 * Tests for FlightAgentConfirmationDialogService
 * Covers lazy loading of React bundle, flight dialog opening, agent dialog opening
 * with stopJobCount calculation, result mapping, and error handling.
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

jest.mock('../../../functions/countSubJobs', () => ({
    default: jest.fn((jobNo: string, relatedJobs: string) => {
        return relatedJobs ? relatedJobs.split(',').length : 0;
    }),
    __esModule: true,
}));

jest.mock('../../../interfaces/nationwideFlight.interfaces', () => ({}));
jest.mock('../../../interfaces/dialog-result.interfaces', () => ({}));

import FlightAgentConfirmationDialogService from './flight-agent-confirmation-dialog.service';
import countSubJobs from '../../../functions/countSubJobs';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const mockEvent = {} as MouseEvent;

const createMockFlightResult = (overrides: Record<string, any> = {}) => ({
    shouldAssign: true,
    awb: 'AWB-12345',
    shouldAssignToStopJobs: false,
    packageReadyTime: undefined,
    packageDeliverByTime: undefined,
    packageDeliveryNotes: undefined,
    ...overrides,
});

describe('FlightAgentConfirmationDialogService', () => {
    let service: FlightAgentConfirmationDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.hash1.js',
            'flightAgentConfirmationDialogReact.js': 'flightAgentConfirmationDialogReact.hash2.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();

        service = new FlightAgentConfirmationDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        delete (window as any).React;
        delete (window as any).ReactFlightAgentConfirmationDialog;
        (countSubJobs as jest.Mock).mockClear();
    });

    afterEach(() => {
        delete (window as any).ReactFlightAgentConfirmationDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal() {
        (window as any).ReactFlightAgentConfirmationDialog = {
            openFlightDialog: jest.fn().mockResolvedValue(createMockFlightResult()),
            openAgentDialog: jest.fn().mockResolvedValue(createMockFlightResult()),
        };
    }

    describe('Lazy Loading', () => {
        it('should fetch manifest.json on first dialog open', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.hash1.js');
        });

        it('should load the flight agent confirmation dialog React module with hashed filename', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.flightAgentConfirmationDialogReact',
                files: ['dist/flightAgentConfirmationDialogReact.hash2.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.flightAgentConfirmationDialogReact',
                files: ['dist/flightAgentConfirmationDialogReact.hash2.js'],
            });
        });

        it('should skip loading entirely if ReactFlightAgentConfirmationDialog is already on window', async () => {
            setupWindowGlobal();
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should use unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new FlightAgentConfirmationDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
            );
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.flightAgentConfirmationDialogReact',
                files: ['dist/flightAgentConfirmationDialogReact.js'],
            });
        });

        it('should also load via agentConfirmationDialog when not yet loaded', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent A' };

            await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });
    });

    describe('Flight Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call openFlightDialog with correct parameters', async () => {
            const job = { id: 42, jobNo: 'FL-42', conNote: 'CN-999', dgClass: 3 };
            const flight = { flightNumber: 'NZ456', segments: [] };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect((window as any).ReactFlightAgentConfirmationDialog.openFlightDialog).toHaveBeenCalledWith({
                jobId: 42,
                jobNumber: 'FL-42',
                flight: flight,
                existingAwb: 'CN-999',
                dgClass: 3,
            });
        });

        it('should return mapped result from flight dialog', async () => {
            const expectedResult = createMockFlightResult({
                shouldAssign: true,
                awb: 'AWB-777',
                shouldAssignToStopJobs: true,
                packageReadyTime: '2025-01-01T10:00:00',
                packageDeliverByTime: '2025-01-01T18:00:00',
                packageDeliveryNotes: 'Handle with care',
            });
            (window as any).ReactFlightAgentConfirmationDialog.openFlightDialog.mockResolvedValue(expectedResult);

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            const result = await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(result).toEqual({
                shouldAssign: true,
                awb: 'AWB-777',
                shouldAssignToStopJobs: true,
                packageReadyTime: '2025-01-01T10:00:00',
                packageDeliverByTime: '2025-01-01T18:00:00',
                packageDeliveryNotes: 'Handle with care',
            });
        });

        it('should handle undefined conNote and dgClass', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: undefined, dgClass: undefined };
            const flight = { flightNumber: 'NZ123' };

            await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            const callArgs = (window as any).ReactFlightAgentConfirmationDialog.openFlightDialog.mock.calls[0][0];
            expect(callArgs.existingAwb).toBeUndefined();
            expect(callArgs.dgClass).toBeUndefined();
        });
    });

    describe('Agent Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call openAgentDialog with correct parameters', async () => {
            const job = { id: 55, jobNo: 'AG-55', conNote: 'CN-100', dgClass: 2, relatedJobs: null };
            const agent = { id: 10, text: 'Test Agent' };

            await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect((window as any).ReactFlightAgentConfirmationDialog.openAgentDialog).toHaveBeenCalledWith({
                jobId: 55,
                jobNumber: 'AG-55',
                agent: agent,
                existingAwb: 'CN-100',
                dgClass: 2,
                stopJobCount: 0,
            });
        });

        it('should calculate stopJobCount using countSubJobs when relatedJobs exists', async () => {
            const relatedJobs = 'JOB1a,JOB1b,JOB1c';
            const job = { id: 1, jobNo: 'JOB1', conNote: '', dgClass: 0, relatedJobs };
            const agent = { id: 1, text: 'Agent' };

            await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(countSubJobs).toHaveBeenCalledWith('JOB1', relatedJobs);
            const callArgs = (window as any).ReactFlightAgentConfirmationDialog.openAgentDialog.mock.calls[0][0];
            expect(callArgs.stopJobCount).toBe(3);
        });

        it('should set stopJobCount to 0 when relatedJobs is falsy', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent' };

            await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(countSubJobs).not.toHaveBeenCalled();
            const callArgs = (window as any).ReactFlightAgentConfirmationDialog.openAgentDialog.mock.calls[0][0];
            expect(callArgs.stopJobCount).toBe(0);
        });

        it('should set stopJobCount to 0 when relatedJobs is undefined', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: undefined };
            const agent = { id: 1, text: 'Agent' };

            await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(countSubJobs).not.toHaveBeenCalled();
            const callArgs = (window as any).ReactFlightAgentConfirmationDialog.openAgentDialog.mock.calls[0][0];
            expect(callArgs.stopJobCount).toBe(0);
        });

        it('should return mapped result from agent dialog', async () => {
            const expectedResult = createMockFlightResult({
                shouldAssign: true,
                awb: 'AWB-AGENT',
                shouldAssignToStopJobs: true,
                packageDeliveryNotes: 'Deliver to reception',
            });
            (window as any).ReactFlightAgentConfirmationDialog.openAgentDialog.mockResolvedValue(expectedResult);

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent' };

            const result = await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(result).toEqual({
                shouldAssign: true,
                awb: 'AWB-AGENT',
                shouldAssignToStopJobs: true,
                packageReadyTime: undefined,
                packageDeliverByTime: undefined,
                packageDeliveryNotes: 'Deliver to reception',
            });
        });
    });

    describe('Error Handling', () => {
        it('should return { shouldAssign: false, awb: undefined } on flight dialog error', async () => {
            setupWindowGlobal();
            (window as any).ReactFlightAgentConfirmationDialog.openFlightDialog.mockRejectedValue(
                new Error('Dialog error')
            );

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            const result = await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should return { shouldAssign: false, awb: undefined } on agent dialog error', async () => {
            setupWindowGlobal();
            (window as any).ReactFlightAgentConfirmationDialog.openAgentDialog.mockRejectedValue(
                new Error('Dialog error')
            );

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent' };

            const result = await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should return { shouldAssign: false, awb: undefined } on flight dialog user cancellation', async () => {
            setupWindowGlobal();
            (window as any).ReactFlightAgentConfirmationDialog.openFlightDialog.mockRejectedValue(undefined);

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            const result = await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should return { shouldAssign: false, awb: undefined } on agent dialog user cancellation', async () => {
            setupWindowGlobal();
            (window as any).ReactFlightAgentConfirmationDialog.openAgentDialog.mockRejectedValue(undefined);

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent' };

            const result = await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should not rethrow when flight dialog load fails', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            const result = await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should not rethrow when agent dialog load fails', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent' };

            const result = await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should return fallback when window global is missing after load for flight dialog', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0 };
            const flight = { flightNumber: 'NZ123' };

            const result = await service.flightConfirmationDialog(mockEvent, job as any, flight as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });

        it('should return fallback when window global is missing after load for agent dialog', async () => {
            const job = { id: 1, jobNo: 'JOB-1', conNote: '', dgClass: 0, relatedJobs: null };
            const agent = { id: 1, text: 'Agent' };

            const result = await service.agentConfirmationDialog(mockEvent, job as any, agent as any);

            expect(result).toEqual({ shouldAssign: false, awb: undefined });
        });
    });
});
