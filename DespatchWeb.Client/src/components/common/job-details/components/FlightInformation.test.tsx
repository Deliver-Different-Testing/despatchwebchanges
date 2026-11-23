import type {Mock} from 'vitest';
import React from 'react';
import {screen} from '@testing-library/react';
import { setupUser } from '../../../../test/utils/setupUser';
import {FlightInformation} from './FlightInformation';
import {createMockFlight} from '../__testUtils__/mockJob';
import {renderWithMantine} from '../../../../test/utils';
import dayjs from 'dayjs';
import nationwideApi from '../../../../api/nationwideApi';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

vi.mock('../../../../api/nationwideApi', () => ({
    __esModule: true,
    default: {
        getFlightWebhookStatus: vi.fn(),
        getForwardAirJob: vi.fn(),
    },
}));

const mockGetFlightWebhookStatus = nationwideApi.getFlightWebhookStatus as Mock;
const mockGetForwardAirJob = nationwideApi.getForwardAirJob as Mock;


function renderWithTheme(ui: React.ReactElement) {
    return renderWithMantine(ui);
}

describe('FlightInformation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when flight has no or undefined segments', () => {
        // `MantineProvider` injects a <style> element, so an empty container is no
        // longer the signal — assert the section header is absent instead.
        const {unmount} = renderWithTheme(
            <FlightInformation flight={createMockFlight({flightSegments: []})} jobId={1} />
        );
        expect(screen.queryByTestId('section-header')).not.toBeInTheDocument();
        unmount();

        renderWithTheme(
            <FlightInformation flight={createMockFlight({flightSegments: undefined})} jobId={1} />
        );
        expect(screen.queryByTestId('section-header')).not.toBeInTheDocument();
    });

    it('renders flight segment details and the Check Webhooks button', () => {
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);
        expect(screen.getByText('Flight information')).toBeInTheDocument();
        expect(screen.getByText('NZ123')).toBeInTheDocument();
        expect(screen.getByText('AKL')).toBeInTheDocument();
        expect(screen.getByText('SYD')).toBeInTheDocument();
        expect(screen.getByText(/10:00/)).toBeInTheDocument();
        expect(screen.getByText(/14:00/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /check webhooks/i})).toBeInTheDocument();
    });

    it('renders connection time between segments', () => {
        const flight = createMockFlight({
            flightSegments: [
                {
                    flightNumber: 'NZ100',
                    departureAirportFsCode: 'AKL',
                    arrivalAirportFsCode: 'MEL',
                    departureTime: dayjs('2026-03-23T08:00:00'),
                    arrivalTime: dayjs('2026-03-23T10:00:00'),
                    _departureTimeStr: '08:00',
                    _arrivalTimeStr: '10:00',
                    _departureTimeZoneStr: 'NZDT',
                    _arrivalTimeZoneStr: 'AEDT',
                } as any,
                {
                    flightNumber: 'NZ200',
                    departureAirportFsCode: 'MEL',
                    arrivalAirportFsCode: 'SYD',
                    departureTime: dayjs('2026-03-23T11:30:00'),
                    arrivalTime: dayjs('2026-03-23T12:30:00'),
                    _departureTimeStr: '11:30',
                    _arrivalTimeStr: '12:30',
                    _departureTimeZoneStr: 'AEDT',
                    _arrivalTimeZoneStr: 'AEDT',
                } as any,
            ],
        });
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);

        expect(screen.getByText('NZ100')).toBeInTheDocument();
        expect(screen.getByText('NZ200')).toBeInTheDocument();
        expect(screen.getAllByText('MEL')).toHaveLength(2);
        expect(screen.getByText(/1h 30m connection/)).toBeInTheDocument();
    });

    it('renders short connection time without hours', () => {
        const flight = createMockFlight({
            flightSegments: [
                {
                    flightNumber: 'NZ100',
                    departureAirportFsCode: 'AKL',
                    arrivalAirportFsCode: 'WLG',
                    departureTime: dayjs('2026-03-23T08:00:00'),
                    arrivalTime: dayjs('2026-03-23T09:00:00'),
                    _departureTimeStr: '08:00',
                    _arrivalTimeStr: '09:00',
                } as any,
                {
                    flightNumber: 'NZ200',
                    departureAirportFsCode: 'WLG',
                    arrivalAirportFsCode: 'CHC',
                    departureTime: dayjs('2026-03-23T09:45:00'),
                    arrivalTime: dayjs('2026-03-23T10:30:00'),
                    _departureTimeStr: '09:45',
                    _arrivalTimeStr: '10:30',
                } as any,
            ],
        });
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);
        expect(screen.getByText(/45m connection/)).toBeInTheDocument();
    });

    it('shows "Webhooks active" when API returns active', async () => {
        mockGetFlightWebhookStatus.mockResolvedValue({active: true});
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={42} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(await screen.findByText('Webhooks active')).toBeInTheDocument();
        expect(mockGetFlightWebhookStatus).toHaveBeenCalledWith(42);
    });

    it('shows "Webhooks inactive" when API returns inactive', async () => {
        mockGetFlightWebhookStatus.mockResolvedValue({active: false});
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={7} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(await screen.findByText('Webhooks inactive')).toBeInTheDocument();
        expect(mockGetFlightWebhookStatus).toHaveBeenCalledWith(7);
    });

    it('shows "Webhooks inactive" when API call fails', async () => {
        mockGetFlightWebhookStatus.mockRejectedValue(new Error('Network error'));
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(await screen.findByText('Webhooks inactive')).toBeInTheDocument();
    });

    it('shows loading state while checking webhooks', async () => {
        let resolve: (value: {active: boolean}) => void;
        mockGetFlightWebhookStatus.mockReturnValue(new Promise(r => { resolve = r; }));

        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(screen.getByText('Checking…')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /checking/i})).toBeDisabled();

        resolve!({active: true});
        expect(await screen.findByText('Webhooks active')).toBeInTheDocument();
    });
});

