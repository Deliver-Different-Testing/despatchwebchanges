import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {NavigationProvider} from '../../routes/NavigationContext';
import {NationwideScreen} from './NationwideScreen';

vi.mock('./NationwidePage', () => ({NationwidePage: () => <div data-testid="nationwide-page"/>}));
vi.mock('../partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => null}));
vi.mock('../../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 7, refresh: vi.fn()})}));
vi.mock('../../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: vi.fn()})}));
vi.mock('../../services/navigationService', () => ({openJobInSearch: vi.fn(), openHubUrl: vi.fn()}));
vi.mock('../../services/toastService', () => ({toastService: {showToast: vi.fn()}}));
vi.mock('../../api/session', () => ({
    getContactId: () => 42, getTimeZone: () => '',
    getSession: () => ({contactId: 42, firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false, isUsCustomer: false, timeZone: '', visibleFeatures: null}),
}));

describe('NationwideScreen frame', () => {
    it('shows the Nationwide heading, the page and the unread messages badge', () => {
        renderWithProviders(
            <NavigationProvider value={{navigate: vi.fn(), currentState: 'nationwide'}}>
                <NationwideScreen/>
            </NavigationProvider>,
        );

        expect(screen.getByTestId('nationwide-page')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Nationwide'})).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });
});
