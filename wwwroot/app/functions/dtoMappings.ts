import {IFlightViewModel, IFlightViewModelDto} from "../components/Nationwide/nationwide.interfaces";
import dayjs from "dayjs";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../components/dialogs/flight-agent-conformation-dialog/interfaces/IFlightCargoProcessing";
import {IDispatchJob, IDispatchJobDto, IJob, IJobDto} from "../interfaces/job.interface";
import {formatDateFromApi} from "./formatDates";
import {ITask, ITaskDto} from "../components/task-dashboard/task-dashboard.interfaces";

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
        time: dto.time ? dayjs(dto.time) : undefined,
        bookedDate: dto.bookedDate ? dayjs(dto.bookedDate) : undefined,
        dispatchTime: dto.dispatchTime ? dayjs(dto.dispatchTime) : undefined,
        booked: dayjs(dto.booked),
        puTime: dto.puTime ? dayjs(dto.puTime) : undefined,
        followupTime: dto.followupTime ? dayjs(dto.followupTime) : undefined,
        truckStartTime: dto.truckStartTime ? dayjs(dto.truckStartTime) : undefined,
        completedTime: dto.completedTime ? dayjs(dto.completedTime) : undefined,
        createdDate: dto.createdDate ? dayjs(dto.createdDate) : undefined,
        deliverByTime: dto.deliverByTime ? dayjs(dto.deliverByTime) : undefined,
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
    };
}

export function transformDispatchJobDTO(dto: IDispatchJobDto): IDispatchJob {
    return {
        ...dto,
        time: dto.time ? dayjs(dto.time) : undefined,
        booked: dayjs(dto.booked),
        followupTime: dayjs(dto.followupTime),
    };
}

export function transformTaskDTO(dto: ITaskDto): ITask {
    return {
        ...dto,
        dueDate: dayjs(dto.dueDate)
    }
}