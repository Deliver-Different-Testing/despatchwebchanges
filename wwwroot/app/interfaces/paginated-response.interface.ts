export interface IPaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pages: number;
}
