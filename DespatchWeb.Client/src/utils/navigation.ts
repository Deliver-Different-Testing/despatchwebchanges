/** Full-page navigation, isolated so tests can observe it (jsdom's location is not redefinable). */
export const redirectTo = (url: string): void => {
    window.location.href = url;
};
