import React from 'react';
import {TriangleAlert} from 'lucide-react';
import {Icon} from '../../../../components/common/icon/Icon';
import {NoData} from '../../../../components/common/no-data/NoData';

export interface ListEmptyStateProps {
    /** Plural lower-case noun for the list, e.g. "drivers". */
    noun: string;
    isError: boolean;
    onRetry: () => void;
    /** True when search text or a non-default filter is narrowing the list. */
    isFiltered: boolean;
    onClearFilters: () => void;
    emptyTitle: string;
    emptyMessage: string;
    emptyIcon: React.ReactNode;
}

/** The three non-data states a list can be in once loading is over: load failed, filtered to nothing, or genuinely empty. */
export const ListEmptyState: React.FC<ListEmptyStateProps> = ({
    noun, isError, onRetry, isFiltered, onClearFilters, emptyTitle, emptyMessage, emptyIcon,
}) => {
    if (isError) {
        return (
            <NoData
                icon={<Icon lucide={TriangleAlert}/>}
                title={`Couldn't load ${noun}`}
                message="Check your connection, then try again."
                showAction
                actionText="Try again"
                onAction={onRetry}
            />
        );
    }
    if (isFiltered) {
        return (
            <NoData
                icon={emptyIcon}
                title={`No ${noun} match these filters`}
                message="Try a different search or clear the filters."
                showAction
                actionText="Clear filters"
                onAction={onClearFilters}
            />
        );
    }
    return <NoData icon={emptyIcon} title={emptyTitle} message={emptyMessage}/>;
};
