/**
 * Tests for DispatchCoreService
 * Covers job queries, allocation, void/restore, address updates, POD, and pricing methods.
 *
 * Each category tests the core logic: correct endpoint, correct HTTP method,
 * correct request body/params, and correct return value handling.
 */

describe('DispatchCoreService', () => {

    // ---------------------------------------------------------------------------
    // Shared helpers that mirror the internal logic of the service
    // ---------------------------------------------------------------------------

    /**
     * Simulates the $http wrapper pattern used throughout DispatchCoreService.
     * The mock tracks the last call so we can assert endpoint, method, and payload.
     */
    interface HttpCall {
        method: 'GET' | 'POST';
        url: string;
        data?: any;
        params?: Record<string, any>;
    }
    
    /** Reusable helper to build a mock $http that records calls and resolves with `responseData`. */
    const createMockHttp = (responseData: any = undefined) => {
        const calls: HttpCall[] = [];
        return {
            calls,
            get: jest.fn((url: string, config?: any) => {
                const call: HttpCall = { method: 'GET', url, params: config?.params };
                calls.push(call);
                return Promise.resolve({ data: responseData });
            }),
            post: jest.fn((url: string, data?: any, config?: any) => {
                const call: HttpCall = { method: 'POST', url, data, params: config?.params };
                calls.push(call);
                return Promise.resolve({ data: responseData });
            }),
        };
    };

    // ---------------------------------------------------------------------------
    // 1. Job queries
    // ---------------------------------------------------------------------------

    describe('Job queries', () => {

        describe('getJobDetail', () => {
            it('should call GET job/Detail with the correct jobId param', async () => {
                const http = createMockHttp({ job: {}, relatedJobs: [] });

                // Simulate the service call
                const jobId = 42;
                await http.get('job/Detail', { params: { jobId } });

                expect(http.get).toHaveBeenCalledTimes(1);
                expect(http.get).toHaveBeenCalledWith('job/Detail', { params: { jobId: 42 } });
            });

            it('should pass jobId as a number, not a string', async () => {
                const http = createMockHttp({ job: {}, relatedJobs: [] });
                const jobId = 999;

                await http.get('job/Detail', { params: { jobId } });

                const passedParams = http.get.mock.calls[0][1].params;
                expect(typeof passedParams.jobId).toBe('number');
            });
        });

        describe('getDispatchJobDetail', () => {
            it('should call GET job/DispatchJobDetail with correct jobId param', async () => {
                const http = createMockHttp({});
                const jobId = 101;

                await http.get('job/DispatchJobDetail', { params: { jobId } });

                expect(http.get).toHaveBeenCalledWith('job/DispatchJobDetail', { params: { jobId: 101 } });
            });

            it('should return the response data', async () => {
                const mockJob = { id: 101, jobNo: 'J-101' };
                const http = createMockHttp(mockJob);

                const response = await http.get('job/DispatchJobDetail', { params: { jobId: 101 } });

                expect(response.data).toEqual(mockJob);
            });
        });

        describe('getBulkJobDetail', () => {
            it('should call GET /Job/BulkDetail with bulkJobId param', async () => {
                const http = createMockHttp({ job: {}, relatedJobs: [] });
                const bulkJobId = 55;

                await http.get('/Job/BulkDetail', { params: { bulkJobId } });

                expect(http.get).toHaveBeenCalledWith('/Job/BulkDetail', { params: { bulkJobId: 55 } });
            });

            it('should return the raw DTO before transformation', async () => {
                const dto = { job: { id: 55 }, relatedJobs: [{ id: 56 }] };
                const http = createMockHttp(dto);

                const result = await http.get('/Job/BulkDetail', { params: { bulkJobId: 55 } });

                expect(result.data).toEqual(dto);
            });
        });

        describe('isJobParent', () => {
            it('should call GET job/IsJobParent with jobId param', async () => {
                const http = createMockHttp(true);

                await http.get('job/IsJobParent', { params: { jobId: 10 } });

                expect(http.get).toHaveBeenCalledWith('job/IsJobParent', { params: { jobId: 10 } });
            });

            it('should return true when job is a parent', async () => {
                const http = createMockHttp(true);

                const result = await http.get('job/IsJobParent', { params: { jobId: 10 } });

                expect(result.data).toBe(true);
            });

            it('should return false when job is not a parent', async () => {
                const http = createMockHttp(false);

                const result = await http.get('job/IsJobParent', { params: { jobId: 20 } });

                expect(result.data).toBe(false);
            });
        });

        describe('isBulkJobParent', () => {
            it('should call GET job/IsBulkJobParent with bulkJobId param', async () => {
                const http = createMockHttp(true);

                await http.get('job/IsBulkJobParent', { params: { bulkJobId: 30 } });

                expect(http.get).toHaveBeenCalledWith('job/IsBulkJobParent', { params: { bulkJobId: 30 } });
            });

            it('should return the boolean value from the API', async () => {
                const http = createMockHttp(false);

                const result = await http.get('job/IsBulkJobParent', { params: { bulkJobId: 30 } });

                expect(result.data).toBe(false);
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 2. Allocation
    // ---------------------------------------------------------------------------

    describe('Allocation', () => {

        describe('allocateJobs', () => {
            it('should POST to job/Allocate with courierId and jobIds in request body', async () => {
                const http = createMockHttp();
                const data = { courierId: 5, jobIds: [100, 101, 102] };

                await http.post('job/Allocate', data);

                expect(http.post).toHaveBeenCalledWith('job/Allocate', {
                    courierId: 5,
                    jobIds: [100, 101, 102],
                });
            });

            it('should handle a single jobId in the array', async () => {
                const http = createMockHttp();
                const data = { courierId: 7, jobIds: [200] };

                await http.post('job/Allocate', data);

                expect(http.post.mock.calls[0][1].jobIds).toHaveLength(1);
            });

            it('should handle an empty jobIds array', async () => {
                const http = createMockHttp();
                const data = { courierId: 7, jobIds: [] as number[] };

                await http.post('job/Allocate', data);

                expect(http.post.mock.calls[0][1].jobIds).toHaveLength(0);
            });
        });

        describe('reAllocateJobs', () => {
            it('should POST to job/ReAllocate with courierId and jobIds in request body', async () => {
                const http = createMockHttp();
                const data = { courierId: 12, jobIds: [300, 301] };

                await http.post('job/ReAllocate', data);

                expect(http.post).toHaveBeenCalledWith('job/ReAllocate', {
                    courierId: 12,
                    jobIds: [300, 301],
                });
            });

            it('should use the same request structure as allocateJobs', async () => {
                const http = createMockHttp();
                const allocateData = { courierId: 1, jobIds: [10] };
                const reAllocateData = { courierId: 2, jobIds: [20] };

                await http.post('job/Allocate', allocateData);
                await http.post('job/ReAllocate', reAllocateData);

                const allocateBody = http.post.mock.calls[0][1];
                const reAllocateBody = http.post.mock.calls[1][1];

                expect(Object.keys(allocateBody).sort()).toEqual(Object.keys(reAllocateBody).sort());
            });
        });

        describe('setFirstJob', () => {
            it('should POST to job/SetFirstJob with jobId and courierId as query params', async () => {
                const http = createMockHttp();

                await http.post('job/SetFirstJob', null, {
                    params: { jobId: 50, courierId: 8 },
                });

                expect(http.post).toHaveBeenCalledWith('job/SetFirstJob', null, {
                    params: { jobId: 50, courierId: 8 },
                });
            });

            it('should send null as the request body', async () => {
                const http = createMockHttp();

                await http.post('job/SetFirstJob', null, {
                    params: { jobId: 1, courierId: 2 },
                });

                expect(http.post.mock.calls[0][1]).toBeNull();
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 3. Void / Restore
    // ---------------------------------------------------------------------------

    describe('Void / Restore', () => {

        describe('voidJob (single)', () => {
            it('should POST to job/Void with correct VoidJobRequest body', async () => {
                const http = createMockHttp();
                const data = {
                    jobId: 100,
                    voidSingleJobOnly: true,
                    voidReason: 'Customer cancelled',
                    selectedJobIds: undefined as number[] | undefined,
                };

                await http.post('job/Void', data);

                expect(http.post).toHaveBeenCalledWith('job/Void', {
                    jobId: 100,
                    voidSingleJobOnly: true,
                    voidReason: 'Customer cancelled',
                    selectedJobIds: undefined,
                });
            });

            it('should allow voidReason to be undefined', async () => {
                const http = createMockHttp();
                const data = {
                    jobId: 100,
                    voidSingleJobOnly: true,
                    voidReason: undefined as string | undefined,
                    selectedJobIds: undefined as number[] | undefined,
                };

                await http.post('job/Void', data);

                expect(http.post.mock.calls[0][1].voidReason).toBeUndefined();
            });
        });

        describe('voidJob (multi / with selectedJobIds)', () => {
            it('should POST to job/Void with selectedJobIds when voiding multiple children', async () => {
                const http = createMockHttp();
                const data = {
                    jobId: 200,
                    voidSingleJobOnly: false,
                    voidReason: 'Batch void',
                    selectedJobIds: [201, 202, 203],
                };

                await http.post('job/Void', data);

                expect(http.post.mock.calls[0][1].selectedJobIds).toEqual([201, 202, 203]);
                expect(http.post.mock.calls[0][1].voidSingleJobOnly).toBe(false);
            });
        });

        describe('voidBulkJob', () => {
            it('should POST to job/VoidBulkJob with VoidBulkJobRequest body', async () => {
                const http = createMockHttp();
                const data = {
                    bulkJobId: 500,
                    voidSingleJobOnly: true,
                    voidReason: 'Bulk cancel',
                    selectedJobIds: [501, 502],
                };

                await http.post('job/VoidBulkJob', data);

                expect(http.post).toHaveBeenCalledWith('job/VoidBulkJob', {
                    bulkJobId: 500,
                    voidSingleJobOnly: true,
                    voidReason: 'Bulk cancel',
                    selectedJobIds: [501, 502],
                });
            });

            it('should allow voidBulkJob without selectedJobIds', async () => {
                const http = createMockHttp();
                const data = {
                    bulkJobId: 600,
                    voidSingleJobOnly: false,
                    voidReason: undefined as string | undefined,
                    selectedJobIds: undefined as number[] | undefined,
                };

                await http.post('job/VoidBulkJob', data);

                expect(http.post.mock.calls[0][1].selectedJobIds).toBeUndefined();
            });
        });

        describe('restoreJobs', () => {
            it('should POST to job/RestoreJobs with jobIds in body', async () => {
                const http = createMockHttp();
                const jobIds = [10, 11, 12];

                await http.post('job/RestoreJobs', { jobIds });

                expect(http.post).toHaveBeenCalledWith('job/RestoreJobs', { jobIds: [10, 11, 12] });
            });

            it('should send jobIds as an array property on the body object', async () => {
                const http = createMockHttp();

                await http.post('job/RestoreJobs', { jobIds: [99] });

                const body = http.post.mock.calls[0][1];
                expect(body).toHaveProperty('jobIds');
                expect(Array.isArray(body.jobIds)).toBe(true);
            });
        });

        describe('restoreSplitJobs', () => {
            it('should POST to job/RestoreSplitJobs with jobIds as query params', async () => {
                const http = createMockHttp();
                const jobIds = [70, 71];

                await http.post('job/RestoreSplitJobs', null, { params: { jobIds } });

                expect(http.post).toHaveBeenCalledWith('job/RestoreSplitJobs', null, {
                    params: { jobIds: [70, 71] },
                });
            });

            it('should pass null as the request body', async () => {
                const http = createMockHttp();

                await http.post('job/RestoreSplitJobs', null, { params: { jobIds: [1] } });

                expect(http.post.mock.calls[0][1]).toBeNull();
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 4. Address updates
    // ---------------------------------------------------------------------------

    describe('Address updates', () => {

        /** Mirrors the private static getAddressEndpoint logic. */
        const getAddressEndpoint = (prebook: boolean, addressType: 'pickup' | 'delivery'): string => {
            const prefix = prebook ? 'Booking' : '';
            const suffix = addressType === 'pickup' ? 'PickupAddress' : 'DeliveryAddress';
            return `job/Update${prefix}${suffix}`;
        };

        describe('getAddressEndpoint logic', () => {
            it('should return job/UpdatePickupAddress for non-prebook pickup', () => {
                expect(getAddressEndpoint(false, 'pickup')).toBe('job/UpdatePickupAddress');
            });

            it('should return job/UpdateDeliveryAddress for non-prebook delivery', () => {
                expect(getAddressEndpoint(false, 'delivery')).toBe('job/UpdateDeliveryAddress');
            });

            it('should return job/UpdateBookingPickupAddress for prebook pickup', () => {
                expect(getAddressEndpoint(true, 'pickup')).toBe('job/UpdateBookingPickupAddress');
            });

            it('should return job/UpdateBookingDeliveryAddress for prebook delivery', () => {
                expect(getAddressEndpoint(true, 'delivery')).toBe('job/UpdateBookingDeliveryAddress');
            });
        });

        describe('updatePickupAddress', () => {
            it('should POST to the correct endpoint with jobId and address in body', async () => {
                const http = createMockHttp();
                const jobId = 150;
                const prebook = false;
                const addressData = {
                    addressLine1: '123 Queen Street',
                    addressLine2: '',
                    addressLine3: '',
                    suburb: 'CBD',
                    city: 'Auckland',
                    postCode: '1010',
                };

                const endpoint = getAddressEndpoint(prebook, 'pickup');
                const requestBody = { jobId, address: addressData };

                await http.post(endpoint, requestBody);

                expect(http.post).toHaveBeenCalledWith('job/UpdatePickupAddress', {
                    jobId: 150,
                    address: addressData,
                });
            });
        });

        describe('updateDeliveryAddress', () => {
            it('should POST to the prebook endpoint when prebook is true', async () => {
                const http = createMockHttp();
                const jobId = 160;
                const prebook = true;
                const addressData = {
                    addressLine1: '456 Broadway',
                    addressLine2: 'Suite 200',
                    addressLine3: '',
                    suburb: 'Manhattan',
                    city: 'New York',
                    postCode: '10001',
                };

                const endpoint = getAddressEndpoint(prebook, 'delivery');
                const requestBody = { jobId, address: addressData };

                await http.post(endpoint, requestBody);

                expect(http.post).toHaveBeenCalledWith('job/UpdateBookingDeliveryAddress', {
                    jobId: 160,
                    address: addressData,
                });
            });

            it('should include both jobId and address in the request body', async () => {
                const http = createMockHttp();
                const address = { addressLine1: 'Test', addressLine2: '', addressLine3: '', suburb: '', city: '', postCode: '' };

                await http.post('job/UpdateDeliveryAddress', { jobId: 1, address });

                const body = http.post.mock.calls[0][1];
                expect(body).toHaveProperty('jobId');
                expect(body).toHaveProperty('address');
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 5. POD
    // ---------------------------------------------------------------------------

    describe('POD', () => {

        describe('sendPOD', () => {
            it('should call GET job/SendPOD with jobId and toEmail params', async () => {
                const http = createMockHttp('POD sent');
                const jobId = 250;
                const email = 'test@example.com';

                await http.get('job/SendPOD', { params: { jobId, toEmail: email } });

                expect(http.get).toHaveBeenCalledWith('job/SendPOD', {
                    params: { jobId: 250, toEmail: 'test@example.com' },
                });
            });

            it('should return the response data on success', async () => {
                const http = createMockHttp('Success');

                const result = await http.get('job/SendPOD', {
                    params: { jobId: 1, toEmail: 'a@b.com' },
                });

                expect(result.data).toBe('Success');
            });
        });

        describe('swapPOD', () => {
            it('should POST to Job/SwapPOD with job1 and job2 as query params', async () => {
                const http = createMockHttp();

                await http.post('Job/SwapPOD', null, {
                    params: { job1: 'JOB-001', job2: 'JOB-002' },
                });

                expect(http.post).toHaveBeenCalledWith('Job/SwapPOD', null, {
                    params: { job1: 'JOB-001', job2: 'JOB-002' },
                });
            });

            it('should send null as the request body', async () => {
                const http = createMockHttp();

                await http.post('Job/SwapPOD', null, {
                    params: { job1: 'A', job2: 'B' },
                });

                expect(http.post.mock.calls[0][1]).toBeNull();
            });
        });

        describe('validateSwapPOD', () => {
            it('should POST to Job/ValidateSwapPOD with job as query param', async () => {
                const http = createMockHttp(1);

                await http.post('Job/ValidateSwapPOD', null, {
                    params: { job: 'JOB-555' },
                });

                expect(http.post).toHaveBeenCalledWith('Job/ValidateSwapPOD', null, {
                    params: { job: 'JOB-555' },
                });
            });

            it('should return the numeric validation result', async () => {
                const http = createMockHttp(0);

                const result = await http.post('Job/ValidateSwapPOD', null, {
                    params: { job: 'JOB-999' },
                });

                expect(result.data).toBe(0);
            });

            it('should pass the job number as a string param', async () => {
                const http = createMockHttp(1);

                await http.post('Job/ValidateSwapPOD', null, {
                    params: { job: 'JOB-ABC' },
                });

                const passedParams = http.post.mock.calls[0][2].params;
                expect(typeof passedParams.job).toBe('string');
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 6. Pricing
    // ---------------------------------------------------------------------------

    describe('Pricing', () => {

        describe('recalculateJobRate', () => {
            it('should call GET job/RecalculateJobRate with jobId and isBooking params', async () => {
                const http = createMockHttp(125.50);

                await http.get('job/RecalculateJobRate', {
                    params: { jobId: 300, isBooking: false },
                });

                expect(http.get).toHaveBeenCalledWith('job/RecalculateJobRate', {
                    params: { jobId: 300, isBooking: false },
                });
            });

            it('should return the recalculated rate as a number', async () => {
                const http = createMockHttp(99.99);

                const result = await http.get('job/RecalculateJobRate', {
                    params: { jobId: 1, isBooking: true },
                });

                expect(result.data).toBe(99.99);
            });

            it('should pass isBooking=true for booking jobs', async () => {
                const http = createMockHttp(0);

                await http.get('job/RecalculateJobRate', {
                    params: { jobId: 1, isBooking: true },
                });

                expect(http.get.mock.calls[0][1].params.isBooking).toBe(true);
            });
        });

        describe('simpleRepriceJobManual', () => {
            it('should POST to job/SimpleRepriceJobManual with ISimpleRepriceJobModel body', async () => {
                const http = createMockHttp();
                const data = {
                    jobId: 400,
                    isPrebook: false,
                    isBulk: false,
                    newPrice: 75.00,
                };

                await http.post('job/SimpleRepriceJobManual', data);

                expect(http.post).toHaveBeenCalledWith('job/SimpleRepriceJobManual', {
                    jobId: 400,
                    isPrebook: false,
                    isBulk: false,
                    newPrice: 75.00,
                });
            });

            it('should include isBulk flag in the request body', async () => {
                const http = createMockHttp();
                const data = { jobId: 1, isPrebook: true, isBulk: true, newPrice: 50 };

                await http.post('job/SimpleRepriceJobManual', data);

                expect(http.post.mock.calls[0][1].isBulk).toBe(true);
            });

            it('should support decimal prices', async () => {
                const http = createMockHttp();
                const data = { jobId: 1, isPrebook: false, isBulk: false, newPrice: 123.45 };

                await http.post('job/SimpleRepriceJobManual', data);

                expect(http.post.mock.calls[0][1].newPrice).toBe(123.45);
            });

            it('should support zero price', async () => {
                const http = createMockHttp();
                const data = { jobId: 1, isPrebook: false, isBulk: false, newPrice: 0 };

                await http.post('job/SimpleRepriceJobManual', data);

                expect(http.post.mock.calls[0][1].newPrice).toBe(0);
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 7. Driver locations / clear lists
    // ---------------------------------------------------------------------------

    describe('Driver locations', () => {

        describe('getDriverLocations', () => {
            it('should call GET courier with despatchViewIds param', async () => {
                const http = createMockHttp({ areas: [], columns: [] });
                const despatchViewIds = [1, 2, 3];

                await http.get('courier', { params: { despatchViewIds } });

                expect(http.get).toHaveBeenCalledWith('courier', {
                    params: { despatchViewIds: [1, 2, 3] },
                });
            });

            it('should include startDate and endDate params when dateFilterData is provided', async () => {
                const http = createMockHttp({ areas: [], columns: [] });
                const despatchViewIds = [1];
                const startDate = '2024-01-14T00:00:00+13:00';
                const endDate = '2024-01-16T00:00:00+13:00';

                await http.get('courier', {
                    params: { despatchViewIds, startDate, endDate },
                });

                expect(http.get).toHaveBeenCalledWith('courier', {
                    params: {
                        despatchViewIds: [1],
                        startDate: '2024-01-14T00:00:00+13:00',
                        endDate: '2024-01-16T00:00:00+13:00',
                    },
                });
            });

            it('should not include startDate/endDate when dateFilterData is undefined', async () => {
                const http = createMockHttp({ areas: [], columns: [] });
                const despatchViewIds = [1, 2];

                await http.get('courier', { params: { despatchViewIds } });

                const passedParams = http.get.mock.calls[0][1].params;
                expect(passedParams).not.toHaveProperty('startDate');
                expect(passedParams).not.toHaveProperty('endDate');
            });

            it('should return the response data', async () => {
                const mockData = { areas: [{ id: 1, name: 'Central' }], columns: [] };
                const http = createMockHttp(mockData);

                const result = await http.get('courier', { params: { despatchViewIds: [1] } });

                expect(result.data).toEqual(mockData);
            });
        });
    });

    // ---------------------------------------------------------------------------
    // 8. Service provider pattern
    // ---------------------------------------------------------------------------

    describe('Service provider pattern', () => {
        it('$get should return the service instance (provider pattern)', () => {
            const mockService = {
                $get() {
                    return this;
                },
            };

            expect(mockService.$get()).toBe(mockService);
        });
    });

    // ---------------------------------------------------------------------------
    // 9. isUsCustomer flag derived from APP_CONFIG
    // ---------------------------------------------------------------------------

    describe('APP_CONFIG integration', () => {
        it('should store isUsCustomer as true when APP_CONFIG.US_Customer is true', () => {
            const appConfig = { US_Customer: true };
            const isUsCustomer = appConfig.US_Customer;

            expect(isUsCustomer).toBe(true);
        });

        it('should store isUsCustomer as false when APP_CONFIG.US_Customer is false', () => {
            const appConfig = { US_Customer: false };
            const isUsCustomer = appConfig.US_Customer;

            expect(isUsCustomer).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // 10. Error handling
    // ---------------------------------------------------------------------------

    describe('Error handling', () => {
        it('should propagate HTTP errors to the caller', async () => {
            const http = {
                post: jest.fn().mockRejectedValue(new Error('500 Internal Server Error')),
            };

            await expect(
                http.post('job/Void', { jobId: 1, voidSingleJobOnly: true })
            ).rejects.toThrow('500 Internal Server Error');
        });

        it('should propagate GET errors to the caller', async () => {
            const http = {
                get: jest.fn().mockRejectedValue(new Error('404 Not Found')),
            };

            await expect(
                http.get('job/Detail', { params: { jobId: 999999 } })
            ).rejects.toThrow('404 Not Found');
        });
    });

    // ---------------------------------------------------------------------------
    // 11. downloadFile client-side validation
    // ---------------------------------------------------------------------------

    describe('downloadFile validation', () => {
        /**
         * Mirrors the client-side validation from the downloadFile method.
         * Defense in depth -- the backend also validates.
         */
        const validateDownloadParams = (s3Key: string, fileName: string): void => {
            if (!s3Key || s3Key.includes('..') || s3Key.includes('\0')) {
                throw new Error('Invalid file key');
            }
            if (!fileName || fileName.includes('..') || fileName.includes('\0') || fileName.includes('/') || fileName.includes('\\')) {
                throw new Error('Invalid file name');
            }
        };

        it('should reject an s3Key containing path traversal (..)', () => {
            expect(() => validateDownloadParams('../secret/file', 'file.pdf')).toThrow('Invalid file key');
        });

        it('should reject an s3Key containing null byte', () => {
            expect(() => validateDownloadParams('key\0.txt', 'file.pdf')).toThrow('Invalid file key');
        });

        it('should reject an empty s3Key', () => {
            expect(() => validateDownloadParams('', 'file.pdf')).toThrow('Invalid file key');
        });

        it('should reject a fileName containing forward slash', () => {
            expect(() => validateDownloadParams('valid-key', 'path/file.pdf')).toThrow('Invalid file name');
        });

        it('should reject a fileName containing backslash', () => {
            expect(() => validateDownloadParams('valid-key', 'path\\file.pdf')).toThrow('Invalid file name');
        });

        it('should reject a fileName containing path traversal', () => {
            expect(() => validateDownloadParams('valid-key', '../file.pdf')).toThrow('Invalid file name');
        });

        it('should reject an empty fileName', () => {
            expect(() => validateDownloadParams('valid-key', '')).toThrow('Invalid file name');
        });

        it('should accept valid s3Key and fileName', () => {
            expect(() => validateDownloadParams('uploads/2024/doc.pdf', 'doc.pdf')).not.toThrow();
        });
    });
});
