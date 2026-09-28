/** @jest-environment jest-environment-jsdom */
import './nationwide.controller.test-setup';
import {ControllerClass, createController, makeFlightJob, setupWindowMocks} from './nationwide.controller.test-helpers';
import dayjs from 'dayjs';

setupWindowMocks();

describe('loadFlights', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadFlights = ControllerClass.prototype.loadFlights;
        ctrl.updateUIState = jest.fn();
        return ctrl;
    }

    it('sets message and returns when no currentJob', async () => {
        const ctrl = setup({currentJob: undefined});
        await ctrl.loadFlights();
        expect(ctrl.flightMessage).toContain('select a job');
    });

    it('returns early when flight already assigned', async () => {
        const ctrl = setup({currentJob: makeFlightJob(1, {assignedFlight: {flightNumber: 'NZ1'}})});
        await ctrl.loadFlights();
        expect(ctrl.nationwideService.getFlightOptions).not.toHaveBeenCalled();
    });

    it('returns early when already loading (debounce)', async () => {
        const ctrl = setup({currentJob: makeFlightJob(1), flightsLoading: true});
        await ctrl.loadFlights();
        expect(ctrl.nationwideService.getFlightOptions).not.toHaveBeenCalled();
    });

    it('sets message when airports not selected', async () => {
        const ctrl = setup({
            currentJob: makeFlightJob(1),
            selectedOutboundAirport: undefined,
            selectedInboundAirport: {id: 1, text: 'WLG'},
        });
        await ctrl.loadFlights();
        expect(ctrl.flightMessage).toContain('select both');
    });

    it('calls service and sets results on success', async () => {
        const flights = [{flightNumber: 'NZ1'}, {flightNumber: 'NZ2'}];
        const ctrl = setup({
            currentJob: makeFlightJob(1),
            selectedOutboundAirport: {id: 10},
            selectedInboundAirport: {id: 20},
        });
        ctrl.nationwideService.getFlightOptions.mockResolvedValue({
            flights, message: undefined, lastDepartureTime: dayjs('2026-01-01'),
        });

        await ctrl.loadFlights();

        expect(ctrl.flightOptions).toBe(flights);
        expect(ctrl.filteredFlightOptions).toBe(flights);
        expect(ctrl.flightsLoading).toBe(false);
    });

    it('sets error message with server detail on failure', async () => {
        const ctrl = setup({
            currentJob: makeFlightJob(1),
            selectedOutboundAirport: {id: 10},
            selectedInboundAirport: {id: 20},
        });
        ctrl.nationwideService.getFlightOptions.mockRejectedValue({data: 'Bad airport code'});

        await ctrl.loadFlights();

        expect(ctrl.flightMessage).toContain('Bad airport code');
        expect(ctrl.flightOptions).toEqual([]);
        expect(ctrl.flightsLoading).toBe(false);
    });

    it('sets "no flights" message when result is empty', async () => {
        const ctrl = setup({
            currentJob: makeFlightJob(1),
            selectedOutboundAirport: {id: 10},
            selectedInboundAirport: {id: 20},
        });
        ctrl.nationwideService.getFlightOptions.mockResolvedValue({flights: [], message: undefined});

        await ctrl.loadFlights();

        expect(ctrl.flightMessage).toContain('No flights available');
    });
});

describe('loadNextDayFlights', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.loadNextDayFlights = ControllerClass.prototype.loadNextDayFlights;
        return ctrl;
    }

    it('shows warning when no currentJob', async () => {
        const ctrl = setup({currentJob: undefined});
        await ctrl.loadNextDayFlights();
        expect(ctrl.toastrService.showWarningToast).toHaveBeenCalled();
    });

    it('advances lastDepartureTime by 1 day', async () => {
        const mockTime = {add: jest.fn().mockReturnValue({startOf: jest.fn().mockReturnValue('nextDay')})};
        const ctrl = setup({currentJob: makeFlightJob(1), lastDepartureTime: mockTime});
        await ctrl.loadNextDayFlights();
        expect(mockTime.add).toHaveBeenCalledWith(1, 'day');
        expect(ctrl.loadFlights).toHaveBeenCalled();
    });

    it('uses currentJob.booked when no lastDepartureTime', async () => {
        const mockBooked = {add: jest.fn().mockReturnValue({startOf: jest.fn().mockReturnValue('nextDay')})};
        const ctrl = setup({currentJob: makeFlightJob(1, {booked: mockBooked}), lastDepartureTime: undefined});
        await ctrl.loadNextDayFlights();
        expect(mockBooked.add).toHaveBeenCalledWith(1, 'day');
    });
});

