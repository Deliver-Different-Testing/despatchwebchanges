import React, {useState} from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import BadgeIcon from '@mui/icons-material/Badge';
import PhoneIcon from '@mui/icons-material/Phone';
import CarIcon from '@mui/icons-material/DirectionsCar';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import BankIcon from '@mui/icons-material/AccountBalance';
import EmailIcon from '@mui/icons-material/Email';
import InfoIcon from '@mui/icons-material/Info';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SearchIcon from '@mui/icons-material/Search';
import {PanelHeader} from '../../../components/common/panel-header';
import {useDriverSearch, useCourierDetails} from '../../../hooks/useDriverManagementApi';
import {FleetOption} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';
import {headerAccentColor, headerBadgeSx, headerSurfaceSx} from '../../../components/dialogs/shared/styles';
import dayjs from 'dayjs';

interface DriverDetailsTabProps {
    showToast: ShowToastFn;
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '\u2014';
    return dayjs(dateStr).format('DD/MM/YYYY');
};

const InfoRow = ({label, value}: { label: string; value: React.ReactNode }) => (
    <Box sx={{display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': {borderBottom: 'none'}}}>
        <Typography
            variant="body2"
            sx={{
                color: "text.secondary",
                fontWeight: 500
            }}>{label}</Typography>
        <Typography variant="body2">{value}</Typography>
    </Box>
);

const BoolBadge = ({value}: { value?: boolean }) => (
    <Box component="span" sx={{
        px: 1, py: 0.25, borderRadius: 1, fontSize: '0.8125rem', fontWeight: 500,
        bgcolor: value ? 'success.light' : 'grey.200',
        color: value ? 'success.contrastText' : 'text.secondary',
    }}>
        {value ? 'Yes' : 'No'}
    </Box>
);

const InfoCard = ({icon, title, children}: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
        <PanelHeader icon={icon} title={title} />
        <CardContent>
            {children}
        </CardContent>
    </Card>
);

export const DriverDetailsTab: React.FC<DriverDetailsTabProps> = ({showToast: _showToast}) => {
    const [searchText, setSearchText] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState<number>(0);

    const {data: searchResults = [], isLoading: isSearching} = useDriverSearch(searchText);
    const {data: driver, isLoading: isLoadingDetails} = useCourierDetails(selectedDriverId);

    const handleDriverSelect = (_event: unknown, value: FleetOption | null) => {
        setSelectedDriverId(value?.id ?? 0);
    };

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Search Section */}
            <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
                <PanelHeader
                    icon={<SearchIcon />}
                    title="Driver Search"
                    action={
                        <Typography variant="caption" sx={{opacity: 0.85, color: 'inherit'}}>
                            Tip: This is a wildcard search!
                        </Typography>
                    }
                />
                <CardContent>
                    <Autocomplete
                        options={searchResults}
                        getOptionLabel={(option) => option.text}
                        loading={isSearching}
                        onInputChange={(_e, value) => setSearchText(value)}
                        onChange={handleDriverSelect}
                        noOptionsText="No drivers were found. Please review your search and try again."
                        sx={{maxWidth: 400}}
                        renderInput={(params) => (
                            <TextField {...params} label="Select Driver" variant="outlined" size="small" />
                        )}
                    />
                </CardContent>
            </Card>
            {/* Loading */}
            {isLoadingDetails && (
                <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
                    <CircularProgress size={64} />
                </Box>
            )}
            {/* Driver Summary Bar */}
            {!isLoadingDetails && driver && (
                <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
                    <Toolbar
                        variant="dense"
                        sx={(theme) => ({
                            ...headerSurfaceSx(theme),
                            minHeight: 48,
                            gap: 2,
                        })}
                    >
                        <BadgeIcon sx={(theme) => ({fontSize: 20, color: headerAccentColor(theme)})}/>
                        <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                            {driver.basicInformation.code}
                        </Typography>
                        <Typography variant="subtitle2">
                            {driver.basicInformation.firstName} {driver.basicInformation.surname}
                        </Typography>
                        {driver.basicInformation.email && (
                            <Chip
                                icon={<EmailIcon sx={{fontSize: 16, color: 'inherit !important'}} />}
                                label={driver.basicInformation.email}
                                size="small"
                                sx={(theme) => ({
                                    ...headerBadgeSx(theme),
                                    '& .MuiChip-icon': {color: 'inherit'},
                                })}
                            />
                        )}
                    </Toolbar>
                </Card>
            )}
            {/* Driver Information Grid */}
            {!isLoadingDetails && driver && (
                <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr'}, gap: 2}}>
                    <InfoCard icon={<BadgeIcon />} title="Basic Information">
                        <InfoRow label="Code" value={driver.basicInformation.code} />
                        <InfoRow label="Name" value={`${driver.basicInformation.firstName} ${driver.basicInformation.surname}`} />
                        <InfoRow label="Email" value={driver.basicInformation.email} />
                        <InfoRow label="Address" value={driver.basicInformation.address} />
                    </InfoCard>

                    <InfoCard icon={<PhoneIcon />} title="Contact Information">
                        <InfoRow label="Home Phone" value={driver.contactInformation.home || '\u2014'} />
                        <InfoRow label="Mobile" value={driver.contactInformation.mobile} />
                        <InfoRow label="GST Number" value={driver.contactInformation.gstNumber || '\u2014'} />
                        <InfoRow label="IRD Number" value={driver.contactInformation.irdNumber || '\u2014'} />
                    </InfoCard>

                    <InfoCard icon={<CarIcon />} title="Vehicle Information">
                        <InfoRow label="Registration" value={driver.vehicleInformation.rego} />
                        <InfoRow label="Model" value={driver.vehicleInformation.vehicleModel} />
                        <InfoRow label="Year" value={driver.vehicleInformation.vehicleYear ?? '\u2014'} />
                        <InfoRow label="Insurance" value={driver.vehicleInformation.vehicleInsurance || '\u2014'} />
                    </InfoCard>

                    <InfoCard icon={<VerifiedIcon />} title="Compliance">
                        <InfoRow label="Dangerous Goods" value={<BoolBadge value={driver.compliance.dangerousGoods} />} />
                        <InfoRow label="DG Expiry" value={formatDate(driver.compliance.dangerousGoodsExpiry)} />
                        <InfoRow label="License Expiry" value={formatDate(driver.compliance.driversLicenceExpiry)} />
                    </InfoCard>

                    <InfoCard icon={<BankIcon />} title="Banking & Emergency">
                        <InfoRow label="Emergency Contact" value={<BoolBadge value={driver.bankingAndEmergency.emergencyContact} />} />
                        <InfoRow label="Bank" value={driver.bankingAndEmergency.bank || '\u2014'} />
                        <InfoRow label="Security Check" value={<BoolBadge value={driver.bankingAndEmergency.securityCheck} />} />
                    </InfoCard>

                    <InfoCard icon={<InfoIcon />} title="Additional Information">
                        <InfoRow label="Contract Date" value={formatDate(driver.additionalInformation.contactSignDate)} />
                        <InfoRow label="Mobile Insurance" value={driver.additionalInformation.mobileInsurence ?? '\u2014'} />
                        <InfoRow label="Daily Profit Adjust" value={driver.additionalInformation.dailyProfitAdjust || '\u2014'} />
                        <InfoRow label="Notes" value={driver.additionalInformation.notes || '\u2014'} />
                    </InfoCard>
                </Box>
            )}
            {/* Empty State */}
            {!isLoadingDetails && !driver && (
                <Card sx={{borderRadius: 1}}>
                    <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8}}>
                        <PersonSearchIcon sx={{fontSize: 48, color: 'grey.400', mb: 1}} />
                        <Typography
                            variant="body1"
                            sx={{
                                color: "text.secondary",
                                fontWeight: 600
                            }}>No Driver Selected</Typography>
                        <Typography variant="body2" sx={{
                            color: "text.secondary"
                        }}>Please select a driver from the search box above to view their details</Typography>
                    </Box>
                </Card>
            )}
        </Box>
    );
};
