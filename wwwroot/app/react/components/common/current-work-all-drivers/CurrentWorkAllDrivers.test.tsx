/**
 * Tests for CurrentWorkAllDrivers component
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '../../../__testUtils__';
import { CurrentWorkAllDrivers } from './CurrentWorkAllDrivers';
import { IDriverWorkOverview } from './CurrentWorkAllDrivers.types';

const mockDrivers: IDriverWorkOverview[] = [
    { courierId: 1, name: 'Charlie Driver', vehicleType: 'Van', jobCount: 3, driverStatusText: 'Active' },
    { courierId: 2, name: 'Alice Driver', vehicleType: 'Truck', jobCount: 5, driverStatusText: 'On Route' },
    { courierId: 3, name: 'Bob Driver', vehicleType: 'Bike', jobCount: 0, driverStatusText: 'Available' },
];

/** The default render, plus the search box every filtering test types into. */
function renderDriverSearch() {
    const user = setupUser();

    renderWithMantine(
        <CurrentWorkAllDrivers
            drivers={mockDrivers}
            onDriverSelect={jest.fn()}
        />
    );

    return {user, searchInput: screen.getByPlaceholderText('Search courier...')};
}

describe('CurrentWorkAllDrivers', () => {
    describe('rendering', () => {
        it('should render driver list', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('Charlie Driver')).toBeInTheDocument();
            expect(screen.getByText('Alice Driver')).toBeInTheDocument();
            expect(screen.getByText('Bob Driver')).toBeInTheDocument();
        });

        it('should display job counts for each driver', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('3 jobs')).toBeInTheDocument();
            expect(screen.getByText('5 jobs')).toBeInTheDocument();
            expect(screen.getByText('0 jobs')).toBeInTheDocument();
        });

        it('should display vehicle types', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('Van')).toBeInTheDocument();
            expect(screen.getByText('Truck')).toBeInTheDocument();
            expect(screen.getByText('Bike')).toBeInTheDocument();
        });

        it('should display driver status text', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('On Route')).toBeInTheDocument();
            expect(screen.getByText('Available')).toBeInTheDocument();
        });

        it('should show empty state when no drivers', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={[]}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('No Drivers Available')).toBeInTheDocument();
            expect(screen.getByText('No active drivers found')).toBeInTheDocument();
        });

        it('should show loading indicator when loading', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    loading={true}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByRole('progressbar', { name: 'Loading drivers' })).toBeInTheDocument();
        });

        it('should use singular "job" for count of 1', () => {
            const singleJobDriver: IDriverWorkOverview[] = [
                { courierId: 1, name: 'Single Job', vehicleType: 'Van', jobCount: 1, driverStatusText: 'Active' },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={singleJobDriver}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('1 job')).toBeInTheDocument();
        });
    });

    describe('sorting', () => {
        it('should sort drivers alphabetically by default (A-Z)', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            const listItems = screen.getAllByRole('button');
            // Filter to only driver list items (exclude sort button)
            const driverItems = listItems.filter(item =>
                item.textContent?.includes('Driver')
            );

            expect(driverItems[0]).toHaveTextContent('Alice Driver');
            expect(driverItems[1]).toHaveTextContent('Bob Driver');
            expect(driverItems[2]).toHaveTextContent('Charlie Driver');
        });

        it('should toggle sort order when sort button is clicked', async () => {
            const user = setupUser();

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            // Click sort button to toggle to Z-A
            const sortButton = screen.getByRole('button', { name: /sort/i });
            await user.click(sortButton);

            const listItems = screen.getAllByRole('button');
            const driverItems = listItems.filter(item =>
                item.textContent?.includes('Driver')
            );

            expect(driverItems[0]).toHaveTextContent('Charlie Driver');
            expect(driverItems[1]).toHaveTextContent('Bob Driver');
            expect(driverItems[2]).toHaveTextContent('Alice Driver');
        });
    });

    describe('search', () => {
        it('should filter drivers by search text', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('Alice');

            expect(screen.getByText('Alice Driver')).toBeInTheDocument();
            expect(screen.queryByText('Bob Driver')).not.toBeInTheDocument();
            expect(screen.queryByText('Charlie Driver')).not.toBeInTheDocument();
        });

        it('should be case insensitive', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('alice');

            expect(screen.getByText('Alice Driver')).toBeInTheDocument();
        });

        it('should show count of filtered results', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('Driver');

            expect(screen.getByText('3 of 3 drivers')).toBeInTheDocument();
        });

        it('should show no results message when search has no matches', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('NonExistent');

            expect(screen.getByText('No Drivers Found')).toBeInTheDocument();
            expect(screen.getByText('No drivers match "NonExistent"')).toBeInTheDocument();
        });

        it('should clear search when clear button is clicked', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('Alice');

            expect(screen.queryByText('Bob Driver')).not.toBeInTheDocument();

            // Click clear button
            const clearButton = screen.getByRole('button', { name: 'Clear search' });
            await user.click(clearButton);

            expect(screen.getByText('Alice Driver')).toBeInTheDocument();
            expect(screen.getByText('Bob Driver')).toBeInTheDocument();
            expect(screen.getByText('Charlie Driver')).toBeInTheDocument();
        });
    });

    describe('selection', () => {
        it('should call onDriverSelect when driver is clicked', async () => {
            const user = setupUser();
            const onDriverSelect = jest.fn();

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={onDriverSelect}
                />
            );

            const aliceRow = screen.getByText('Alice Driver').closest('button');
            if (aliceRow) {
                await user.click(aliceRow);
            }

            expect(onDriverSelect).toHaveBeenCalledWith(
                expect.objectContaining({ courierId: 2, name: 'Alice Driver' })
            );
        });

        it('should highlight selected driver', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    selectedCourierId={2}
                    onDriverSelect={jest.fn()}
                />
            );

            const aliceRow = screen.getByText('Alice Driver').closest('button');
            // Selection rides on a data attribute (see CurrentWorkAllDrivers.module.css),
            // so a styling refactor cannot break this assertion.
            expect(aliceRow).toHaveAttribute('data-selected');
        });
    });

    describe('combined search and sort', () => {
        it('should maintain sort order when searching', async () => {
            const user = setupUser();

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            // Toggle to Z-A sort
            const sortButton = screen.getByRole('button', { name: /sort/i });
            await user.click(sortButton);

            // Search for "Driver"
            const searchInput = screen.getByPlaceholderText('Search courier...');
            await user.click(searchInput);
            await user.paste('Driver');

            const listItems = screen.getAllByRole('button');
            const driverItems = listItems.filter(item =>
                item.textContent?.includes('Driver') && !item.textContent?.includes('Sort')
            );

            // Should still be in Z-A order
            expect(driverItems[0]).toHaveTextContent('Charlie Driver');
            expect(driverItems[1]).toHaveTextContent('Bob Driver');
            expect(driverItems[2]).toHaveTextContent('Alice Driver');
        });
    });

    describe('job count chip colors', () => {
        it('should show default color for 0 jobs', () => {
            const drivers: IDriverWorkOverview[] = [
                { courierId: 1, name: 'Zero Jobs', vehicleType: 'Van', jobCount: 0, driverStatusText: 'Available' },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={drivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('0 jobs').closest('[data-tier]')).toHaveAttribute('data-tier', 'none');
        });

        it('should show success color for 1-3 jobs', () => {
            const drivers: IDriverWorkOverview[] = [
                { courierId: 1, name: 'Few Jobs', vehicleType: 'Van', jobCount: 2, driverStatusText: 'Active' },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={drivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('2 jobs').closest('[data-tier]')).toHaveAttribute('data-tier', 'light');
        });

        it('should show warning color for 4-6 jobs', () => {
            const drivers: IDriverWorkOverview[] = [
                { courierId: 1, name: 'Medium Jobs', vehicleType: 'Van', jobCount: 5, driverStatusText: 'Busy' },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={drivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('5 jobs').closest('[data-tier]')).toHaveAttribute('data-tier', 'busy');
        });

        it('should show error color for 7+ jobs', () => {
            const drivers: IDriverWorkOverview[] = [
                { courierId: 1, name: 'Many Jobs', vehicleType: 'Van', jobCount: 8, driverStatusText: 'Overloaded' },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={drivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('8 jobs').closest('[data-tier]')).toHaveAttribute('data-tier', 'heavy');
        });
    });

    describe('edge cases', () => {
        it('should handle undefined selectedCourierId', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    selectedCourierId={undefined}
                    onDriverSelect={jest.fn()}
                />
            );

            // No driver should be selected
            const listItems = screen.getAllByRole('button').filter(item =>
                item.textContent?.includes('Driver')
            );
            listItems.forEach(item => {
                expect(item).not.toHaveAttribute('data-selected');
            });
        });

        it('should handle partial name matches in search', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('Char');

            expect(screen.getByText('Charlie Driver')).toBeInTheDocument();
            expect(screen.queryByText('Alice Driver')).not.toBeInTheDocument();
        });

        it('should handle numeric sorting in names correctly', () => {
            const driversWithNumbers: IDriverWorkOverview[] = [
                { courierId: 1, name: 'Driver 10', vehicleType: 'Van', jobCount: 1, driverStatusText: 'Active' },
                { courierId: 2, name: 'Driver 2', vehicleType: 'Van', jobCount: 1, driverStatusText: 'Active' },
                { courierId: 3, name: 'Driver 1', vehicleType: 'Van', jobCount: 1, driverStatusText: 'Active' },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={driversWithNumbers}
                    onDriverSelect={jest.fn()}
                />
            );

            const listItems = screen.getAllByRole('button').filter(item =>
                item.textContent?.includes('Driver')
            );

            // Should sort numerically: 1, 2, 10 (not alphabetically: 1, 10, 2)
            expect(listItems[0]).toHaveTextContent('Driver 1');
            expect(listItems[1]).toHaveTextContent('Driver 2');
            expect(listItems[2]).toHaveTextContent('Driver 10');
        });

        it('should handle whitespace in search', async () => {
            const {user, searchInput} = renderDriverSearch();
            await user.click(searchInput);
            await user.paste('  Alice  ');

            expect(screen.getByText('Alice Driver')).toBeInTheDocument();
        });

        it('should not show filter count when search is empty', () => {
            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.queryByText(/of \d+ drivers/)).not.toBeInTheDocument();
        });

        it('should handle driver with very long name', () => {
            const longNameDriver: IDriverWorkOverview[] = [
                {
                    courierId: 1,
                    name: 'This Is A Very Long Driver Name That Might Overflow The Container',
                    vehicleType: 'Van',
                    jobCount: 1,
                    driverStatusText: 'Active'
                },
            ];

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={longNameDriver}
                    onDriverSelect={jest.fn()}
                />
            );

            expect(screen.getByText('This Is A Very Long Driver Name That Might Overflow The Container')).toBeInTheDocument();
        });

        it('should handle rapid sort toggling', async () => {
            const user = setupUser();

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={jest.fn()}
                />
            );

            const sortButton = screen.getByRole('button', { name: /sort/i });

            // Toggle multiple times
            await user.click(sortButton); // Z-A
            await user.click(sortButton); // A-Z
            await user.click(sortButton); // Z-A

            const listItems = screen.getAllByRole('button').filter(item =>
                item.textContent?.includes('Driver')
            );

            // Should be in Z-A order after 3 clicks
            expect(listItems[0]).toHaveTextContent('Charlie Driver');
        });

        it('should call onDriverSelect with complete driver object', async () => {
            const user = setupUser();
            const onDriverSelect = jest.fn();

            renderWithMantine(
                <CurrentWorkAllDrivers
                    drivers={mockDrivers}
                    onDriverSelect={onDriverSelect}
                />
            );

            const bobRow = screen.getByText('Bob Driver').closest('button');
            if (bobRow) {
                await user.click(bobRow);
            }

            expect(onDriverSelect).toHaveBeenCalledWith({
                courierId: 3,
                name: 'Bob Driver',
                vehicleType: 'Bike',
                jobCount: 0,
                driverStatusText: 'Available',
            });
        });
    });
});
