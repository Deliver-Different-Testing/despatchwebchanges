import React from 'react';
import {PageFrame} from '../app/PageFrame';
import {ErrorBoundary} from '../components/common/error-boundary';
import {TaskDashboardPage} from '../pages/task-dashboard/TaskDashboardPage';
import {getSession} from '../session';
import {noopRegisterRefresh, showPageToast} from './pageToasts';

export const TaskDashboardScreen: React.FC = () => (
    <PageFrame section="Dashboards" title="Task Dashboard">
        <ErrorBoundary>
            <TaskDashboardPage
                showToast={showPageToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                setRefreshCallback={noopRegisterRefresh}
            />
        </ErrorBoundary>
    </PageFrame>
);
