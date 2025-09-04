import {IAddressViewModel} from "../../interfaces/job.interface";

export interface IPrebookListModel {
    id: number;
    booked: Date;
    client: string;

    /** @deprecated Use pickup/delivery address properties instead */
    fromAddress: string;

    /** @deprecated Use pickup/delivery address properties instead */
    toAddress: string;

    jobNo: string;
    clientId: number | null;
    courier: string;
    speed: string;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
}

export interface IRecurringJobQuery {
    order: string;
    limit: number;
    page: number;
}
