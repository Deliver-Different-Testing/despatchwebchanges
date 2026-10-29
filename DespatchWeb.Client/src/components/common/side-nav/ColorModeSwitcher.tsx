import React from 'react';
import {Tooltip, useMantineTheme} from '@mantine/core';
import {Monitor, Moon, Sun} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {useColorMode, type ColorModePreference} from '../../../hooks/useColorMode';
import type {onBrandScrim} from '../../../theme/dfrntMantineTheme';
import classes from './ColorModeSwitcher.module.css';

const OPTIONS: {value: ColorModePreference; label: string; icon: typeof Sun}[] = [
    {value: 'system', label: 'Match device', icon: Monitor},
    {value: 'light', label: 'Light', icon: Sun},
    {value: 'dark', label: 'Dark', icon: Moon},
];

const GLYPH_SIZE = 14;

/**
 * Light / dark / match-device picker for shell chrome. It takes the shell's scrim overlays rather
 * than the page scheme: the theme's (which follows the tenant's primary) unless `scrim` pins one,
 * as the always-Ink side menu does. Native radios keep arrow-key navigation and `aria-checked` for free.
 */
export const ColorModeSwitcher: React.FC<{scrim?: typeof onBrandScrim}> = ({scrim: scrimProp}) => {
    const {preference, setPreference} = useColorMode();
    const themeScrim = useMantineTheme().other.scrim;
    const scrim = scrimProp ?? themeScrim;

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
