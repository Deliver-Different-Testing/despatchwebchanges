import React, {useState} from 'react';
import {alpha} from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import EmailIcon from '@mui/icons-material/Email';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import type {SxProps, Theme} from '@mui/material';
import {useDriverSearch, useCourierDetails} from '../../../hooks/useDriverManagementApi';
import {FleetOption} from '../../../interfaces';
import type {ShowToastFn} from '../../../services/toastService';
import dayjs from 'dayjs';

const cardHeaderStyle: SxProps<Theme> = (theme: Theme) => ({
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    minHeight: 40,
    px: 1.25,
    gap: 0.5,
    flexShrink: 0,
    boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
    '& .MuiIconButton-root': {
        color: 'inherit',
        p: 0.5,
        borderRadius: 1,
        transition: 'background-color 150ms ease, transform 150ms ease',
        '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.15),
        },
        '&:active': {
            transform: 'scale(0.92)',
        },
    },
});

interface DriverDetailsTabProps {
    showToast: ShowToastFn;
}

export const DriverDetailsTab: React.FC<DriverDetailsTabProps> = ({showToast: _showToast}) => {
    const [searchText, setSearchText] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState<number>(0);

    const {data: searchResults = [], isLoading: isSearching} = useDriverSearch(searchText);
    const {data: driver, isLoading: isLoadingDetails} = useCourierDetails(selectedDriverId);

    const handleDriverSelect = (_event: unknown, value: FleetOption | null) => {
        setSelectedDriverId(value?.id ?? 0);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '\u2014';
        return dayjs(dateStr).format('DD/MM/YYYY');
    };

    const InfoRow = ({label, value}: { label: string; value: React.ReactNode }) => (
        <Box sx={{display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': {borderBottom: 'none'}}}>
            <Typography variant="body2" color="text.secondary" sx={{fontWeight: 500}}>{label}</Typography>
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

    const InfoCard = ({iconName, title, children}: { iconName: string; title: string; children: React.ReactNode }) => (
        <Card sx={{overflow: 'hidden'}}>
            <Toolbar variant="dense" disableGutters sx={cardHeaderStyle}>
                <Icon sx={{fontSize: 20, mr: 0.75, opacity: 0.9}} baseClassName="material-symbols-outlined">{iconName}</Icon>
                <Typography variant="subtitle2" noWrap sx={{fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.01em'}}>{title}</Typography>
            </Toolbar>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {/* Search Section */}
            <Card sx={{overflow: 'hidden'}}>
                <Toolbar variant="dense" disableGutters sx={cardHeaderStyle}>
                    <Icon sx={{fontSize: 20, mr: 0.75, opacity: 0.9}} baseClassName="material-symbols-outlined">search</Icon>
                    <Typography variant="subtitle2" noWrap sx={{fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.01em'}}>Driver Search</Typography>
                    <Typography variant="caption" sx={{ml: 1, opacity: 0.75}}>Tip: This is a wildcard search!</Typography>
                </Toolbar>
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
                <Card sx={{overflow: 'hidden'}}>
                    <Toolbar variant="dense" disableGutters sx={cardHeaderStyle}>
                        <Icon sx={{fontSize: 20, mr: 0.75, opacity: 0.9}} baseClassName="material-symbols-outlined">badge</Icon>
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
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.15)',
                                    color: 'inherit',
                                    '& .MuiChip-icon': {color: 'inherit'},
                                }}
                            />
                        )}
                    </Toolbar>
                </Card>
            )}

            {/* Driver Information Grid */}
            {!isLoadingDetails && driver && (
                <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr'}, gap: 2}}>
                    <InfoCard iconName="badge" title="Basic Information">
                        <InfoRow label="Code" value={driver.basicInformation.code} />
                        <InfoRow label="Name" value={`${driver.basicInformation.firstName} ${driver.basicInformation.surname}`} />
                        <InfoRow label="Email" value={driver.basicInformation.email} />
                        <InfoRow label="Address" value={driver.basicInformation.address} />
                    </InfoCard>

                    <InfoCard iconName="phone" title="Contact Information">
                        <InfoRow label="Home Phone" value={driver.contactInformation.home || '\u2014'} />
                        <InfoRow label="Mobile" value={driver.contactInformation.mobile} />
                        <InfoRow label="GST Number" value={driver.contactInformation.gstNumber || '\u2014'} />
                        <InfoRow label="IRD Number" value={driver.contactInformation.irdNumber || '\u2014'} />
                    </InfoCard>

                    <InfoCard iconName="directions_car" title="Vehicle Information">
                        <InfoRow label="Registration" value={driver.vehicleInformation.rego} />
                        <InfoRow label="Model" value={driver.vehicleInformation.vehicleModel} />
                        <InfoRow label="Year" value={driver.vehicleInformation.vehicleYear ?? '\u2014'} />
                        <InfoRow label="Insurance" value={driver.vehicleInformation.vehicleInsurance || '\u2014'} />
                    </InfoCard>

                    <InfoCard iconName="verified_user" title="Compliance">
                        <InfoRow label="Dangerous Goods" value={<BoolBadge value={driver.compliance.dangerousGoods} />} />
                        <InfoRow label="DG Expiry" value={formatDate(driver.compliance.dangerousGoodsExpiry)} />
                        <InfoRow label="License Expiry" value={formatDate(driver.compliance.driversLicenceExpiry)} />
                    </InfoCard>

                    <InfoCard iconName="account_balance" title="Banking & Emergency">
                        <InfoRow label="Emergency Contact" value={<BoolBadge value={driver.bankingAndEmergency.emergencyContact} />} />
                        <InfoRow label="Bank" value={driver.bankingAndEmergency.bank || '\u2014'} />
                        <InfoRow label="Security Check" value={<BoolBadge value={driver.bankingAndEmergency.securityCheck} />} />
                    </InfoCard>

                    <InfoCard iconName="info" title="Additional Information">
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
                        <Typography variant="body1" sx={{fontWeight: 600}} color="text.secondary">No Driver Selected</Typography>
                        <Typography variant="body2" color="text.secondary">Please select a driver from the search box above to view their details</Typography>
                    </Box>
                </Card>
            )}
        </Box>
    );
};
