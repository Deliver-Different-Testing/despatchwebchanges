import {ISuggestion} from "../../../../interfaces/job.interface";

interface ICreateJobDialogControllerScope extends angular.IScope {
    jobForm: angular.IFormController;
    fromAddressSearchText: string;
    toAddressSearchText: string;
    searchClientText: string;
    courierSearchText: string;
    isLoading: boolean;
    selectedCourier: ISuggestion;
    selectedClient: ISuggestion;
    selectedVehicle: ISuggestion;
}

export default ICreateJobDialogControllerScope;