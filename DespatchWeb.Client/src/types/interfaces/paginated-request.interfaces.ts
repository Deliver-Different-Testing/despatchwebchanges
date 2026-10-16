export interface IPaginatedRequest {
    searchTerm?: string;
    page: number;
    pageSize: number;
    orderBy: string;
    sortDescending: boolean;
}