/** @jest-environment jest-environment-jsdom */
/**
 * Tests for the React App Shell directive's messages wiring.
 *
 * The messages button must appear on every page: when a host page wires
 * `on-messages-click` the directive defers to it, otherwise the directive
 * self-wires the shared messaging dialog and polls the unread count.
 *
 * Follows the repo convention (see jobSearch.controller.spec.ts) of invoking
 * the unit directly with mocked dependencies instead of bootstrapping AngularJS DI.
 */

jest.mock('angular', () => ({default: {}, element: jest.fn()}));
jest.mock('../../../react/services/navigationService', () => ({
    openHubUrl: jest.fn(),
    openJobInSearch: jest.fn(),
}));

import reactAppShellDirective from './react-app-shell.directive';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

interface MockScope {
    title?: string;
    messagesCount?: number;
    onMessagesClick?: jest.Mock;
    $watchGroup: jest.Mock;
    $watch: jest.Mock;
    $on: jest.Mock;
    $apply: jest.Mock;
}

function makeScope(overrides: Partial<MockScope> = {}): MockScope {
    return {
        title: 'Some Page',
        $watchGroup: jest.fn(),
        $watch: jest.fn(),
        $on: jest.fn(),
        $apply: jest.fn((fn: () => void) => fn()),
        ...overrides,
    };
}

async function linkDirective(scope: MockScope, deps: {
    $interval: any;
    messagingDialogService: any;
}) {
    const setToolbarActions = jest.fn();
    (window as any).React = {};
    (window as any).ReactAppShell = {
        mount: jest.fn(),
        setToolbarActions,
        updateState: jest.fn(),
        updateBreadcrumbs: jest.fn(),
        unmount: jest.fn(),
    };
    global.fetch = jest.fn(() =>
        Promise.resolve({json: () => Promise.resolve({})}),
    ) as any;

    const $ocLazyLoad: any = {load: jest.fn(() => Promise.resolve())};
    const $state: any = {current: {name: 'home'}, go: jest.fn(() => Promise.resolve())};
    const $rootScope: any = {$on: jest.fn(() => jest.fn())};

    const directive: any = reactAppShellDirective(
        $ocLazyLoad,
        $state,
        {US_Customer: false},
        $rootScope,
        {},
        deps.$interval,
        deps.messagingDialogService,
    );

    const containerEl = document.createElement('div');
    const element: any = {find: () => [containerEl]};

    directive.link(scope, element, {});
    await flush();
    await flush();

    const lastActions = setToolbarActions.mock.calls.at(-1)?.[0];
    return {setToolbarActions, lastActions};
}

describe('reactAppShellDirective — messages button', () => {
    let $interval: any;
    let messagingDialogService: any;

    beforeEach(() => {
        jest.clearAllMocks();
        $interval = jest.fn(() => 'poll-token');
        $interval.cancel = jest.fn();
        messagingDialogService = {
            getUnreadMessageCount: jest.fn(() => Promise.resolve(3)),
            openMessagingDialog: jest.fn(() => Promise.resolve()),
        };
    });

    it('self-wires messages on pages that do not provide on-messages-click', async () => {
        const scope = makeScope();
        const {lastActions} = await linkDirective(scope, {$interval, messagingDialogService});

        expect(lastActions.messages).toBeDefined();
        expect(messagingDialogService.getUnreadMessageCount).toHaveBeenCalled();
        expect(lastActions.messages.unreadCount).toBe(3);

        // Clicking opens the shared messaging dialog.
        lastActions.messages.onClick({} as MouseEvent);
        expect(messagingDialogService.openMessagingDialog).toHaveBeenCalled();

        // Unread count is polled on an interval.
        expect($interval).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('defers to the host page handler and count when on-messages-click is provided', async () => {
        const onMessagesClick = jest.fn();
        const scope = makeScope({onMessagesClick, messagesCount: 5});
        const {lastActions} = await linkDirective(scope, {$interval, messagingDialogService});

        expect(lastActions.messages).toBeDefined();
        expect(lastActions.messages.unreadCount).toBe(5);

        lastActions.messages.onClick({} as MouseEvent);
        expect(onMessagesClick).toHaveBeenCalled();

        // The page owns messaging: the directive neither polls nor self-opens.
        expect(messagingDialogService.getUnreadMessageCount).not.toHaveBeenCalled();
        expect(messagingDialogService.openMessagingDialog).not.toHaveBeenCalled();
        expect($interval).not.toHaveBeenCalled();
    });

    it('cancels the unread poll on $destroy for self-wired pages', async () => {
        const scope = makeScope();
        await linkDirective(scope, {$interval, messagingDialogService});

        const destroyCall = scope.$on.mock.calls.find((c: any[]) => c[0] === '$destroy');
        expect(destroyCall).toBeDefined();
        destroyCall![1]();
        expect($interval.cancel).toHaveBeenCalledWith('poll-token');
    });
});
