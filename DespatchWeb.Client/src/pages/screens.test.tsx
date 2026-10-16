import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithProviders} from '../test/utils';
import {setupUser} from '../test/utils/setupUser';
import {NavigationProvider} from '../routes/NavigationContext';
import {OverviewScreen} from './overview/OverviewScreen';
import {TaskDashboardScreen} from './task-dashboard/TaskDashboardScreen';
import {DriverManagementScreen} from './driver-management/DriverManagementScreen';
import {RecurringJobsScreen} from './recurring-jobs/RecurringJobsScreen';
import {SettingsScreen} from './settings/SettingsScreen';
import {CourierMapScreen} from './courier-map/CourierMapScreen';
import {ErrorScreen} from './error-page/ErrorScreen';
import {getHereMapsKey} from '../api/configApi';
import {openJobInSearch} from '../services/navigationService';

const pageProps = jest.fn();
const mockPage = (testId: string) => (props: unknown) => {
    pageProps(testId, props);
    return <div data-testid={testId}/>;
};

jest.mock('./overview/OverviewPage', () => ({OverviewPage: (p: unknown) => mockPage('overview')(p)}));
jest.mock('./task-dashboard/TaskDashboardPage', () => ({TaskDashboardPage: (p: unknown) => mockPage('tasks')(p)}));
jest.mock('./driver-management/DriverManagementPage', () => ({DriverManagementPage: (p: unknown) => mockPage('drivers')(p)}));
jest.mock('./recurring-jobs/RecurringJobsPage', () => ({RecurringJobsPage: (p: unknown) => mockPage('recurring')(p)}));
jest.mock('./settings/SettingsPage', () => ({SettingsPage: (p: unknown) => mockPage('settings')(p)}));
jest.mock('./courier-map/CourierMapPage', () => ({CourierMapPage: (p: unknown) => mockPage('map')(p)}));
jest.mock('./partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => null}));
jest.mock('../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 3, refresh: jest.fn()})}));
jest.mock('../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: jest.fn()})}));
jest.mock('../api/configApi', () => ({getHereMapsKey: jest.fn()}));
jest.mock('../services/navigationService', () => ({openJobInSearch: jest.fn(), openHubUrl: jest.fn()}));
jest.mock('../services/toastService', () => ({toastService: {showToast: jest.fn()}}));
jest.mock('../api/session', () => ({
    getSession: () => ({firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false, isUsCustomer: true, visibleFeatures: null}),
}));

const navigate = jest.fn();
const renderScreen = (ui: React.ReactElement, currentState = 'x') =>
    renderWithProviders(<NavigationProvider value={{navigate, currentState}}>{ui}</NavigationProvider>);

const propsOf = (testId: string) => pageProps.mock.calls.filter(([id]) => id === testId).at(-1)![1] as any;

beforeEach(() => jest.clearAllMocks());

describe.each([
    ['OverviewScreen', <OverviewScreen/>, 'overview', 'Dashboards', 'Overview'],
    ['TaskDashboardScreen', <TaskDashboardScreen/>, 'tasks', 'Dashboards', 'Task Dashboard'],
    ['DriverManagementScreen', <DriverManagementScreen/>, 'drivers', 'Operations', 'Drivers'],
    ['RecurringJobsScreen', <RecurringJobsScreen/>, 'recurring', 'Dashboards', 'Recurring Jobs'],
    ['SettingsScreen', <SettingsScreen/>, 'settings', 'Account', 'Settings'],
])('%s', (_name, element, testId, section, title) => {
    it('renders the page inside the frame with section/title breadcrumb', () => {
        renderScreen(element);

        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.getAllByText(section).length).toBeGreaterThan(0);
        expect(screen.getByRole('heading', {name: title})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /navigation menu/i})).toBeInTheDocument();
    });
});

describe('screen props', () => {
    it('passes session-derived props to the dashboards', () => {
        renderScreen(<OverviewScreen/>);
        renderScreen(<TaskDashboardScreen/>);
        renderScreen(<DriverManagementScreen/>);

        for (const id of ['overview', 'tasks', 'drivers']) {
            expect(propsOf(id).isUsCustomer).toBe(true);
        }
        propsOf('overview').onOpenJobDetail(42);
        expect(openJobInSearch).toHaveBeenCalledWith(42);
    });

    it('defaults RecurringJobs onAddStop to a no-op and forwards a supplied one', () => {
        renderScreen(<RecurringJobsScreen/>);
        expect(() => propsOf('recurring').onAddStop({}, true)).not.toThrow();

        const onAddStop = jest.fn();
        renderScreen(<RecurringJobsScreen onAddStop={onAddStop}/>);
        expect(propsOf('recurring').onAddStop).toBe(onAddStop);
    });
});

describe('CourierMapScreen', () => {
    it('waits for the HERE key then renders the map with key and tenant centre', async () => {
        (getHereMapsKey as jest.Mock).mockResolvedValue('key-1');
        renderScreen(<CourierMapScreen/>);

        expect(await screen.findByTestId('map')).toBeInTheDocument();
        expect(propsOf('map')).toMatchObject({apiKey: 'key-1', isUsCustomer: true, mapCenter: {lat: 39.8283, lng: -98.5795}});
        expect(screen.getByRole('heading', {name: 'Courier Map'})).toBeInTheDocument();
    });

    it('falls back to a null key when the lookup fails', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (getHereMapsKey as jest.Mock).mockRejectedValue(new Error('boom'));
        renderScreen(<CourierMapScreen/>);

        await screen.findByTestId('map');
        expect(propsOf('map').apiKey).toBeNull();
    });
});

describe('ErrorScreen', () => {
    it('shows the error type and navigates home via the navigation provider', async () => {
        const user = setupUser();
        renderScreen(<ErrorScreen errorType="forbidden"/>);

        expect(screen.getByText('Access denied')).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: /home/i}));
        expect(navigate).toHaveBeenCalledWith('home');
    });
});
