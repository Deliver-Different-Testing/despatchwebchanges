/**
 * React Query Hooks for Address API
 *
 * Provides type-safe hooks for address-related API operations
 * with automatic caching, loading states, and error handling.
 */

import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../query';
import {addressApi} from '../services/addressApi';
import {HereMapsLocationResult, HereMapsLookupResponse} from '../interfaces';

/**
 * Hook to search for addresses using HERE Maps autocomplete
 *
 * @param searchText - Search text (minimum 3 characters to trigger search)
 * @param options - Additional options
 * @returns Query result with address results array, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: addresses, isFetching, error } = useAddressSearch(searchText);
 * ```
 */
export function useAddressSearch(
    searchText: string,
    options?: {
        enabled?: boolean;
    }
) {
    const shouldSearch = searchText.length >= 3;

    return useQuery<HereMapsLocationResult[], Error>({
        queryKey: queryKeys.addresses.search(searchText),
        queryFn: ({signal}) => addressApi.autocompleteSearch(searchText, {signal}),
        enabled: shouldSearch && (options?.enabled ?? true),
        staleTime: 30 * 1000, // Cache search results for 30 seconds
    });
}

/**
 * Hook to get detailed location information by address ID
 *
 * @param addressId - HERE Maps location ID
 * @param options - Additional options
 * @returns Query result with detailed location info, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: details, isLoading } = useLocationDetails(selectedAddressId);
 * ```
 */
export function useLocationDetails(
    addressId: string | null,
    options?: {
        enabled?: boolean;
    }
) {
    return useQuery<HereMapsLookupResponse, Error>({
        queryKey: queryKeys.addresses.details(addressId || ''),
        queryFn: ({signal}) => addressApi.getLocationDetailsById(addressId!, {signal}),
        enabled: !!addressId && (options?.enabled ?? true),
        staleTime: 5 * 60 * 1000, // Cache location details for 5 minutes
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    });
}

/**
 * Hook to get the HERE Maps API key
 *
 * @param options - Additional options
 * @returns Query result with API key string, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: apiKey, isLoading } = useHereMapsApiKey();
 * ```
 */
export function useHereMapsApiKey(options?: {enabled?: boolean}) {
    return useQuery<string, Error>({
        queryKey: queryKeys.hereMaps.apiKey,
        queryFn: ({signal}) => addressApi.getHereMapsKey({signal}),
        enabled: options?.enabled ?? true,
        staleTime: 60 * 60 * 1000, // Cache API key for 1 hour
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    });
}
