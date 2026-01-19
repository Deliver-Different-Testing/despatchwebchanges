/**
 * Shared Mock Data Factories
 *
 * Centralized mock data to reduce duplication across test files.
 */

import dayjs from 'dayjs';

/**
 * Address mock data
 */
export function createMockAddress(overrides?: Partial<ReturnType<typeof createMockAddress>>) {
    return {
        addressString: '123 Test Street, Auckland 1010',
        unitNumber: '',
        streetNumber: '123',
        streetName: 'Test Street',
        suburb: 'Auckland Central',
        city: 'Auckland',
        postcode: '1010',
        country: 'New Zealand',
        dpid: 'DPID123',
        longitude: 174.7633,
        latitude: -36.8485,
        ...overrides,
    };
}

/**
 * US Address mock data
 */
export function createMockUSAddress(overrides?: Partial<ReturnType<typeof createMockUSAddress>>) {
    return {
        addressString: '456 Main St, New York, NY 10001',
        unitNumber: 'Apt 5',
        streetNumber: '456',
        streetName: 'Main St',
        suburb: 'Manhattan',
        city: 'New York',
        state: 'NY',
        postcode: '10001',
        country: 'United States',
        dpid: '',
        longitude: -74.006,
        latitude: 40.7128,
        ...overrides,
    };
}

/**
 * Agent mock data
 */
export function createMockAgent(overrides?: Partial<ReturnType<typeof createMockAgent>>) {
    return {
        id: 1,
        text: 'Test Agent',
        name: 'Test Agent Company',
        email: 'agent@test.com',
        phone: '555-0100',
        ...overrides,
    };
}

/**
 * Task mock data
 */
export function createMockTask(overrides?: Partial<ReturnType<typeof createMockTask>>) {
    return {
        id: 1,
        title: 'Test Task',
        description: 'Test description',
        dueDate: dayjs().add(1, 'day').toISOString(),
        isCompleted: false,
        priority: 'medium',
        assignedTo: 'Test User',
        ...overrides,
    };
}

/**
 * Job mock data
 */
export function createMockJob(overrides?: Partial<ReturnType<typeof createMockJob>>) {
    return {
        id: 1,
        jobNo: 'JOB-001',
        status: 'active',
        pickupAddress: '123 Pickup St',
        deliveryAddress: '456 Delivery Ave',
        customerName: 'Test Customer',
        ...overrides,
    };
}

/**
 * Event type mock data
 */
export function createMockEventType(overrides?: Partial<ReturnType<typeof createMockEventType>>) {
    return {
        id: 1,
        name: 'Test Event',
        color: '#FF0000',
        ...overrides,
    };
}

/**
 * Flight segment mock data
 */
export function createMockFlightSegment(overrides?: Partial<ReturnType<typeof createMockFlightSegment>>) {
    return {
        segmentOrder: 0,
        departureAirportFsCode: 'AKL',
        departureAirportName: 'Auckland Airport',
        departureAirportCity: 'Auckland',
        departureAirportId: 1,
        departureAirportTimeZone: 'Pacific/Auckland',
        arrivalAirportFsCode: 'SYD',
        arrivalAirportName: 'Sydney Airport',
        arrivalAirportCity: 'Sydney',
        arrivalAirportId: 2,
        arrivalAirportTimeZone: 'Australia/Sydney',
        departureTime: dayjs('2024-03-15T08:00:00'),
        arrivalTime: dayjs('2024-03-15T10:30:00'),
        carrierFsCode: 'NZ',
        flightNumber: '123',
        airlineName: 'Air New Zealand',
        ...overrides,
    };
}

/**
 * Flight mock data
 */
export function createMockFlight(overrides?: Partial<ReturnType<typeof createMockFlight>>) {
    return {
        flightNumber: 'NZ123',
        departureTime: dayjs('2024-03-15T08:00:00'),
        arrivalTime: dayjs('2024-03-15T10:30:00'),
        departureTimeZone: 'Pacific/Auckland',
        arrivalTimeZone: 'Australia/Sydney',
        flightSegments: [createMockFlightSegment()],
        ...overrides,
    };
}

/**
 * Cargo processing mock data
 */
export function createMockCargoProcessing(overrides?: Partial<ReturnType<typeof createMockCargoProcessing>>) {
    return {
        arrivalTime: dayjs('2024-03-15T10:30:00'),
        processingTimeMins: 90,
        cargoOpeningTime: dayjs('2024-03-15T06:00:00'),
        cargoClosingTime: dayjs('2024-03-15T22:00:00'),
        deliverByTime: dayjs('2024-03-15T18:00:00'),
        ...overrides,
    };
}

/**
 * Recurring job mock data
 */
export function createMockRecurringJob(overrides?: Partial<ReturnType<typeof createMockRecurringJob>>) {
    return {
        id: 1,
        name: 'Daily Pickup',
        frequency: 'daily',
        nextRun: dayjs().add(1, 'day').toISOString(),
        isActive: true,
        ...overrides,
    };
}

/**
 * Create array of mock items
 */
export function createMockArray<T>(
    factory: (index: number) => T,
    count: number
): T[] {
    return Array.from({ length: count }, (_, i) => factory(i));
}
