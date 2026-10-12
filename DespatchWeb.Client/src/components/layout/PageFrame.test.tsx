import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {NavigationProvider, useNavigation} from '../../routes/NavigationContext';
import {PageFrame} from './PageFrame';

jest.mock('../../pages/partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => <div data-testid="approvals"/>}));
jest.mock('../../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 7, refresh: jest.fn()})}));
jest.mock('../../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: jest.fn()})}));
jest.mock('../../services/navigationService', () => ({openJobInSearch: jest.fn(), openHubUrl: jest.fn()}));
jest.mock('../../api/session', () => ({
    getSession: () => ({firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false, isUsCustomer: false, visibleFeatures: null}),
}));

const wrap = (ui: React.ReactElement) =>
    renderWithProviders(<NavigationProvider value={{navigate: jest.fn(), currentState: 'overview'}}>{ui}</NavigationProvider>);

describe('PageFrame', () => {
    it('wires default messages and partner approvals, body sized below the bar', () => {
        wrap(<PageFrame title="T"><div data-testid="body"/></PageFrame>);

        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByTestId('approvals')).toBeInTheDocument();
        expect(screen.getByTestId('body').parentElement).toHaveStyle({overflow: 'hidden'});
    });

    it('lets a page own messages and scroll', () => {
        wrap(
            <PageFrame title="T" scrollable toolbarActions={{messages: {unreadCount: 2, onClick: jest.fn()}}}>
                <div data-testid="body"/>
            </PageFrame>
        );

        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.queryByText('7')).not.toBeInTheDocument();
        expect(screen.getByTestId('body').parentElement).toHaveStyle({overflow: 'auto'});
    });
});

describe('useNavigation', () => {
    it('throws a clear error without a provider', () => {
        const Probe = () => {
            useNavigation();
            return null;
        };
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => renderWithProviders(<Probe/>)).toThrow('NavigationProvider');
    });
});
