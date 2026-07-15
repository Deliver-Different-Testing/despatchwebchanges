import userEvent from '@testing-library/user-event';

type SetupOptions = Parameters<typeof userEvent.setup>[0];

/**
 * `userEvent.setup()` tuned for speed via `delay: null` — this skips the
 * macrotask yield user-event otherwise schedules between every keystroke and
 * pointer sub-event (the default `delay: 0` still queues a `setTimeout(0)`,
 * ~9 per click). Pointer-events checking is left at its default so disabled
 * elements still correctly reject interaction.
 *
 * Fake-timer files pass `{advanceTimers: jest.advanceTimersByTime}`, which
 * flows through `...options`.
 *
 * Lives in its own module (not the shared `__testUtils__/index`) because
 * user-event touches `navigator`/`document` and registers an `afterEach`
 * hook at import time — importing it must happen at collection time and only
 * in a jsdom environment. Node-environment service tests import the error
 * helpers from `__testUtils__/index`, which must stay free of user-event.
 */
export function setupUser(options: SetupOptions = {}) {
    return userEvent.setup({ delay: null, ...options });
}
