interface ITodayActiveDrivers {
    courierId: number;
    code: string;
    name: string;
    fleet: string;
    loginTime: Date;
    logoutTime: Date;
    duration: string;
    deliveries: number;
    status: string;
}

export default ITodayActiveDrivers;