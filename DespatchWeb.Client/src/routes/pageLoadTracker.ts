let pending = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

export const getPendingPageLoads = () => pending;

export const subscribePageLoads = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
};

/** Router navigations run in a transition, so the old page stays up with no signal; this is the signal. */
export const trackPageLoad = async <T>(load: () => Promise<T>): Promise<T> => {
    pending++;
    notify();
    try {
        return await load();
    } finally {
        pending--;
        notify();
    }
};
