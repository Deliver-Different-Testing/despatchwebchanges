import dayjs from 'dayjs';
import type {PrebookListModel} from '../../types';

const createMockAddress = (line1: string, line2: string, full: string) => ({
    addressLine1: line1,
    addressLine2: line2,
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
    addressLine6: '',
    addressLine7: '',
    addressLine8: '',
    fullAddress: full,
});

export const createMockJob = (id: number, client: string = 'Test Client'): PrebookListModel => ({
    id,
    booked: dayjs('2024-01-15T10:30:00'),
    nextDueTime: dayjs('2024-01-16T09:00:00'),
    client,
    jobNo: `JOB${id}`,
    clientId: 100 + id,
    courier: 'John Courier',
    speed: 'Standard',
    customJobName: `Job Name ${id}`,
    pickupAddress: createMockAddress('123 Pickup St', 'Floor 1', '123 Pickup St, London'),
    deliveryAddress: createMockAddress('456 Delivery Ave', 'Suite 200', '456 Delivery Ave, Manchester'),
});
