import React from 'react';
import {PageFrame} from '../app/PageFrame';
import {ErrorBoundary} from '../components/common/error-boundary';
import {OverviewPage} from '../pages/overview/OverviewPage';
import {openJobInSearch} from '../services/navigationService';
import {getSession} from '../session';
import {noopRegisterRefresh, overviewToast} from './pageToasts';

export const OverviewScreen: React.FC = () => (
    <PageFrame section="Dashboards" title="Overview" scrollable>
        <ErrorBoundary>
            <OverviewPage
                showToast={overviewToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                onOpenJobDetail={(jobId) => openJobInSearch(jobId)}
                setRefreshCallback={noopRegisterRefresh}
            />
        </ErrorBoundary>
    </PageFrame>
);
