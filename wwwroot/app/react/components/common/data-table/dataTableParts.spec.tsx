/**
 * SortableTh and TablePager replace MUI primitives Mantine has no equivalent for,
 * and five tables now depend on them, so their contracts are pinned here rather
 * than incidentally through each table's own suite.
 */
import React from 'react';
import {screen} from '@testing-library/react';
import {Table} from '@mantine/core';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {SortableTh} from './SortableTh';
import {TablePager} from './TablePager';

const user = setupUser();

const renderTh = (props: Partial<React.ComponentProps<typeof SortableTh>> = {}) =>
    renderWithMantine(
        <Table>
            <Table.Thead>
                <Table.Tr>
                    <SortableTh active={false} direction="asc" onSort={jest.fn()} {...props}>
                        Job No
                    </SortableTh>
                </Table.Tr>
            </Table.Thead>
        </Table>,
    );

describe('SortableTh', () => {
    it('exposes the sort state on the header cell, not just in the glyph', () => {
        const {rerender} = renderTh();
        expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');

        rerender(
            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <SortableTh active direction="desc" onSort={jest.fn()}>Job No</SortableTh>
                    </Table.Tr>
                </Table.Thead>
            </Table>,
        );
        expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
    });

    it('is a real button, so the sort is reachable by keyboard', async () => {
        const onSort = jest.fn();
        renderTh({onSort});

        const button = screen.getByRole('button', {name: /Job No/});
        button.focus();
        await user.keyboard('{Enter}');

        expect(onSort).toHaveBeenCalledTimes(1);
    });

    it('renders a plain header with no button when not sortable', () => {
        renderTh({sortable: false});

        expect(screen.getByRole('columnheader')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

describe('TablePager', () => {
    const pagerProps = {
        totalCount: 50,
        page: 1,
        pageSize: 20,
        onPageChange: jest.fn(),
        onPageSizeChange: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders the range text the tables assert on', () => {
        renderWithMantine(<TablePager {...pagerProps} />);
        expect(screen.getByText('1–20 of 50')).toBeInTheDocument();
    });

    it('clamps the final page range to the total', () => {
        renderWithMantine(<TablePager {...pagerProps} page={3} />);
        expect(screen.getByText('41–50 of 50')).toBeInTheDocument();
    });

    it('disables prev on the first page and next on the last', () => {
        const {rerender} = renderWithMantine(<TablePager {...pagerProps} />);
        expect(screen.getByRole('button', {name: 'Go to previous page'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Go to next page'})).toBeEnabled();

        rerender(<TablePager {...pagerProps} page={3} />);
        expect(screen.getByRole('button', {name: 'Go to previous page'})).toBeEnabled();
        expect(screen.getByRole('button', {name: 'Go to next page'})).toBeDisabled();
    });

    it('pages in 1-based numbers, matching the app callbacks', async () => {
        renderWithMantine(<TablePager {...pagerProps} page={2} />);

        await user.click(screen.getByRole('button', {name: 'Go to next page'}));
        expect(pagerProps.onPageChange).toHaveBeenCalledWith(3);

        await user.click(screen.getByRole('button', {name: 'Go to previous page'}));
        expect(pagerProps.onPageChange).toHaveBeenCalledWith(1);
    });

    it('hides itself when there is nothing to page through', () => {
        const {container} = renderWithMantine(<TablePager {...pagerProps} totalCount={0} />);
        expect(container.querySelector('[aria-label="Go to next page"]')).toBeNull();
    });

    it('still renders at zero rows when the host asks it to', () => {
        renderWithMantine(<TablePager {...pagerProps} totalCount={0} hideWhenEmpty={false} />);
        expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
    });
});
