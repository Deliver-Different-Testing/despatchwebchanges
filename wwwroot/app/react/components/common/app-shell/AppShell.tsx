/**
 * React App Shell Component
 *
 * Combines the AppToolbar and SideNav into a single shell component
 * that manages the interaction between them.
 */

import React, {useState, useCallback, useRef} from 'react';
import {Box} from '@mui/material';
import {AppToolbar, AppToolbarProps} from '../app-toolbar/AppToolbar';
import {SideNav} from '../side-nav/SideNav';

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

export const AppShell: React.FC<AppShellProps> = ({
    title,
    firstName,
    fullName,
    isUsCustomer,
    currentState,
    logoUrl,
    companyName,
    children,
    onLogoClick,
    onNavigate,
}) => {
    const [sidenavOpen, setSidenavOpen] = useState(false);
    const closeTimeoutRef = useRef<number | null>(null);

    const handleMenuHover = useCallback(() => {
        // Clear any pending close timeout
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setSidenavOpen(true);
    }, []);

    const handleSidenavClose = useCallback(() => {
        setSidenavOpen(false);
    }, []);

    const handleSidenavMouseEnter = useCallback(() => {
        // Clear any pending close timeout
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    const handleSidenavMouseLeave = useCallback(() => {
        // Delay closing to allow for re-entry
        closeTimeoutRef.current = window.setTimeout(() => {
            setSidenavOpen(false);
        }, 300);
    }, []);

    return (
        <Box sx={{display: 'flex', flexDirection: 'column'}}>
            <AppToolbar
                title={title}
                firstName={firstName}
                logoUrl={logoUrl}
                onLogoClick={onLogoClick}
                onMenuHover={handleMenuHover}
            >
                {children}
            </AppToolbar>

            <SideNav
                open={sidenavOpen}
                userName={fullName}
                companyName={companyName}
                isUsCustomer={isUsCustomer}
                currentState={currentState}
                onClose={handleSidenavClose}
                onNavigate={onNavigate}
                onMouseEnter={handleSidenavMouseEnter}
                onMouseLeave={handleSidenavMouseLeave}
            />
        </Box>
    );
};

export default AppShell;
