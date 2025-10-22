import {IFlightSegment, IFlightSegmentDto} from "../components/Nationwide/nationwide.interfaces";
import {formatDateForApiWithTzs} from "./formatDates";
import {IJobNote, IJobNoteDto} from "../interfaces/job.interface";

export function transformFlightToDTO(model: IFlightSegment): IFlightSegmentDto {
    return {
        ...model,
        departureTime: formatDateForApiWithTzs(model.departureTime, model.departureAirportTimeZone),
        arrivalTime: formatDateForApiWithTzs(model.arrivalTime, model.arrivalAirportTimeZone)
    }
}

export function transformJobNoteToDTO(model: IJobNote): IJobNoteDto {
    return {
        ...model,
        createdDate: model.createdDate ? formatDateForApiWithTzs(model.createdDate) : undefined,
        updatedDate: model.updatedDate ? formatDateForApiWithTzs(model.updatedDate) : undefined
    }
}