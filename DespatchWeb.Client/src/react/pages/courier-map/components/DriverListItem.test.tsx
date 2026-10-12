/**
 * DriverListItem Tests
 *
 * The selected style has to be asserted via inline style, not the CSS module class —
 * CSS modules resolve to `{}` under Jest (see the map-container comment in
 * CourierMapPage.tsx), so a class-only highlight would be invisible to these tests.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {DriverListItem} from './DriverListItem';
import type {IAvailableCourierPosition} from '../../../../interfaces/courier.interface';

function driver(overrides: Partial<IAvailableCourierPosition> = {}): IAvailableCourierPosition {
    return {
        courierId: 1,
        courierName: 'Dave Smith',
        channelId: 1,
        vehicleType: 'Van',
        code: 'DT14',
        isUrgentArmyDriver: false,
        clearListAreaIDs: [],
        longitude: 174.76,
        latitude: -36.85,
        totalJobs: 4,
        overDueJobs: 0,
        ...overrides,
    };
}

describe('DriverListItem', () => {
    it('has no persistent background when not selected', () => {
        renderWithMantine(<DriverListItem driver={driver()} onClick={jest.fn()} isSelected={false} />);
        expect(screen.getByRole('button').style.backgroundColor).toBe('');
    });

    it('gets a persistent tinted background when selected', () => {
        renderWithMantine(<DriverListItem driver={driver()} onClick={jest.fn()} isSelected={true} />);
        expect(screen.getByRole('button').style.backgroundColor).not.toBe('');
    });

    it('calls onClick when clicked', async () => {
        const onClick = jest.fn();
        renderWithMantine(<DriverListItem driver={driver()} onClick={onClick} isSelected={false} />);

        screen.getByRole('button').click();

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
