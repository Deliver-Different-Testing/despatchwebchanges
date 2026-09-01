import {Autocomplete, Badge, Card, Group, Loader, SimpleGrid, Stack, Text} from '@mantine/core';
import {Car, IdCard, Info, Landmark, Mail, Phone, Search, ShieldCheck, UserSearch} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import classes from './DriverDetailsTab.module.css';
import React, {useState} from 'react';
import {PanelHeader} from '../../../components/common/panel-header';
import {useDriverSearch, useCourierDetails} from '../../../hooks/useDriverManagementApi';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';

interface DriverDetailsTabProps {
    showToast: ShowToastFn;
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '\u2014';
    return dayjs(dateStr).format('DD/MM/YYYY');
};

const InfoRow = ({label, value}: { label: string; value: React.ReactNode }) => (
    <div className={classes.infoRow}>
        <Text fz="sm" fw={500} c="dimmed">{label}</Text>
        <Text fz="sm">{value}</Text>
    </div>
);

const BoolBadge = ({value}: { value?: boolean }) => (
    <Badge size="sm" tt="none" variant="light" color={value ? 'green' : 'gray'}>
        {value ? 'Yes' : 'No'}
    </Badge>
);

const InfoCard = ({icon, title, children}: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <Card withBorder p={0} radius="sm" style={{overflow: 'hidden'}}>
        <PanelHeader icon={icon} title={title} />
        <div style={{padding: 16}}>
            {children}
        </div>
    </Card>
);

