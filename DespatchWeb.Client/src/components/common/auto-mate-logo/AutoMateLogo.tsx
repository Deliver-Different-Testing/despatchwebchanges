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
 *
 * The PNG is a gradient mark with opaque white inside its orbits, so it only
 * reads on a surface. On a filled control use `variant="mono"`: an SVG of the
 * same mark in `currentColor`, so the control's autoContrast foreground (Ink on
 * light primaries, white on dark ones) colours it.
 */

import React from 'react';
import {Box} from '@mantine/core';

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
    /** `color` is the brand PNG, for surfaces; `mono` follows `currentColor`, for fills. */
    variant?: 'color' | 'mono';
}

const ORBIT_ANGLES = [0, 60, 120];
const VIEW_BOX = {x: -28.5, y: -28.5, width: 57, height: 57};

const AutoMateMonoMark: React.FC<{size: number}> = ({size}) => {
    const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const orbitsMask = `${id}-orbits`;
    const faceMask = `${id}-face`;
    return (
        <svg
            role="img"
            aria-label="Auto-mate"
            width={size}
            height={size}
            viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
            style={{display: 'block', flexShrink: 0}}
        >
            <defs>
                {/* Orbits stop short of the nucleus so the face keeps a clear ring around it. */}
                <mask id={orbitsMask} maskUnits="userSpaceOnUse" {...VIEW_BOX}>
                    <rect {...VIEW_BOX} fill="white"/>
                    <circle r="13.5" fill="black"/>
                </mask>
                <mask id={faceMask} maskUnits="userSpaceOnUse" {...VIEW_BOX}>
                    <circle r="11" fill="white"/>
                    <circle cx="-4.2" cy="-2.2" r="2.5" fill="black"/>
                    <circle cx="4.2" cy="-2.2" r="2.5" fill="black"/>
                    <path d="M -4 3.8 Q 0 7.2 4 3.8" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round"/>
                </mask>
            </defs>
            <g mask={`url(#${orbitsMask})`} fill="none" stroke="currentColor" strokeWidth="3.8">
                {ORBIT_ANGLES.map(angle => (
                    <ellipse key={angle} rx="25.6" ry="8.6" transform={`rotate(${angle})`}/>
                ))}
            </g>
            <circle r="11" fill="currentColor" mask={`url(#${faceMask})`}/>
        </svg>
    );
};

export const AutoMateLogo: React.FC<AutoMateLogoProps> = ({size = 24, animated = false, variant = 'color'}) => variant === 'mono' ? (
    <AutoMateMonoMark size={size}/>
) : (
    <Box
        component="img"
        src={animated ? AUTO_MATE_LOGO_ANIMATED_SRC : AUTO_MATE_LOGO_SRC}
        alt="Auto-mate"
        // width/height in `style`, not Mantine's `w`/`h` props: a numeric style
        // prop is emitted as `calc(Xrem * var(--mantine-scale))`, so the logo
        // would rescale with the user's rem while the `Icon` glyphs beside it —
        // sized by a literal-px SVG attribute — would not. `size` is px by
        // contract, so keep it literal.
        style={{
            width: size,
            height: size,
            objectFit: 'contain',
            display: 'block',
            flexShrink: 0,
        }}
    />
);

export default AutoMateLogo;
