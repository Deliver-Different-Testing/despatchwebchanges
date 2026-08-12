/**
 * React App Shell Component
 *
 * Combines the AppToolbar and SideNav into a single shell component
 * that manages the interaction between them.
 */

import React, {useRef, useCallback, useEffect} from 'react';
import {Stack} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
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
    const [sidenavOpen, {open: openSidenav, close: closeSidenav}] = useDisclosure(false);
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
        openSidenav();
    }, [openSidenav]);

    const handleSidenavClose = closeSidenav;

    const handleSidenavMouseEnter = useCallback(() => {
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    const handleSidenavMouseLeave = useCallback(() => {
        closeTimeoutRef.current = window.setTimeout(closeSidenav, 300);
    }, [closeSidenav]);

    return (
        <Stack gap={0}>
            <AppToolbar
                title={title}
                breadcrumbs={breadcrumbs}
                firstName={firstName}
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
        </Stack>
    );
};

export default AppShell;
