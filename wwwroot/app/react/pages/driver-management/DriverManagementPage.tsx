import React, {useEffect, useState} from 'react';
import {Box, Card, Stack, Tabs} from '@mantine/core';
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

/** Ordered to match DriverManagementTabs — the index is the stored value. */
const TAB_LABELS = [
    'Driver Details',
    "Today's Active",
    'Driver Compliance',
    'After Hours Schedule',
    'Driver Emails',
    'Driver Earnings',
];

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

    // Mantine's Tabs are keyed by string; the stored preference stays the numeric
    // index it has always been, so an existing localStorage value still resolves.
    const handleTabChange = (value: string | null) => {
        if (value == null) return;
        const newValue = Number(value);
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
        /*
         * The MUI original wrapped this in an `& .MuiCard-root` override that
         * restyled every card in the subtree — a descendant selector reaching into
         * children it did not own, which is why cards here looked unlike cards
         * anywhere else. Each card carries its own chrome now.
         */
        <Stack gap={16} h="100%" p={8} bg="var(--mantine-color-body)">
            {/* Page Header */}
            <Card withBorder p={0} radius="lg" style={{flexShrink: 0, overflow: 'hidden'}}>
                <Tabs value={String(selectedTab)} onChange={handleTabChange}>
                    <Tabs.List>
                        {TAB_LABELS.map((label, index) => (
                            <Tabs.Tab key={label} value={String(index)}>{label}</Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs>
            </Card>

            <Box style={{flex: 1, overflow: 'auto'}}>
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
        </Stack>
    );
};
