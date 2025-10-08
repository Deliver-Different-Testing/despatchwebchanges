import {IAddressViewModel} from "../../interfaces/job.interface";
import {Dayjs} from "dayjs";

export interface IPrebookListModel {
    id: number;
    booked: Dayjs;
    client: string;
    jobNo: string;
    clientId: number | null;
    courier: string;
    speed: string;
    pickupAddress: IAddressViewModel;
    deliveryAddress: IAddressViewModel;
}

export interface IPrebookListModelDto {
    id: number;
    booked: string;
    client: string;
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
