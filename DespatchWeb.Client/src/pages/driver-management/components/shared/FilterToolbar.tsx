import React from 'react';
import {Button, Card, Divider, Group} from '@mantine/core';
import {FilterX, SlidersHorizontal} from 'lucide-react';
import {Icon} from '../../../../components/common/icon/Icon';
import {PanelHeader} from '../../../../components/common/panel-header';
import {FILTER_CONTROL_HEIGHT} from '../../../../components/common/filter-fields';

interface FilterToolbarProps {
    /** Right-aligned slot on the panel bar — a tab's own actions. */
    actions?: React.ReactNode;
    /**
     * How many criteria are currently applied. Labels the reset and disables it
     * when there is nothing to undo. Omit on a tab that only has a search box.
     */
    activeFilterCount?: number;
    onClearAll?: () => void;
    children: React.ReactNode;
}

/**
 * The filter bar every driver-management tab sits behind.
 *
 * It owns the separation and the reset rather than leaving them to each tab —
 * six tabs meant six chances to forget, and the dividers were missing from all
 * of them. Matches the recurring-jobs toolbar, which is the app's other
 * horizontal filter row.
 */
export const FilterToolbar: React.FC<FilterToolbarProps> = ({
    actions,
    activeFilterCount,
    onClearAll,
    children,
}) => {
    /*
     * A rule between groups, never inside one — the same line eBay's design
     * system draws and the overview's Quick Filters follow. Interleaving here
     * means a tab just lists its controls and gets the separation for free.
     */
    // Flatten one level of fragments: a tab may list its controls as siblings or
    // wrap them in a <>…</>, and `toArray` counts the latter as a single child —
    // which would silently skip every rule.
    const groups = React.Children.toArray(children)
        .flatMap(child =>
            React.isValidElement(child) && child.type === React.Fragment
                ? React.Children.toArray((child.props as {children?: React.ReactNode}).children)
                : [child])
        .filter(Boolean);

    return (
        <Card withBorder p={0} radius="lg" style={{overflow: 'hidden'}}>
            <PanelHeader icon={<Icon lucide={SlidersHorizontal}/>} title="Filters" action={actions} />
            {/*
              * Bottom-aligned for the same reason the recurring-jobs toolbar is: the
              * controls a tab drops in here are a mix of labelled and unlabelled, and
              * centring them would float the unlabelled ones half a label higher.
              */}
            <Group gap={16} px={16} py={12} align="flex-end">
                {groups.map((child, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <Divider
                                role="separator"
                                orientation="vertical"
                                h={FILTER_CONTROL_HEIGHT}
                                style={{alignSelf: 'flex-end'}}
                            />
                        )}
                        {child}
                    </React.Fragment>
                ))}

                {onClearAll && (
                    <>
                        {/* Spacer, so the reset keeps the row's end however wide the
                            criteria before it run. */}
                        <div style={{flex: 1}}/>
                        {/*
                          * Always present, disabled when there is nothing to undo: a
                          * control that appears and disappears moves the layout and
                          * cannot be relied on to be where it was last seen.
                          */}
                        <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            h={FILTER_CONTROL_HEIGHT}
                            disabled={!activeFilterCount}
                            onClick={onClearAll}
                            leftSection={<Icon lucide={FilterX} size={16}/>}
                        >
                            {activeFilterCount ? `Clear all (${activeFilterCount})` : 'Clear all'}
                        </Button>
                    </>
                )}
            </Group>
        </Card>
    );
};
