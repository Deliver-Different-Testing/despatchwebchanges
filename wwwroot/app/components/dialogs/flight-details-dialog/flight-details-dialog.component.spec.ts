/**
 * Tests for FlightDetailsDialogController
 * Tests pseudo-segment creation for non-segmented flights
 */

import FlightDetailsDialogController from './flight-details-dialog.component';
import dayjs from 'dayjs';
import { IFlightViewModel, IFlightSegment } from '../../Nationwide/nationwide.interfaces';

// Mock the getIanaTimezone function
jest.mock('../../../functions/formatDates', () => ({
    getIanaTimezone: jest.fn().mockReturnValue('Pacific/Auckland')
}));

// Mock TimeZone global
(global as any).TimeZone = 'Pacific/Auckland';

describe('FlightDetailsDialogController', () => {
    // Helper to create a mock flight view model
    const createMockFlightViewModel = (overrides: Partial<IFlightViewModel> = {}): IFlightViewModel => ({
        airline: 'Test Airline',
        flightNumber: 'NZ123',
        departureTime: dayjs('2024-01-15T10:00:00'),
        arrivalTime: dayjs('2024-01-15T14:00:00'),
        departureAirport: 'AKL',
        arrivalAirport: 'SYD',
        duration: '4:00:00',
        stops: 0,
        aircraft: 'Boeing 787',
        serviceClasses: ['Economy', 'Business'],
        isCodeShare: false,
        amount: 500,
        codeShareAirline: '',
        airlineId: 1,
        departureTimeZone: 'Pacific/Auckland',
        arrivalTimeZone: 'Australia/Sydney',
        isMultiSegment: false,
        elapsedTime: 240,
        score: 95,
        connectionId: 'conn-123',
        flightSegments: [],
        _departureTimeStr: '10:00 AM',
        _arrivalTimeStr: '2:00 PM',
        _arrivalTimeZoneStr: 'AEDT',
        _departureTimeZoneStr: 'NZDT',
        ...overrides
    });

    // Helper to create a mock flight segment
    const createMockFlightSegment = (overrides: Partial<IFlightSegment> = {}): IFlightSegment => ({
        segmentOrder: 1,
        carrierFsCode: 'NZ',
        flightNumber: '123',
        departureTime: dayjs('2024-01-15T10:00:00'),
        arrivalTime: dayjs('2024-01-15T14:00:00'),
        departureAirportFsCode: 'AKL',
        arrivalAirportFsCode: 'SYD',
        departureAirportTimeZone: 'Pacific/Auckland',
        arrivalAirportTimeZone: 'Australia/Sydney',
        flightEquipmentIataCode: '787',
        elapsedTime: 240,
        stopsInSegment: 0,
        _departureTimeStr: '10:00 AM',
        _arrivalTimeStr: '2:00 PM',
        _arrivalTimeZoneStr: 'AEDT',
        _departureTimeZoneStr: 'NZDT',
        ...overrides
    });

    describe('Constructor - Pseudo-segment Creation', () => {
        it('should use first flight segment for multi-segment flights', () => {
            // Arrange
            const segment1 = createMockFlightSegment({ segmentOrder: 1 });
            const segment2 = createMockFlightSegment({ segmentOrder: 2 });
            const flight = createMockFlightViewModel({
                isMultiSegment: true,
                flightSegments: [segment1, segment2]
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Assert
            expect(controller.currentSegment).toBe(segment1);
        });

        it('should create pseudo-segment with all required properties for non-segmented flights', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                flightNumber: 'NZ456',
                departureTime: dayjs('2024-01-15T10:00:00'),
                arrivalTime: dayjs('2024-01-15T14:00:00'),
                departureAirport: 'AKL',
                arrivalAirport: 'SYD',
                departureTimeZone: 'Pacific/Auckland',
                arrivalTimeZone: 'Australia/Sydney',
                elapsedTime: 240,
                _departureTimeStr: '10:00 AM',
                _arrivalTimeStr: '2:00 PM',
                _departureTimeZoneStr: 'NZDT',
                _arrivalTimeZoneStr: 'AEDT'
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert - All required IFlightSegment properties should be present
            expect(segment.segmentOrder).toBe(0);
            expect(segment.carrierFsCode).toBe('NZ'); // First 2 chars of NZ456
            expect(segment.flightNumber).toBe('456'); // Rest of NZ456
            expect(segment.departureTime).toEqual(flight.departureTime);
            expect(segment.arrivalTime).toEqual(flight.arrivalTime);
            expect(segment.departureAirportFsCode).toBe('AKL');
            expect(segment.arrivalAirportFsCode).toBe('SYD');
            expect(segment.flightEquipmentIataCode).toBe('');
            expect(segment.elapsedTime).toBe(240);
            expect(segment.stopsInSegment).toBe(0);
        });

        it('should include timezone properties in pseudo-segment', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                departureTimeZone: 'Pacific/Auckland',
                arrivalTimeZone: 'Australia/Sydney'
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert - Timezone properties must be present (these were the missing properties)
            expect(segment.departureAirportTimeZone).toBe('Pacific/Auckland');
            expect(segment.arrivalAirportTimeZone).toBe('Australia/Sydney');
        });

        it('should include private string properties in pseudo-segment', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                _departureTimeStr: '10:00 AM',
                _arrivalTimeStr: '2:00 PM',
                _departureTimeZoneStr: 'NZDT',
                _arrivalTimeZoneStr: 'AEDT'
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert - Private string properties must be present (these were the missing properties)
            expect(segment._departureTimeStr).toBe('10:00 AM');
            expect(segment._arrivalTimeStr).toBe('2:00 PM');
            expect(segment._departureTimeZoneStr).toBe('NZDT');
            expect(segment._arrivalTimeZoneStr).toBe('AEDT');
        });

        it('should handle empty flight number gracefully', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                flightNumber: ''
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert
            expect(segment.carrierFsCode).toBe('');
            expect(segment.flightNumber).toBe('');
        });

        it('should handle short flight number', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                flightNumber: 'A'
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert - substring(0, 2) on 'A' returns 'A', substring(2) returns ''
            expect(segment.carrierFsCode).toBe('A');
            expect(segment.flightNumber).toBe('');
        });

        it('should handle null elapsedTime', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                elapsedTime: null as any
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert - Should default to 0
            expect(segment.elapsedTime).toBe(0);
        });

        it('should handle undefined elapsedTime', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                isMultiSegment: false,
                elapsedTime: undefined as any
            });

            // Act
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);
            const segment = controller.currentSegment;

            // Assert - Should default to 0
            expect(segment.elapsedTime).toBe(0);
        });
    });

    describe('selectSegment', () => {
        it('should set isDisplayingOverview to true when selecting index 0', () => {
            // Arrange
            const segment = createMockFlightSegment();
            const flight = createMockFlightViewModel({
                isMultiSegment: true,
                flightSegments: [segment]
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            controller.selectSegment(0);

            // Assert
            expect(controller.isDisplayingOverview).toBe(true);
            expect(controller.selectedTabIndex).toBe(0);
        });

        it('should set isDisplayingOverview to false when selecting non-zero index', () => {
            // Arrange
            const segment1 = createMockFlightSegment({ segmentOrder: 1 });
            const segment2 = createMockFlightSegment({ segmentOrder: 2 });
            const flight = createMockFlightViewModel({
                isMultiSegment: true,
                flightSegments: [segment1, segment2]
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            controller.selectSegment(1);

            // Assert
            expect(controller.isDisplayingOverview).toBe(false);
            expect(controller.selectedTabIndex).toBe(1);
        });

        it('should update currentSegment when selecting a segment', () => {
            // Arrange
            const segment1 = createMockFlightSegment({ segmentOrder: 1, carrierFsCode: 'NZ' });
            const segment2 = createMockFlightSegment({ segmentOrder: 2, carrierFsCode: 'QF' });
            const flight = createMockFlightViewModel({
                isMultiSegment: true,
                flightSegments: [segment1, segment2]
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            controller.selectSegment(2); // Tab 2 = segment index 1

            // Assert
            expect(controller.currentSegment.carrierFsCode).toBe('QF');
        });
    });

    describe('getFlightTotalDuration', () => {
        it('should format elapsed time in hours and minutes', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                elapsedTime: 145 // 2 hours 25 minutes
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            const duration = controller.getFlightTotalDuration();

            // Assert
            expect(duration).toBe('2h 25m');
        });

        it('should pad single digit minutes with zero', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                elapsedTime: 65 // 1 hour 5 minutes
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            const duration = controller.getFlightTotalDuration();

            // Assert
            expect(duration).toBe('1h 05m');
        });

        it('should return N/A when no duration available', () => {
            // Arrange
            const flight = createMockFlightViewModel({
                elapsedTime: null as any,
                duration: '' as any
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            const duration = controller.getFlightTotalDuration();

            // Assert
            expect(duration).toBe('N/A');
        });
    });

    describe('getConnectionTime', () => {
        it('should calculate connection time between segments', () => {
            // Arrange
            const segment1 = createMockFlightSegment({
                arrivalTime: dayjs('2024-01-15T14:00:00')
            });
            const segment2 = createMockFlightSegment({
                departureTime: dayjs('2024-01-15T16:30:00')
            });
            const flight = createMockFlightViewModel({
                isMultiSegment: true,
                flightSegments: [segment1, segment2]
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            const connectionTime = controller.getConnectionTime(segment1, segment2);

            // Assert - 2.5 hours difference
            expect(connectionTime).toBe('2h 30m');
        });

        it('should return short format for less than an hour', () => {
            // Arrange
            const segment1 = createMockFlightSegment({
                arrivalTime: dayjs('2024-01-15T14:00:00')
            });
            const segment2 = createMockFlightSegment({
                departureTime: dayjs('2024-01-15T14:45:00')
            });
            const flight = createMockFlightViewModel({
                isMultiSegment: true,
                flightSegments: [segment1, segment2]
            });
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            const connectionTime = controller.getConnectionTime(segment1, segment2);

            // Assert - 45 minutes
            expect(connectionTime).toBe('45m');
        });

        it('should return empty string for null segments', () => {
            // Arrange
            const flight = createMockFlightViewModel();
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            const connectionTime = controller.getConnectionTime(null as any, null as any);

            // Assert
            expect(connectionTime).toBe('');
        });
    });

    describe('cancel', () => {
        it('should call mdDialog.cancel', () => {
            // Arrange
            const flight = createMockFlightViewModel();
            const mockMdDialog = { cancel: jest.fn() } as any;
            const controller = new FlightDetailsDialogController(mockMdDialog, flight);

            // Act
            controller.cancel();

            // Assert
            expect(mockMdDialog.cancel).toHaveBeenCalled();
        });
    });
});

describe('IFlightSegment Interface Compliance', () => {
    it('should define all required properties', () => {
        // This test documents the required properties of IFlightSegment
        const requiredProperties = [
            'segmentOrder',
            'carrierFsCode',
            'flightNumber',
            'departureTime',
            'arrivalTime',
            'departureAirportFsCode',
            'arrivalAirportFsCode',
            'departureAirportTimeZone',
            'arrivalAirportTimeZone',
            'flightEquipmentIataCode',
            'elapsedTime',
            'stopsInSegment',
            '_departureTimeStr',
            '_arrivalTimeStr',
            '_departureTimeZoneStr',
            '_arrivalTimeZoneStr'
        ];

        // Create a compliant segment
        const segment: IFlightSegment = {
            segmentOrder: 0,
            carrierFsCode: 'NZ',
            flightNumber: '123',
            departureTime: dayjs(),
            arrivalTime: dayjs(),
            departureAirportFsCode: 'AKL',
            arrivalAirportFsCode: 'SYD',
            departureAirportTimeZone: 'Pacific/Auckland',
            arrivalAirportTimeZone: 'Australia/Sydney',
            flightEquipmentIataCode: '787',
            elapsedTime: 240,
            stopsInSegment: 0,
            _departureTimeStr: '10:00',
            _arrivalTimeStr: '14:00',
            _departureTimeZoneStr: 'NZDT',
            _arrivalTimeZoneStr: 'AEDT'
        };

        // Assert all required properties exist
        requiredProperties.forEach(prop => {
            expect(segment).toHaveProperty(prop);
        });
    });
});
