import {getSession} from './react/session';
const FirstName: string = getSession().firstName;
const ContactID: number = getSession().contactId;
const TimeZone: string = getSession().timeZone;
const NationwideSpeedId = 415;

export {FirstName, ContactID, TimeZone, NationwideSpeedId};
