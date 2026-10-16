import React from 'react';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import type {PrebookListModel} from '../../types';
import {RecurringJobsPage} from './RecurringJobsPage';
import {getSession} from '../../api/session';
import {noopRegisterRefresh, showPageToast} from '../pageToasts';

export interface RecurringJobsScreenProps {
    /** Adds a pickup/delivery stop to a recurring job. Defaults to a no-op until the add-stop flow is wired in. */
    onAddStop?: (job: PrebookListModel, isPickup: boolean) => void;
}

const noopAddStop = (): void => undefined;

export const RecurringJobsScreen: React.FC<RecurringJobsScreenProps> = ({onAddStop = noopAddStop}) => (
    <PageFrame section="Dashboards" title="Recurring Jobs">
        <ErrorBoundary>
            <RecurringJobsPage
                showToast={showPageToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                onAddStop={onAddStop}
                setRefreshCallback={noopRegisterRefresh}
            />
        </ErrorBoundary>
    </PageFrame>
);
