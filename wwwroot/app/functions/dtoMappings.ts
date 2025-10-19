import {IFlightViewModel, IFlightViewModelDto} from "../components/Nationwide/nationwide.interfaces";
import dayjs from "dayjs";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../components/dialogs/flight-agent-conformation-dialog/interfaces/IFlightCargoProcessing";
import {IDispatchJob, IDispatchJobDto, IJob, IJobDto} from "../interfaces/job.interface";
import {formatDateFromApi} from "./formatDates";
import {ITask, ITaskDto} from "../components/task-dashboard/task-dashboard.interfaces";
import {IPrebookListModel, IPrebookListModelDto} from "../components/recurringJobs/recurringJobs.interface";
import {
    IDeliveryJourney,
    IDeliveryJourneyDto
} from "../components/common/task-history/task-history.interfaces";
import {
    ITodayActiveDrivers,
    ITodayActiveDriversDto
} from "../components/driver-management-dashboard/interfaces/ITodayActiveDrivers";
import {
    IAfterHoursCourierSchedule,
    IAfterHoursCourierScheduleDto
} from "../components/driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";
import {
    ICourierCompliance,
    ICourierComplianceDto
} from "../components/driver-management-dashboard/interfaces/ICourierCompliance";

export function transformFlightDTO(dto: IFlightViewModelDto): IFlightViewModel {
    return {
        ...dto,
        departureTime: formatDateFromApi(dto.departureTime),
        arrivalTime: formatDateFromApi(dto.arrivalTime),
        flightSegments: dto.flightSegments?.map(segment => ({
            ...segment,
            departureTime: formatDateFromApi(segment.departureTime),
            arrivalTime: formatDateFromApi(segment.arrivalTime),
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

export function transformJobDTO(dto: IJobDto): IJob {
    return {
        ...dto,
        time: dto.time ? formatDateFromApi(dto.time) : undefined,
        bookedDate: dto.bookedDate ? formatDateFromApi(dto.bookedDate) : undefined,
        dispatchTime: dto.dispatchTime ? formatDateFromApi(dto.dispatchTime) : undefined,
        booked: formatDateFromApi(dto.booked),
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
            })) ?? []
        } : undefined,
        
        deliverToPrivateResString: dto.deliverToPrivateRes ? 'residential' : 'business',
        
        // Prebook-specific options
        daysOfWeek: dto.daysOfWeek,
        frequency: dto.frequency,
        holidayDeliveryOption: dto.holidayDeliveryOption,
    };
}

export function transformDispatchJobDTO(dto: IDispatchJobDto): IDispatchJob {
    return {
        ...dto,
        time: dto.time ? formatDateFromApi(dto.time) : undefined,
        booked: formatDateFromApi(dto.booked),
        followupTime: dto.followupTime ? formatDateFromApi(dto.followupTime) : undefined,
    };
}

export function transformTaskDTO(dto: ITaskDto): ITask {
    return {
        ...dto,
        dueDate: dayjs(dto.dueDate)
    }
}

export function transformPrebookListDTO(dto: IPrebookListModelDto): IPrebookListModel {
    return {
        ...dto,
        booked: formatDateFromApi(dto.booked),
        nextDueTime: dto.nextDueTime ? formatDateFromApi(dto.nextDueTime) : undefined,
    }
}

export function transformDeliveryJourneyDTO(dto: IDeliveryJourneyDto): IDeliveryJourney {
    return {
        ...dto,
        date: dayjs(dto.date),
    }
}

export function transformTodayActiveDriversDTO(dto: ITodayActiveDriversDto): ITodayActiveDrivers {
    return {
        ...dto,
        loginTime: formatDateFromApi(dto.loginTime),
        logoutTime: dto.logoutTime ? formatDateFromApi(dto.logoutTime) : undefined,
    }
}

export function transformAfterHoursScheduleDto(dto: IAfterHoursCourierScheduleDto): IAfterHoursCourierSchedule {
    return {
        ...dto,
        startTime: dto.startTime ? formatDateFromApi(dto.startTime) : undefined,
        endTime: dto.endTime ? formatDateFromApi(dto.endTime) : undefined,
    }
}

export function transformCourierComplianceDto(dto: ICourierComplianceDto): ICourierCompliance {
    return {
        ...dto,
        expiryDate: dto.expiryDate ? formatDateFromApi(dto.expiryDate) : undefined,
    }
}