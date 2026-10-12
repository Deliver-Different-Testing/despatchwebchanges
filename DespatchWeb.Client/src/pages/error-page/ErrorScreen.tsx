import React from 'react';
import {useNavigation} from '../../routes/NavigationContext';
import {ErrorPage, type ErrorType} from './ErrorPage';

export interface ErrorScreenProps {
    errorType: ErrorType;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({errorType}) => {
    const {navigate} = useNavigation();
    return (
        <div style={{height: '100%'}}>
            <ErrorPage
                errorType={errorType}
                onGoHome={() => navigate('home')}
                onGoBack={() => window.history.back()}
            />
        </div>
    );
};
