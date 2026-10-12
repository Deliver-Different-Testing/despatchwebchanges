/**
 * Tests for transformJobGroupDTO / transformJobDTO in dtoMappings.ts
 * Focuses on the new arrival time fields, created date/time string,
 * and the "Ready" combined display string.
 */

import {transformJobGroupDTO} from './dtoMappings';
import {IJobDto, IJobGroupDto} from '../interfaces/job.interface';
import {formatShortDateTime, formatShortDate, formatDateFromApi} from '../react/utils/dateUtils';

/** Builds a minimal IJobDto with sensible defaults. Override as needed. */
function makeJobDto(overrides: Partial<IJobDto> = {}): IJobDto {
    return {
        angularId: 'test-1',
        id: 1,
        rootParentId: undefined,
        hasBeenRead: false,
        van: false,
        jobNo: 'JOB-001',
        speed: 'STD',
        speedName: 'Standard',
        source: '',
        notifiedName: '',
        acceptedName: '',
        notify: '',
        vehicle: {id: 1, text: 'Bike'},
        client: 'TST',
        clientName: 'Test Client',
        from: 'A',
        fromSuburbName: '',
        fromPostCode: '',
        fromAddress: '',
        to: 'B',
        toSuburbName: '',
        toPostCode: '',
        toAddress: '',
        toCity: '',
        courier: '',
        status: 'New',
        statusName: 'New',
        contactName: '',
        loggedInContactName: '',
        deliverToContact: '',
        trackingMobile: '',
        trackingEmail: '',
        udStatus: '',
        podPhoto: new Uint8Array(),
        deliverySignature: new Uint8Array(),
        podPhotos: [],
        podName: '',
        toContactPhone: '',
        speedAccepted: '',
        size: {id: 1, text: 'Small'},
        refA: '',
        refB: '',
        ourRef: '',
        sigNotRequired: '',
        charge: 0,
        date: '2024-06-10',
        booked: '2024-06-10T09:00:00+00:00',
        clientNotes: '',
        internalNotes: '',
        childNotes: '',
        palletInfo: [],
        relatedJobs: [],
        courierData: {courier: '', courierNumber: ''},
        fromContactName: '',
        fromContactNumber: '',
        preBook: false,
        isBulkJob: false,
        runName: '',
        scheduleName: '',
        conNote: '',
        dispatcherName: '',
        pickupAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '',
            addressLine5: '', addressLine6: '', addressLine7: '', addressLine8: '',
            fullAddress: ''
        },
        deliveryAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '',
            addressLine5: '', addressLine6: '', addressLine7: '', addressLine8: '',
            fullAddress: ''
        },
        parcelDimensions: [],
        isActive: true,
        isArchived: false,
        distance: 0,
        holidayDeliveryOption: 0,
        pickUpTimeZone: {id: 1, text: 'Pacific/Auckland'},
        deliveryTimeZone: {id: 2, text: 'Pacific/Auckland'},
        calculateDimsOncePerJob: false,
        tailLiftPu: false,
        tailLiftDo: false,
        deliverToPrivateRes: false,
        isInvoiced: false,
        isFlightAssigned: false,
        isAgentAssigned: false,
        ...overrides,
    } as IJobDto;
}

function makeJobGroupDto(jobOverrides: Partial<IJobDto> = {}): IJobGroupDto {
    return {
        job: makeJobDto(jobOverrides),
        relatedJobs: [],
    };
}

describe('transformJobGroupDTO - Arrival Time Fields', () => {

    describe('pickupArrivalTime', () => {
        it('should convert pickupArrivalTime string to Dayjs', () => {
            const dto = makeJobGroupDto({
                pickupArrivalTime: '2024-06-10T09:15:00+00:00',
            });
            const result = transformJobGroupDTO(dto, false);

            expect(result.job.pickupArrivalTime).toBeDefined();
            expect(result.job.pickupArrivalTime!.isValid()).toBe(true);
        });

        it('should leave pickupArrivalTime undefined when not provided', () => {
            const dto = makeJobGroupDto({pickupArrivalTime: undefined});
            const result = transformJobGroupDTO(dto, false);

            expect(result.job.pickupArrivalTime).toBeUndefined();
        });

        it('should produce _pickupArrivalTimeStr display string', () => {
            const dateStr = '2024-06-10T09:15:00+00:00';
            const dto = makeJobGroupDto({pickupArrivalTime: dateStr});
            const result = transformJobGroupDTO(dto, false);

            const expected = formatShortDateTime(formatDateFromApi(dateStr), false);
            expect(result.job._pickupArrivalTimeStr).toBe(expected);
        });

        it('should leave _pickupArrivalTimeStr undefined when not provided', () => {
            const dto = makeJobGroupDto({pickupArrivalTime: undefined});
            const result = transformJobGroupDTO(dto, false);

            expect(result.job._pickupArrivalTimeStr).toBeUndefined();
        });
    });

    describe('deliveryArrivalTime', () => {
        it('should convert deliveryArrivalTime string to Dayjs', () => {
            const dto = makeJobGroupDto({
                deliveryArrivalTime: '2024-06-10T14:30:00+00:00',
            });
            const result = transformJobGroupDTO(dto, false);

            expect(result.job.deliveryArrivalTime).toBeDefined();
            expect(result.job.deliveryArrivalTime!.isValid()).toBe(true);
        });

        it('should leave deliveryArrivalTime undefined when not provided', () => {
            const dto = makeJobGroupDto({deliveryArrivalTime: undefined});
            const result = transformJobGroupDTO(dto, false);

            expect(result.job.deliveryArrivalTime).toBeUndefined();
        });

        it('should produce _deliveryArrivalTimeStr display string', () => {
            const dateStr = '2024-06-10T14:30:00+00:00';
            const dto = makeJobGroupDto({deliveryArrivalTime: dateStr});
            const result = transformJobGroupDTO(dto, false);

            const expected = formatShortDateTime(formatDateFromApi(dateStr), false);
            expect(result.job._deliveryArrivalTimeStr).toBe(expected);
        });

        it('should leave _deliveryArrivalTimeStr undefined when not provided', () => {
            const dto = makeJobGroupDto({deliveryArrivalTime: undefined});
            const result = transformJobGroupDTO(dto, false);

            expect(result.job._deliveryArrivalTimeStr).toBeUndefined();
        });
    });
});

