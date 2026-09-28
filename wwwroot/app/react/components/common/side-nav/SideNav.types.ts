import React from "react";

export interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    state: string;
    usOnly?: boolean;
    nzOnly?: boolean;
}

export interface SideNavProps {
    open: boolean;
    userName: string;
    companyName?: string;
    isUsCustomer: boolean;
    currentState: string;
    onClose: () => void;
    onNavigate: (state: string) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}