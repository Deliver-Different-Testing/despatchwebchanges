import {IFlightViewModel, IFlightViewModelDto} from "../components/Nationwide/nationwide.interfaces";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../interfaces/flight-cargo-processing.interface";
import {
    IDispatchJob,
    IDispatchJobDto,
    IJob,
    IJobDto,
    IJobGroup,
    IJobGroupDto
} from "../interfaces/job.interface";
import {
    formatDateFromApi, formatInfoLogDateTimeString,
    formatLongDate,
    formatLongDateTime,
    formatMins,
    formatShortDate,
    formatShortDateTime
} from "../react/utils/dateUtils";
import {ITask, ITaskDto} from "../interfaces/task.interfaces";
import {
    IDeliveryJourney,
    IDeliveryJourneyDto
} from "../react/components/common/task-history/TaskHistory.interfaces";
import {timezoneShortFilter} from "../filters";

export function transformFlightDTO(dto: IFlightViewModelDto): IFlightViewModel {
    const departureTime = formatDateFromApi(dto.departureTime);
    const arrivalTime = formatDateFromApi(dto.arrivalTime);
    return {
        ...dto,
        departureTime,
        arrivalTime,
        _departureTimeStr: formatLongDateTime(departureTime),
        _departureTimeZoneStr: timezoneShortFilter(dto.departureTimeZone),
        _arrivalTimeStr: formatLongDateTime(arrivalTime),
        _arrivalTimeZoneStr: timezoneShortFilter(dto.arrivalTimeZone),
        flightSegments: dto.flightSegments?.map(segment => {
            const segDepartureTime = formatDateFromApi(segment.departureTime);
            const segArrivalTime = formatDateFromApi(segment.arrivalTime);
            return {
                ...segment,
                departureTime: segDepartureTime,
                arrivalTime: segArrivalTime,
                _departureTimeStr: formatLongDateTime(segDepartureTime),
                _arrivalTimeStr: formatLongDateTime(segArrivalTime),
                _arrivalTimeZoneStr: timezoneShortFilter(segment.arrivalAirportTimeZone),
                _departureTimeZoneStr: timezoneShortFilter(segment.departureAirportTimeZone),
            };
        }) ?? []
    };
}

export function transformCargoHoursDTO(dto: IFlightCargoProcessingDto): IFlightCargoProcessing {
    return {
        ...dto,
        arrivalTime: formatDateFromApi(dto.arrivalTime),
        cargoOpeningTime: formatDateFromApi(dto.cargoOpeningTime),
        cargoClosingTime: formatDateFromApi(dto.cargoClosingTime),
        deliverByTime: dto.deliverByTime ? formatDateFromApi(dto.deliverByTime) : undefined,
    };
}

export function transformJobGroupDTO(dto: IJobGroupDto, isUsCustomer: boolean): IJobGroup {
    return {
        job: transformJobDTO(dto.job, isUsCustomer),
        relatedJobs: dto.relatedJobs?.map(dto => transformJobDTO(dto, isUsCustomer)) ?? [],
    }
}

