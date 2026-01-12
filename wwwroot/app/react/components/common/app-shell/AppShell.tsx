/**
 * React App Shell Component
 *
 * Combines the AppToolbar and SideNav into a single shell component
 * that manages the interaction between them.
 */

import React from 'react';
import {Box} from '@mui/material';
import {AppToolbar} from '../app-toolbar/AppToolbar';
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

interface AppShellState {
    sidenavOpen: boolean;
}

export class AppShell extends React.Component<AppShellProps, AppShellState> {
    private closeTimeoutRef: number | null = null;

    constructor(props: AppShellProps) {
        super(props);
        this.state = {
            sidenavOpen: false,
        };
    }

    componentWillUnmount(): void {
        if (this.closeTimeoutRef) {
            window.clearTimeout(this.closeTimeoutRef);
        }
    }

    private handleMenuHover = (): void => {
        // Clear any pending close timeout
        if (this.closeTimeoutRef) {
            window.clearTimeout(this.closeTimeoutRef);
            this.closeTimeoutRef = null;
        }
        this.setState({sidenavOpen: true});
    };

    private handleSidenavClose = (): void => {
        this.setState({sidenavOpen: false});
    };

    private handleSidenavMouseEnter = (): void => {
        // Clear any pending close timeout
        if (this.closeTimeoutRef) {
            window.clearTimeout(this.closeTimeoutRef);
            this.closeTimeoutRef = null;
        }
    };

    private handleSidenavMouseLeave = (): void => {
        // Delay closing to allow for re-entry
        this.closeTimeoutRef = window.setTimeout(() => {
            this.setState({sidenavOpen: false});
        }, 300);
    };

    render(): React.ReactNode {
        const {
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
        } = this.props;
        const {sidenavOpen} = this.state;

        return (
            <Box sx={{display: 'flex', flexDirection: 'column'}}>
                <AppToolbar
                    title={title}
                    firstName={firstName}
                    logoUrl={logoUrl}
                    onLogoClick={onLogoClick}
                    onMenuHover={this.handleMenuHover}
                >
                    {children}
                </AppToolbar>

                <SideNav
                    open={sidenavOpen}
                    userName={fullName}
                    companyName={companyName}
                    isUsCustomer={isUsCustomer}
                    currentState={currentState}
                    onClose={this.handleSidenavClose}
                    onNavigate={onNavigate}
                    onMouseEnter={this.handleSidenavMouseEnter}
                    onMouseLeave={this.handleSidenavMouseLeave}
                />
            </Box>
        );
    }
}

export default AppShell;