describe('FlightInformation - Forward Air', () => {
    const forwardAirFlight = () => createMockFlight({
        flightNumber: 'T2T',
        flightSegments: [
            {
                flightNumber: 'T2T',
                carrierFsCode: 'FWD',
                airlineName: 'Forward Air',
                departureAirportFsCode: 'BNA',
                arrivalAirportFsCode: 'EWR',
                departureTerminal: 'T1',
                arrivalTerminal: 'T9',
                aircraftName: 'Boeing 737',
                departureTime: dayjs('2026-12-01T10:00:00'),
                arrivalTime: dayjs('2026-12-02T09:00:00'),
                _departureTimeStr: '10:00',
                _arrivalTimeStr: '09:00',
                _departureTimeZoneStr: 'CST',
                _arrivalTimeZoneStr: 'EST',
            } as any,
        ],
    });

    const bookedJob = {
        jobId: 55,
        status: 'Booked',
        serviceLevel: 'GS-T2T',
        airbillNumber: '97880858',
        lastStatusCode: 'DEP',
        lastStatusDescription: 'Departed origin terminal',
        lastStatusAtUtc: '2026-12-01T18:30:00Z',
        etaLocal: '2026-12-02T09:00:00',
        deliveryDocumentAvailable: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows service, airbill, last status with its time, and expected arrival', async () => {
        mockGetForwardAirJob.mockResolvedValue(bookedJob);
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        expect(await screen.findByText('97880858')).toBeInTheDocument();
        expect(mockGetForwardAirJob).toHaveBeenCalledWith(55);
        expect(screen.getByText('GS-T2T')).toBeInTheDocument();
        expect(screen.getByText(/Departed origin terminal/)).toBeInTheDocument();
        expect(screen.getByText(/Last status/i)).toBeInTheDocument();
        expect(screen.getByText(/Expected arrival/i)).toBeInTheDocument();
        expect(screen.getByText(/Dec 2, 09:00/)).toBeInTheDocument();
    });

    it('shows the booking error when there is one', async () => {
        mockGetForwardAirJob.mockResolvedValue({
            jobId: 55, status: 'Failed', lastError: 'Forward Air rejected the weight', deliveryDocumentAvailable: false,
        });
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        expect(await screen.findByText('Forward Air rejected the weight')).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: 'BOL'})).not.toBeInTheDocument();
    });

    it('hides terminal, gate and aircraft and the webhook check', async () => {
        mockGetForwardAirJob.mockResolvedValue(bookedJob);
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        await screen.findByText('97880858');
        expect(screen.queryByText(/Terminal/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Gate/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Boeing 737/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /check webhooks/i})).not.toBeInTheDocument();
    });

    it('opens BOL and Label in a new tab', async () => {
        mockGetForwardAirJob.mockResolvedValue(bookedJob);
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        const bol = await screen.findByRole('link', {name: 'BOL'});
        const label = screen.getByRole('link', {name: 'Label'});
        expect(bol).toHaveAttribute('href', '/api/nationwide/55/forwardair/documents/BOL');
        expect(bol).toHaveAttribute('target', '_blank');
        expect(label).toHaveAttribute('href', '/api/nationwide/55/forwardair/documents/LABEL');
        expect(label).toHaveAttribute('target', '_blank');
        expect(screen.queryByRole('link', {name: /delivery/i})).not.toBeInTheDocument();
    });

    it('offers the delivery receipt only when Forward Air has one', async () => {
        mockGetForwardAirJob.mockResolvedValue({...bookedJob, deliveryDocumentAvailable: true});
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        expect(await screen.findByRole('link', {name: /delivery receipt/i}))
            .toHaveAttribute('href', '/api/nationwide/55/forwardair/documents/DELIVER');
    });

    it('says the airbill is not booked yet when Forward Air has no record', async () => {
        mockGetForwardAirJob.mockResolvedValue(null);
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        expect(await screen.findByText(/not booked yet/i)).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: 'BOL'})).not.toBeInTheDocument();
    });

    it('keeps the flight visible and explains when Forward Air cannot be reached', async () => {
        mockGetForwardAirJob.mockRejectedValue(new Error('boom'));
        renderWithTheme(<FlightInformation flight={forwardAirFlight()} jobId={55} />);

        expect(await screen.findByText(/Forward Air details are unavailable/i)).toBeInTheDocument();
        expect(screen.getByText('BNA')).toBeInTheDocument();
    });

    it('does not call Forward Air for an airline flight', () => {
        renderWithTheme(<FlightInformation flight={createMockFlight()} jobId={55} />);

        expect(mockGetForwardAirJob).not.toHaveBeenCalled();
    });
});
