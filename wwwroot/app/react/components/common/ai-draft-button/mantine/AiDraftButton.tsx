import React from 'react';
import {Button} from '@mantine/core';
import {Sparkles} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {isAiEnabled} from '../../../../../functions/aiSettings';

interface AiDraftButtonProps {
    onClick: () => void;
    isDrafting: boolean;
    disabled?: boolean;
    label?: string;
    size?: string;
}

/**
 * "Draft with Auto-Mate" button (Mantine). Renders nothing when the user hasn't
 * opted into AI, so callers can drop it in unconditionally. Shows a spinner
 * while drafting.
 */
export const AiDraftButton: React.FC<AiDraftButtonProps> = ({
    onClick,
    isDrafting,
    disabled = false,
    label = 'Draft',
    size = 'xs',
}) => {
    if (!isAiEnabled()) {
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
