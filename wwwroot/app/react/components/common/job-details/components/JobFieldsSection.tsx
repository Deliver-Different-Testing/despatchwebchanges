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
import {ActionIcon, Box, Collapse, Flex, Paper, Stack, Tooltip} from '@mantine/core';
import {Briefcase, Building2, Eye, EyeOff, FileText, Target, User} from 'lucide-react';
import {IconPackage, IconTruck} from '@tabler/icons-react';
import {Icon} from '../../icon/Icon';
import {EditableField} from './EditableField';
import {SectionHeader} from './SectionHeader';
import type {IJob} from '../JobDetails.types';
import {getTrackingMethodText} from '../JobDetails.types';
import {cardContainerProps} from '../JobDetails.styles';

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

/** A card that stretches to fill its share of a row. */
const cardFillStyle: React.CSSProperties = {
    ...cardContainerProps.style,
    flex: 1,
    minWidth: 0,
};

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
    const label = isVisible ? 'Hide section' : 'Show section';
    return (
        <Tooltip label={label}>
            <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={label}
                onClick={() => onToggleVisibility(sectionKey)}
            >
                <Icon lucide={isVisible ? Eye : EyeOff} size={18}/>
            </ActionIcon>
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
        <Flex gap="sm" direction={{base: 'column', md: 'row'}}>
            {/* Left Column - 60% */}
            <Stack gap="sm" style={{flex: 3, minWidth: 0}}>
                {/* Package Details + Additional Info — side by side */}
                <Flex gap="sm" direction={{base: 'column', sm: 'row'}}>
                    <Paper {...cardContainerProps} style={cardFillStyle}>
                        <SectionHeader
                            tabler={IconPackage}
                            title="Package Details"
                            dense={dense}
                            endAction={editEndAction('packageDetails')}
                        />
                        <Collapse expanded={isFieldVisible('packageDetails')} keepMounted={false}>
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
                                onClick={onEditDimensions}
                                dense={dense} isEditMode={isEditMode}
                                isVisible={isFieldVisible('dimensions')}
                                onToggleVisibility={onToggleField} fieldKey="dimensions"
                                endAdornment={job.calculateDimsOncePerJob ?
                                    <Tooltip label="Dimensions calculated once per job">
                                        <Box
                                            data-testid="calc-once-indicator"
                                            ml="xs"
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--mantine-color-green-5)',
                                                flexShrink: 0,
                                            }}
                                        />
                                    </Tooltip> : undefined}
                            />
                            <EditableField
                                icon="qr_code" label="Barcode" value={job.barcode}
                                dense={dense} isEditMode={isEditMode}
                                isVisible={isFieldVisible('dimensions')}
                                onToggleVisibility={onToggleField} fieldKey="dimensions"
                            />
                        </Collapse>
                    </Paper>

                    <Paper {...cardContainerProps} style={cardFillStyle}>
                        <SectionHeader
                            lucide={FileText}
                            title="Additional Info"
                            dense={dense}
                            endAction={editEndAction('additionalInfo')}
                        />
                        <Collapse expanded={isFieldVisible('additionalInfo')} keepMounted={false}>
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
                        </Collapse>
                    </Paper>
                </Flex>

                {/* Delivery Details */}
                {(isEditMode || isFieldVisible('deliveryDetails')) && (
                    <Paper {...cardContainerProps}>
                        <SectionHeader
                            tabler={IconTruck}
                            title="Delivery Details"
                            dense={dense}
                            endAction={editEndAction('deliveryDetails')}
                        />
                        <Collapse expanded={isFieldVisible('deliveryDetails')} keepMounted={false}>
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
                        </Collapse>
                    </Paper>
                )}

                {/* Tracking */}
                {(isEditMode || isFieldVisible('trackingSection')) && (
                    <Paper {...cardContainerProps}>
                        <SectionHeader
                            lucide={Target}
                            title="Tracking"
                            dense={dense}
                            endAction={editEndAction('trackingSection')}
                        />
                        <Collapse expanded={isFieldVisible('trackingSection')} keepMounted={false}>
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
                        </Collapse>
                    </Paper>
                )}
            </Stack>

            {/* Right Column - 40% */}
            <Stack gap="sm" style={{flex: 2, minWidth: 0}}>
                {/* Booked By */}
                {(isEditMode || isFieldVisible('bookedBy')) && (
                    <Paper {...cardContainerProps}>
                        <SectionHeader
                            lucide={User}
                            title="Booked By"
                            dense={dense}
                            endAction={editEndAction('bookedBy')}
                        />
                        <Collapse expanded={isFieldVisible('bookedBy')} keepMounted={false}>
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
                        </Collapse>
                    </Paper>
                )}

                {/* Job Details */}
                {(isEditMode || isFieldVisible('jobDetails')) && (
                    <Paper {...cardContainerProps}>
                        <SectionHeader
                            lucide={Briefcase}
                            title="Job Details"
                            dense={dense}
                            endAction={editEndAction('jobDetails')}
                        />
                        <Collapse expanded={isFieldVisible('jobDetails')} keepMounted={false}>
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
                        </Collapse>
                    </Paper>
                )}

                {/* Client */}
                <Paper {...cardContainerProps}>
                    <SectionHeader lucide={Building2} title="Client" dense={dense}/>
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
                </Paper>
            </Stack>
        </Flex>
    );
});