function transformJobDTO(dto: IJobDto, isUsCustomer: boolean): IJob {
    // Parse dates first (preserves timezone offset from API)
    const dispatchTime = dto.dispatchTime ? formatDateFromApi(dto.dispatchTime) : undefined;
    const puTime = dto.puTime ? formatDateFromApi(dto.puTime) : undefined;
    const followupTime = dto.followupTime ? formatDateFromApi(dto.followupTime) : undefined;
    const completedTime = dto.completedTime ? formatDateFromApi(dto.completedTime) : undefined;
    const createdDate = dto.createdDate ? formatDateFromApi(dto.createdDate) : undefined;
    const deliverByTime = dto.deliverByTime ? formatDateFromApi(dto.deliverByTime) : undefined;
    const pickupArrivalTime = dto.pickupArrivalTime ? formatDateFromApi(dto.pickupArrivalTime) : undefined;
    const deliveryArrivalTime = dto.deliveryArrivalTime ? formatDateFromApi(dto.deliveryArrivalTime) : undefined;

    const time = dto.time ? formatDateFromApi(dto.time) : undefined;
    const bookedDate = dto.bookedDate ? formatDateFromApi(dto.bookedDate) : undefined;
    const booked = formatDateFromApi(dto.booked);
    const truckStartTime = dto.truckStartTime ? formatDateFromApi(dto.truckStartTime) : undefined;
    const inActiveDate = dto.inActiveDate ? formatDateFromApi(dto.inActiveDate) : undefined;
    const firstDue = dto.firstDue ? formatDateFromApi(dto.firstDue) : undefined;
    const nextDue = dto.nextDue ? formatDateFromApi(dto.nextDue) : undefined;
    const lastDone = dto.lastDone ? formatDateFromApi(dto.lastDone) : undefined;
    const stopDate = dto.stopDate ? formatDateFromApi(dto.stopDate) : undefined;
    const restartDate = dto.restartDate ? formatDateFromApi(dto.restartDate) : undefined;

    return {
        ...dto,
        time,
        bookedDate,
        dispatchTime,
        booked,
        puTime,
        followupTime,
        truckStartTime,
        completedTime,
        createdDate,
        deliverByTime,
        inActiveDate,
        firstDue,
        nextDue,
        lastDone,
        stopDate,
        restartDate,
        assignedFlight: dto.assignedFlight ? {
            ...dto.assignedFlight,
            expectedArrival: dto.assignedFlight.expectedArrival ? formatDateFromApi(dto.assignedFlight.expectedArrival) : undefined,
            expectedDeparture: dto.assignedFlight.expectedDeparture ? formatDateFromApi(dto.assignedFlight.expectedDeparture) : undefined,
            flightSegments: dto.assignedFlight.flightSegments?.map(segment => {
                const segDepartureTime = formatDateFromApi(segment.departureTime);
                const segArrivalTime = formatDateFromApi(segment.arrivalTime);
                return {
                    ...segment,
                    departureTime: segDepartureTime,
                    arrivalTime: segArrivalTime,
                    _departureTimeStr: formatLongDateTime(segDepartureTime, isUsCustomer),
                    _arrivalTimeStr: formatLongDateTime(segArrivalTime, isUsCustomer),
                    _arrivalTimeZoneStr: timezoneShortFilter(segment.arrivalAirportTimeZone),
                    _departureTimeZoneStr: timezoneShortFilter(segment.departureAirportTimeZone),
                };
            }) ?? []
        } : undefined,

        pickupArrivalTime,
        deliveryArrivalTime,

        deliverToPrivateResString: dto.deliverToPrivateRes ? 'residential' : 'business',

        // Prebook-specific options
        daysOfWeek: dto.daysOfWeek,
        frequency: dto.frequency,
        holidayDeliveryOption: dto.holidayDeliveryOption,

        readTrackerInfo: dto.readTrackerInfo ? {
            ...dto.readTrackerInfo,
            readDate: dto.readTrackerInfo.readDate ? formatDateFromApi(dto.readTrackerInfo.readDate) : undefined,
            _readDateStr: dto.readTrackerInfo.readDate ? formatLongDateTime(formatDateFromApi(dto.readTrackerInfo.readDate), isUsCustomer) : undefined,
        } : undefined,

        // Display strings use parsed Dayjs objects (with correct timezone offset)
        _createdDateStr: createdDate ? formatShortDate(createdDate, isUsCustomer) : undefined,
        _createdDateTimeStr: createdDate ? formatShortDateTime(createdDate, isUsCustomer) : undefined,
        _readyStr: booked ? formatShortDateTime(booked, isUsCustomer) : undefined,
        _pickupArrivalTimeStr: pickupArrivalTime ? formatShortDateTime(pickupArrivalTime, isUsCustomer) : undefined,
        _deliveryArrivalTimeStr: deliveryArrivalTime ? formatShortDateTime(deliveryArrivalTime, isUsCustomer) : undefined,
        _startTimeStr: time ? formatMins(time) : undefined,
        _puTimeStr: puTime ? formatShortDateTime(puTime, isUsCustomer) : undefined,
        _deliverByTimeStr: deliverByTime ? formatShortDateTime(deliverByTime, isUsCustomer) : undefined,
        _dispatchTimeStr: dispatchTime ? formatShortDateTime(dispatchTime, isUsCustomer) : undefined,
        _completedTimeStr: completedTime ? formatShortDateTime(completedTime, isUsCustomer) : undefined,
        _completedTimeLongStr: completedTime ? formatLongDateTime(completedTime, isUsCustomer) : undefined,
        _followupTimeStr: followupTime ? formatShortDateTime(followupTime, isUsCustomer) : undefined,
        _pickUpTimeZoneStr: dto.pickUpTimeZone ? timezoneShortFilter(dto.pickUpTimeZone.text) : undefined,
        _deliveryTimeZoneStr: dto.deliveryTimeZone ? timezoneShortFilter(dto.deliveryTimeZone.text) : undefined,
        _stopDateStr: stopDate ? formatLongDate(stopDate, isUsCustomer) : undefined,
        _restartDateStr: restartDate ? formatLongDate(restartDate, isUsCustomer) : undefined,
    };
}

