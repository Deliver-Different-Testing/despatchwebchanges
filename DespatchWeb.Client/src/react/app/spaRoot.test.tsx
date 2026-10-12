import React from 'react';
import {screen, waitFor, act} from '@testing-library/react';
import {renderWithProviders} from '../__testUtils__';
import {createMemoryRouter, RouterProvider} from 'react-router';
import {spaRoutes} from './spaRoot';
import {useNavigation} from './NavigationContext';
import {getSession} from '../session';
import {confirmNavigationAllowed} from '../services/unsavedChangesGuard';

jest.mock('../session', () => {
    const session = {visibleFeatures: null, isUsCustomer: false};
    return {getSession: () => session};
});
jest.mock('../services/unsavedChangesGuard', () => ({confirmNavigationAllowed: jest.fn()}));
jest.mock('../hooks/useAddStopFlow', () => ({useAddStopFlow: () => ({addRecurringJobStop: jest.fn()})}));

// jsdom has no fetch Request; the data router only needs url/signal/method from it.
if (typeof globalThis.Request === 'undefined') {
    Object.assign(globalThis, {
        Request: class {
            method: string;
            signal: AbortSignal | undefined;
            constructor(public url: string, init?: {method?: string; signal?: AbortSignal}) {
                this.method = init?.method ?? 'GET';
                this.signal = init?.signal;
            }
        },
    });
}

const mockSession = getSession() as {visibleFeatures: string[] | null};

const Probe = ({id}: {id: string}) => {
    const {currentState, navigate} = useNavigation();
    return <div data-testid={id}>{currentState}<button onClick={() => navigate('jobSearch', {jobId: 7, skip: null})}>go</button></div>;
};
const withProps = (id: string, props: unknown) => <div data-testid={id} data-props={JSON.stringify(props)}/>;

jest.mock('../screens/DispatchScreen', () => ({DispatchScreen: (p: unknown) => withProps('dispatch', p)}));
jest.mock('../screens/NationwideScreen', () => ({NationwideScreen: (p: unknown) => withProps('nationwide', p)}));
jest.mock('../screens/JobSearchScreen', () => ({JobSearchScreen: (p: unknown) => withProps('jobSearch', p)}));
jest.mock('../screens/RecurringJobsScreen', () => ({RecurringJobsScreen: () => <div data-testid="recurring"/>}));
jest.mock('../screens/OverviewScreen', () => ({OverviewScreen: () => <Probe id="overview"/>}));
jest.mock('../screens/TaskDashboardScreen', () => ({TaskDashboardScreen: () => <div data-testid="tasks"/>}));
jest.mock('../screens/DriverManagementScreen', () => ({DriverManagementScreen: () => <div data-testid="drivers"/>}));
jest.mock('../screens/CourierMapScreen', () => ({CourierMapScreen: () => <div data-testid="map"/>}));
jest.mock('../screens/SettingsScreen', () => ({SettingsScreen: () => <div data-testid="settings"/>}));
jest.mock('../screens/ErrorScreen', () => ({ErrorScreen: ({errorType}: {errorType: string}) => <div data-testid="error">{errorType}</div>}));

const renderAt = (path: string) => {
    const router = createMemoryRouter(spaRoutes, {initialEntries: [path]});
    renderWithProviders(<RouterProvider router={router}/>);
    return router;
};
const propsOf = (id: string) => JSON.parse(screen.getByTestId(id).getAttribute('data-props')!);

beforeEach(() => {
    mockSession.visibleFeatures = null;
    jest.mocked(confirmNavigationAllowed).mockReset().mockResolvedValue(true);
});

describe('SPA routes', () => {
    it('redirects aliases to their page, preserving the query string', async () => {
        const router = renderAt('/?jobId=1');

        expect(await screen.findByTestId('dispatch')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/dispatch');
        expect(router.state.location.search).toBe('?jobId=1');
        expect(propsOf('dispatch')).toEqual({deepLinkJobId: 1});
    });

    it('plumbs jobId as a number, and undefined when absent or not numeric', async () => {
        renderAt('/jobSearch?jobId=42');
        await screen.findByTestId('jobSearch');
        expect(propsOf('jobSearch')).toEqual({jobId: 42});
    });

    it.each([['/Nationwide', 'nationwide', 'deepLinkJobId'], ['/dispatch', 'dispatch', 'deepLinkJobId']])(
        '%s gets no jobId when absent or NaN', async (path, id, prop) => {
            const {unmount} = renderWithProviders(<RouterProvider router={createMemoryRouter(spaRoutes, {initialEntries: [`${path}?jobId=abc`]})}/>);
            await screen.findByTestId(id);
            expect(propsOf(id)[prop]).toBeUndefined();
            unmount();
            renderAt(path);
            await screen.findByTestId(id);
            expect(propsOf(id)[prop]).toBeUndefined();
        });

    it('redirects a hidden dashboard to the first allowed one', async () => {
        mockSession.visibleFeatures = ['dw-overview'];
        const router = renderAt('/dispatch');

        expect(await screen.findByTestId('overview')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/overview');
    });

    it('sends unknown paths to the not-found error screen', async () => {
        const router = renderAt('/nope');

        expect(await screen.findByTestId('error')).toHaveTextContent('notFound');
        expect(router.state.location.pathname).toBe('/not-found');
    });

    it('derives currentState from the path and navigates via route table', async () => {
        const router = renderAt('/overview');
        expect(await screen.findByTestId('overview')).toHaveTextContent('overview');

        await act(async () => { screen.getByRole('button', {name: 'go'}).click(); });
        expect(await screen.findByTestId('jobSearch')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/jobSearch');
        expect(router.state.location.search).toBe('?jobId=7');
    });

    describe('unsaved changes blocker', () => {
        it('stays put when confirmNavigationAllowed refuses', async () => {
            jest.mocked(confirmNavigationAllowed).mockResolvedValue(false);
            const router = renderAt('/overview');
            await screen.findByTestId('overview');

            await act(async () => { await router.navigate('/settings'); });

            await waitFor(() => expect(confirmNavigationAllowed).toHaveBeenCalledTimes(1));
            expect(router.state.location.pathname).toBe('/overview');
        });

        it('proceeds when confirmNavigationAllowed allows', async () => {
            jest.mocked(confirmNavigationAllowed).mockResolvedValue(true);
            const router = renderAt('/overview');
            await screen.findByTestId('overview');

            await act(async () => { await router.navigate('/settings'); });

            await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
        });
    });
});
