/** @jest-environment jest-environment-jsdom */
/**
 * JobListStatsHeader Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {JobListStatsHeader} from './JobListStatsHeader';

describe('JobListStatsHeader', () => {
    it('renders all stat labels and values, including zero counts', () => {
        const {unmount} = renderWithTheme(<JobListStatsHeader stats={{total: 25, active: 10, transit: 5, done: 8}}/>);

        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Transit')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        unmount();

        renderWithTheme(<JobListStatsHeader stats={{total: 0, active: 0, transit: 0, done: 0}}/>);
        expect(screen.getAllByText('0')).toHaveLength(4);
    });
});
