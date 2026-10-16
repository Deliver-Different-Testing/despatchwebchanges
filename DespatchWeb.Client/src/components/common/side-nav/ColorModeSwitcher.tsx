import React from 'react';
import {Tooltip, useMantineTheme} from '@mantine/core';
import {Monitor, Moon, Sun} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {useColorMode, type ColorModePreference} from '../../../hooks/useColorMode';
import classes from './ColorModeSwitcher.module.css';

const OPTIONS: {value: ColorModePreference; label: string; icon: typeof Sun}[] = [
    {value: 'system', label: 'Match device', icon: Monitor},
    {value: 'light', label: 'Light', icon: Sun},
    {value: 'dark', label: 'Dark', icon: Moon},
];

const GLYPH_SIZE = 14;

/**
 * Light / dark / match-device picker for the side-nav account header. It sits on the
 * shell bar (Ink or gold), so it takes the bar's scrim overlays rather than the page
 * scheme. Native radios keep arrow-key navigation and `aria-checked` for free.
 */
export const ColorModeSwitcher: React.FC = () => {
    const {preference, setPreference} = useColorMode();
    const {scrim} = useMantineTheme().other;

    return (
        <div
            role="radiogroup"
            aria-label="Colour mode"
            className={classes.root}
            style={{
                '--cms-track': scrim.hoverFill,
                '--cms-chip': scrim.fillStrong,
                '--cms-ring': scrim.border,
                color: scrim.text,
            } as React.CSSProperties}
        >
            {OPTIONS.map(({value, label, icon}) => (
                <Tooltip key={value} label={label} openDelay={300}>
                    <label className={classes.option}>
                        <input
                            type="radio"
                            className={classes.input}
                            name="dd-color-mode"
                            value={value}
                            aria-label={label}
                            checked={preference === value}
                            onChange={() => setPreference(value)}
                        />
                        <Icon lucide={icon} size={GLYPH_SIZE} />
                    </label>
                </Tooltip>
            ))}
        </div>
    );
};

export default ColorModeSwitcher;
