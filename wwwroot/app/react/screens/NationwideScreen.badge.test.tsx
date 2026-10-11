import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithProviders} from '../__testUtils__';
import {NavigationProvider} from '../app/NavigationContext';
import {NationwideScreen} from './NationwideScreen';

jest.mock('../pages/nationwide/NationwidePage', () => ({NationwidePage: () => <div data-testid="nationwide-page"/>}));
jest.mock('../pages/partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => null}));
jest.mock('../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 7, refresh: jest.fn()})}));
jest.mock('../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: jest.fn()})}));
jest.mock('../services/navigationService', () => ({openJobInSearch: jest.fn(), openHubUrl: jest.fn()}));
jest.mock('../services/toastService', () => ({toastService: {showToast: jest.fn()}}));
jest.mock('../session', () => ({
    getSession: () => ({contactId: 42, firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false, isUsCustomer: false, timeZone: '', visibleFeatures: null}),
}));

describe('NationwideScreen frame', () => {
    it('shows the Nationwide heading, the page and the unread messages badge', () => {
        renderWithProviders(
            <NavigationProvider value={{navigate: jest.fn(), currentState: 'nwV2'}}>
                <NationwideScreen/>
            </NavigationProvider>,
        );

        expect(screen.getByTestId('nationwide-page')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Nationwide'})).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });
});
