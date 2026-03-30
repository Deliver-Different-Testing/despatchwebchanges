/**
 * JobFieldsSection - Material Design list-based layout matching AngularJS md-list pattern
 *
 * Left column (60%):
 *   - Package Details + Additional Info (side by side 50/50)
 *   - Delivery Details + Truck Options (side by side 50/50)
 *
 * Right column (40%):
 *   - Booked By
 *   - Job Details
 *   - Client
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import DescriptionIcon from '@mui/icons-material/Description';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import BusinessIcon from '@mui/icons-material/Business';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Chip from '@mui/material/Chip';
import {EditableField} from './EditableField';
import type {IJob} from '../JobDetails.types';
import {getTrackingMethodText} from '../JobDetails.types';
import {
    cardContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
    sectionBorderSx,
    getSectionToolbarSx,
} from '../JobDetails.styles';

const leftColumnSx = {...cardContainerSx as object, flex: 3, minWidth: 0};
const rightColumnSx = {...cardContainerSx as object, flex: 2, minWidth: 0, bgcolor: 'grey.50'};
const packageRowSx = {display: 'flex', flexDirection: {xs: 'column', sm: 'row'}, ...sectionBorderSx as object};

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
    onEditWeight: () => void;
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

function SectionToolbar({
                            title,
                            icon: IconComponent,
                            isEditMode,
                            sectionKey,
                            isVisible,
                            onToggleVisibility,
                            dense,
                        }: {
    title: string;
    icon: React.ComponentType<SvgIconProps>;
    isEditMode?: boolean;
    sectionKey?: string;
    isVisible?: boolean;
    onToggleVisibility?: (key: string) => void;
    dense?: boolean;
}) {
    const handleClick = React.useCallback(() => {
        if (sectionKey && onToggleVisibility) onToggleVisibility(sectionKey);
    }, [sectionKey, onToggleVisibility]);

    return (
        <Box sx={dense ? getSectionToolbarSx(true) : sectionToolbarSx}>
            <IconComponent sx={sectionToolbarIconSx}/>
            <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                {title}
            </Typography>
            <Box sx={{flex: 1}}/>
            {isEditMode && sectionKey && onToggleVisibility && (
                <IconButton size="small" onClick={handleClick}>
                    {isVisible ? <VisibilityIcon sx={{fontSize: 18}}/> : <VisibilityOffIcon sx={{fontSize: 18}}/>}
                </IconButton>
            )}
        </Box>
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
                                                onEditWeight,
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

    return (
        <Box sx={{display: 'flex', gap: 2, flexDirection: {xs: 'column', md: 'row'}}}>
            {/* Left Column - 60% */}
            <Box sx={leftColumnSx}>
                    {/* Package Details + Additional Info - side by side */}
                    <Box sx={packageRowSx}>
                        {/* Package Details */}
                        <Box sx={{flex: 1, minWidth: 0}}>
                            <SectionToolbar title="Package Details" icon={Inventory2Icon} dense={dense}
                                isEditMode={isEditMode} sectionKey="packageDetails"
                                isVisible={isFieldVisible('packageDetails')}
                                onToggleVisibility={onToggleField}
                            />
                            <Collapse in={isFieldVisible('packageDetails')} unmountOnExit>
                            <List dense disablePadding>
                                <EditableField
                                    icon="straighten" label="Dimensions"
                                    value={job.parcelDimensions?.length ? `${job.parcelDimensions.length} parcels` : '\u2014'}
                                    onClick={onEditDimensions} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('dimensions')}
                                    onToggleVisibility={onToggleField} fieldKey="dimensions"
                                    endAdornment={job.calculateDimsOncePerJob ?
                                        <Chip label="CALC ONCE" size="small" color="success" sx={{
                                            height: 20,
                                            fontSize: '0.6875rem',
                                            fontWeight: 600,
                                            ml: 0.5
                                        }}/> : undefined}
                                />
                                <EditableField
                                    icon="scale" label="Weight"
                                    value={job.weight != null ? `${job.weight} ${isUsCustomer ? 'lbs' : 'kg'}` : undefined}
                                    onClick={onEditWeight} disabled={locked}
                                    dense={dense} isEditMode={isEditMode}
                                    isVisible={isFieldVisible('weight')}
                                    onToggleVisibility={onToggleField} fieldKey="weight"
                                    endAdornment={job.calculateDimsOncePerJob ?
                                        <Chip label="CALC ONCE" size="small" color="success" sx={{
                                            height: 20,
                                            fontSize: '0.6875rem',
                                            fontWeight: 600,
                                            ml: 0.5
                                        }}/> : undefined}
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

                        <Divider orientation="vertical" flexItem sx={{display: {xs: 'none', sm: 'block'}}}/>
                        <Divider sx={{display: {xs: 'block', sm: 'none'}}}/>

                        {/* Additional Info */}
                        <Box sx={{flex: 1, minWidth: 0}}>
                            <SectionToolbar title="Additional Info" icon={DescriptionIcon} dense={dense}
                                isEditMode={isEditMode} sectionKey="additionalInfo"
                                isVisible={isFieldVisible('additionalInfo')}
                                onToggleVisibility={onToggleField}
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
                    <Box sx={sectionBorderSx}>
                        <SectionToolbar
                            title="Delivery Details" icon={LocalShippingIcon}
                            isEditMode={isEditMode} sectionKey="deliveryDetails"
                            isVisible={isFieldVisible('deliveryDetails')}
                            onToggleVisibility={onToggleField}
                            dense={dense}
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
                    <Box sx={sectionBorderSx}>
                        <SectionToolbar title="Tracking" icon={TrackChangesIcon} dense={dense}
                            isEditMode={isEditMode} sectionKey="trackingSection"
                            isVisible={isFieldVisible('trackingSection')}
                            onToggleVisibility={onToggleField}
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
            </Box>

            {/* Right Column - 40% */}
            <Box sx={rightColumnSx}>
                    {/* Booked By */}
                    {(isEditMode || isFieldVisible('bookedBy')) && (
                    <Box>
                        <SectionToolbar
                            title="Booked By" icon={PersonOutlineIcon}
                            isEditMode={isEditMode} sectionKey="bookedBy"
                            isVisible={isFieldVisible('bookedBy')}
                            onToggleVisibility={onToggleField}
                            dense={dense}
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

                    <Divider/>

                    {/* Job Details */}
                    {(isEditMode || isFieldVisible('jobDetails')) && (
                    <Box>
                        <SectionToolbar
                            title="Job Details" icon={WorkOutlineIcon}
                            isEditMode={isEditMode} sectionKey="jobDetails"
                            isVisible={isFieldVisible('jobDetails')}
                            onToggleVisibility={onToggleField}
                            dense={dense}
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

                    <Divider/>

                    {/* Client */}
                    <Box>
                        <SectionToolbar title="Client" icon={BusinessIcon} dense={dense}/>
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
            </Box>
        </Box>
    );
});
