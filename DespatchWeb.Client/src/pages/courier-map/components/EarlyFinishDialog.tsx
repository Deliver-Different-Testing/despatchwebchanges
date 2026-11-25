/**
 * EarlyFinishDialog
 *
 * Dispatch records that a driver finished early / disappeared / was unavailable / broke down, with a time. The time
 * becomes the driver's finish for the day and is shown to the manager approving their minimum hourly top-up in
 * Accounts. It never changes the driver's hours by itself.
 */

import React, {useState} from 'react';
import {Button, Group, Modal, Select, Stack, Text, Textarea, TextInput} from '@mantine/core';
import {recordEarlyFinish} from '../../../api/courierApi';
import type {EarlyFinishReason} from '../../../api/courierApi';
import {tenantNow} from '../../../utils/dateUtils';
import {toastService} from '../../../services/toastService';

export interface EarlyFinishDialogProps {
    opened: boolean;
    onClose: () => void;
    courierId: number;
    driverName: string;
    reasons: EarlyFinishReason[];
}

const NOW_FORMAT = 'YYYY-MM-DDTHH:mm';

export function EarlyFinishDialog({opened, onClose, courierId, driverName, reasons}: EarlyFinishDialogProps) {
    const [reasonId, setReasonId] = useState<string | null>(null);
    const [finishTime, setFinishTime] = useState(() => tenantNow().format(NOW_FORMAT));
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!reasonId) {
            setError('Choose a reason.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await recordEarlyFinish({courierId, reasonId: Number(reasonId), finishTime, note: note.trim() || undefined});
            toastService.showSuccessToast(`Early finish recorded for ${driverName}`);
            setReasonId(null);
            setNote('');
            onClose();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Could not record the early finish. Try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title={`Early finish: ${driverName}`} size="sm">
            <Stack gap="sm">
                <Text fz="sm" c="dimmed">
                    The time becomes the driver&apos;s finish for the day. It informs the manager approving their top-up;
                    it does not change their hours by itself.
                </Text>
                <Select
                    label="Reason"
                    placeholder="Choose a reason"
                    data={reasons.map(r => ({value: String(r.id), label: r.name}))}
                    value={reasonId}
                    onChange={setReasonId}
                    allowDeselect={false}
                />
                <TextInput
                    label="Finish time"
                    type="datetime-local"
                    value={finishTime}
                    onChange={e => setFinishTime(e.currentTarget.value)}
                />
                <Textarea
                    label="Note (optional)"
                    maxLength={200}
                    autosize
                    minRows={2}
                    value={note}
                    onChange={e => setNote(e.currentTarget.value)}
                />
                {error && <Text c="red" fz="sm">{error}</Text>}
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} loading={saving}>Record</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
