import angular from "angular";

export interface SideNavScope extends angular.IScope {
    isActive(stateName: string): boolean;

    navState: {
        isOpen: boolean;
        isAnimating: boolean;
    };

    userName: string;
    companyName: string;
    isUsCustomer: boolean;
}
