import React from "react";
import type {BreadcrumbItem} from "../app-toolbar/AppToolbar";

export interface AppShellProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
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