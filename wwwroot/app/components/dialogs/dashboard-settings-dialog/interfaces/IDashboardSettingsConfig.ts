interface IDashboardSettingsConfig {
    title: string;
    showRefreshInterval?: boolean;
    showDriverLocationRefresh?: boolean;
    showAiToggle?: boolean;
    /** Show the "Try the React (BETA) Job Search" toggle. Job Search settings only. */
    showJobSearchBetaToggle?: boolean;
    /** Show the "Try the React (BETA) Dispatch" toggle. Dispatch settings only. */
    showDispatchBetaToggle?: boolean;
    showNationwideBetaToggle?: boolean;
}

export default IDashboardSettingsConfig;