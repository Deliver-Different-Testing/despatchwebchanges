import {IFlightSegment, IFlightSegmentDto} from "../components/Nationwide/nationwide.interfaces";
import {formatDateForApiWithTzs} from "./formatDates";

export function transformFlightToDTO(model: IFlightSegment): IFlightSegmentDto {
    return {
        ...model,
        departureTime: formatDateForApiWithTzs(model.departureTime, model.departureAirportTimeZone),
        arrivalTime: formatDateForApiWithTzs(model.arrivalTime, model.arrivalAirportTimeZone)
    }
}