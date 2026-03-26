/**
 * Shared jest.mock() declarations for NationwideController tests.
 * Import this file FIRST in every test file.
 */

jest.mock('angular', () => ({
    copy: jest.fn((obj: any) => ({...obj})),
    element: jest.fn().mockReturnValue({length: 0, find: jest.fn().mockReturnValue({length: 0})}),
    module: jest.fn().mockReturnValue({
        component: jest.fn(),
        provider: jest.fn(),
        factory: jest.fn(),
        service: jest.fn(),
        config: jest.fn(),
        run: jest.fn(),
    }),
}));

jest.mock('../nationwide.service', () => ({}));
jest.mock('../../../services/dispatch-core.service', () => ({}));
jest.mock('../../../services/dispatch-executor.service', () => ({}));
jest.mock('../../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service', () => ({}));
jest.mock('../../dialogs/job-file-upload-dialog/job-file-upload-dialog.service', () => ({}));
jest.mock('../../dialogs/flight-details-dialog/flight-details-dialog.service', () => ({}));
jest.mock('../../../services/config.service', () => ({}));
jest.mock('../../dialogs/auto-complete-dialog/auto-complete-dialog.service', () => ({}));
jest.mock('../../../services/job-add-stop.service', () => ({}));
jest.mock('../../dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.service', () => ({}));
jest.mock('../../dialogs/messaging-dialog/messaging-dialog.service', () => ({}));
jest.mock('../../../services/tasks.service', () => ({}));
jest.mock('../../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.service', () => ({}));
jest.mock('../../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service', () => ({}));
jest.mock('../../../react/components/dialogs/add-event-dialog', () => ({openAddEventDialog: jest.fn()}));
jest.mock('../../../react/components/dialogs/agent-info-dialog', () => ({openAgentInfoDialog: jest.fn()}));
jest.mock('../../../react/services/jobSearchApi', () => ({
    fetchNationwideJobsNew: jest.fn(),
    fetchNationwideJobsPod: jest.fn(),
    fetchNationwideJobsReprice: jest.fn(),
}));
jest.mock('../../../react/query/queryClient', () => ({queryKeys: {}}));
jest.mock('../../../functions/aiSettings', () => ({setAiEnabled: jest.fn()}));
jest.mock('../../../functions/setDateFilterDefaults', () => jest.fn().mockReturnValue({
    startDate: {format: () => ''}, endDate: {format: () => ''},
}));
jest.mock('../../../functions/toDtoMappings', () => ({
    transformFlightToDTO: jest.fn((s: any) => s),
}));

export {};
