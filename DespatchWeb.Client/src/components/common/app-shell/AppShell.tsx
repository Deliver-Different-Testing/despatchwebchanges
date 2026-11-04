/**
 * React App Shell Component
 *
 * Combines the AppToolbar and SideNav into a single shell component
 * that manages the interaction between them, or hands over to the DFRNT
 * SidebarShell when the user's navigation style is `dfrnt`.
 */

import React, {useRef, useCallback, useEffect} from 'react';
import {Stack} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {AppToolbar} from '../app-toolbar/AppToolbar';
import {SideNav} from '../side-nav/SideNav';
import {SidebarShell} from '../sidebar-shell/SidebarShell';
import {useNavStyle} from '../../../hooks/useNavStyle';
import {AppShellProps} from './app-shell.types';

export const AppShell: React.FC<AppShellProps> = ({
    title,
    breadcrumbs,
    firstName,
    fullName,
    isUsCustomer,
    isNetworkPartner,
    currentState,
    logoUrl,
    companyName,
    children,
    body,
    onLogoClick,
    onNavigate,
    beta,
}) => {
    const {style} = useNavStyle();
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

    if (style === 'dfrnt') {
        return (
            <SidebarShell
                title={title}
                breadcrumbs={breadcrumbs}
                firstName={firstName}
                fullName={fullName}
                isUsCustomer={isUsCustomer}
                isNetworkPartner={isNetworkPartner}
                currentState={currentState}
                logoUrl={logoUrl}
                companyName={companyName}
                body={body}
                onLogoClick={onLogoClick}
                onNavigate={onNavigate}
                beta={beta}
            >
                {children}
            </SidebarShell>
        );
    }

    return (
        <>
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
                    isNetworkPartner={isNetworkPartner}
                    currentState={currentState}
                    onClose={handleSidenavClose}
                    onNavigate={onNavigate}
                    onMouseEnter={handleSidenavMouseEnter}
                    onMouseLeave={handleSidenavMouseLeave}
                />
            </Stack>
            {body}
        </>
    );
};

export default AppShell;
