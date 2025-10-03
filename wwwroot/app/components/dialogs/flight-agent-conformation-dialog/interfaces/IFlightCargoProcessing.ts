import {Dayjs} from "dayjs";

export interface IFlightCargoProcessingDto {
    arrivalTime: string;
    processingTimeMins: number;
    cargoOpeningTime: string;
    cargoClosingTime: string;
    deliverByTime?: string;
}

export interface IFlightCargoProcessing {
    arrivalTime: Dayjs;
    processingTimeMins: number;
    cargoOpeningTime: Dayjs;
    cargoClosingTime: Dayjs;
    deliverByTime?: Dayjs;
}

export default IFlightCargoProcessing;