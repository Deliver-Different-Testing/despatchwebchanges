/**
 * Shared jest.mock() declarations for HomeController tests.
 *
 * Import this file FIRST in every test file so Jest hoists the mocks
 * before any real module code executes.
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

jest.mock('../../../services/dispatch-core.service', () => ({}));
jest.mock('../../../services/dispatch-executor.service', () => ({}));
jest.mock('../../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service', () => ({}));
jest.mock('../../dialogs/job-file-upload-dialog/job-file-upload-dialog.service', () => ({}));
jest.mock('../../dialogs/truck-courier-status-dialog/truck-courier-status-dialog.service', () => ({}));
jest.mock('../../../services/job-add-stop.service', () => ({}));
jest.mock('../../dialogs/messaging-dialog/messaging-dialog.service', () => ({}));
jest.mock('../../../services/tasks.service', () => ({}));
jest.mock('../../dialogs/create-job-dialog/create-job-dialog.service', () => ({}));
jest.mock('../../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service', () => ({}));
jest.mock('../../../react/components/dialogs/add-event-dialog', () => ({openAddEventDialog: jest.fn()}));
jest.mock('../../../react/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module', () => ({
    openInterCourierChargeDialog: jest.fn(),
}));
jest.mock('../../../react/services/jobSearchApi', () => ({
    fetchDispatchJobs: jest.fn(),
    fetchClearListJobs: jest.fn(),
}));
jest.mock('../../../react/query/queryClient', () => ({queryKeys: {}}));
jest.mock('../../../functions/setDateFilterDefaults', () => jest.fn().mockReturnValue({
    startDate: {format: () => ''}, endDate: {format: () => ''},
}));

export {};
