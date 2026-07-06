/**
 * DialogTransition
 *
 * The MUI Dialog open/close transition, made motion-accessible. Users who set
 * the OS "reduce motion" preference get a plain cross-fade instead of the
 * scaling `Grow`; everyone else keeps `Grow`. This honours WCAG 2.3.3
 * (Animation from Interactions) by replacing the large-scale movement that can
 * trigger vestibular discomfort, while still communicating the state change —
 * a targeted swap rather than a blanket "kill all animation" override.
 */
import React from 'react';
import Grow from '@mui/material/Grow';
import Fade from '@mui/material/Fade';
import useMediaQuery from '@mui/material/useMediaQuery';
import type {TransitionProps} from '@mui/material/transitions';

export const DialogTransition = React.forwardRef(function DialogTransition(
    props: TransitionProps & { children: React.ReactElement },
    ref: React.Ref<unknown>,
) {
    const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', {
        noSsr: true,
    });
    return prefersReducedMotion ? (
        <Fade ref={ref} {...props} />
    ) : (
        <Grow ref={ref} {...props} />
    );
});

export default DialogTransition;
