interface IFlightCargoProcessing {
    arrivalTime: Date;
    processingTimeMins: number;
    cargoOpeningTime: Date;
    cargoClosingTime: Date;
    deliverByTime?: Date;
}

export default IFlightCargoProcessing;