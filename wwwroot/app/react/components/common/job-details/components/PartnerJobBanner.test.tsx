/**
 * PartnerJobBanner Component Tests
 */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {PartnerJobBanner} from './PartnerJobBanner';
import {renderWithMantine} from '../../../../__testUtils__';

const STORAGE_KEY = 'despatchweb.partnerJobBanner.dismissed';

describe('PartnerJobBanner', () => {
    beforeEach(() => window.localStorage.removeItem(STORAGE_KEY));

    it('explains the change-request workflow for a healthy partner link', () => {
        renderWithMantine(<PartnerJobBanner partnerName="OTG Cargo" pairingId={1}/>);

        const banner = screen.getByRole('region', {name: 'Partner job context'});
        expect(banner).toHaveTextContent('Partner job — owned by OTG Cargo');
        expect(banner).toHaveTextContent(/queue as change requests/);
    });

    /**
     * Reflex Blue is pinned, not taken from the Mantine `info` variant — `info` is
     * the tenant primary (Cyan on US), which would repaint this banner in the
     * brand colour and break its meaning.
     */
    it('keeps the Reflex Blue accent rather than following the tenant brand', () => {
        renderWithMantine(<PartnerJobBanner pairingId={1}/>);

        const banner = screen.getByRole('region', {name: 'Partner job context'});
        // jsdom normalises a hex in a longhand colour property to rgb().
        expect(banner).toHaveStyle({borderLeftColor: 'rgb(42, 78, 255)', borderLeftWidth: '3px'});
    });

    it('warns without a dismiss affordance when the pairing reference is missing', () => {
        renderWithMantine(<PartnerJobBanner partnerName="OTG Cargo" pairingId={null}/>);

        const banner = screen.getByRole('region', {name: 'Stale partner link'});
        expect(banner).toHaveTextContent('Resend the job to OTG Cargo');
        expect(banner).toHaveStyle({borderLeftColor: 'rgb(254, 129, 26)'});
        // A blocker, not guidance — it cannot be dismissed away.
        expect(screen.queryByLabelText('Dismiss for this device')).not.toBeInTheDocument();
    });

    it('names the partner generically when none is supplied', () => {
        renderWithMantine(<PartnerJobBanner pairingId={undefined}/>);
        expect(screen.getByRole('region', {name: 'Stale partner link'}))
            .toHaveTextContent('Resend the job to the partner');
    });

    it('remembers the dismissal for the device and can restore it', () => {
        const {unmount} = renderWithMantine(<PartnerJobBanner pairingId={1}/>);

        fireEvent.click(screen.getByLabelText('Dismiss for this device'));
        expect(screen.queryByRole('region', {name: 'Partner job context'})).not.toBeInTheDocument();
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
        unmount();

        // A fresh mount stays collapsed until the dispatcher asks for it back.
        renderWithMantine(<PartnerJobBanner pairingId={1}/>);
        expect(screen.queryByRole('region', {name: 'Partner job context'})).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Show partner-job guidance'));
        expect(screen.getByRole('region', {name: 'Partner job context'})).toBeInTheDocument();
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});
