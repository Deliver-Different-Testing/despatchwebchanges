import React, {type CSSProperties} from 'react';
import {Text} from '@mantine/core';
import {getMd3Scheme, type Md3Mode} from '../../theme/md3';
import {inkReadsOnFill, isHexColor, type AppearanceColorField, type AppearanceSettings} from '../../theme/appearance';
import classes from './AppearancePreview.module.css';

const INK = '#0d0c2c';

/** What every app uses when neither the company nor the user has chosen a colour. */
export const DFRNT_DEFAULT_COLORS: Record<AppearanceColorField, string> = {
    primary: '#3bc7f4',
    secondary: '#2a4eff',
    textLight: getMd3Scheme('light').onSurface,
    textDark: getMd3Scheme('dark').onSurface.toLowerCase(),
};

/** The user's draft, else the company default, else DFRNT's. */
function resolve(field: AppearanceColorField, draft: AppearanceSettings, company: AppearanceSettings | null): string | undefined {
    const own = draft[field];
    if (own && isHexColor(own)) return own;
    return company?.[field];
}

interface PaneProps {
    mode: Md3Mode;
    draft: AppearanceSettings;
    company: AppearanceSettings | null;
    highContrast: boolean;
}

function Pane({mode, draft, company, highContrast}: PaneProps) {
    const scheme = getMd3Scheme(mode);
    const textField = mode === 'light' ? 'textLight' : 'textDark';
    const text = resolve(textField, draft, company) ?? DFRNT_DEFAULT_COLORS[textField];
    const chosenPrimary = resolve('primary', draft, company);
    const primary = chosenPrimary ?? DFRNT_DEFAULT_COLORS.primary;
    // The app bar is the chosen primary, or Ink Blue when none is chosen (not the default cyan).
    const bar = chosenPrimary ?? INK;
    const onFill = (fill: string) => (inkReadsOnFill(fill) ? INK : '#ffffff');

    // The same page/card surfaces the contrast checks measure against, so the preview shows what passes.
    const vars = {
        '--pv-page': scheme.surface,
        '--pv-card': mode === 'light' ? scheme.surfaceContainerLowest : scheme.surfaceContainer,
        '--pv-text': text,
        '--pv-muted': highContrast ? text : scheme.onSurfaceVariant,
        '--pv-border': highContrast ? scheme.outline : scheme.outlineVariant,
        '--pv-primary': primary,
        '--pv-on-primary': onFill(primary),
        '--pv-bar': bar,
        '--pv-on-bar': onFill(bar),
        '--pv-secondary': resolve('secondary', draft, company) ?? DFRNT_DEFAULT_COLORS.secondary,
    } as CSSProperties;

    return (
        <div className={classes.window} style={vars} data-mode={mode} data-high-contrast={highContrast || undefined}>
            <div className={classes.bar}>
                <span className={classes.wordmark}>DFRNT</span>
                <span className={classes.crumb}>Dispatch</span>
            </div>
            <div className={classes.page}>
                <div className={classes.card}>
                    <div className={classes.cardHead}>
                        <span className={classes.heading}>Today’s jobs</span>
                        <span className={classes.button}>Dispatch</span>
                    </div>
                    <div className={classes.row} data-selected>
                        <span className={classes.job}>10234</span>
                        <span className={classes.route}>Ponsonby to Newmarket</span>
                        <span className={classes.badge} data-status="late">Late</span>
                    </div>
                    <div className={classes.row}>
                        <span className={classes.job}>10235</span>
                        <span className={classes.route}>Albany to Takapuna</span>
                        <span className={classes.badge} data-status="done">Completed</span>
                    </div>
                    <div className={classes.foot}>
                        <span className={classes.muted}>1 job needs a driver</span>
                        <span className={classes.link}>View details</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface Props {
    draft: AppearanceSettings;
    company: AppearanceSettings | null;
    highContrast: boolean;
}

/** A small Despatch board in both themes, painted with the draft over the company default. */
export const AppearancePreview: React.FC<Props> = ({draft, company, highContrast}) => (
    <figure className={classes.figure} aria-label="Preview of your colours">
        <div className={classes.panes}>
            <div>
                <Text size="xs" fw={600} mb={6}>Light theme</Text>
                <Pane mode="light" draft={draft} company={company} highContrast={highContrast}/>
            </div>
            <div>
                <Text size="xs" fw={600} mb={6}>Dark theme</Text>
                <Pane mode="dark" draft={draft} company={company} highContrast={highContrast}/>
            </div>
        </div>
        <figcaption>
            <Text size="xs" c="dimmed" mt="sm">
                {highContrast ? 'Shown at high contrast.' : 'Shown at standard contrast.'} Status colours never change.
            </Text>
        </figcaption>
    </figure>
);