export const DriverDetailsTab: React.FC<DriverDetailsTabProps> = ({showToast: _showToast}) => {
    const [searchText, setSearchText] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState<number>(0);

    const {data: searchResults = [], isLoading: isSearching} = useDriverSearch(searchText);
    const {data: driver, isLoading: isLoadingDetails} = useCourierDetails(selectedDriverId);

    const handleDriverSelect = (value: string) => {
        setSearchText(value);
        const match = searchResults.find(option => option.text === value);
        setSelectedDriverId(match?.id ?? 0);
    };

    return (
        <Stack gap={16}>
            {/* Search Section */}
            <Card withBorder p={0} radius="sm" style={{overflow: 'hidden'}}>
                <PanelHeader
                    icon={<Icon lucide={Search}/>}
                    title="Driver search"
                    action={
                        <Text fz="xs" c="inherit" style={{opacity: 0.85}}>
                            Wildcards work here — try a partial name or code
                        </Text>
                    }
                />
                <div style={{padding: 16}}>
                    {/*
                      * Mantine's Autocomplete carries a string, not an option object,
                      * so the driver is resolved from the chosen label. Typing without
                      * matching clears the selection, which keeps a half-typed name
                      * from silently holding the previous driver's details on screen.
                      */}
                    <Autocomplete
                        size="xs"
                        label="Select driver"
                        maw={400}
                        value={searchText}
                        onChange={handleDriverSelect}
                        data={searchResults.map(option => option.text)}
                        rightSection={isSearching ? <Loader size={16} aria-label="Searching drivers"/> : undefined}
                    />
                    {!isSearching && searchText.length > 0 && searchResults.length === 0 && (
                        <Text fz="xs" c="dimmed" mt={4}>
                            No drivers match that search. Try fewer characters.
                        </Text>
                    )}
                </div>
            </Card>
            {/* Loading */}
            {isLoadingDetails && (
                <Group justify="center" py={48}>
                    <Loader size={64} aria-label="Loading driver details"/>
                </Group>
            )}
            {/* Driver Summary Bar */}
            {!isLoadingDetails && driver && (
                /*
                 * Was a bespoke Toolbar built from the legacy headerSurfaceSx /
                 * headerBadgeSx tokens. PanelHeader *is* that bar, so the summary
                 * takes it: same 48px surface, same keyline, one definition.
                 */
                <Card withBorder p={0} radius="sm" style={{overflow: 'hidden'}}>
                    <PanelHeader
                        icon={<Icon lucide={IdCard}/>}
                        title={`${driver.basicInformation.code} — ${driver.basicInformation.firstName} ${driver.basicInformation.surname}`}
                        action={driver.basicInformation.email ? (
                            <Badge
                                size="sm"
                                tt="none"
                                variant="default"
                                leftSection={<Icon lucide={Mail} size={14}/>}
                            >
                                {driver.basicInformation.email}
                            </Badge>
                        ) : undefined}
                    />
                </Card>
            )}
            {/* Driver Information Grid */}
            {!isLoadingDetails && driver && (
                <SimpleGrid cols={{base: 1, md: 2, lg: 3}} spacing={16}>
                    <InfoCard icon={<Icon lucide={IdCard}/>} title="Basic Information">
                        <InfoRow label="Code" value={driver.basicInformation.code} />
                        <InfoRow label="Name" value={`${driver.basicInformation.firstName} ${driver.basicInformation.surname}`} />
                        <InfoRow label="Email" value={driver.basicInformation.email} />
                        <InfoRow label="Address" value={driver.basicInformation.address} />
                    </InfoCard>

                    <InfoCard icon={<Icon lucide={Phone}/>} title="Contact Information">
                        <InfoRow label="Home Phone" value={driver.contactInformation.home || '\u2014'} />
                        <InfoRow label="Mobile" value={driver.contactInformation.mobile} />
                        <InfoRow label="GST Number" value={driver.contactInformation.gstNumber || '\u2014'} />
                        <InfoRow label="IRD Number" value={driver.contactInformation.irdNumber || '\u2014'} />
                    </InfoCard>

                    <InfoCard icon={<Icon lucide={Car}/>} title="Vehicle Information">
                        <InfoRow label="Registration" value={driver.vehicleInformation.rego} />
                        <InfoRow label="Model" value={driver.vehicleInformation.vehicleModel} />
                        <InfoRow label="Year" value={driver.vehicleInformation.vehicleYear ?? '\u2014'} />
                        <InfoRow label="Insurance" value={driver.vehicleInformation.vehicleInsurance || '\u2014'} />
                    </InfoCard>

                    <InfoCard icon={<Icon lucide={ShieldCheck}/>} title="Compliance">
                        <InfoRow label="Dangerous Goods" value={<BoolBadge value={driver.compliance.dangerousGoods} />} />
                        <InfoRow label="DG Expiry" value={formatDate(driver.compliance.dangerousGoodsExpiry)} />
                        <InfoRow label="License Expiry" value={formatDate(driver.compliance.driversLicenceExpiry)} />
                    </InfoCard>

                    <InfoCard icon={<Icon lucide={Landmark}/>} title="Banking & Emergency">
                        <InfoRow label="Emergency Contact" value={<BoolBadge value={driver.bankingAndEmergency.emergencyContact} />} />
                        <InfoRow label="Bank" value={driver.bankingAndEmergency.bank || '\u2014'} />
                        <InfoRow label="Security Check" value={<BoolBadge value={driver.bankingAndEmergency.securityCheck} />} />
                    </InfoCard>

                    <InfoCard icon={<Icon lucide={Info}/>} title="Additional Information">
                        <InfoRow label="Contract Date" value={formatDate(driver.additionalInformation.contactSignDate)} />
                        <InfoRow label="Mobile Insurance" value={driver.additionalInformation.mobileInsurence ?? '\u2014'} />
                        <InfoRow label="Daily Profit Adjust" value={driver.additionalInformation.dailyProfitAdjust || '\u2014'} />
                        <InfoRow label="Notes" value={driver.additionalInformation.notes || '\u2014'} />
                    </InfoCard>
                </SimpleGrid>
            )}
            {/* Empty State */}
            {!isLoadingDetails && !driver && (
                <Card withBorder radius="sm">
                    <Stack align="center" gap={4} py={64} c="dimmed">
                        <Icon lucide={UserSearch} size={48}/>
                        <Text fw={600} mt={8}>No driver selected</Text>
                        <Text fz="sm">Search above to see a driver&apos;s details.</Text>
                    </Stack>
                </Card>
            )}
        </Stack>
    );
};