describe('filterFlights', () => {
    function setup(overrides = {}) {
        const ctrl = createController(overrides);
        ctrl.filterFlights = ControllerClass.prototype.filterFlights;
        return ctrl;
    }

    it('returns empty when flightOptions is null', () => {
        const ctrl = setup({flightOptions: null});
        ctrl.filterFlights();
        expect(ctrl.filteredFlightOptions).toEqual([]);
    });

    it('returns all flights when search text empty', () => {
        const flights = [{flightNumber: 'NZ1'}, {flightNumber: 'QF2'}];
        const ctrl = setup({flightOptions: flights, flightSearchText: ''});
        ctrl.filterFlights();
        expect(ctrl.filteredFlightOptions).toBe(flights);
    });

    it('filters by flightNumber case-insensitively', () => {
        const flights = [
            {flightNumber: 'NZ123', airline: 'Air NZ', departureAirport: 'AKL', arrivalAirport: 'SYD', aircraft: 'A320'},
            {flightNumber: 'QF456', airline: 'Qantas', departureAirport: 'SYD', arrivalAirport: 'MEL', aircraft: 'B737'},
        ];
        const ctrl = setup({flightOptions: flights, flightSearchText: 'nz'});
        ctrl.filterFlights();
        expect(ctrl.filteredFlightOptions).toHaveLength(1);
        expect(ctrl.filteredFlightOptions[0].flightNumber).toBe('NZ123');
    });

    it('filters by airline', () => {
        const flights = [
            {flightNumber: 'NZ1', airline: 'Air New Zealand', departureAirport: '', arrivalAirport: '', aircraft: ''},
            {flightNumber: 'QF2', airline: 'Qantas', departureAirport: '', arrivalAirport: '', aircraft: ''},
        ];
        const ctrl = setup({flightOptions: flights, flightSearchText: 'qantas'});
        ctrl.filterFlights();
        expect(ctrl.filteredFlightOptions).toHaveLength(1);
    });

    it('trims whitespace in search text', () => {
        const flights = [{flightNumber: 'NZ1', airline: '', departureAirport: '', arrivalAirport: '', aircraft: ''}];
        const ctrl = setup({flightOptions: flights, flightSearchText: '  NZ  '});
        ctrl.filterFlights();
        expect(ctrl.filteredFlightOptions).toHaveLength(1);
    });
});

describe('getFlightIcon', () => {
    function setup() {
        const ctrl = createController();
        ctrl.getFlightIcon = ControllerClass.prototype.getFlightIcon;
        return ctrl;
    }

    it('returns "flight" for flight job', () => {
        expect(setup().getFlightIcon({isFlightJob: true})).toBe('flight');
    });

    it('returns "flight_takeoff" for toAirport-only agent job', () => {
        expect(setup().getFlightIcon({isFlightJob: false, isAgentJob: true, toAirportId: 1, fromAirportId: undefined})).toBe('flight_takeoff');
    });

    it('returns "flight_land" for fromAirport-only agent job', () => {
        expect(setup().getFlightIcon({isFlightJob: false, isAgentJob: true, toAirportId: undefined, fromAirportId: 1})).toBe('flight_land');
    });

    it('returns empty string for non-flight non-agent job', () => {
        expect(setup().getFlightIcon({isFlightJob: false, isAgentJob: false})).toBe('');
    });
});

describe('formatAirportCodeForDropdown', () => {
    function setup() {
        const ctrl = createController();
        ctrl.formatAirportCodeForDropdown = ControllerClass.prototype.formatAirportCodeForDropdown;
        return ctrl;
    }

    it('returns empty for falsy', () => {
        expect(setup().formatAirportCodeForDropdown('')).toBe('');
        expect(setup().formatAirportCodeForDropdown(undefined)).toBe('');
    });

    it('returns full text when no space', () => {
        expect(setup().formatAirportCodeForDropdown('AKL')).toBe('AKL');
    });

    it('truncates at first space (inclusive)', () => {
        expect(setup().formatAirportCodeForDropdown('AKL Auckland International')).toBe('AKL ');
    });
});

describe('getConnectionTime', () => {
    function setup() {
        const ctrl = createController();
        ctrl.getConnectionTime = ControllerClass.prototype.getConnectionTime;
        return ctrl;
    }

    it('returns empty for null segments', () => {
        expect(setup().getConnectionTime(null, null)).toBe('');
        expect(setup().getConnectionTime({arrivalTime: dayjs()}, null)).toBe('');
    });

    it('formats hours and minutes', () => {
        const first = {arrivalTime: dayjs('2026-01-01T10:00')};
        const second = {departureTime: dayjs('2026-01-01T12:30')};
        expect(setup().getConnectionTime(first, second)).toBe('2h 30m');
    });

    it('formats minutes only', () => {
        const first = {arrivalTime: dayjs('2026-01-01T10:00')};
        const second = {departureTime: dayjs('2026-01-01T10:45')};
        expect(setup().getConnectionTime(first, second)).toBe('45m');
    });

    it('zero-pads minutes less than 10', () => {
        const first = {arrivalTime: dayjs('2026-01-01T10:00')};
        const second = {departureTime: dayjs('2026-01-01T11:05')};
        expect(setup().getConnectionTime(first, second)).toBe('1h 05m');
    });
});

describe('formatMinutesToTimeReact', () => {
    function setup() {
        const ctrl = createController();
        ctrl.formatMinutesToTimeReact = ControllerClass.prototype.formatMinutesToTimeReact;
        return ctrl;
    }

    it('formats hours and minutes', () => {
        expect(setup().formatMinutesToTimeReact(150)).toBe('2h 30m');
    });

    it('formats minutes only', () => {
        expect(setup().formatMinutesToTimeReact(45)).toBe('45m');
    });

    it('zero-pads minutes < 10', () => {
        expect(setup().formatMinutesToTimeReact(65)).toBe('1h 05m');
    });
});
