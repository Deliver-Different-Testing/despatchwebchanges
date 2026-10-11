/**
 * Page modules supply showToast from the Mantine toastService; the AngularJS
 * host no longer passes one.
 */
const mockRender = jest.fn();

jest.mock('react-dom/client', () => {
    (window as any).angular = (window as any).angular || {module: jest.fn(() => ({}))};
    return {createRoot: jest.fn(() => ({render: mockRender, unmount: jest.fn()}))};
});

jest.mock('../theme/DfrntMantineProvider', () => ({islandTree: (node: unknown) => node}));
jest.mock('../query', () => ({ReactQueryProvider: ({children}: {children: any}) => children}));
jest.mock('../components/common/error-boundary', () => ({ErrorBoundary: ({children}: {children: any}) => children}));
jest.mock('../services/toastService', () => ({
    toastService: {
        showToast: jest.fn(),
        showSuccessToast: jest.fn(),
        showWarningToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
    },
}));
jest.mock('./recurring-jobs/RecurringJobsPage', () => ({RecurringJobsPage: () => null}));
jest.mock('./task-dashboard/TaskDashboardPage', () => ({TaskDashboardPage: () => null}));
jest.mock('./overview/OverviewPage', () => ({OverviewPage: () => null}));
jest.mock('./driver-management/DriverManagementPage', () => ({DriverManagementPage: () => null}));

import {toastService} from '../services/toastService';
import {mountRecurringJobsPage, unmountRecurringJobsPage} from './recurring-jobs/recurring-jobs-react.module';
import {mountTaskDashboardPage, unmountTaskDashboardPage} from './task-dashboard/task-dashboard-react.module';
import {mountOverviewPage, unmountOverviewPage} from './overview/overview-react.module';
import {mountDriverManagementPage, unmountDriverManagementPage} from './driver-management/driver-management-react.module';

const mocked = toastService as jest.Mocked<typeof toastService>;
const renderedProps = () => (mockRender.mock.calls.at(-1)![0] as any).props;

const types = ['success', 'warning', 'error', 'info'] as const;

describe.each([
    ['recurring-jobs', mountRecurringJobsPage, unmountRecurringJobsPage],
    ['task-dashboard', mountTaskDashboardPage, unmountTaskDashboardPage],
    ['driver-management', mountDriverManagementPage, unmountDriverManagementPage],
] as const)('%s module', (_name, mount, unmount) => {
    beforeEach(() => {
        unmount();
        mockRender.mockClear();
        jest.clearAllMocks();
    });

    it('routes showToast through toastService without an Angular callback', () => {
        mount('c', {isUsCustomer: false} as any);
        const {showToast} = renderedProps().children.props;
        types.forEach(t => showToast(`msg-${t}`, t));
        types.forEach(t => expect(mocked.showToast).toHaveBeenCalledWith(`msg-${t}`, t, undefined));
    });
});

describe('overview module', () => {
    beforeEach(() => {
        unmountOverviewPage();
        mockRender.mockClear();
        jest.clearAllMocks();
    });

    it('routes showToast helpers through toastService without an Angular callback', () => {
        mountOverviewPage('c', {isUsCustomer: false, onOpenJobDetail: jest.fn()} as any);
        const {showToast} = renderedProps().children.props;
        showToast.showSuccessToast('a');
        showToast.showWarningToast('b');
        showToast.showErrorToast('c');
        showToast.showInfoToast('d');
        expect(mocked.showSuccessToast).toHaveBeenCalledWith('a');
        expect(mocked.showWarningToast).toHaveBeenCalledWith('b');
        expect(mocked.showErrorToast).toHaveBeenCalledWith('c');
        expect(mocked.showInfoToast).toHaveBeenCalledWith('d');
    });
});
