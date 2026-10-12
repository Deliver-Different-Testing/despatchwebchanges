import React from 'react';
import {PageFrame} from '../app/PageFrame';
import {ErrorBoundary} from '../components/common/error-boundary';
import {DriverManagementPage} from '../pages/driver-management/DriverManagementPage';
import {getSession} from '../session';
import {noopRegisterRefresh, showPageToast} from './pageToasts';

export const DriverManagementScreen: React.FC = () => (
    <PageFrame section="Operations" title="Drivers">
        <ErrorBoundary>
            <DriverManagementPage
                showToast={showPageToast}
                isUsCustomer={getSession().isUsCustomer ?? false}
                setRefreshCallback={noopRegisterRefresh}
            />
        </ErrorBoundary>
    </PageFrame>
);
