/**
 * AutoMateLogo — the Auto-mate brand mark.
 *
 * Renders the Auto-mate logo from the static images folder. Used anywhere the
 * Auto-mate brand appears (AI briefing card/panel headers and the dashboard
 * settings section), replacing the previous generic sparkle icon so the brand
 * reads consistently across the app.
 *
 * Defaults to a lightweight static image. Pass `animated` to use the larger
 * "thinking" animation — reserved for transient states (e.g. while a briefing
 * is generating) so the loop doesn't run permanently in every header.
 */

import React from 'react';
import Box from '@mui/material/Box';

/** Static brand mark, served from wwwroot/images. Used in headers/badges. */
export const AUTO_MATE_LOGO_SRC = 'images/auto-mate.png';
/** Animated "thinking" mark, served from wwwroot/images. Used in loading states.
 *  WebP (not GIF) so the transparent background is honoured on every frame —
 *  the legacy GIF only flagged transparency on frame 0, flashing an opaque
 *  background behind the icon on every loop. */
export const AUTO_MATE_LOGO_ANIMATED_SRC = 'images/auto-mate-thinking.webp';

interface AutoMateLogoProps {
    /** Square render size in px. Default 24 (matches the icon it replaces). */
    size?: number;
    /** Use the animated "thinking" variant instead of the static mark. */
    animated?: boolean;
}

export const AutoMateLogo: React.FC<AutoMateLogoProps> = ({size = 24, animated = false}) => (
    <Box
        component="img"
        src={animated ? AUTO_MATE_LOGO_ANIMATED_SRC : AUTO_MATE_LOGO_SRC}
        alt="Auto-mate"
        sx={{
            width: size,
            height: size,
            objectFit: 'contain',
            display: 'block',
            flexShrink: 0,
        }}
    />
);

export default AutoMateLogo;
