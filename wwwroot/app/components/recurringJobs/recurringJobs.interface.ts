import {IAddressViewModel} from "../../interfaces/job.interface";
import {Dayjs} from "dayjs";

export interface IPrebookListModel {
    id: number;
    booked: Dayjs;
    nextDueTime?: Dayjs;
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
    nextDueTime?: string;
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
    orderDirection: string;
    limit: number;
    page: number;
    searchText?: string;
    active: boolean;
}