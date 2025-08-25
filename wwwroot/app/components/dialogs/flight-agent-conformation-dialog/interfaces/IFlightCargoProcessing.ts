interface IFlightCargoProcessing {
    arrivalTime: Date;
    processingTimeMins: number;
    arrivalWithProcessingTime: Date;
    cargoOpeningTime: Date;
    cargoClosingTime: Date;
    deliverByTime?: Date;
    isDeliveryTimeWithinCargoWindow?: boolean;
    packageReadyTime: Date;
}

export default IFlightCargoProcessing;