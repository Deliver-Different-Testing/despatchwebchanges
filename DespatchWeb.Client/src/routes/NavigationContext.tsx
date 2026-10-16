import React, {createContext, useContext} from 'react';

export type NavigationParams = Record<string, string | number | null>;

export interface Navigation {
    navigate(stateName: string, params?: NavigationParams): void;
    currentState: string;
}

const NavigationContext = createContext<Navigation | null>(null);

export const NavigationProvider: React.FC<{value: Navigation; children?: React.ReactNode}> = ({value, children}) => (
    <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
);

export function useNavigation(): Navigation {
    const navigation = useContext(NavigationContext);
    if (!navigation) {
        throw new Error('useNavigation must be used inside a NavigationProvider');
    }
    return navigation;
}
