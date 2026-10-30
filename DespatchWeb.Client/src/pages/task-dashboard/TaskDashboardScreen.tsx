import React from 'react';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {TaskDashboardPage} from './TaskDashboardPage';
import {getSession} from '../../api/session';
import {noopRegisterRefresh, showPageToast} from '../pageToasts';

export const TaskDashboardScreen: React.FC = () => (
    <PageFrame section="Dashboards" title="Task dashboard">
        <ErrorBoundary>
            <TaskDashboardPage
                showToast={showPageToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                setRefreshCallback={noopRegisterRefresh}
            />
        </ErrorBoundary>
    </PageFrame>
);