export function transformDispatchJobDTO(dto: IDispatchJobDto): IDispatchJob {
    // Transform children recursively if present
    const children = dto.children?.map(transformDispatchJobDTO);

    const time = dto.time ? formatDateFromApi(dto.time) : undefined;
    const booked = formatDateFromApi(dto.booked);

    return {
        ...dto,
        time,
        booked,
        followupTime: dto.followupTime ? formatDateFromApi(dto.followupTime) : undefined,
        _deliveryTimeString: booked ? formatMins(booked) : undefined,
        _deliveryDateString: booked ? formatShortDate(booked) : undefined,
        _pickUpTimeZoneStr: dto.pickUpTimeZone ? timezoneShortFilter(dto.pickUpTimeZone.text) : undefined,
        _deliveryTimeZoneStr: dto.deliveryTimeZone ? timezoneShortFilter(dto.deliveryTimeZone.text) : undefined,
        // Transform assignedFlight with helper fields for display
        assignedFlight: dto.assignedFlight ? {
            ...dto.assignedFlight,
            expectedArrival: dto.assignedFlight.expectedArrival ? formatDateFromApi(dto.assignedFlight.expectedArrival) : undefined,
            expectedDeparture: dto.assignedFlight.expectedDeparture ? formatDateFromApi(dto.assignedFlight.expectedDeparture) : undefined,
            flightSegments: dto.assignedFlight.flightSegments?.map(segment => {
                const segDepartureTime = formatDateFromApi(segment.departureTime);
                const segArrivalTime = formatDateFromApi(segment.arrivalTime);
                return {
                    ...segment,
                    departureTime: segDepartureTime,
                    arrivalTime: segArrivalTime,
                    _departureTimeStr: formatLongDateTime(segDepartureTime),
                    _arrivalTimeStr: formatLongDateTime(segArrivalTime),
                    _arrivalTimeZoneStr: timezoneShortFilter(segment.arrivalAirportTimeZone),
                    _departureTimeZoneStr: timezoneShortFilter(segment.departureAirportTimeZone),
                };
            }) ?? []
        } : undefined,
        // Map backend children to _groupChildren for the UI
        children: children,
        _groupChildren: children,
        _isExpanded: false
    };
}

export function transformTaskDTO(dto: ITaskDto): ITask {
    const dueDate = formatDateFromApi(dto.dueDate);
    return {
        ...dto,
        dueDate,
        _dueDateString: formatLongDate(dueDate),
        _dueTimeString: formatMins(dueDate)
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