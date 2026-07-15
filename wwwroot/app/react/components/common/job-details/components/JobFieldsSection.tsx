/**
 * JobFieldsSection - Material 3 elevated cards laid out in a 60/40 column split.
 *
 * Left column (60%):
 *   - Package Details + Additional Info (side by side 50/50)
 *   - Delivery Details
 *   - Tracking
 *
 * Right column (40%):
 *   - Booked By
 *   - Job Details
 *   - Client
 */

import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import DescriptionIcon from '@mui/icons-material/Description';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {EditableField} from './EditableField';
import {SectionHeader} from './SectionHeader';
import type {IJob} from '../JobDetails.types';
import {getTrackingMethodText} from '../JobDetails.types';
import {cardContainerSx} from '../JobDetails.styles';

interface JobFieldsSectionProps {
    job: IJob;
    dense: boolean;
    isUsCustomer: boolean;
    isEditMode: boolean;
    isFieldVisible: (key: string) => boolean;
    onToggleField: (key: string) => void;
    onSpeedClick: () => void;
    onJobTypeClick: () => void;
    onSizeClick: () => void;
    onEditRefA: () => void;
    onEditRefB: () => void;
    onEditOurRef: () => void;
    onEditConNote: () => void;
    onDgClassClick: () => void;
    onLeaveClick: () => void;
    onTrackingMethodClick: () => void;
    onEditTrackingMobile: () => void;
    onEditTrackingEmail: () => void;
    onCourierClick: () => void;
    onContactClick: () => void;
    onClientClick: () => void;
    onEditCustomJobName: () => void;
    onEditDimensions: () => void;
    onInActiveByClick: () => void;
}

/** Edit-mode visibility toggle for the section header endAction slot. */
function VisibilityToggle({
    sectionKey,
    isVisible,
    onToggleVisibility,
}: {
    sectionKey: string;
    isVisible: boolean;
    onToggleVisibility: (key: string) => void;
}) {
    return (
        <Tooltip title={isVisible ? 'Hide section' : 'Show section'}>
            <IconButton size="small" onClick={() => onToggleVisibility(sectionKey)}>
                {isVisible ? <VisibilityIcon sx={{fontSize: 18}} /> : <VisibilityOffIcon sx={{fontSize: 18}} />}
            </IconButton>
        </Tooltip>
    );
}

