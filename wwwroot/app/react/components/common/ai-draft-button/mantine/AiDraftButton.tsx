import React from 'react';
import {Button} from '@mantine/core';
import {Sparkles} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {useAiFeature, useAutoMateEnabled} from '../../../../hooks/useAiFeature';
import {AiFeatureCategory} from '../../../../services/aiPreferenceStore';

interface AiDraftButtonProps {
    onClick: () => void;
    isDrafting: boolean;
    disabled?: boolean;
    label?: string;
    size?: string;
    /**
     * Which Auto-mate category this button belongs to. Omitted means the master
     * switch alone, which is the right answer only for a button whose owner has
     * already gated itself on a category.
     */
    category?: AiFeatureCategory;
}

/**
 * "Draft with Auto-Mate" button (Mantine). Renders nothing when the user has this
 * category of Auto-mate switched off, so callers can drop it in unconditionally.
 * Shows a spinner while drafting.
 */
export const AiDraftButton: React.FC<AiDraftButtonProps> = ({
    onClick,
    isDrafting,
    disabled = false,
    label = 'Draft',
    size = 'xs',
    category,
}) => {
    const categoryEnabled = useAiFeature(category ?? 'writing');
    const masterEnabled = useAutoMateEnabled();

    if (!(category ? categoryEnabled : masterEnabled)) {
        return null;
    }

    return (
        <Button
            variant="outline"
            color="grape"
            size={size}
            onClick={onClick}
            disabled={disabled}
            loading={isDrafting}
            leftSection={<Icon lucide={Sparkles} size={16}/>}
        >
            {isDrafting ? 'Drafting…' : label}
        </Button>
    );
};

export default AiDraftButton;
