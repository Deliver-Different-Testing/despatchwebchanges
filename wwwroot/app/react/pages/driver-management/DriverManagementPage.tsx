import React, {useEffect, useState} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import {useFleetOptions} from '../../hooks/useDriverManagementApi';
import {DriverManagementPageProps} from '../../interfaces';
import {DriverDetailsTab} from './components/DriverDetailsTab';
import {TodayActiveTab} from './components/TodayActiveTab';
import {DriverComplianceTab} from './components/DriverComplianceTab';
import {AfterHoursTab} from './components/AfterHoursTab';
import {DriverEmailsTab} from './components/DriverEmailsTab';
import {DriverEarningsTab} from './components/DriverEarningsTab';

declare const ContactID: number;

enum DriverManagementTabs {
    DriverDetails = 0,
    TodayActive = 1,
    DriverCompliance = 2,
    AfterHours = 3,
    DriverEmails = 4,
    DriverEarnings = 5,
}

const TAB_KEY = `lastActiveTab-DriverManagement-${typeof ContactID !== 'undefined' ? ContactID : 0}`;

function getInitialTab(): number {
    try {
        const stored = localStorage.getItem(TAB_KEY);
        if (stored) return parseInt(stored, 10);
    } catch { /* ignore */ }
    return 0;
}

export const DriverManagementPage: React.FC<DriverManagementPageProps> = ({
    showToast,
    isUsCustomer = false,
    setRefreshCallback,
}) => {
    const [selectedTab, setSelectedTab] = useState<number>(getInitialTab);
    const {data: fleetOptions = []} = useFleetOptions();

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setSelectedTab(newValue);
        try { localStorage.setItem(TAB_KEY, newValue.toString()); } catch { /* ignore */ }
    };

    // Register refresh callback for AngularJS bridge
    useEffect(() => {
        if (setRefreshCallback) {
            setRefreshCallback(() => {
                // Force React Query to refetch on external refresh signal
                // Individual tabs handle their own data fetching
            });
        }
    }, [setRefreshCallback]);

    return (
        <Box sx={{height: '100%', bgcolor: 'background.default'}}>
        <Box sx={{
            height: '100%', display: 'flex', flexDirection: 'column', gap: 2,
            maxWidth: 1400, mx: 'auto', p: {xs: 2, md: 3},
            '& .MuiCard-root': {
                borderRadius: 3,
                boxShadow: 1,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {boxShadow: 3},
            },
        }}>
            {/* Page Header */}
            <Card sx={{flexShrink: 0, borderRadius: 1, overflow: 'hidden'}}>
                <Tabs
                    value={selectedTab}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{bgcolor: 'background.paper'}}
                >
                    <Tab label="Driver Details" />
                    <Tab label="Today's Active" />
                    <Tab label="Driver Compliance" />
                    <Tab label="After Hours Schedule" />
                    <Tab label="Driver Emails" />
                    <Tab label="Driver Earnings" />
                </Tabs>
            </Card>

            <Box sx={{flex: 1, overflow: 'auto'}}>
                {selectedTab === DriverManagementTabs.DriverDetails && (
                    <DriverDetailsTab showToast={showToast} />
                )}
                {selectedTab === DriverManagementTabs.TodayActive && (
                    <TodayActiveTab showToast={showToast} fleetOptions={fleetOptions} />
                )}
                {selectedTab === DriverManagementTabs.DriverCompliance && (
                    <DriverComplianceTab showToast={showToast} fleetOptions={fleetOptions} />
                )}
                {selectedTab === DriverManagementTabs.AfterHours && (
                    <AfterHoursTab showToast={showToast} isUsCustomer={isUsCustomer} />
                )}
                {selectedTab === DriverManagementTabs.DriverEmails && (
                    <DriverEmailsTab showToast={showToast} />
                )}
                {selectedTab === DriverManagementTabs.DriverEarnings && (
                    <DriverEarningsTab showToast={showToast} />
                )}
            </Box>
        </Box>
        </Box>
    );
};
