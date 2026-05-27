/**
 * JobListStatsHeader Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithTheme} from '../../__testUtils__';
import {JobListStatsHeader} from './JobListStatsHeader';

const defaultStats = {total: 25, active: 10, transit: 5, done: 8};

describe('JobListStatsHeader', () => {
    it('renders all stat labels and values', () => {
        renderWithTheme(<JobListStatsHeader stats={defaultStats}/>);

        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Transit')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('renders zero counts', () => {
        renderWithTheme(<JobListStatsHeader stats={{total: 0, active: 0, transit: 0, done: 0}}/>);

        const zeros = screen.getAllByText('0');
        expect(zeros).toHaveLength(4);
    });
});
