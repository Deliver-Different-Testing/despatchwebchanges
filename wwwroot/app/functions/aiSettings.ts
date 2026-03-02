import {ContactID} from '../contants';

const STORAGE_KEY = `aiEnabled_${ContactID}`;

export function isAiEnabled(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
}

export function setAiEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(enabled));
}
