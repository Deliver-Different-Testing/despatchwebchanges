interface IDashboardSettingsConfig {
    title: string;
    showRefreshInterval?: boolean;
    showDriverLocationRefresh?: boolean;
    showDashboards?: boolean;
    showAiToggle?: boolean;
    /** Show the "Try the React (BETA) Job Search" toggle. Job Search settings only. */
    showJobSearchBetaToggle?: boolean;
    /** Show the "Try the React (BETA) Dispatch" toggle. Dispatch settings only. */
    showDispatchBetaToggle?: boolean;
    /** Replace the panels section with a "moved to the Layouts menu" notice. */
    panelsMovedNotice?: boolean;
}

export default IDashboardSettingsConfig;