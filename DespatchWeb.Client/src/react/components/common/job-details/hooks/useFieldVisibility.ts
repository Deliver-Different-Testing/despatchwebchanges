/**
 * Hook for managing field visibility via localStorage
 */

import {useState, useCallback} from 'react';
import {DEFAULT_FIELD_VISIBILITY} from '../JobDetails.types';
import type {FieldVisibility} from '../JobDetails.types';

const STORAGE_KEY_PREFIX = 'jobDetail_fieldVisibility_';

function loadFromStorage(contactId: number): FieldVisibility {
    try {
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${contactId}`);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {...DEFAULT_FIELD_VISIBILITY, ...parsed};
        }
    } catch {
        // Ignore storage errors
    }
    return {...DEFAULT_FIELD_VISIBILITY};
}

function saveToStorage(contactId: number, visibility: FieldVisibility): void {
    try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${contactId}`, JSON.stringify(visibility));
    } catch {
        // Ignore storage errors
    }
}

export function useFieldVisibility(contactId: number) {
    const [fieldVisibility, setFieldVisibility] = useState<FieldVisibility>(
        () => loadFromStorage(contactId)
    );
    const [isEditMode, setIsEditMode] = useState(false);

    const toggleField = useCallback((fieldKey: string) => {
        setFieldVisibility(prev => {
            const updated = {...prev, [fieldKey]: !prev[fieldKey]};
            saveToStorage(contactId, updated);
            return updated;
        });
    }, [contactId]);

    const resetToDefaults = useCallback(() => {
        const defaults = {...DEFAULT_FIELD_VISIBILITY};
        setFieldVisibility(defaults);
        saveToStorage(contactId, defaults);
    }, [contactId]);

    const isFieldVisible = useCallback((fieldKey: string): boolean => {
        return fieldVisibility[fieldKey] ?? true;
    }, [fieldVisibility]);

    const toggleEditMode = useCallback(() => {
        setIsEditMode(prev => !prev);
    }, []);

    return {
        fieldVisibility,
        isEditMode,
        toggleEditMode,
        toggleField,
        resetToDefaults,
        isFieldVisible,
    };
}
