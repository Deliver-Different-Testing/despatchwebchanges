export enum MessageDirection
{
    StaffToCourier = 1,
    CourierToStaff = 2
}

export enum QuickResponseType {
    OnMyWay = 'On my way!',
    DeliveredSuccessfully = 'Delivered successfully',
    UnableToDeliver = 'Unable to deliver - will retry',
    CustomerNotAvailable = 'Customer not available',
    NeedAssistance = 'Need assistance',
    ETA5Minutes = 'ETA 5 minutes',
    PackageLeftAtDoor = 'Package left at door',
    DeliveryComplete = 'Delivery complete',
    AddressIssue = 'Having trouble finding the address',
    CustomerRequested = 'Customer requested different time',
    WeatherDelay = 'Delayed due to weather conditions',
    TrafficDelay = 'Delayed due to traffic',
    ArrivedAtLocation = 'Arrived at delivery location',
    ContactingCustomer = 'Attempting to contact customer',
    PackageReturning = 'Returning package to depot'
}