import React from 'react';
import {render} from '@testing-library/react';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/en-nz';
import {clearSessionContext, setSessionContext, type SessionContextDto} from '../api/session';
import {ThemeBootstrap} from './ThemeBootstrap';

const context = (isUsTenant: boolean): SessionContextDto => ({
    contactId: 1, staffId: null, firstName: null, fullName: null, email: null, dispatcher: null,
    timeZone: null, countryCode: null, isUsTenant, currencyCode: isUsTenant ? 'USD' : 'NZD',
    clientInternal: false, isNetworkPartner: false, visibleFeatures: null, npMapCenter: null, hubUrl: null,
});

describe('ThemeBootstrap', () => {
    afterEach(() => {
        clearSessionContext();
        dayjs.locale('en');
        document.body.className = '';
        document.documentElement.removeAttribute('style');
    });

    it('sets the en-nz locale before children render for a non-US tenant', () => {
        setSessionContext(context(false));
        let localeSeenByChild = '';
        const Child = () => {
            localeSeenByChild = dayjs.locale();
            return <span>child</span>;
        };
        const {getByText} = render(<ThemeBootstrap><Child/></ThemeBootstrap>);

        expect(getByText('child')).toBeInTheDocument();
        expect(localeSeenByChild).toBe('en-nz');
    });

    it('keeps the en locale for a US tenant', () => {
        setSessionContext(context(true));
        render(<ThemeBootstrap><span/></ThemeBootstrap>);

        expect(dayjs.locale()).toBe('en');
    });

    it.each([false, true])('never picks theme colours from the tenant country (isUsTenant=%s)', (isUs) => {
        setSessionContext(context(isUs));
        render(<ThemeBootstrap><span/></ThemeBootstrap>);

        expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('');
        expect(document.body.className).toBe('');
    });
});
