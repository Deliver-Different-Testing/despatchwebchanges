/**
 * Shared Mock Data Factories
 *
 * Centralized mock data to reduce duplication across test files.
 * Factories import actual source types to catch interface mismatches at compile time.
 */

import dayjs from 'dayjs';
import type { AddressViewModel } from '../interfaces/address';
import type { AgentInfo } from '../interfaces/agent';
import type { EventType, AddEventJob } from '../interfaces/event';
import Task, {TaskAssignee} from '../interfaces/tasks';
import type { PrebookListModel } from '../interfaces/recurringJobs';
import type {
    FlightSegment,
    FlightViewModel,
    FlightCargoProcessing,
} from '../components/dialogs/flight-agent-confirmation-dialog/types';

/**
 * Address mock data (NZ format)
 */
export function createMockAddress(overrides?: Partial<AddressViewModel>): AddressViewModel {
    return {
        addressLine1: '',                        // Company/Building
        addressLine2: '',                        // Unit/Suite
        addressLine3: '123',                     // Street Number
        addressLine4: 'Test Street',             // Street Name
        addressLine5: 'Auckland Central',        // Suburb
        addressLine6: 'Auckland',                // City
        addressLine7: '1010',                    // Post Code
        addressLine8: '',                        // Additional Notes
        fullAddress: '123 Test Street, Auckland Central, Auckland 1010',
        latitude: -36.8485,
        longitude: 174.7633,
        ...overrides,
    };
}

/**
 * US Address mock data
 */
export function createMockUSAddress(overrides?: Partial<AddressViewModel>): AddressViewModel {
    return {
        addressLine1: '',                        // Company/Building
        addressLine2: 'Apt 5',                   // Unit/Suite
        addressLine3: '456',                     // Street Number
        addressLine4: 'Main St',                 // Street Name
        addressLine5: 'New York',                // City (US)
        addressLine6: 'NY',                      // State (US)
        addressLine7: '10001',                   // ZIP Code
        addressLine8: '',                        // Additional Notes
        fullAddress: '456 Main St, New York, NY 10001',
        latitude: 40.7128,
        longitude: -74.006,
        ...overrides,
    };
}

/**
 * Agent mock data
 */
export function createMockAgent(overrides?: Partial<AgentInfo>): AgentInfo {
    return {
        agentId: 1,
        agentName: 'Test Agent Company',
        agentRate: 50,
        agentRanking: 'A',
        agentNotes: '',
        agentPhone: '555-0100',
        agentEmail: 'agent@test.com',
        ...overrides,
    };
}

/**
 * Task assignee mock data
 */
export function createMockTaskAssignee(overrides?: Partial<TaskAssignee>): TaskAssignee {
    return {
        id: 1,
        text: 'Test User',
        ...overrides,
    };
}

/**
 * Task mock data
 */
export function createMockTask(overrides?: Partial<Task>): Task {
    return {
        id: 1,
        title: 'Test Task',
        description: 'Test description',
        dueDate: dayjs().add(1, 'day'),
        closed: false,
        assignee: createMockTaskAssignee(),
        jobId: 100,
        eventType: 'Follow Up',
        jobNumber: 'JOB-001',
        priority: 'medium',
        ...overrides,
    };
}

/**
 * Job mock data (simplified — use for AddEventDialog and similar)
 */
export function createMockJob(overrides?: Partial<AddEventJob>): AddEventJob {
    return {
        id: 1,
        jobNo: 'JOB-001',
        client: 'Test Customer',
        ...overrides,
    };
}

/**
 * Event type mock data
 */
export function createMockEventType(overrides?: Partial<EventType>): EventType {
    return {
        id: 1,
        text: 'Follow Up',
        ...overrides,
    };
}

/**
 * Flight segment mock data
 */
export function createMockFlightSegment(overrides?: Partial<FlightSegment>): FlightSegment {
    return {
        segmentOrder: 0,
        departureAirportFsCode: 'AKL',
        departureAirportName: 'Auckland Airport',
        departureAirportCity: 'Auckland',
        departureAirportTimeZone: 'Pacific/Auckland',
        arrivalAirportFsCode: 'SYD',
        arrivalAirportName: 'Sydney Airport',
        arrivalAirportCity: 'Sydney',
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
export function createMockFlight(overrides?: Partial<FlightViewModel>): FlightViewModel {
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
export function createMockCargoProcessing(overrides?: Partial<FlightCargoProcessing>): FlightCargoProcessing {
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
export function createMockRecurringJob(overrides?: Partial<PrebookListModel>): PrebookListModel {
    return {
        id: 1,
        booked: dayjs('2024-01-15'),
        nextDueTime: dayjs(Date.now() + 86400000),
        client: 'Test Client',
        jobNo: 'RJ-001',
        clientId: 1,
        courier: 'Test Courier',
        speed: 'Standard',
        customJobName: 'Daily Pickup',
        pickupAddress: createMockAddress(),
        deliveryAddress: createMockAddress({
            addressLine3: '456',
            addressLine4: 'Delivery Ave',
            fullAddress: '456 Delivery Ave, Auckland Central, Auckland 1010',
        }),
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
