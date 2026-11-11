import type {IOpenJobResponse} from './OpenJobsList.types';

export function createMockOpenJob(overrides: Partial<IOpenJobResponse> = {}): IOpenJobResponse {
    return {
        jobId: 1,
        reference: 'JOB-001',
        status: 'New',
        pickupTime: '2024-01-15T10:00:00',
        pickupName: 'Warehouse A',
        pickupAddress: '123 Main St',
        deliveryTime: '2024-01-15T14:00:00',
        deliveryName: 'Office B',
        deliveryAddress: '456 High St',
        driverName: 'John Smith',
        completedToday: 5,
        lastCompleted: '13:00',
        quantity: 2,
        packageType: 'Parcel',
        mileage: 15,
        _pickUpTimeStr: '15 Jan 2024 10:00',
        _deliveryTimeStr: '15 Jan 2024 14:00',
        ...overrides,
    };
}
