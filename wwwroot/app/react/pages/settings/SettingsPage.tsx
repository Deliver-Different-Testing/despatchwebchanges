/**
 * Global Settings page, reached from the sidebar.
 *
 * Account-wide preferences that used to be scattered across each dashboard's
 * gear-icon dialog live here instead — starting with Auto-mate, the AI
 * job-briefing feature. The Auto-mate toggles apply immediately. The address
 * format section below is the exception: it edits a draft and only persists
 * on "Save", so leaving with unsaved changes is guarded (see
 * `unsavedChangesGuard.ts`) both for in-app navigation and tab close/refresh.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Badge, Box, Button, Group, Stack, Text, Title} from '@mantine/core';
import {ArrowLeftRight, MapPin, RotateCcw, Save, TriangleAlert} from 'lucide-react';
import {SectionHeading, SettingRow} from '../../components/common/settings-controls/SettingsControls';
import {AutoMateLogo} from '../../components/common/auto-mate-logo/AutoMateLogo';
import {Icon} from '../../components/common/icon/Icon';
import {ActionButton, ACTION_BUTTON_GLYPH_SIZE} from '../../components/common/action-button';
import {aiAccentColor} from '../../theme/designTokens';
import {
    isAiEnabled,
    isAiAutoOpenEnabled,
    setAiEnabled,
    setAiAutoOpenEnabled,
    loadAutoMateFromServer,
} from '../../../functions/aiSettings';
import {AddressFormatEditor} from './AddressFormatEditor';
import {parseAddressFormatJson, serializeAddressFormatJson} from '../../components/job-list/jobAddressFormat';
import type {AddressLineFormat} from '../../interfaces/address';
import {StaffPreferenceKey} from '../../../enums/staff-preference-key.enum';
import {deletePreference, getPreference, savePreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';
import {DialogShell, dialogSize, DialogHeader, DialogFooter} from '../../components/dialogs/shared/mantine';
import {registerUnsavedChangesGuard, type LeaveDecision} from '../../services/unsavedChangesGuard';

const EMPTY_FORMAT: AddressLineFormat = {line1: [], line2: []};

export const SettingsPage: React.FC = () => {
    const [aiEnabled, setAiEnabledState] = useState<boolean>(isAiEnabled);
    const [aiAutoOpen, setAiAutoOpenState] = useState<boolean>(isAiAutoOpenEnabled);

    // Address format: draft state the user edits freely, and the last-saved
    // baseline it's compared against for the Save button / leave guard. Each
    // side (pickup/delivery) is independent; "Reset to default" is the one
    // exception that still applies immediately to both, since it means "stop
    // overriding, follow the tenant default from now on" rather than "stage
    // an edit".
    const [pickupSaved, setPickupSaved] = useState<AddressLineFormat>(EMPTY_FORMAT);
    const [deliverySaved, setDeliverySaved] = useState<AddressLineFormat>(EMPTY_FORMAT);
    const [pickupDraft, setPickupDraft] = useState<AddressLineFormat>(EMPTY_FORMAT);
    const [deliveryDraft, setDeliveryDraft] = useState<AddressLineFormat>(EMPTY_FORMAT);
    const [hasAddressOverride, setHasAddressOverride] = useState(false);
    const [addressLoadError, setAddressLoadError] = useState(false);
    const [leaveResolver, setLeaveResolver] = useState<((decision: LeaveDecision) => void) | null>(null);

    const isDirty = JSON.stringify({pickup: pickupDraft, delivery: deliveryDraft})
        !== JSON.stringify({pickup: pickupSaved, delivery: deliverySaved});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [userResult, tenantResult] = await Promise.allSettled([
                getPreference(StaffPreferenceKey.DispatchAddressFormat),
                getTenantAddressFormatDefault(),
            ]);

            if (userResult.status === 'rejected') {
                console.error('Failed to load address format preference:', userResult.reason);
            }
            if (tenantResult.status === 'rejected') {
                console.error('Failed to load tenant address format default:', tenantResult.reason);
            }

            const userSides = userResult.status === 'fulfilled'
                ? parseAddressFormatJson(userResult.value) : {pickup: null, delivery: null};
            const tenantSides = tenantResult.status === 'fulfilled'
                ? parseAddressFormatJson(tenantResult.value) : {pickup: null, delivery: null};

            const pickup = userSides.pickup ?? tenantSides.pickup ?? EMPTY_FORMAT;
            const delivery = userSides.delivery ?? tenantSides.delivery ?? EMPTY_FORMAT;

            if (!cancelled) {
                setPickupSaved(pickup);
                setPickupDraft(pickup);
                setDeliverySaved(delivery);
                setDeliveryDraft(delivery);
                setHasAddressOverride(!!(userSides.pickup || userSides.delivery));
                setAddressLoadError(tenantResult.status === 'rejected');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // localStorage is a synchronous read-through cache of the server value, so
    // the toggles paint instantly from whatever this browser last saw, then
    // reconcile once the server round-trip resolves (same pattern as dispatch
    // layout sync) — this is what carries a setting to another device.
    useEffect(() => {
        void loadAutoMateFromServer().then(() => {
            setAiEnabledState(isAiEnabled());
            setAiAutoOpenState(isAiAutoOpenEnabled());
        });
    }, []);

    const toggleAiEnabled = () => {
        setAiEnabledState((prev) => {
            const next = !prev;
            setAiEnabled(next);
            return next;
        });
    };

    const toggleAiAutoOpen = () => {
        setAiAutoOpenState((prev) => {
            const next = !prev;
            setAiAutoOpenEnabled(next);
            return next;
        });
    };

    const saveAddressFormat = useCallback(async (pickup: AddressLineFormat, delivery: AddressLineFormat) => {
        await savePreference(StaffPreferenceKey.DispatchAddressFormat, serializeAddressFormatJson({pickup, delivery}));
        setPickupSaved(pickup);
        setDeliverySaved(delivery);
        setHasAddressOverride(true);
    }, []);

    const handleSaveClick = () => {
        void saveAddressFormat(pickupDraft, deliveryDraft)
            .catch((error) => console.error('Failed to save address format preference:', error));
    };

    const handleResetAddressFormat = () => {
        void deletePreference(StaffPreferenceKey.DispatchAddressFormat)
            .catch((error) => console.error('Failed to reset address format preference:', error));
        void getTenantAddressFormatDefault()
            .then((tenantJson) => {
                const tenantSides = parseAddressFormatJson(tenantJson);
                const pickup = tenantSides.pickup ?? EMPTY_FORMAT;
                const delivery = tenantSides.delivery ?? EMPTY_FORMAT;
                setPickupSaved(pickup);
                setPickupDraft(pickup);
                setDeliverySaved(delivery);
                setDeliveryDraft(delivery);
                setHasAddressOverride(false);
            })
            .catch((error) => console.error('Failed to load tenant address format default:', error));
    };

    // Refs so the guard (registered once) and the beforeunload listener always
    // see the latest draft/saved values without re-registering on every edit.
    const draftRef = useRef({pickup: pickupDraft, delivery: deliveryDraft});
    draftRef.current = {pickup: pickupDraft, delivery: deliveryDraft};
    const savedRef = useRef({pickup: pickupSaved, delivery: deliverySaved});
    savedRef.current = {pickup: pickupSaved, delivery: deliverySaved};

    useEffect(() => {
        return registerUnsavedChangesGuard({
            isDirty: () => JSON.stringify(draftRef.current) !== JSON.stringify(savedRef.current),
            promptToLeave: () => new Promise<LeaveDecision>((resolve) => setLeaveResolver(() => resolve)),
            save: () => saveAddressFormat(draftRef.current.pickup, draftRef.current.delivery),
        });
    }, [saveAddressFormat]);

    useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => {
            if (JSON.stringify(draftRef.current) === JSON.stringify(savedRef.current)) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);

    const resolveLeavePrompt = (decision: LeaveDecision) => {
        leaveResolver?.(decision);
        setLeaveResolver(null);
    };

    return (
        <Box p={24} maw={720}>
            <Title order={3} fw={600} mb={24}>Settings</Title>

            <Box>
                <SectionHeading
                    icon={<AutoMateLogo size={28}/>}
                    title="Auto-mate Settings"
                    accent={aiAccentColor}
                />

                <Stack gap={16}>
                    <SettingRow
                        title="Show Auto-mate briefings"
                        badge={
                            <Badge
                                size="xs"
                                c="white"
                                style={{'--badge-bg': aiAccentColor} as React.CSSProperties}
                            >
                                BETA
                            </Badge>
                        }
                        description="Adds a short AI briefing — verdict, what needs attention, and key facts —
                            to the job details, task dashboard, operations, and driver compliance pages.
                            Applies to your account only."
                        accent={aiAccentColor}
                        checked={aiEnabled}
                        onToggle={toggleAiEnabled}
                    />

                    {/* Only meaningful while briefings are on, so the row is
                        disabled and dimmed when they are off. */}
                    <SettingRow
                        title="Open automatically"
                        description="Opens the Auto-mate briefing expanded instead of waiting for a click.
                            Applies to your account only."
                        accent={aiAccentColor}
                        checked={aiAutoOpen}
                        disabled={!aiEnabled}
                        onToggle={toggleAiAutoOpen}
                    />
                </Stack>
            </Box>

            <Box mt={32}>
                <SectionHeading
                    icon={<Icon lucide={MapPin} size={20}/>}
                    title="Address Format"
                />

                <Text fz="sm" c="dimmed" mb={12}>
                    Choose which fields show for pickup and delivery addresses, and which of the
                    two display lines each sits on. Applies to your account only — your tenant
                    admin sets the default everyone else sees. Edits here are a draft until you
                    click Save.
                </Text>

                {addressLoadError && (
                    <Text fz="sm" c="orange" mb={12}>
                        Couldn&apos;t load the tenant address format default — showing your last
                        saved settings instead.
                    </Text>
                )}

                <Group align="flex-start" grow>
                    <Stack gap={8}>
                        <Group justify="space-between">
                            <Text fz="sm" fw={600}>Pickup</Text>
                            <ActionButton
                                size="compact"
                                leftSection={<Icon lucide={ArrowLeftRight} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                                onClick={() => setDeliveryDraft(pickupDraft)}
                            >
                                Copy to delivery
                            </ActionButton>
                        </Group>
                        <AddressFormatEditor value={pickupDraft} onChange={setPickupDraft}/>
                    </Stack>

                    <Stack gap={8}>
                        <Group justify="space-between">
                            <Text fz="sm" fw={600}>Delivery</Text>
                            <ActionButton
                                size="compact"
                                leftSection={<Icon lucide={ArrowLeftRight} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                                onClick={() => setPickupDraft(deliveryDraft)}
                            >
                                Copy to pickup
                            </ActionButton>
                        </Group>
                        <AddressFormatEditor value={deliveryDraft} onChange={setDeliveryDraft}/>
                    </Stack>
                </Group>

                <Group justify="space-between" mt={8}>
                    <ActionButton
                        leftSection={<Icon lucide={RotateCcw} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                        onClick={handleResetAddressFormat}
                        disabled={!hasAddressOverride}
                    >
                        Reset to default
                    </ActionButton>
                    <ActionButton
                        leftSection={<Icon lucide={Save} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                        onClick={handleSaveClick}
                        disabled={!isDirty}
                    >
                        Save
                    </ActionButton>
                </Group>
            </Box>

            <DialogShell
                opened={leaveResolver !== null}
                onClose={() => resolveLeavePrompt('stay')}
                size={dialogSize.sm}
                label="Unsaved address format changes"
            >
                <DialogHeader
                    variant="warning"
                    icon={<Icon lucide={TriangleAlert}/>}
                    title="Unsaved changes"
                    subtitle="Your address format edits haven't been saved"
                    onClose={() => resolveLeavePrompt('stay')}
                />
                <Box p={24}>
                    <Text>Save your address format changes before leaving, or they&apos;ll be lost.</Text>
                </Box>
                <DialogFooter
                    onCancel={() => resolveLeavePrompt('stay')}
                    cancelLabel="Cancel"
                    onConfirm={() => resolveLeavePrompt('save-and-leave')}
                    confirmLabel="Save and leave"
                    secondaryAction={
                        <Button variant="subtle" color="red" onClick={() => resolveLeavePrompt('discard')}>
                            Leave without saving
                        </Button>
                    }
                />
            </DialogShell>
        </Box>
    );
};

export default SettingsPage;
