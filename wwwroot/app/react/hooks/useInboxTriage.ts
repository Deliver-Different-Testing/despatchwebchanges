/**
 * One Auto-mate pass over the whole message inbox.
 *
 * Triage is advisory — it orders the list the dispatcher is about to work down,
 * and they read every message before replying. That, plus cost, is why this is a
 * single batched call over the recent-conversation list rather than one request
 * per thread.
 *
 * It runs once when the dialog opens and not on the 20-second conversation
 * refresh: a chip that reshuffles under the cursor is worse than a stale one, and
 * the server's 90-second response cache would collapse the repeats anyway.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {triageInbox} from '../services/aiAssistantApi';
import {InboxTriageItem} from '../interfaces/ai';
import {isAiFeatureEnabled} from '../services/aiPreferenceStore';

/** The key the messaging dialog already identifies a conversation by. */
export function triageKey(otherPartyId: number, otherPartyType: number): string {
    return `${otherPartyId}-${otherPartyType}`;
}

export interface UseInboxTriageResult {
    /** Triage by conversation key, empty until the pass returns. */
    triage: Map<string, InboxTriageItem>;
    isTriaging: boolean;
}

export function useInboxTriage(open: boolean, hasConversations: boolean): UseInboxTriageResult {
    const [items, setItems] = useState<InboxTriageItem[]>([]);
    const [isTriaging, setIsTriaging] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const requestedRef = useRef(false);

    useEffect(() => () => abortRef.current?.abort(), []);

    const run = useCallback(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        setIsTriaging(true);
        try {
            const response = await triageInbox({signal: controller.signal});
            if (!controller.signal.aborted) setItems(response.conversations);
        } catch {
            // Advisory only: a failed pass leaves the list exactly as it was.
            if (!controller.signal.aborted) setItems([]);
        } finally {
            if (abortRef.current === controller) setIsTriaging(false);
        }
    }, []);

    useEffect(() => {
        if (!open) {
            requestedRef.current = false;
            abortRef.current?.abort();
            setItems([]);
            return;
        }

        if (!hasConversations || !isAiFeatureEnabled('triage') || requestedRef.current) return;

        requestedRef.current = true;
        void run();
    }, [open, hasConversations, run]);

    const triage = useMemo(() => {
        const map = new Map<string, InboxTriageItem>();
        for (const item of items) {
            map.set(triageKey(item.otherPartyId, item.otherPartyType), item);
        }
        return map;
    }, [items]);

    return {triage, isTriaging};
}
