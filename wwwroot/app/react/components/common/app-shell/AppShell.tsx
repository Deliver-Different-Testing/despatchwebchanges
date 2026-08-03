/**
 * React App Shell Component
 *
 * Combines the AppToolbar and SideNav into a single shell component
 * that manages the interaction between them.
 */

import React, {useState, useRef, useCallback, useEffect} from 'react';
import Box from '@mui/material/Box';
import {AppToolbar} from '../app-toolbar/AppToolbar';
import {SideNav} from '../side-nav/SideNav';
import {AppShellProps} from './app-shell.types';

export const AppShell: React.FC<AppShellProps> = ({
    title,
    breadcrumbs,
    firstName,
    fullName,
    isUsCustomer,
    currentState,
    logoUrl,
    companyName,
    children,
    onLogoClick,
    onNavigate,
    beta,
}) => {
    const [sidenavOpen, setSidenavOpen] = useState(false);
    const closeTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) {
                window.clearTimeout(closeTimeoutRef.current);
            }
        };
    }, []);

    const handleMenuHover = useCallback(() => {
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
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    const handleSidenavMouseLeave = useCallback(() => {
        closeTimeoutRef.current = window.setTimeout(() => {
            setSidenavOpen(false);
        }, 300);
    }, []);

    return (
        <Box sx={{display: 'flex', flexDirection: 'column'}}>
            <AppToolbar
                title={title}
                breadcrumbs={breadcrumbs}
                firstName={firstName}
                isUsCustomer={isUsCustomer}
                logoUrl={logoUrl}
                onLogoClick={onLogoClick}
                onMenuHover={handleMenuHover}
                onMenuClick={handleMenuHover}
                beta={beta}
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
