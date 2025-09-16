interface IAfterHoursCourierSchedule {
    courierId: number;
    courierName: string;
    day: string;
    startTime?: Date;
    endTime?: Date;
    duration: string;
}