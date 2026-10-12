import React, {Suspense, useCallback, useEffect, useMemo} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {
    createHashRouter,
    Navigate,
    Outlet,
    RouterProvider,
    useBlocker,
    useLocation,
    useNavigate,
    useSearchParams,
    type RouteObject,
} from 'react-router';
import {Center, Loader} from '@mantine/core';
import {DfrntMantineProvider} from '../theme/DfrntMantineProvider';
import {SessionGate} from '../components/common/session-gate/SessionGate';
import {ThemeBootstrap} from '../theme/ThemeBootstrap';
import type {SessionContextDto} from '../session';
import {useAddStopFlow} from '../hooks/useAddStopFlow';
import {resolveDashboardRedirect} from '../services/dashboardRouteGuard';
import {confirmNavigationAllowed} from '../services/unsavedChangesGuard';
import type {ErrorType} from '../pages/error-page/ErrorPage';
import type {PrebookListModel} from '../interfaces';
import {NavigationProvider, type Navigation, type NavigationParams} from './NavigationContext';
import {ROUTES, resolveAlias, routePath, type RouteEntry} from './routeTable';

const lazyScreen = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, name: K) =>
    React.lazy(async () => ({default: (await load())[name]}));

const DispatchScreen = lazyScreen(() => import('../screens/DispatchScreen'), 'DispatchScreen');
const NationwideScreen = lazyScreen(() => import('../screens/NationwideScreen'), 'NationwideScreen');
const JobSearchScreen = lazyScreen(() => import('../screens/JobSearchScreen'), 'JobSearchScreen');
const RecurringJobsScreen = lazyScreen(() => import('../screens/RecurringJobsScreen'), 'RecurringJobsScreen');
const OverviewScreen = lazyScreen(() => import('../screens/OverviewScreen'), 'OverviewScreen');
const TaskDashboardScreen = lazyScreen(() => import('../screens/TaskDashboardScreen'), 'TaskDashboardScreen');
const DriverManagementScreen = lazyScreen(() => import('../screens/DriverManagementScreen'), 'DriverManagementScreen');
const CourierMapScreen = lazyScreen(() => import('../screens/CourierMapScreen'), 'CourierMapScreen');
const SettingsScreen = lazyScreen(() => import('../screens/SettingsScreen'), 'SettingsScreen');
const ErrorScreen = lazyScreen(() => import('../screens/ErrorScreen'), 'ErrorScreen');

const useJobIdParam = (): number | undefined => {
    const [params] = useSearchParams();
    const jobId = Number(params.get('jobId'));
    return params.get('jobId') && Number.isFinite(jobId) ? jobId : undefined;
};

const DispatchRoute: React.FC = () => <DispatchScreen deepLinkJobId={useJobIdParam()}/>;
const NationwideRoute: React.FC = () => <NationwideScreen deepLinkJobId={useJobIdParam()}/>;
const JobSearchRoute: React.FC = () => <JobSearchScreen jobId={useJobIdParam()}/>;

const RecurringJobsRoute: React.FC = () => {
    const {addRecurringJobStop} = useAddStopFlow();
    const onAddStop = useCallback(
        (job: PrebookListModel, isPickup: boolean) => void addRecurringJobStop(job, isPickup),
        [addRecurringJobStop],
    );
    return <RecurringJobsScreen onAddStop={onAddStop}/>;
};

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
    dispatch: DispatchRoute,
    nwV2: NationwideRoute,
    jobSearch: JobSearchRoute,
    recurringJobs: RecurringJobsRoute,
    overview: OverviewScreen,
    taskDashboard: TaskDashboardScreen,
    driverManagement: DriverManagementScreen,
    courierMap: CourierMapScreen,
    settings: SettingsScreen,
};

const GuardedRoute: React.FC<{state: string; children: React.ReactNode}> = ({state, children}) => {
    const redirect = resolveDashboardRedirect(state);
    return redirect ? <Navigate to={routePath(redirect)} replace/> : <>{children}</>;
};

const AliasRedirect: React.FC<{target: string}> = ({target}) => {
    const {search} = useLocation();
    return <Navigate to={{pathname: routePath(target), search}} replace/>;
};

const routeObject = (route: RouteEntry): RouteObject => {
    if (route.kind === 'alias') {
        return {path: route.path, element: <AliasRedirect target={resolveAlias(route.state)}/>};
    }
    if (route.kind === 'error') {
        return {path: route.path, element: <ErrorScreen errorType={route.state as ErrorType}/>};
    }
    const Page = PAGE_COMPONENTS[route.state];
    return {path: route.path, element: <GuardedRoute state={route.state}><Page/></GuardedRoute>};
};

const stateForPath = (pathname: string): string => {
    const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    return ROUTES.find(r => r.path.toLowerCase() === normalized.toLowerCase())?.state ?? 'notFound';
};

const RouterNavigationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const routerNavigate = useNavigate();
    const {pathname} = useLocation();

    const navigate = useCallback((state: string, params?: NavigationParams) => {
        const query = new URLSearchParams();
        Object.entries(params ?? {}).forEach(([key, value]) => {
            if (value !== null && value !== undefined) query.set(key, String(value));
        });
        routerNavigate({pathname: routePath(state), search: query.toString()});
    }, [routerNavigate]);

    const value = useMemo<Navigation>(
        () => ({navigate, currentState: stateForPath(pathname)}),
        [navigate, pathname],
    );
    return <NavigationProvider value={value}>{children}</NavigationProvider>;
};

const UnsavedChangesBlocker: React.FC = () => {
    const blocker = useBlocker(({currentLocation, nextLocation}) => currentLocation.pathname !== nextLocation.pathname);

    useEffect(() => {
        if (blocker.state !== 'blocked') return;
        void confirmNavigationAllowed().then(allowed => (allowed ? blocker.proceed() : blocker.reset()));
    }, [blocker]);

    return null;
};

const PageLoader: React.FC = () => <Center h="100%" mih="50vh"><Loader/></Center>;

export const SpaLayout: React.FC = () => (
    <RouterNavigationProvider>
        <UnsavedChangesBlocker/>
        <Suspense fallback={<PageLoader/>}>
            <Outlet/>
        </Suspense>
    </RouterNavigationProvider>
);

/** useBlocker needs a data router, so the app uses createHashRouter rather than <HashRouter>. */
export const spaRoutes: RouteObject[] = [{
    element: <SpaLayout/>,
    children: [
        ...ROUTES.map(routeObject),
        {path: '*', element: <Navigate to={routePath('notFound')} replace/>},
    ],
}];

export const SpaRoot: React.FC<{initialContext?: SessionContextDto}> = ({initialContext}) => {
    const router = useMemo(() => createHashRouter(spaRoutes), []);
    return (
        <DfrntMantineProvider>
            <SessionGate initialContext={initialContext}>
                <ThemeBootstrap>
                    <RouterProvider router={router}/>
                </ThemeBootstrap>
            </SessionGate>
        </DfrntMantineProvider>
    );
};

export function mountSpa(container: HTMLElement, initialContext?: SessionContextDto): Root {
    const root = createRoot(container);
    root.render(<SpaRoot initialContext={initialContext}/>);
    return root;
}
