import React from "react";
import type {BreadcrumbItem} from "../app-toolbar/AppToolbar";

export interface AppShellProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    firstName: string;
    fullName: string;
    isUsCustomer: boolean;
    /** Marks the signed-in user as a network partner, badging the drawer's account header. */
    isNetworkPartner?: boolean;
    currentState: string;
    logoUrl?: string;
    companyName?: string;
    children?: React.ReactNode;
    onLogoClick?: () => void;
    onNavigate: (state: string) => void;
    /** Show a BETA chip next to the page title (V2 pages). */
    beta?: boolean;
}