/**
 * Shared mock data factories for Job Details tests
 */

import type {IJob, IAddressViewModel, ICourierData, IAgent, IAssignedFlight, IPalletInfo, IReadTrackerInfo, ISuggestion} from '../../../../../../app/interfaces/job.interface';
import dayjs from 'dayjs';

export function createMockAddress(overrides?: Partial<IAddressViewModel>): IAddressViewModel {
    return {
        addressLine1: '123 Test St',
        addressLine2: 'Suite 1',
        addressLine3: 'Testville',
        addressLine4: 'TST 1234',
        addressLine5: '',
        addressLine6: '',
        addressLine7: '',
        addressLine8: '',
        fullAddress: '123 Test St, Testville TST 1234',
        ...overrides,
    };
}

export function createMockCourierData(overrides?: Partial<ICourierData>): ICourierData {
    return {
        courier: 'C001',
        courierNumber: 'C001',
        courierName: 'Test Courier',
        courierMobile: '021 555 1234',
        ...overrides,
    };
}

export function createMockAgent(overrides?: Partial<IAgent>): IAgent {
    return {
        agentId: 1,
        agentName: 'Test Agent',
        agentRate: 50.00,
        agentRanking: 'A',
        agentNotes: 'Reliable agent',
        agentPhone: '09 555 6789',
        agentEmail: 'agent@test.com',
        ...overrides,
    };
}

export function createMockFlight(overrides?: Partial<IAssignedFlight>): IAssignedFlight {
    return {
        flightNumber: 'NZ123',
        expectedDeparture: dayjs('2026-03-23T10:00:00'),
        departureTimeZone: 'Pacific/Auckland',
        expectedArrival: dayjs('2026-03-23T14:00:00'),
        arrivalTimeZone: 'Australia/Sydney',
        notes: 'Direct flight',
        flightSegments: [
            {
                flightNumber: 'NZ123',
                departureAirportFsCode: 'AKL',
                arrivalAirportFsCode: 'SYD',
                departureTime: dayjs('2026-03-23T10:00:00'),
                arrivalTime: dayjs('2026-03-23T14:00:00'),
                _departureTimeStr: '10:00',
                _arrivalTimeStr: '14:00',
                _departureTimeZoneStr: 'NZDT',
                _arrivalTimeZoneStr: 'AEDT',
            } as any,
        ],
        ...overrides,
    };
}

export function createMockPallet(overrides?: Partial<IPalletInfo>): IPalletInfo {
    return {
        id: 1,
        quantity: 2,
        weight: 25,
        length: 120,
        depth: 80,
        height: 100,
        cubic: 0,
        pu: true,
        do: false,
        notes: 'Fragile',
        itemId: 1001,
        ...overrides,
    };
}

export function createMockReadTracker(overrides?: Partial<IReadTrackerInfo>): IReadTrackerInfo {
    return {
        hasBeenRead: false,
        readBy: '',
        readDate: undefined,
        ...overrides,
    };
}

export function createMockSuggestion(overrides?: Partial<ISuggestion>): ISuggestion {
    return {
        id: 1,
        text: 'Test',
        ...overrides,
    };
}

export function createMockJob(overrides?: Partial<IJob>): IJob {
    return {
        angularId: 'job-1',
        id: 1001,
        hasBeenRead: false,
        jobNo: 'J-1001',
        speed: 'Standard',
        speedName: 'Standard',
        source: 'Web',
        notifiedName: '',
        acceptedName: '',
        notify: '',
        vehicle: {id: 1, text: 'Car'},
        client: 'Test Client',
        clientName: 'Test Client Ltd',
        from: 'Auckland',
        fromSuburbName: 'CBD',
        fromPostCode: '1010',
        fromAddress: '123 Queen St',
        to: 'Wellington',
        toSuburbName: 'CBD',
        toPostCode: '6011',
        toAddress: '456 Lambton Quay',
        toCity: 'Wellington',
        courier: 'C001',
        status: 'Dispatched',
        statusName: 'Dispatched',
        contactName: 'John Doe',
        loggedInContactName: 'Jane Admin',
        deliverToContact: 'Bob Smith',
        trackingMobile: '021 555 0000',
        trackingEmail: 'track@test.com',
        udStatus: '',
        podPhoto: new Uint8Array(),
        deliverySignature: new Uint8Array(),
        podPhotos: [],
        podName: 'Bob Smith',
        toContactPhone: '04 555 1234',
        speedAccepted: 'Standard',
        size: {id: 2, text: 'Small'},
        refA: 'REF-A-001',
        refB: 'REF-B-001',
        ourRef: 'OUR-001',
        sigNotRequired: 'false',
        charge: 45.50,
        date: '2026-03-23',
        booked: dayjs('2026-03-23T09:00:00'),
        clientNotes: 'Handle with care',
        internalNotes: 'Priority customer',
        childNotes: '',
        palletInfo: [],
        relatedJobs: [],
        courierData: createMockCourierData(),
        parcelDimensions: [],
        isActive: true,
        isArchived: false,
        isFlightJob: false,
        preBook: false,
        isBulkJob: false,
        van: false,
        runName: '',
        scheduleName: '',
        conNote: 'CN-001',
        dispatcherName: 'Dispatcher A',
        pickupAddress: createMockAddress(),
        deliveryAddress: createMockAddress({
            addressLine1: '456 Delivery Rd',
            addressLine3: 'Deliverytown',
            fullAddress: '456 Delivery Rd, Deliverytown DLV 5678',
        }),
        distance: 12.5,
        isFlightAssigned: false,
        isAgentAssigned: false,
        pickUpTimeZone: {id: 1, text: 'Pacific/Auckland'},
        deliveryTimeZone: {id: 1, text: 'Pacific/Auckland'},
        holidayDeliveryOption: 0,
        calculateDimsOncePerJob: false,
        tailLiftPu: false,
        tailLiftDo: false,
        deliverToPrivateRes: false,
        deliverToPrivateResString: 'No',
        fromContactName: 'John Sender',
        fromContactNumber: '09 555 0001',
        isInvoiced: false,
        readTrackerInfo: createMockReadTracker(),

        // Pre-formatted display strings
        _createdDateTimeStr: '23/03/2026 09:00',
        _readyStr: '23/03/2026 09:00',
        _puTimeStr: '09:30',
        _dispatchTimeStr: '09:15',
        _deliverByTimeStr: '12:00',
        _completedTimeStr: '11:45',
        _followupTimeStr: '',
        _pickUpTimeZoneStr: 'NZDT',
        _deliveryTimeZoneStr: 'NZDT',
        ...overrides,
    } as IJob;
}
