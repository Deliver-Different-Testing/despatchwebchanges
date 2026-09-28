
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { ClearListDebugButton } from './ClearListDebugDialog';
import { renderWithMantine as renderWithTheme } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import type { IClearListDebugViewModel, IPolygonAreaMapping } from '../../../../interfaces/job.interface';
import { apiClient } from '../../../services/apiClient';

jest.mock('../../../services/apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

const mockGet = apiClient.get as jest.Mock;

const mockMapping = (overrides?: Partial<IPolygonAreaMapping>): IPolygonAreaMapping => ({
    clearListAreaId: 1,
    clearListAreaName: 'North Area',
    areaChannelId: 10,
    channelMatches: true,
    ...overrides,
});

const mockDebugData = (overrides?: Partial<IClearListDebugViewModel>): IClearListDebugViewModel => ({
    courierId: 42,
    courierCode: 'C042',
    courierName: 'Test Driver',
    channelId: 10,
    fleetName: 'Fleet Alpha',
    gpsPolygonId: 5,
    gpsPolygonName: 'Zone A',
    gpsPolygonSuburbs: ['Suburb1', 'Suburb2'],
    gpsLatitude: -33.8688,
    gpsLongitude: 151.2093,
    gpsTimestamp: '2026-03-30T10:00:00Z',
    gpsAgeMinutes: 1,
    assignedClearListAreaId: 1,
    assignedClearListAreaName: 'North Area',
    assignedStatus: 1,
    assignedStatusLabel: 'Active',
    polygonAreaMappings: [
        mockMapping(),
        mockMapping({ clearListAreaId: 2, clearListAreaName: 'South Area', areaChannelId: 20, channelMatches: false }),
    ],
    isLoggedIn: true,
    loginTime: '2026-03-30T08:00:00Z',
    explanation: 'Driver is in Zone A, assigned to North Area.',
    ...overrides,
});

afterEach(() => {
    mockGet.mockReset();
});

describe('ClearListDebugButton', () => {
    describe('Trigger Button', () => {
        it('renders the info icon button with tooltip', async () => {
            const user = setupUser();
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();

            await user.hover(button);
            expect(await screen.findByText('Clear list debug info')).toBeInTheDocument();
        });

        it('does not render a dialog before clicking', () => {
            renderWithTheme(<ClearListDebugButton courierId={42} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Loading State', () => {
        it('shows loading spinner after clicking the button', async () => {
            const user = setupUser();
            mockGet.mockReturnValue(new Promise(() => {}));
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
    });

    describe('Successful Data Load', () => {
        it('renders the dialog header and calls apiClient.get with correct params', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData());
            renderWithTheme(<ClearListDebugButton courierId={99} />);

            await user.click(screen.getByRole('button'));

            expect(await screen.findByText('Clear List Debug')).toBeInTheDocument();
            expect(screen.getByText('Driver placement diagnostics')).toBeInTheDocument();
            expect(mockGet).toHaveBeenCalledWith('/courier/ClearListDebug', { courierId: 99 });
        });

        it('renders the explanation alert', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData());
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));

            expect(await screen.findByText('Driver is in Zone A, assigned to North Area.')).toBeInTheDocument();
        });

        it('renders all four section cards', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData());
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));

            await screen.findByText('Courier');
            expect(screen.getByText('GPS Location')).toBeInTheDocument();
            expect(screen.getByText('Admin Assignment (TblClearListAreaOrder)')).toBeInTheDocument();
            expect(screen.getByText('Polygon Area Mappings')).toBeInTheDocument();
        });
    });

    describe('Courier Section', () => {
        async function openWithData(data?: Partial<IClearListDebugViewModel>) {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData(data));
            renderWithTheme(<ClearListDebugButton courierId={42} />);
            await user.click(screen.getByRole('button'));
            await screen.findByText('Courier');
        }

        it('displays courier code, name, channel, and fleet', async () => {
            await openWithData();

            expect(screen.getByText('C042')).toBeInTheDocument();
            expect(screen.getByText('Test Driver')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
            expect(screen.getByText('Fleet Alpha')).toBeInTheDocument();
        });

        it('shows "Yes" chip when logged in', async () => {
            await openWithData({ isLoggedIn: true });
            expect(screen.getByText('Yes')).toBeInTheDocument();
        });

        it('shows "No" chip when logged out', async () => {
            await openWithData({ isLoggedIn: false });
            expect(screen.getByText('No')).toBeInTheDocument();
        });

        it('shows login time when available', async () => {
            await openWithData({ loginTime: '2026-03-30T08:00:00Z' });
            expect(screen.getByText('2026-03-30T08:00:00Z')).toBeInTheDocument();
        });

        it('hides login time row when null', async () => {
            await openWithData({ loginTime: null });
            expect(screen.queryByText('LOGIN TIME')).not.toBeInTheDocument();
        });

        it('shows N/A for null fleet', async () => {
            await openWithData({ fleetName: null });
            const naElements = screen.getAllByText('N/A');
            expect(naElements.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GPS Section', () => {
        async function openWithData(data?: Partial<IClearListDebugViewModel>) {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData(data));
            renderWithTheme(<ClearListDebugButton courierId={42} />);
            await user.click(screen.getByRole('button'));
            await screen.findByText('GPS Location');
        }

        it('displays polygon info and coordinates', async () => {
            await openWithData();

            expect(screen.getByText('5')).toBeInTheDocument();
            expect(screen.getByText('Zone A')).toBeInTheDocument();
            expect(screen.getByText('-33.8688, 151.2093')).toBeInTheDocument();
        });

        it('displays suburb chips', async () => {
            await openWithData();

            expect(screen.getByText('Suburb1')).toBeInTheDocument();
            expect(screen.getByText('Suburb2')).toBeInTheDocument();
        });

        it('hides suburbs row when empty', async () => {
            await openWithData({ gpsPolygonSuburbs: [] });
            expect(screen.queryByText('Suburb1')).not.toBeInTheDocument();
        });

        it('shows success chip for fresh GPS (<=3 min)', async () => {
            await openWithData({ gpsAgeMinutes: 2 });
            expect(screen.getByText('2 min ago')).toBeInTheDocument();
        });

        it('shows warning chip for stale GPS (>3 min)', async () => {
            await openWithData({ gpsAgeMinutes: 10 });
            expect(screen.getByText('10 min ago')).toBeInTheDocument();
        });

        it('shows N/A for null coordinates', async () => {
            await openWithData({ gpsLatitude: null, gpsLongitude: null });
            const naElements = screen.getAllByText('N/A');
            expect(naElements.length).toBeGreaterThanOrEqual(1);
        });

        it('shows timestamp when available', async () => {
            await openWithData({ gpsTimestamp: '2026-03-30T10:00:00Z' });
            expect(screen.getByText('2026-03-30T10:00:00Z')).toBeInTheDocument();
        });

        it('hides timestamp row when null', async () => {
            await openWithData({ gpsTimestamp: null });
            expect(screen.queryByText('GPS TIMESTAMP')).not.toBeInTheDocument();
        });
    });

    describe('Admin Assignment Section', () => {
        it('displays assigned area and status', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData());
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));
            await screen.findByText('Admin Assignment (TblClearListAreaOrder)');

            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText(/controls the row position/)).toBeInTheDocument();
        });
    });

    describe('Polygon Area Mappings Section', () => {
        it('displays mappings with channel match/no match chips', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData());
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));
            await screen.findByText('Polygon Area Mappings');

            expect(screen.getAllByText('North Area').length).toBeGreaterThanOrEqual(2);
            expect(screen.getByText('Ch: 10')).toBeInTheDocument();
            expect(screen.getByText('Channel Match')).toBeInTheDocument();

            expect(screen.getByText('South Area')).toBeInTheDocument();
            expect(screen.getByText('Ch: 20')).toBeInTheDocument();
            expect(screen.getByText('No Match')).toBeInTheDocument();
        });

        it('shows warning alert when no mappings exist', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData({ polygonAreaMappings: [] }));
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));
            await screen.findByText('Polygon Area Mappings');

            expect(screen.getByText(/No polygon-to-area mappings found/)).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('shows error message when API rejects', async () => {
            const user = setupUser();
            mockGet.mockRejectedValue({ status: 404, statusText: 'Not Found', message: 'Not Found' });
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));

            expect(await screen.findByText('Failed to load debug info')).toBeInTheDocument();
        });

        it('shows Error.message when API throws an Error', async () => {
            const user = setupUser();
            mockGet.mockRejectedValue(new Error('Network error'));
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));

            expect(await screen.findByText('Network error')).toBeInTheDocument();
        });

        it('does not show content when there is an error', async () => {
            const user = setupUser();
            mockGet.mockRejectedValue(new Error('fail'));
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));
            await screen.findByRole('alert');

            expect(screen.queryByText('Courier')).not.toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('closes dialog when close button is clicked', async () => {
            const user = setupUser();
            mockGet.mockResolvedValue(mockDebugData());
            renderWithTheme(<ClearListDebugButton courierId={42} />);

            await user.click(screen.getByRole('button'));
            await screen.findByText('Clear List Debug');

            // The shared <DialogHeader> names its close button, so this no longer
            // has to hunt for an icon's generated test id.
            await user.click(screen.getByRole('button', {name: 'Close dialog'}));

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });
    });

    describe('Event Propagation', () => {
        it('stops click propagation when opening', async () => {
            const user = setupUser();
            const parentClick = jest.fn();
            mockGet.mockResolvedValue(mockDebugData());

            renderWithTheme(
                <div onClick={parentClick}>
                    <ClearListDebugButton courierId={42} />
                </div>
            );

            await user.click(screen.getByRole('button'));

            expect(parentClick).not.toHaveBeenCalled();
        });
    });
});
