/**
 * TablePager — the replacement for MUI's `TablePagination`.
 *
 * Mantine ships `Pagination` (a page-number strip), which is a different control:
 * it has no rows-per-page selector and no "showing x–y of N" range. Every table in
 * this app used MUI's shape, and the range text is what the specs assert, so this
 * keeps that contract and builds it out of Mantine parts.
 *
 * Pages are **1-based** here, unlike MUI's 0-based `page` prop — the app's own
 * callbacks were already 1-based and had to un-offset at every call site.
 */
import React from 'react';
import {ActionIcon, Group, Select, Text} from '@mantine/core';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Icon} from '../icon/Icon';

export interface TablePagerProps {
    /** Total rows across all pages. */
    totalCount: number;
    /** 1-based page number. */
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    pageSizeOptions?: number[];
    /** Hidden when there is nothing to page through. */
    hideWhenEmpty?: boolean;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const TablePager: React.FC<TablePagerProps> = ({
    totalCount,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    hideWhenEmpty = true,
}) => {
    if (hideWhenEmpty && totalCount === 0) return null;

    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
    const first = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, totalCount);

    return (
        <Group
            justify="flex-end"
            gap="md"
            px="md"
            py={6}
            wrap="nowrap"
            style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
        >
            <Group gap={6} wrap="nowrap">
                <Text fz="xs" c="dimmed">Rows per page:</Text>
                <Select
                    size="xs"
                    w={80}
                    aria-label="Rows per page"
                    data={pageSizeOptions.map(String)}
                    value={String(pageSize)}
                    onChange={(v) => v && onPageSizeChange(Number(v))}
                    allowDeselect={false}
                    comboboxProps={{withinPortal: true}}
                />
            </Group>

            {/* The range text MUI rendered — several specs assert on "of N". */}
            <Text fz="xs" c="dimmed">
                {`${first}–${last} of ${totalCount}`}
            </Text>

            <Group gap={2} wrap="nowrap">
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="md"
                    aria-label="Go to previous page"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <Icon lucide={ChevronLeft} size={18} />
                </ActionIcon>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="md"
                    aria-label="Go to next page"
                    disabled={page >= lastPage}
                    onClick={() => onPageChange(page + 1)}
                >
                    <Icon lucide={ChevronRight} size={18} />
                </ActionIcon>
            </Group>
        </Group>
    );
};

export default TablePager;
