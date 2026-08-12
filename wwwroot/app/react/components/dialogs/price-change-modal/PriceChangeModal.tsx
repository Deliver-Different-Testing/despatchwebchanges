import React from 'react';
import {Box, Button, Group, Text} from '@mantine/core';
import {ArrowRight, BellRing, Check, NotepadText} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogHeader, DialogShell, PriceDelta} from '../shared/mantine';

export interface PriceChangeModalProps {
    open: boolean;
    jobNumber: string;
    oldPrice: number;
    newPrice: number;
    description: string | null;
    isApplying: boolean;
    onAccept: () => void;
    onKeep: () => void;
    onManualEdit: () => void;
}

/** The two price tiles sit on a faint wash so the pair reads as one comparison. */
const comparisonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 16,
    backgroundColor: 'var(--mantine-color-gray-1)',
    borderRadius: 'var(--mantine-radius-lg)',
    marginBottom: 4,
};

const secondaryActionProps = {
    variant: 'default',
    radius: 'md',
    fullWidth: true,
} as const;

export const PriceChangeModal: React.FC<PriceChangeModalProps> = ({
    open,
    jobNumber,
    oldPrice,
    newPrice,
    description,
    isApplying,
    onAccept,
    onKeep,
    onManualEdit,
}) => {
    const diff = newPrice - oldPrice;
    // Up is bad news on a price change, down is good; no change reads neutral.
    const diffColor = diff > 0
        ? 'var(--mantine-color-red-6)'
        : diff < 0 ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-dimmed)';

    return (
        <DialogShell
            opened={open}
            onClose={isApplying ? () => {} : onKeep}
            size={400}
            label="Price Change"
            trapFocus={false}
        >
            <DialogHeader
                icon={<Icon lucide={BellRing}/>}
                title="Price Change"
                subtitle={jobNumber}
                variant="warning"
                onClose={onKeep}
                closeDisabled={isApplying}
            />
            {/* Price comparison */}
            <Box px="lg" pt="lg" pb="md">
                <Text size="sm" c="dimmed" mb="lg">
                    Updating this job changes its calculated price. How would you like to proceed?
                </Text>

                <Box style={comparisonStyle}>
                    <Box style={{textAlign: 'center', flex: 1}}>
                        <Text size="xs" c="dimmed" mb={4}>Original</Text>
                        <Text fz="lg" fw={600} c="dimmed">${oldPrice.toFixed(2)}</Text>
                    </Box>
                    <Icon lucide={ArrowRight} size={20} color="var(--mantine-color-dimmed)" aria-hidden/>
                    <Box style={{textAlign: 'center', flex: 1}}>
                        <Text size="xs" c="dimmed" mb={4}>New</Text>
                        <Text fz="lg" fw={700} c="var(--mantine-primary-color-filled)">
                            ${newPrice.toFixed(2)}
                        </Text>
                    </Box>
                </Box>

                {diff !== 0 && (
                    <Group justify="center" gap={4} mt="xs">
                        <PriceDelta oldPrice={oldPrice} newPrice={newPrice}/>
                        <Text size="sm" fw={600} style={{color: diffColor}}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </Text>
                    </Group>
                )}

                {description && (
                    <Box
                        mt="md"
                        p="sm"
                        style={{
                            backgroundColor: 'var(--mantine-color-gray-1)',
                            borderRadius: 'var(--mantine-radius-md)',
                        }}
                    >
                        {description.split(/\r|\n/).filter(Boolean).map((line, i) => (
                            <Text key={i} size="xs" c="dimmed" style={{lineHeight: 1.8}}>
                                {line}
                            </Text>
                        ))}
                    </Box>
                )}
            </Box>
            {/* Actions — stacked rather than the standard footer: accepting is the
                headline choice and the two alternatives share the row below it. */}
            <Box px="md" pb="md" style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                <Button
                    fullWidth
                    radius="md"
                    onClick={onAccept}
                    disabled={isApplying}
                    leftSection={<Icon lucide={Check} size={16}/>}
                >
                    {isApplying ? 'Applying…' : `Accept New Price ($${newPrice.toFixed(2)})`}
                </Button>
                <Group gap="xs" grow>
                    <Button {...secondaryActionProps} onClick={onKeep} disabled={isApplying}>
                        Keep Original
                    </Button>
                    <Button
                        {...secondaryActionProps}
                        onClick={onManualEdit}
                        disabled={isApplying}
                        leftSection={<Icon lucide={NotepadText} size={16}/>}
                    >
                        Set Manually
                    </Button>
                </Group>
            </Box>
        </DialogShell>
    );
};

export default PriceChangeModal;
