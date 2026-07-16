/**
 * JobListFooter Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithTheme} from '../../__testUtils__';
import {JobListFooter} from './JobListFooter';

describe('JobListFooter', () => {
    it('renders displayed count and last updated timestamp when all jobs loaded', () => {
        renderWithTheme(
            <JobListFooter displayedCount={15} totalCount={15} lastUpdated="Last updated: 3:00 PM" allJobsLoaded/>,
        );

        expect(screen.getByText('Showing 15 jobs')).toBeInTheDocument();
        expect(screen.getByText('Last updated: 3:00 PM')).toBeInTheDocument();
    });

    it('renders "X of Y" when not all jobs loaded', () => {
        renderWithTheme(
            <JobListFooter displayedCount={10} totalCount={50} lastUpdated="Last updated: 3:00 PM" allJobsLoaded={false}/>,
        );

        expect(screen.getByText('Showing 10 of 50 jobs')).toBeInTheDocument();
    });

    it('renders nothing when there are no jobs', () => {
        const {container} = renderWithTheme(
            <JobListFooter displayedCount={0} totalCount={0} lastUpdated="Last updated: 3:00 PM" allJobsLoaded/>,
        );

        expect(screen.queryByText('Last updated: 3:00 PM')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });

    it('renders loading message when loading more', () => {
        renderWithTheme(
            <JobListFooter displayedCount={10} totalCount={50} lastUpdated="Last updated: 3:00 PM" isLoadingMore/>,
        );

        expect(screen.getByText('Loading more jobs...')).toBeInTheDocument();
    });
});
