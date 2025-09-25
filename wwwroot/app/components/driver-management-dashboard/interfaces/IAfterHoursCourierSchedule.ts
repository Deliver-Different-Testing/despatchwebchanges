interface IAfterHoursCourierSchedule {
    afterHoursScheduleId: number;
    courierId: number;
    courierName: string;
    courierCode: string;
    day: string;
    startTime?: Date;
    endTime?: Date;
    duration: string;
}