/**
 * TotalDistance Component Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {TotalDistance} from './TotalDistance';
import {renderWithMantine as renderWithTheme} from '../../../../__testUtils__';

describe('TotalDistance', () => {
    it('hides content when not visible', () => {
        renderWithTheme(
            <TotalDistance distance={12.5} isUsCustomer={false} visible={false} />
        );
        expect(screen.queryByText('12.5 km')).not.toBeInTheDocument();
    });

    it('hides content when distance is 0', () => {
        renderWithTheme(
            <TotalDistance distance={0} isUsCustomer={false} visible={true} />
        );
        expect(screen.queryByText('km')).not.toBeInTheDocument();
    });

    it('shows content when visible with distance', () => {
        renderWithTheme(
            <TotalDistance distance={12.5} isUsCustomer={false} visible={true} />
        );
        expect(screen.getByText('12.5 km')).toBeInTheDocument();
    });

    it('shows distance in km for non-US customers', () => {
        renderWithTheme(<TotalDistance distance={12.5} isUsCustomer={false} visible={true} />);
        expect(screen.getByText('12.5 km')).toBeInTheDocument();
    });

    it('shows distance in miles for US customers', () => {
        renderWithTheme(<TotalDistance distance={7.8} isUsCustomer={true} visible={true} />);
        expect(screen.getByText('7.8 miles')).toBeInTheDocument();
    });

    it('formats distance to one decimal place', () => {
        renderWithTheme(<TotalDistance distance={100.456} isUsCustomer={false} visible={true} />);
        expect(screen.getByText('100.5 km')).toBeInTheDocument();
    });
});