export const JobFieldsSection = React.memo(({
                                                job,
                                                dense,
                                                isUsCustomer,
                                                isEditMode,
                                                isFieldVisible,
                                                onToggleField,
                                                onSpeedClick,
                                                onJobTypeClick,
                                                onSizeClick,
                                                onEditRefA,
                                                onEditRefB,
                                                onEditOurRef,
                                                onEditConNote,
                                                onDgClassClick,
                                                onLeaveClick,
                                                onTrackingMethodClick,
                                                onEditTrackingMobile,
                                                onEditTrackingEmail,
                                                onCourierClick,
                                                onContactClick,
                                                onClientClick,
                                                onEditCustomJobName,
                                                onEditDimensions,
                                                onInActiveByClick,
                                            }: JobFieldsSectionProps) => {
    const locked = !!job.locked;

    const hasDgDocs = job.dgClass
        ? ((job.dgClass || 0) === 1 || job.dgDocumentation ? 'Yes' : 'No')
        : '';

    const editEndAction = (key: string) => (
        isEditMode ? (
            <VisibilityToggle
                sectionKey={key}
                isVisible={isFieldVisible(key)}
                onToggleVisibility={onToggleField}
            />
        ) : undefined
    );

    return (
        <Box sx={{display: 'flex', gap: 1.5, flexDirection: {xs: 'column', md: 'row'}}}>
            {/* Left Column - 60% */}
            <Stack spacing={1.5} sx={{flex: 3, minWidth: 0}}>
                {/* Package Details + Additional Info — side by side */}
                <Box sx={{display: 'flex', gap: 1.5, flexDirection: {xs: 'column', sm: 'row'}}}>
                    <Box sx={{...cardContainerSx as object, flex: 1, minWidth: 0}}>
                        <SectionHeader
                            icon={Inventory2Icon}
                            title="Package Details"
                            dense={dense}
                            endAction={editEndAction('packageDetails')}
                        />
                        <Collapse in={isFieldVisible('packageDetails')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="straighten" label="Quantity"
                                    value={(() => {
                                        const pallets = job.palletInfo ?? [];
                                        const palletQty = pallets.reduce((sum, p) => sum + (p.quantity || 0), 0);
                                        const count = palletQty || job.parcelDimensions?.length || 0;
                                        const weight = job.weight;
                                        // Cube total from the same source the count prefers (pallets first,
                                        // then parcels). Pallet cubic is per-unit (× quantity); parcel cubic
                                        // is already stored per-barcode, so a plain sum reconstructs the total.
                                        const cube = palletQty
                                            ? pallets.reduce((sum, p) => sum + (p.cubic || 0) * (p.quantity || 1), 0)
                                            : (job.parcelDimensions ?? []).reduce((sum, p) => sum + (p.cubic || 0), 0);
                                        const parts: string[] = [];
                                        if (count) parts.push(`${count} parcel${count !== 1 ? 's' : ''}`);
                                        if (weight != null) parts.push(`${weight} ${isUsCustomer ? 'lbs' : 'kg'}`);
                                        if (cube > 0) parts.push(`${cube.toFixed(3)} ${isUsCustomer ? 'ft³' : 'm³'}`);
                                        return parts.length ? parts.join(' · ') : '—';
                                    })()}
                                    onClick={onEditDimensions} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('dimensions')}
                                    onToggleVisibility={onToggleField} fieldKey="dimensions"
                                    endAdornment={job.calculateDimsOncePerJob ?
                                        <Tooltip title="Dimensions calculated once per job">
                                            <Box data-testid="calc-once-indicator" sx={{width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1, flexShrink: 0}} />
                                        </Tooltip> : undefined}
                                />
                                <EditableField
                                    icon="qr_code" label="Barcode" value={job.barcode}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('dimensions')}
                                    onToggleVisibility={onToggleField} fieldKey="dimensions"
                                />
                            </List>
                        </Collapse>
                    </Box>

                    <Box sx={{...cardContainerSx as object, flex: 1, minWidth: 0}}>
                        <SectionHeader
                            icon={DescriptionIcon}
                            title="Additional Info"
                            dense={dense}
                            endAction={editEndAction('additionalInfo')}
                        />
                        <Collapse in={isFieldVisible('additionalInfo')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="warning" label="DG Class"
                                    value={job.dgClass ? `Class ${job.dgClass}` : undefined}
                                    onClick={onDgClassClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('dgDocs')}
                                    onToggleVisibility={onToggleField} fieldKey="dgDocs"
                                />
                                {job.dgClass && (
                                    <EditableField
                                        icon="description" label="DG Docs" value={hasDgDocs}
                                        dense={dense}
                                    />
                                )}
                                <EditableField
                                    icon="package_2" label="Leave Parcel"
                                    value={job.sigNotRequired || 'Signature Required'}
                                    onClick={onLeaveClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('leaveParcel')}
                                    onToggleVisibility={onToggleField} fieldKey="leaveParcel"
                                />
                            </List>
                        </Collapse>
                    </Box>
                </Box>

                {/* Delivery Details */}
                {(isEditMode || isFieldVisible('deliveryDetails')) && (
                    <Box sx={cardContainerSx}>
                        <SectionHeader
                            icon={LocalShippingIcon}
                            title="Delivery Details"
                            dense={dense}
                            endAction={editEndAction('deliveryDetails')}
                        />
                        <Collapse in={isFieldVisible('deliveryDetails')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="person" label="Dispatcher" value={job.dispatcherName}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('dispatcherName')}
                                    onToggleVisibility={onToggleField} fieldKey="dispatcherName"
                                />
                                <EditableField
                                    icon="delivery_truck_speed" label="Courier" value={job.courierData?.courierName}
                                    onClick={onCourierClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('courierName')}
                                    onToggleVisibility={onToggleField} fieldKey="courierName"
                                />
                                <EditableField
                                    icon="badge" label="Courier Number" value={job.courierData?.courierNumber}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('courierNumber')}
                                    onToggleVisibility={onToggleField} fieldKey="courierNumber"
                                />
                                <EditableField
                                    icon="phone_android" label="Courier Mobile" value={job.courierData?.courierMobile}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('courierMobile')}
                                    onToggleVisibility={onToggleField} fieldKey="courierMobile"
                                />
                                <EditableField
                                    icon="schedule" label="Schedule" value={job.scheduleName}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('scheduleName')}
                                    onToggleVisibility={onToggleField} fieldKey="scheduleName"
                                />
                            </List>
                        </Collapse>
                    </Box>
                )}

                {/* Tracking */}
                {(isEditMode || isFieldVisible('trackingSection')) && (
                    <Box sx={cardContainerSx}>
                        <SectionHeader
                            icon={TrackChangesIcon}
                            title="Tracking"
                            dense={dense}
                            endAction={editEndAction('trackingSection')}
                        />
                        <Collapse in={isFieldVisible('trackingSection')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="notifications" label="Method" value={getTrackingMethodText(job.trackingMethod)}
                                    onClick={onTrackingMethodClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('tracking')}
                                    onToggleVisibility={onToggleField} fieldKey="tracking"
                                />
                                <EditableField
                                    icon="phone" label="Mobile" value={job.trackingMobile}
                                    onClick={onEditTrackingMobile} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('mobile')}
                                    onToggleVisibility={onToggleField} fieldKey="mobile"
                                />
                                <EditableField
                                    icon="email" label="Email" value={job.trackingEmail}
                                    onClick={onEditTrackingEmail} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('email')}
                                    onToggleVisibility={onToggleField} fieldKey="email"
                                />
                            </List>
                        </Collapse>
                    </Box>
                )}
            </Stack>

            {/* Right Column - 40% */}
            <Stack spacing={1.5} sx={{flex: 2, minWidth: 0}}>
                {/* Booked By */}
                {(isEditMode || isFieldVisible('bookedBy')) && (
                    <Box sx={cardContainerSx}>
                        <SectionHeader
                            icon={PersonOutlineIcon}
                            title="Booked By"
                            dense={dense}
                            endAction={editEndAction('bookedBy')}
                        />
                        <Collapse in={isFieldVisible('bookedBy')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="account_circle" label="Logged In" value={job.loggedInContactName}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('loggedInContactName')}
                                    onToggleVisibility={onToggleField} fieldKey="loggedInContactName"
                                />
                                <EditableField
                                    icon="source" label="Source" value={job.bookingSource?.text}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('bookingSource')}
                                    onToggleVisibility={onToggleField} fieldKey="bookingSource"
                                />
                                <EditableField
                                    icon="contacts" label="Contact" value={job.fromContactName}
                                    onClick={onContactClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('fromContactName')}
                                    onToggleVisibility={onToggleField} fieldKey="fromContactName"
                                />
                                <EditableField
                                    icon="phone" label="Phone" value={job.fromContactNumber}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('fromContactNumber')}
                                    onToggleVisibility={onToggleField} fieldKey="fromContactNumber"
                                />
                            </List>
                        </Collapse>
                    </Box>
                )}

                {/* Job Details */}
                {(isEditMode || isFieldVisible('jobDetails')) && (
                    <Box sx={cardContainerSx}>
                        <SectionHeader
                            icon={WorkOutlineIcon}
                            title="Job Details"
                            dense={dense}
                            endAction={editEndAction('jobDetails')}
                        />
                        <Collapse in={isFieldVisible('jobDetails')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="label" label="Job Name" value={job.customJobName}
                                    onClick={onEditCustomJobName} disabled={locked}
                                    dense={dense}
                                />
                                <EditableField
                                    icon="speed" label="Speed" value={job.speedName}
                                    onClick={onSpeedClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('speedName')}
                                    onToggleVisibility={onToggleField} fieldKey="speedName"
                                />
                                <EditableField
                                    icon="notifications" label="Notified" value={job.notifiedName}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('notifiedSpeed')}
                                    onToggleVisibility={onToggleField} fieldKey="notifiedSpeed"
                                />
                                <EditableField
                                    icon="category" label="Job Type" value={job.jobTypeDescription}
                                    onClick={onJobTypeClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('jobTypeDescription')}
                                    onToggleVisibility={onToggleField} fieldKey="jobTypeDescription"
                                />
                                <EditableField
                                    icon="photo_size_select_large" label="Size" value={job.size?.text}
                                    onClick={onSizeClick} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('sizeText')}
                                    onToggleVisibility={onToggleField} fieldKey="sizeText"
                                />
                                <EditableField
                                    icon="bookmark" label="Ref A" value={job.refA}
                                    onClick={onEditRefA} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('refA')}
                                    onToggleVisibility={onToggleField} fieldKey="refA"
                                />
                                <EditableField
                                    icon="bookmark_border" label="Ref B" value={job.refB}
                                    onClick={onEditRefB} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('refB')}
                                    onToggleVisibility={onToggleField} fieldKey="refB"
                                />
                                <EditableField
                                    icon="tag" label="Our Ref" value={job.ourRef}
                                    onClick={onEditOurRef} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('ourRef')}
                                    onToggleVisibility={onToggleField} fieldKey="ourRef"
                                />
                                <EditableField
                                    icon="local_shipping" label="AWB" value={job.conNote}
                                    onClick={onEditConNote} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('conNote')}
                                    onToggleVisibility={onToggleField} fieldKey="conNote"
                                />
                            </List>
                        </Collapse>
                    </Box>
                )}

                {/* Client */}
                <Box sx={cardContainerSx}>
                    <SectionHeader icon={BusinessIcon} title="Client" dense={dense} />
                    <List dense disablePadding>
                        <EditableField
                            icon="business" label="Client" value={job.clientName}
                            onClick={onClientClick} disabled={locked}
                            dense={dense} isEditMode={isEditMode}
                            isVisible={isFieldVisible('client')}
                            onToggleVisibility={onToggleField} fieldKey="client"
                        />
                        {job.inActiveBy && (
                            <EditableField
                                icon="person_off" label="InActive By" value={job.inActiveBy?.text}
                                onClick={onInActiveByClick} disabled={locked}
                                dense={dense}
                            />
                        )}
                    </List>
                </Box>
            </Stack>
        </Box>
    );
});
