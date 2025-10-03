import {IFlightViewModel, IFlightViewModelDto} from "../components/Nationwide/nationwide.interfaces";
import dayjs from "dayjs";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../components/dialogs/flight-agent-conformation-dialog/interfaces/IFlightCargoProcessing";

export function transformFlightDTO(dto: IFlightViewModelDto): IFlightViewModel {
    return {
        ...dto,
        departureTime: dayjs(dto.departureTime),
        arrivalTime: dayjs(dto.arrivalTime),
        flightSegments: dto.flightSegments?.map(segment => ({
            ...segment,
            departureTime: dayjs(segment.departureTime),
            arrivalTime: dayjs(segment.arrivalTime),
        })) ?? []
    };
}

export function transformCargoHoursDTO(dto: IFlightCargoProcessingDto): IFlightCargoProcessing {
    return {
        ...dto,
        arrivalTime: dayjs(dto.arrivalTime),
        cargoOpeningTime: dayjs(dto.cargoOpeningTime),
        cargoClosingTime: dayjs(dto.cargoClosingTime),
        deliverByTime: dto.deliverByTime ? dayjs(dto.deliverByTime) : undefined,
    };
}