import {IFlightSegment, IFlightSegmentDto} from "../interfaces/nationwideFlight.interfaces";
import {formatDateForApiWithTzs} from "../react/utils/dateUtils";
import {IJobQueryParams, IJobQueryParamsDto} from "../interfaces/job.interface";

export function transformFlightToDTO(model: IFlightSegment): IFlightSegmentDto {
    return {
        ...model,
        departureTime: formatDateForApiWithTzs(model.departureTime, model.departureAirportTimeZone),
        arrivalTime: formatDateForApiWithTzs(model.arrivalTime, model.arrivalAirportTimeZone)
    }
}

export function transformJobQueryParamsToDTO(model: IJobQueryParams) : IJobQueryParamsDto {
    return {
        ...model,
        startDate: model.startDate ? formatDateForApiWithTzs(model.startDate) : undefined,
        endDate: model.endDate ? formatDateForApiWithTzs(model.endDate) : undefined,
    };
}