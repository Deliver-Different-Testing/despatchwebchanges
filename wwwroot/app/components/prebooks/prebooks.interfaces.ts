import {AddressViewModel} from "../../interfaces/job.interface";

export interface PrebookListViewModel {
    id: number;
    booked: Date;
    client: string;
    /** @deprecated Use pickupAddress/deliveryAddress properties instead */
    fromAddress: string;
    /** @deprecated Use pickupAddress/deliveryAddress properties instead */
    toAddress: string;
    jobNo: string;
    clientId: number | null;
    courier: string;
    speed: string;
    pickupAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
}
