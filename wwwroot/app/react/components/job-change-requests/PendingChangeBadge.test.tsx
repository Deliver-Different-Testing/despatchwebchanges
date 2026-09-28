/**
 * PendingChangeBadge Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {PendingChangeBadge} from './PendingChangeBadge';
import {renderWithMantine} from '../../__testUtils__';
import type {JobChangeRequestDto} from '../../interfaces/jobChangeRequest';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function makeRequest(overrides: Partial<JobChangeRequestDto> = {}): JobChangeRequestDto {
    return {
        id: 1,
        jobId: 42,
        sourceRequestUuid: 'a1',
        origin: 'Peer',
        requestingPartyType: 'PartnerTenant',
        approvalPartyType: 'OwnerTenant',
        fieldName: 'Quantity',
        currentValue: '3',
        requestedValue: '5',
        status: 'Pending',
        approvalMode: 'Manual',
        requiresCommercialRefresh: false,
        requestedAt: hoursAgo(1),
        ...overrides,
    };
}

describe('PendingChangeBadge', () => {
    it('names the corner dot with the value awaiting approval', () => {
        renderWithMantine(<PendingChangeBadge request={makeRequest()}/>);
        // The dot is the whole affordance, so the accessible name has to carry the
        // value — there is no visible text in this variant.
        expect(screen.getByLabelText('Change pending: 5')).toBeInTheDocument();
    });

    it('spells out the request and its age in the inline strip', () => {
        renderWithMantine(<PendingChangeBadge request={makeRequest()} variant="inline"/>);
        expect(screen.getByText('Change pending →')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    /**
     * Amber while it is merely waiting, red once overdue — the accent is carried by
     * a CSS custom property so one rule serves both the dot and the strip.
     */
    it('switches the accent from amber to red once the request is overdue', () => {
        const {unmount} = renderWithMantine(<PendingChangeBadge request={makeRequest()}/>);
        expect(screen.getByLabelText('Change pending: 5').style.getPropertyValue('--pending-accent'))
            .toBe('var(--mantine-color-orange-6)');
        unmount();

        renderWithMantine(<PendingChangeBadge request={makeRequest({requestedAt: hoursAgo(100)})}/>);
        expect(screen.getByLabelText('Change pending: 5').style.getPropertyValue('--pending-accent'))
            .toBe('var(--mantine-color-red-6)');
    });
});
