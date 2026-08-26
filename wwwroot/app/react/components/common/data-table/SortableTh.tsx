/**
 * SortableTh — the replacement for MUI's `TableSortLabel`.
 *
 * Mantine has no sortable-header primitive, and this app has ~36 of them across
 * five tables, so it lives here once. The header cell is a real `<button>` so the
 * sort is reachable by keyboard, and it carries `aria-sort` on the `<th>` — which
 * `TableSortLabel` never did.
 */
import React from 'react';
import {Group, Table, Text, UnstyledButton} from '@mantine/core';
import {ArrowDown, ArrowUp, ChevronsUpDown} from 'lucide-react';
import {Icon} from '../icon/Icon';
import classes from './DataTable.module.css';

export type SortDirection = 'asc' | 'desc';

export interface SortableThProps {
    children: React.ReactNode;
    /** True when this column is the one currently sorted. */
    active: boolean;
    direction: SortDirection;
    onSort: () => void;
    /** Omit to render a plain, non-sortable header cell. */
    sortable?: boolean;
    width?: string | number;
    align?: 'left' | 'center' | 'right';
}

export const SortableTh: React.FC<SortableThProps> = ({
    children,
    active,
    direction,
    onSort,
    sortable = true,
    width,
    align = 'left',
}) => {
    if (!sortable) {
        return (
            <Table.Th style={{width, textAlign: align}}>
                {children}
            </Table.Th>
        );
    }

    return (
        <Table.Th
            style={{width, textAlign: align}}
            // The sorted state belongs on the header cell for assistive tech, not
            // just in the glyph.
            aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <UnstyledButton onClick={onSort} className={classes.sortButton}>
                <Group gap={4} wrap="nowrap" justify={align === 'right' ? 'flex-end' : 'flex-start'}>
                    <Text component="span" fz="inherit" fw="inherit">{children}</Text>
                    <Icon
                        lucide={active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown}
                        size={14}
                        className={classes.sortIcon}
                        data-active={active}
                    />
                </Group>
            </UnstyledButton>
        </Table.Th>
    );
};

export default SortableTh;