describe('transformJobGroupDTO - Created Date/Time String', () => {
    it('should produce _createdDateTimeStr with formatShortDateTime', () => {
        const createdStr = '2024-06-10T08:00:00+00:00';
        const dto = makeJobGroupDto({createdDate: createdStr});
        const result = transformJobGroupDTO(dto, false);

        const expected = formatShortDateTime(formatDateFromApi(createdStr), false);
        expect(result.job._createdDateTimeStr).toBe(expected);
    });

    it('should leave _createdDateTimeStr undefined when createdDate is not provided', () => {
        const dto = makeJobGroupDto({createdDate: undefined});
        const result = transformJobGroupDTO(dto, false);

        expect(result.job._createdDateTimeStr).toBeUndefined();
    });

    it('should still produce _createdDateStr (short date only)', () => {
        const createdStr = '2024-06-10T08:00:00+00:00';
        const dto = makeJobGroupDto({createdDate: createdStr});
        const result = transformJobGroupDTO(dto, false);

        const expected = formatShortDate(formatDateFromApi(createdStr), false);
        expect(result.job._createdDateStr).toBe(expected);
    });
});

describe('transformJobGroupDTO - Ready String', () => {
    it('should produce _readyStr from booked date using formatShortDateTime', () => {
        const bookedStr = '2024-06-10T09:00:00+00:00';
        const dto = makeJobGroupDto({booked: bookedStr});
        const result = transformJobGroupDTO(dto, false);

        const expected = formatShortDateTime(formatDateFromApi(bookedStr), false);
        expect(result.job._readyStr).toBe(expected);
    });

    it('should respect isUsCustomer flag for date format', () => {
        const bookedStr = '2024-06-10T09:00:00+00:00';

        const nzResult = transformJobGroupDTO(makeJobGroupDto({booked: bookedStr}), false);
        const usResult = transformJobGroupDTO(makeJobGroupDto({booked: bookedStr}), true);

        // NZ format: DD/MMM HH:mm, US format: MMM\DD HH:mm
        const parsed = formatDateFromApi(bookedStr);
        expect(nzResult.job._readyStr).toBe(formatShortDateTime(parsed, false));
        expect(usResult.job._readyStr).toBe(formatShortDateTime(parsed, true));
        expect(nzResult.job._readyStr).not.toBe(usResult.job._readyStr);
    });
});

describe('transformJobGroupDTO - US vs Non-US Format', () => {
    const dateStr = '2024-06-10T09:15:00+00:00';

    it('should format arrival times differently for US customers', () => {
        const dto = makeJobGroupDto({
            pickupArrivalTime: dateStr,
            deliveryArrivalTime: dateStr,
        });

        const nzResult = transformJobGroupDTO(dto, false);
        const usResult = transformJobGroupDTO({...dto, job: makeJobDto({
            pickupArrivalTime: dateStr,
            deliveryArrivalTime: dateStr,
        })}, true);

        const parsed = formatDateFromApi(dateStr);
        expect(nzResult.job._pickupArrivalTimeStr).toBe(formatShortDateTime(parsed, false));
        expect(usResult.job._pickupArrivalTimeStr).toBe(formatShortDateTime(parsed, true));
    });
});

describe('transformJobGroupDTO - Related Jobs', () => {
    it('should transform arrival times on related jobs too', () => {
        const dto: IJobGroupDto = {
            job: makeJobDto({pickupArrivalTime: '2024-06-10T09:00:00+00:00'}),
            relatedJobs: [
                makeJobDto({
                    id: 2,
                    pickupArrivalTime: '2024-06-10T10:00:00+00:00',
                    deliveryArrivalTime: '2024-06-10T15:00:00+00:00',
                }),
            ],
        };

        const result = transformJobGroupDTO(dto, false);

        expect(result.relatedJobs).toHaveLength(1);
        expect(result.relatedJobs[0].pickupArrivalTime).toBeDefined();
        expect(result.relatedJobs[0].pickupArrivalTime!.isValid()).toBe(true);
        expect(result.relatedJobs[0].deliveryArrivalTime).toBeDefined();
        expect(result.relatedJobs[0]._pickupArrivalTimeStr).toBe(
            formatShortDateTime(formatDateFromApi('2024-06-10T10:00:00+00:00'), false)
        );
        expect(result.relatedJobs[0]._deliveryArrivalTimeStr).toBe(
            formatShortDateTime(formatDateFromApi('2024-06-10T15:00:00+00:00'), false)
        );
    });
});
