/**
 * JobListStatsHeader Tests
 */

import React from 'react';
import {screen, within} from '@testing-library/react';
import {renderWithMantine} from '../../test/utils';
import {JobListStatsHeader} from './JobListStatsHeader';

const defaultStats = {total: 25, unassigned: 7, active: 17, transit: 5, done: 8};

const statValue = (label: string) =>
    within(screen.getByText(label).closest('div')!).getByText(/^\d+$/).textContent;

describe('JobListStatsHeader', () => {
    it('names each count after the tab it predicts, in tab order, with transit inside Active', () => {
        renderWithMantine(<JobListStatsHeader stats={defaultStats}/>);

        const labels = screen.getAllByText(/^(Total|Unassigned|Active|Done)$/).map(el => el.textContent);
        expect(labels).toEqual(['Total', 'Unassigned', 'Active', 'Done']);
        expect([statValue('Total'), statValue('Unassigned'), statValue('Active'), statValue('Done')])
            .toEqual(['25', '7', '17', '8']);
        expect(screen.getByText('5 in transit')).toBeInTheDocument();
        expect(screen.queryByText('Transit')).not.toBeInTheDocument();
    });

    it('leaves out the counts for tabs the list does not offer', () => {
        renderWithMantine(
            <JobListStatsHeader stats={defaultStats} hiddenCategories={['needs-dispatch']}/>,
        );

        expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
        expect(statValue('Active')).toBe('17');
        expect(statValue('Done')).toBe('8');
    });
});
