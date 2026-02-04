import React from "react";

export interface AppShellProps {
    title: string;
    firstName: string;
    fullName: string;
    isUsCustomer: boolean;
    currentState: string;
    logoUrl?: string;
    companyName?: string;
    children?: React.ReactNode;
    onLogoClick?: () => void;
    onNavigate: (state: string) => void;
}

export interface AppShellState {
    sidenavOpen: boolean;
}