import React from "react";

export interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    state: string;
    /** Extra ui-router state names (e.g. v2/beta variants) that also mark this item active. */
    matchStates?: string[];
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