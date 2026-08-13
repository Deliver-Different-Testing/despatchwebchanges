/**
 * SegmentedToggle — the app's single-select control.
 *
 * One selection grammar for every "pick exactly one of a few" control: an
 * indicator that **slides** between options. On the dispatch board six panels
 * change independently, so a moving indicator lets a dispatcher track a scope
 * change peripherally instead of re-reading labels.
 *
 * Two orientations, same grammar, different indicator surface:
 *   - `horizontal` — a segmented bar (MD3 segmented button): an opaque chip
 *     raised off a sunken track, per Mantine's own segmented look. No radio dot.
 *   - `vertical` — option rows that keep their dot, a tonal accent indicator
 *     sliding down behind the selected row (MD3's active nav-drawer row).
 *
 * **Single-select only.** `FloatingIndicator` marks exactly one target, so
 * multi-select stays `aria-pressed` buttons — see `ViewsRail`.
 *
 * Accessibility is native: a real `<input type="radio">` per option inside its
 * label, so arrow-key navigation, `aria-checked` and `getByRole('radio')` all
 * come for free. The visuals live in the unlayered CSS module; the metrics are
 * published as custom properties so they stay assertable in Jest.
 */

import React, {useId, useReducer, useRef, useState} from 'react';
import {FloatingIndicator, Tooltip} from '@mantine/core';

import classes from './SegmentedToggle.module.css';
import {
    segmentedToggleAccent,
    segmentedToggleHeight,
    type SegmentedToggleVariant,
} from './segmentedToggleTokens';

export interface SegmentedToggleOption<T extends string = string> {
    value: T;
    /** Visible text, and the accessible name for an icon-only option. */
    label: React.ReactNode;
    /** Renders instead of the label text; `label` still names the control. */
    icon?: React.ReactNode;
    disabled?: boolean;
    /**
     * Explains the option — typically why it is disabled. Anchored to the
     * option's content rather than the label element, so it keeps working when
     * the input is disabled and never competes for the indicator's ref.
     */
    tooltip?: React.ReactNode;
}

export interface SegmentedToggleProps<T extends string = string> {
    data: SegmentedToggleOption<T>[];
    value: T;
    onChange: (value: T) => void;
    orientation?: 'horizontal' | 'vertical';
    /**
     * Mantine colour key for the indicator accent. Defaults to the tenant brand.
     * Pass a semantic key where the colour carries information (the job-list
     * category tabs), not for decoration.
     */
    color?: string;
    /** `header` sits on a panel card bar's 32px band; `inline` is normal flow. */
    variant?: SegmentedToggleVariant;
    'aria-label': string;
    className?: string;
    style?: React.CSSProperties;
}

export function SegmentedToggle<T extends string = string>({
    data,
    value,
    onChange,
    orientation = 'horizontal',
    color = 'brand',
    variant = 'header',
    'aria-label': ariaLabel,
    className,
    style,
}: SegmentedToggleProps<T>) {
    const [root, setRoot] = useState<HTMLDivElement | null>(null);
    // Scopes the radio inputs so two toggles on the same bar don't share a group.
    const name = useId();

    /*
     * The indicator needs the selected option's DOM node, which is only known
     * after commit, and each ref callback must keep a stable identity across
     * renders: an inline `(node) => ...` is a new function every render, so React
     * detaches and re-attaches every ref, and a `setState` inside it loops
     * forever. So the nodes live in a ref, each option's callback is created once
     * and cached by value, and a counter re-renders when a node actually arrives.
     */
    const nodes = useRef<Record<string, HTMLElement | null>>({});
    const refCallbacks = useRef<Record<string, (node: HTMLElement | null) => void>>({});
    const [, onNodesChanged] = useReducer((n: number) => n + 1, 0);

    const optionRef = (key: string) => {
        refCallbacks.current[key] ??= (node) => {
            if (nodes.current[key] === node) return;
            nodes.current[key] = node;
            onNodesChanged();
        };
        return refCallbacks.current[key];
    };

    const vertical = orientation === 'vertical';

    return (
        <div
            ref={setRoot}
            role="radiogroup"
            aria-label={ariaLabel}
            aria-orientation={orientation}
            data-orientation={orientation}
            className={[classes.root, className].filter(Boolean).join(' ')}
            style={{
                '--st-height': `${segmentedToggleHeight(variant)}px`,
                '--st-accent': segmentedToggleAccent(color),
                ...style,
            } as React.CSSProperties}
        >
            <FloatingIndicator
                target={nodes.current[value]}
                parent={root}
                className={classes.indicator}
            />

            {data.map((option) => {
                const active = option.value === value;
                // A horizontal icon option renders no text, so it has to name
                // itself; everywhere else the wrapping label supplies the name.
                const iconOnly = !!option.icon && !vertical;
                /*
                 * The content always gets its own box, and carries the option's
                 * padding, so a tooltip can anchor to the whole hit area rather
                 * than just the glyph — and so the anchor never competes with
                 * the label's ref, which the indicator needs.
                 */
                const content = (
                    <span className={classes.content}>
                        {vertical && <span className={classes.dot} aria-hidden/>}
                        {option.icon && <span className={classes.glyph} aria-hidden>{option.icon}</span>}
                        {!iconOnly && option.label}
                    </span>
                );
                return (
                    <label
                        key={option.value}
                        ref={optionRef(option.value)}
                        className={classes.option}
                        data-active={active || undefined}
                        data-disabled={option.disabled || undefined}
                    >
                        <input
                            type="radio"
                            className={classes.input}
                            name={name}
                            value={option.value}
                            checked={active}
                            disabled={option.disabled}
                            aria-label={iconOnly ? String(option.label) : undefined}
                            onChange={() => onChange(option.value)}
                        />
                        {option.tooltip
                            ? <Tooltip label={option.tooltip} withArrow>{content}</Tooltip>
                            : content}
                    </label>
                );
            })}
        </div>
    );
}

export default SegmentedToggle;
