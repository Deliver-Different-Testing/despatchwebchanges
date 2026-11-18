import React from 'react';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {OverviewPage} from './OverviewPage';
import {openJobInSearch} from '../../services/navigationService';
import {getSession} from '../../api/session';
import {overviewToast} from '../pageToasts';

export const OverviewScreen: React.FC = () => (
    <PageFrame section="Dashboards" title="Overview" scrollable>
        <ErrorBoundary>
            <OverviewPage
                showToast={overviewToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                onOpenJobDetail={(jobId) => openJobInSearch(jobId)}
            />
        </ErrorBoundary>
    </PageFrame>
);
