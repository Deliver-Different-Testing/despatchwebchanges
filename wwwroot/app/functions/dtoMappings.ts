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
    IJobGroupDto
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
    // Parse dates first (preserves timezone offset from API)
    const dispatchTime = dto.dispatchTime ? formatDateFromApi(dto.dispatchTime) : undefined;
    const puTime = dto.puTime ? formatDateFromApi(dto.puTime) : undefined;
    const followupTime = dto.followupTime ? formatDateFromApi(dto.followupTime) : undefined;
    const completedTime = dto.completedTime ? formatDateFromApi(dto.completedTime) : undefined;
    const createdDate = dto.createdDate ? formatDateFromApi(dto.createdDate) : undefined;
    const deliverByTime = dto.deliverByTime ? formatDateFromApi(dto.deliverByTime) : undefined;
    const pickupArrivalTime = dto.pickupArrivalTime ? formatDateFromApi(dto.pickupArrivalTime) : undefined;
    const deliveryArrivalTime = dto.deliveryArrivalTime ? formatDateFromApi(dto.deliveryArrivalTime) : undefined;

    return {
        ...dto,
        time: dto.time ? dayjs(dto.time) : undefined,
        bookedDate: dto.bookedDate ? dayjs(dto.bookedDate) : undefined,
        dispatchTime,
        booked: dayjs(dto.booked),
        puTime,
        followupTime,
        truckStartTime: dto.truckStartTime ? dayjs(dto.truckStartTime) : undefined,
        completedTime,
        createdDate,
        deliverByTime,
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

        pickupArrivalTime,
        deliveryArrivalTime,

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

        // Display strings use parsed Dayjs objects (with correct timezone offset)
        _createdDateStr: createdDate ? formatShortDate(createdDate, isUsCustomer) : undefined,
        _createdDateTimeStr: createdDate ? formatShortDateTime(createdDate, isUsCustomer) : undefined,
        _readyStr: dto.booked ? formatShortDateTime(dto.booked, isUsCustomer) : undefined,
        _pickupArrivalTimeStr: pickupArrivalTime ? formatShortDateTime(pickupArrivalTime, isUsCustomer) : undefined,
        _deliveryArrivalTimeStr: deliveryArrivalTime ? formatShortDateTime(deliveryArrivalTime, isUsCustomer) : undefined,
        _startTimeStr: dto.time ? formatMins(dto.time) : undefined,
        _puTimeStr: puTime ? formatShortDateTime(puTime, isUsCustomer) : undefined,
        _deliverByTimeStr: deliverByTime ? formatShortDateTime(deliverByTime, isUsCustomer) : undefined,
        _dispatchTimeStr: dispatchTime ? formatShortDateTime(dispatchTime, isUsCustomer) : undefined,
        _completedTimeStr: completedTime ? formatShortDateTime(completedTime, isUsCustomer) : undefined,
        _completedTimeLongStr: completedTime ? formatLongDateTime(completedTime, isUsCustomer) : undefined,
        _followupTimeStr: followupTime ? formatShortDateTime(followupTime, isUsCustomer) : undefined,
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