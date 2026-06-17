interface IDashboardSettingsConfig {
    title: string;
    showRefreshInterval?: boolean;
    showDriverLocationRefresh?: boolean;
    showDashboards?: boolean;
    showAiToggle?: boolean;
    /** Show the "Try the React (BETA) Job Search" toggle. Job Search settings only. */
    showJobSearchBetaToggle?: boolean;
}

export default IDashboardSettingsConfig;