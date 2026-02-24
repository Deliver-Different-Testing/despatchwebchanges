import {IFlightViewModel, IFlightViewModelDto} from "../components/Nationwide/nationwide.interfaces";
import dayjs from "dayjs";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../interfaces/flight-cargo-processing.interface";
import {
    IDispatchJob,
    IDispatchJobDto,
    IJob,
    IJobDto,
    IJobGroup,
    IJobGroupDto, IJobNote,
    IJobNoteDto
} from "../interfaces/job.interface";
import {
    formatDateFromApi, formatInfoLogDateTimeString,
    formatLongDate,
    formatLongDateTime,
    formatMins,
    formatShortDate,
    formatShortDateTime
} from "./formatDates";
import {ITask, ITaskDto} from "../interfaces/task.interfaces";
import {
    IDeliveryJourney,
    IDeliveryJourneyDto
} from "../react/components/common/task-history/TaskHistory.interfaces";
import {IOpenJobResponse, IOpenJobResponseDto} from "../components/overview/overview.interfaces";
import {timezoneShortFilter} from "../filters";

export function transformFlightDTO(dto: IFlightViewModelDto): IFlightViewModel {
    return {
        ...dto,
        departureTime: formatDateFromApi(dto.departureTime),
        arrivalTime: formatDateFromApi(dto.arrivalTime),
        _departureTimeStr: formatLongDateTime(dto.departureTime),
        _departureTimeZoneStr: timezoneShortFilter(dto.departureTimeZone),
        _arrivalTimeStr: formatLongDateTime(dto.arrivalTime),
        _arrivalTimeZoneStr: formatLongDateTime(dto.arrivalTime),
        flightSegments: dto.flightSegments?.map(segment => ({
            ...segment,
            departureTime: formatDateFromApi(segment.departureTime),
            arrivalTime: formatDateFromApi(segment.arrivalTime),
            _departureTimeStr: formatLongDateTime(segment.departureTime),
            _arrivalTimeStr: formatLongDateTime(segment.arrivalTime),
            _arrivalTimeZoneStr: timezoneShortFilter(segment.arrivalAirportTimeZone),
            _departureTimeZoneStr: timezoneShortFilter(segment.departureAirportTimeZone),
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

export function transformJobGroupDTO(dto: IJobGroupDto, isUsCustomer: boolean): IJobGroup {
    return {
        job: transformJobDTO(dto.job, isUsCustomer),
        relatedJobs: dto.relatedJobs?.map(dto => transformJobDTO(dto, isUsCustomer)) ?? [],
    }
}

function transformJobDTO(dto: IJobDto, isUsCustomer: boolean): IJob {
    return {
        ...dto,
        time: dto.time ? dayjs(dto.time) : undefined,
        bookedDate: dto.bookedDate ? dayjs(dto.bookedDate) : undefined,
        dispatchTime: dto.dispatchTime ? formatDateFromApi(dto.dispatchTime) : undefined,
        booked: dayjs(dto.booked),
        puTime: dto.puTime ? formatDateFromApi(dto.puTime) : undefined,
        followupTime: dto.followupTime ? formatDateFromApi(dto.followupTime) : undefined,
        truckStartTime: dto.truckStartTime ? dayjs(dto.truckStartTime) : undefined,
        completedTime: dto.completedTime ? formatDateFromApi(dto.completedTime) : undefined,
        createdDate: dto.createdDate ? formatDateFromApi(dto.createdDate) : undefined,
        deliverByTime: dto.deliverByTime ? formatDateFromApi(dto.deliverByTime) : undefined,
        inActiveDate: dto.inActiveDate ? dayjs(dto.inActiveDate) : undefined,
        firstDue: dto.firstDue ? dayjs(dto.firstDue) : undefined,
        nextDue: dto.nextDue ? dayjs(dto.nextDue) : undefined,
        lastDone: dto.lastDone ? dayjs(dto.lastDone) : undefined,
        stopDate: dto.stopDate ? dayjs(dto.stopDate) : undefined,
        restartDate: dto.restartDate ? dayjs(dto.restartDate) : undefined,
        assignedFlight: dto.assignedFlight ? {
            ...dto.assignedFlight,
            expectedArrival: dto.assignedFlight.expectedArrival ? formatDateFromApi(dto.assignedFlight.expectedArrival) : undefined,
            expectedDeparture: dto.assignedFlight.expectedDeparture ? formatDateFromApi(dto.assignedFlight.expectedDeparture) : undefined,
            flightSegments: dto.assignedFlight.flightSegments?.map(segment => ({
                ...segment,
                departureTime: formatDateFromApi(segment.departureTime),
                arrivalTime: formatDateFromApi(segment.arrivalTime),
                _departureTimeStr: formatLongDateTime(segment.departureTime, isUsCustomer),
                _arrivalTimeStr: formatLongDateTime(segment.arrivalTime, isUsCustomer),
                _arrivalTimeZoneStr: timezoneShortFilter(segment.arrivalAirportTimeZone),
                _departureTimeZoneStr: timezoneShortFilter(segment.departureAirportTimeZone),
            })) ?? []
        } : undefined,

        deliverToPrivateResString: dto.deliverToPrivateRes ? 'residential' : 'business',

        // Prebook-specific options
        daysOfWeek: dto.daysOfWeek,
        frequency: dto.frequency,
        holidayDeliveryOption: dto.holidayDeliveryOption,

        readTrackerInfo: dto.readTrackerInfo ? {
            ...dto.readTrackerInfo,
            readDate: dto.readTrackerInfo.readDate ? dayjs(dto.readTrackerInfo.readDate) : undefined,
            _readDateStr: dto.readTrackerInfo.readDate ? formatLongDateTime(dto.readTrackerInfo.readDate, isUsCustomer) : undefined,
        } : undefined,

        // Private
        _createdDateStr: dto.createdDate ? formatShortDate(dto.createdDate, isUsCustomer) : undefined,
        _startTimeStr: dto.time ? formatMins(dto.time) : undefined,
        _puTimeStr: dto.puTime ? formatShortDateTime(dto.puTime, isUsCustomer) : undefined,
        _deliverByTimeStr: dto.deliverByTime ? formatShortDateTime(dto.deliverByTime, isUsCustomer) : undefined,
        _dispatchTimeStr: dto.dispatchTime ? formatShortDateTime(dto.dispatchTime, isUsCustomer) : undefined,
        _completedTimeStr: dto.completedTime ? formatShortDateTime(dto.completedTime, isUsCustomer) : undefined,
        _completedTimeLongStr: dto.completedTime ? formatLongDateTime(dto.completedTime, isUsCustomer) : undefined,
        _followupTimeStr: dto.followupTime ? formatShortDateTime(dto.followupTime, isUsCustomer) : undefined,
        _pickUpTimeZoneStr: dto.pickUpTimeZone ? timezoneShortFilter(dto.pickUpTimeZone.text) : undefined,
        _deliveryTimeZoneStr: dto.deliveryTimeZone ? timezoneShortFilter(dto.deliveryTimeZone.text) : undefined,
        _stopDateStr: dto.stopDate ? formatLongDate(dto.stopDate, isUsCustomer) : undefined,
        _restartDateStr: dto.restartDate ? formatLongDate(dto.restartDate, isUsCustomer) : undefined,
    };
}

export function transformDispatchJobDTO(dto: IDispatchJobDto): IDispatchJob {
    // Transform children recursively if present
    const children = dto.children?.map(transformDispatchJobDTO);

    return {
        ...dto,
        time: dto.time ? dayjs(dto.time) : undefined,
        booked: dayjs(dto.booked),
        followupTime: dto.followupTime ? formatDateFromApi(dto.followupTime) : undefined,
        _deliveryTimeString: dto.booked ? formatMins(dto.booked) : undefined,
        _deliveryDateString: dto.booked ? formatShortDate(dto.booked) : undefined,
        _pickUpTimeZoneStr: dto.pickUpTimeZone ? timezoneShortFilter(dto.pickUpTimeZone.text) : undefined,
        _deliveryTimeZoneStr: dto.deliveryTimeZone ? timezoneShortFilter(dto.deliveryTimeZone.text) : undefined,
        // Transform assignedFlight with helper fields for display
        assignedFlight: dto.assignedFlight ? {
            ...dto.assignedFlight,
            expectedArrival: dto.assignedFlight.expectedArrival ? formatDateFromApi(dto.assignedFlight.expectedArrival) : undefined,
            expectedDeparture: dto.assignedFlight.expectedDeparture ? formatDateFromApi(dto.assignedFlight.expectedDeparture) : undefined,
            flightSegments: dto.assignedFlight.flightSegments?.map(segment => ({
                ...segment,
                departureTime: formatDateFromApi(segment.departureTime),
                arrivalTime: formatDateFromApi(segment.arrivalTime),
                _departureTimeStr: formatLongDateTime(segment.departureTime),
                _arrivalTimeStr: formatLongDateTime(segment.arrivalTime),
                _arrivalTimeZoneStr: timezoneShortFilter(segment.arrivalAirportTimeZone),
                _departureTimeZoneStr: timezoneShortFilter(segment.departureAirportTimeZone),
            })) ?? []
        } : undefined,
        // Map backend children to _groupChildren for the UI
        children: children,
        _groupChildren: children,
        _isExpanded: false
    };
}

export function transformTaskDTO(dto: ITaskDto): ITask {
    return {
        ...dto,
        dueDate: formatDateFromApi(dto.dueDate),
        _dueDateString: formatLongDate(dto.dueDate),
        _dueTimeString: formatMins(dto.dueDate)
    }
}

export function transformDeliveryJourneyDTO(dto: IDeliveryJourneyDto): IDeliveryJourney {
    return {
        ...dto,
        date: formatDateFromApi(dto.date),
        status: dto.status as IDeliveryJourney['status'],
        _dateStr: formatInfoLogDateTimeString(dto.date)
    }
}


export function transformOpenJobResponseDto(dto: IOpenJobResponseDto): IOpenJobResponse {
    return {
        ...dto,
        deliveryTime: dto.deliveryTime ? formatDateFromApi(dto.deliveryTime) : undefined,
        pickupTime: dto.pickupTime ? formatDateFromApi(dto.pickupTime) : undefined,
        lastCompleted: dto.lastCompleted ? formatDateFromApi(dto.lastCompleted) : undefined,
        _pickUpTimeStr: dto.pickupTime ? formatLongDateTime(dto.pickupTime) : undefined,
        _deliveryTimeStr: dto.deliveryTime ? formatLongDateTime(dto.deliveryTime) : undefined,
    }
}