/**
 * MetricCard - Single metric tile for the timing/pricing grid.
 * Centered text with category-aware accent colors and hover interactions.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import type {SxProps, Theme} from '@mui/material/styles';
import {metricLabelSx, metricValueSx, getMetricLabelSx, getMetricValueSx} from '../JobDetails.styles';

export type MetricCategory = 'pricing' | 'time' | 'pod' | 'info';

interface MetricCardProps {
    label: string;
    value: string;
    onClick?: () => void;
    disabled?: boolean;
    highlight?: boolean;
    category?: MetricCategory;
    filled?: boolean;
    dense?: boolean;
}

const categoryAccentMap: Record<MetricCategory, string> = {
    pricing: 'warning.main',
    time: 'primary.main',
    pod: 'success.main',
    info: 'grey.400',
};

const cardSx: SxProps<Theme> = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    px: 1.5,
    py: 1.5,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    bgcolor: 'background.paper',
    position: 'relative',
};

const clickableCardSx: SxProps<Theme> = {
    ...cardSx as object,
    cursor: 'pointer',
    transition: (theme) => `all ${theme.transitions.duration.short}ms ease`,
    '&:hover': {
        bgcolor: 'grey.50',
        '& .MetricCard-label': {color: 'primary.main'},
        '& .MetricCard-value': {color: 'primary.main'},
    },
};

export const MetricCard = React.memo(({
                                          label,
                                          value,
                                          onClick,
                                          disabled,
                                          highlight,
                                          category = 'info',
                                          filled,
                                          dense,
                                      }: MetricCardProps) => {
    const isClickable = onClick && !disabled;
    const accentColor = categoryAccentMap[category];
    const hasValue = !!value && value !== '-' && value !== '\u2014';

    const highlightSx = highlight
        ? {borderTop: 3, borderTopColor: accentColor}
        : {};

    const filledIndicatorSx = filled && hasValue ? {
        '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: '20%',
            right: '20%',
            height: 2,
            borderRadius: 1,
            bgcolor: accentColor,
            opacity: 0.5,
        },
    } : {};

    const densePaddingSx = dense ? {py: 0.5, px: 1} : {};

    const content = (
        <Box sx={{
            ...(isClickable ? clickableCardSx : cardSx) as object,
            ...highlightSx,
            ...filledIndicatorSx,
            ...densePaddingSx,
        }}>
            <Typography className="MetricCard-label" variant="overline" color="text.secondary" sx={dense ? getMetricLabelSx(true) : metricLabelSx}>
                {label}
            </Typography>
            <Typography
                className="MetricCard-value"
                variant="body2"
                sx={{
                    ...(dense ? getMetricValueSx(true) : metricValueSx) as object,
                    color: hasValue ? 'text.primary' : 'text.disabled',
                    fontWeight: hasValue ? 700 : 400,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '100%',
                }}
            >
                {value || '\u2014'}
            </Typography>
        </Box>
    );

    if (isClickable) {
        return (
            <ButtonBase onClick={onClick} sx={{width: '100%', height: '100%'}} focusRipple>
                {content}
            </ButtonBase>
        );
    }

    return content;
});
