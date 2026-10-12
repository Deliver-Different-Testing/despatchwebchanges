/**
 * WarningBanner Component Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {WarningBanner} from './WarningBanner';
import {createMockJob} from '../__testUtils__/mockJob';
import {renderWithMantine as renderWithTheme} from '../../../../__testUtils__';

describe('WarningBanner', () => {
    it('renders nothing for a normal job', () => {
        const job = createMockJob({isArchived: false, preBook: false, isBulkJob: false});
        renderWithTheme(<WarningBanner job={job} />);
        // `MantineProvider` injects a <style> element, so an empty container is
        // no longer the signal — assert the banner's role is absent instead.
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows archived warning', () => {
        const job = createMockJob({isArchived: true});
        renderWithTheme(<WarningBanner job={job} />);
        expect(screen.getByText(/archived/i)).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows bulk job warning', () => {
        const job = createMockJob({isBulkJob: true, isArchived: false});
        renderWithTheme(<WarningBanner job={job} />);
        expect(screen.getByText(/bulk job/i)).toBeInTheDocument();
    });

    it('shows recurring job info when preBook is true', () => {
        const job = createMockJob({preBook: true, isArchived: false, isBulkJob: false});
        renderWithTheme(<WarningBanner job={job} />);
        expect(screen.getByText(/recurring job/i)).toBeInTheDocument();
    });

    it('applies correct priority ordering', () => {
        // Archived > bulk
        const archivedBulk = createMockJob({isArchived: true, isBulkJob: true});
        const {unmount} = renderWithTheme(<WarningBanner job={archivedBulk} />);
        expect(screen.getByText(/archived/i)).toBeInTheDocument();
        unmount();

        // Bulk > recurring
        const bulkRecurring = createMockJob({isBulkJob: true, preBook: true, isArchived: false});
        renderWithTheme(<WarningBanner job={bulkRecurring} />);
        expect(screen.getByText(/bulk job/i)).toBeInTheDocument();
    });
});
