import React from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {isAiEnabled} from '../../../../functions/aiSettings';

interface AiDraftButtonProps {
    onClick: () => void;
    isDrafting: boolean;
    disabled?: boolean;
    label?: string;
    size?: 'small' | 'medium' | 'large';
}

/**
 * "Draft with Auto-Mate" button. Renders nothing when the user hasn't opted into
 * AI, so callers can drop it in unconditionally. Shows a spinner while drafting.
 */
export const AiDraftButton: React.FC<AiDraftButtonProps> = ({
    onClick,
    isDrafting,
    disabled = false,
    label = 'Draft',
    size = 'small',
}) => {
    if (!isAiEnabled()) {
        return null;
    }

    return (
        <Button
            variant="outlined"
            size={size}
            onClick={onClick}
            disabled={disabled || isDrafting}
            startIcon={isDrafting ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
        >
            {isDrafting ? 'Drafting…' : label}
        </Button>
    );
};
