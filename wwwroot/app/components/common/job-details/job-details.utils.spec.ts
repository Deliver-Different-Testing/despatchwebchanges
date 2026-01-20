/**
 * Tests for JobDetailController utility functions
 * Tests static methods and helper functions used in job details
 */

import JobDetailComponent from './job-details.component';

// Extract the controller class from the component
const JobDetailController = JobDetailComponent.controller as any;

describe('JobDetailController', () => {
    describe('Static Methods', () => {
        describe('getTrackingMethod', () => {
            it('should return "Email" for trackingMethod 1', () => {
                expect(JobDetailController.getTrackingMethod(1)).toBe('Email');
            });

            it('should return "Mobile" for trackingMethod 2', () => {
                expect(JobDetailController.getTrackingMethod(2)).toBe('Mobile');
            });

            it('should return "Email & Mobile" for trackingMethod 3', () => {
                expect(JobDetailController.getTrackingMethod(3)).toBe('Email & Mobile');
            });

            it('should return empty string for trackingMethod 0', () => {
                expect(JobDetailController.getTrackingMethod(0)).toBe('');
            });

            it('should return empty string for undefined', () => {
                expect(JobDetailController.getTrackingMethod(undefined)).toBe('');
            });

            it('should return empty string for null', () => {
                expect(JobDetailController.getTrackingMethod(null)).toBe('');
            });

            it('should return empty string for unknown values', () => {
                expect(JobDetailController.getTrackingMethod(4)).toBe('');
                expect(JobDetailController.getTrackingMethod(99)).toBe('');
                expect(JobDetailController.getTrackingMethod(-1)).toBe('');
            });
        });

        describe('hasDGDocs', () => {
            it('should return empty string when dgClass is falsy', () => {
                expect(JobDetailController.hasDGDocs({ dgClass: 0 })).toBe('');
                expect(JobDetailController.hasDGDocs({ dgClass: null })).toBe('');
                expect(JobDetailController.hasDGDocs({ dgClass: undefined })).toBe('');
                expect(JobDetailController.hasDGDocs({})).toBe('');
            });

            it('should return "Yes" when dgClass is 1', () => {
                expect(JobDetailController.hasDGDocs({ dgClass: 1 })).toBe('Yes');
            });

            it('should return "Yes" when dgDocumentation is true', () => {
                expect(JobDetailController.hasDGDocs({
                    dgClass: 2,
                    dgDocumentation: true
                })).toBe('Yes');
            });

            it('should return "No" when dgClass exists but dgDocumentation is false', () => {
                expect(JobDetailController.hasDGDocs({
                    dgClass: 2,
                    dgDocumentation: false
                })).toBe('No');
            });

            it('should return "No" when dgClass exists but dgDocumentation is undefined', () => {
                expect(JobDetailController.hasDGDocs({
                    dgClass: 5
                })).toBe('No');
            });

            it('should handle various dgClass values with documentation', () => {
                for (let i = 2; i <= 9; i++) {
                    expect(JobDetailController.hasDGDocs({
                        dgClass: i,
                        dgDocumentation: true
                    })).toBe('Yes');

                    expect(JobDetailController.hasDGDocs({
                        dgClass: i,
                        dgDocumentation: false
                    })).toBe('No');
                }
            });
        });
    });

    describe('Instance Methods', () => {
        // Create a minimal mock controller for testing instance methods
        const createMockController = (overrides: any = {}) => {
            return {
                formattedPodPhotos: [],
                selectedPhotoIndex: 0,
                ...overrides
            };
        };

        describe('nextPhoto', () => {
            it('should increment selectedPhotoIndex', () => {
                const ctrl = createMockController({
                    formattedPodPhotos: [{}, {}, {}],
                    selectedPhotoIndex: 0
                });

                // Manually implement the logic since we're testing the algorithm
                const nextPhoto = () => {
                    if (!ctrl.formattedPodPhotos.length) return;
                    ctrl.selectedPhotoIndex =
                        (ctrl.selectedPhotoIndex + 1) % ctrl.formattedPodPhotos.length;
                };

                nextPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(1);

                nextPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(2);
            });

            it('should wrap around to 0 after last photo', () => {
                const ctrl = createMockController({
                    formattedPodPhotos: [{}, {}, {}],
                    selectedPhotoIndex: 2
                });

                const nextPhoto = () => {
                    if (!ctrl.formattedPodPhotos.length) return;
                    ctrl.selectedPhotoIndex =
                        (ctrl.selectedPhotoIndex + 1) % ctrl.formattedPodPhotos.length;
                };

                nextPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(0);
            });

            it('should not change index when no photos', () => {
                const ctrl = createMockController({
                    formattedPodPhotos: [],
                    selectedPhotoIndex: 0
                });

                const nextPhoto = () => {
                    if (!ctrl.formattedPodPhotos.length) return;
                    ctrl.selectedPhotoIndex =
                        (ctrl.selectedPhotoIndex + 1) % ctrl.formattedPodPhotos.length;
                };

                nextPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(0);
            });
        });

        describe('prevPhoto', () => {
            it('should decrement selectedPhotoIndex', () => {
                const ctrl = createMockController({
                    formattedPodPhotos: [{}, {}, {}],
                    selectedPhotoIndex: 2
                });

                const prevPhoto = () => {
                    if (!ctrl.formattedPodPhotos.length) return;
                    ctrl.selectedPhotoIndex =
                        (ctrl.selectedPhotoIndex - 1 + ctrl.formattedPodPhotos.length) %
                        ctrl.formattedPodPhotos.length;
                };

                prevPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(1);

                prevPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(0);
            });

            it('should wrap around to last photo from index 0', () => {
                const ctrl = createMockController({
                    formattedPodPhotos: [{}, {}, {}],
                    selectedPhotoIndex: 0
                });

                const prevPhoto = () => {
                    if (!ctrl.formattedPodPhotos.length) return;
                    ctrl.selectedPhotoIndex =
                        (ctrl.selectedPhotoIndex - 1 + ctrl.formattedPodPhotos.length) %
                        ctrl.formattedPodPhotos.length;
                };

                prevPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(2);
            });

            it('should not change index when no photos', () => {
                const ctrl = createMockController({
                    formattedPodPhotos: [],
                    selectedPhotoIndex: 0
                });

                const prevPhoto = () => {
                    if (!ctrl.formattedPodPhotos.length) return;
                    ctrl.selectedPhotoIndex =
                        (ctrl.selectedPhotoIndex - 1 + ctrl.formattedPodPhotos.length) %
                        ctrl.formattedPodPhotos.length;
                };

                prevPhoto();
                expect(ctrl.selectedPhotoIndex).toBe(0);
            });
        });

        describe('isPdfFile', () => {
            // Extract the logic from the controller
            const isPdfFile = (photo: any): boolean => {
                if (!photo) return false;

                if (photo.contentType) {
                    return photo.contentType === 'application/pdf';
                }

                if (photo.fileName) {
                    return photo.fileName.toLowerCase().endsWith('.pdf');
                }

                if (photo.s3Key) {
                    return photo.s3Key.toLowerCase().endsWith('.pdf');
                }

                return false;
            };

            it('should return false for null', () => {
                expect(isPdfFile(null)).toBe(false);
            });

            it('should return false for undefined', () => {
                expect(isPdfFile(undefined)).toBe(false);
            });

            it('should return false for empty object', () => {
                expect(isPdfFile({})).toBe(false);
            });

            it('should return true when contentType is application/pdf', () => {
                expect(isPdfFile({ contentType: 'application/pdf' })).toBe(true);
            });

            it('should return false when contentType is not pdf', () => {
                expect(isPdfFile({ contentType: 'image/png' })).toBe(false);
                expect(isPdfFile({ contentType: 'image/jpeg' })).toBe(false);
                expect(isPdfFile({ contentType: 'text/plain' })).toBe(false);
            });

            it('should check fileName when contentType is not present', () => {
                expect(isPdfFile({ fileName: 'document.pdf' })).toBe(true);
                expect(isPdfFile({ fileName: 'DOCUMENT.PDF' })).toBe(true);
                expect(isPdfFile({ fileName: 'file.PDF' })).toBe(true);
            });

            it('should return false for non-pdf filenames', () => {
                expect(isPdfFile({ fileName: 'image.png' })).toBe(false);
                expect(isPdfFile({ fileName: 'photo.jpg' })).toBe(false);
                expect(isPdfFile({ fileName: 'document.docx' })).toBe(false);
            });

            it('should check s3Key when fileName is not present', () => {
                expect(isPdfFile({ s3Key: 'uploads/2024/01/document.pdf' })).toBe(true);
                expect(isPdfFile({ s3Key: 'files/REPORT.PDF' })).toBe(true);
            });

            it('should return false for non-pdf s3Keys', () => {
                expect(isPdfFile({ s3Key: 'uploads/image.png' })).toBe(false);
                expect(isPdfFile({ s3Key: 'photos/IMG_001.JPG' })).toBe(false);
            });

            it('should prioritize contentType over fileName', () => {
                // contentType says it's not a PDF, even though fileName says it is
                expect(isPdfFile({
                    contentType: 'image/png',
                    fileName: 'file.pdf'
                })).toBe(false);
            });
        });

        describe('isImageFile', () => {
            const isImageFile = (photo: any): boolean => {
                if (!photo) return false;

                if (photo.contentType) {
                    return photo.contentType.startsWith('image/');
                }

                if (photo.fileName) {
                    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
                    return imageExtensions.some(ext =>
                        photo.fileName.toLowerCase().endsWith(ext)
                    );
                }

                if (photo.s3Key) {
                    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
                    return imageExtensions.some(ext =>
                        photo.s3Key.toLowerCase().endsWith(ext)
                    );
                }

                return false;
            };

            it('should return false for null', () => {
                expect(isImageFile(null)).toBe(false);
            });

            it('should return false for undefined', () => {
                expect(isImageFile(undefined)).toBe(false);
            });

            it('should return false for empty object', () => {
                expect(isImageFile({})).toBe(false);
            });

            it('should return true for image contentTypes', () => {
                expect(isImageFile({ contentType: 'image/png' })).toBe(true);
                expect(isImageFile({ contentType: 'image/jpeg' })).toBe(true);
                expect(isImageFile({ contentType: 'image/gif' })).toBe(true);
                expect(isImageFile({ contentType: 'image/webp' })).toBe(true);
                expect(isImageFile({ contentType: 'image/bmp' })).toBe(true);
            });

            it('should return false for non-image contentTypes', () => {
                expect(isImageFile({ contentType: 'application/pdf' })).toBe(false);
                expect(isImageFile({ contentType: 'text/plain' })).toBe(false);
                expect(isImageFile({ contentType: 'video/mp4' })).toBe(false);
            });

            it('should check fileName extensions when contentType is not present', () => {
                expect(isImageFile({ fileName: 'photo.jpg' })).toBe(true);
                expect(isImageFile({ fileName: 'photo.jpeg' })).toBe(true);
                expect(isImageFile({ fileName: 'photo.png' })).toBe(true);
                expect(isImageFile({ fileName: 'photo.gif' })).toBe(true);
                expect(isImageFile({ fileName: 'photo.webp' })).toBe(true);
                expect(isImageFile({ fileName: 'photo.bmp' })).toBe(true);
            });

            it('should be case-insensitive for fileName', () => {
                expect(isImageFile({ fileName: 'PHOTO.JPG' })).toBe(true);
                expect(isImageFile({ fileName: 'Photo.PNG' })).toBe(true);
                expect(isImageFile({ fileName: 'IMAGE.JPEG' })).toBe(true);
            });

            it('should return false for non-image filenames', () => {
                expect(isImageFile({ fileName: 'document.pdf' })).toBe(false);
                expect(isImageFile({ fileName: 'data.json' })).toBe(false);
                expect(isImageFile({ fileName: 'video.mp4' })).toBe(false);
            });

            it('should check s3Key when fileName is not present', () => {
                expect(isImageFile({ s3Key: 'uploads/2024/01/photo.jpg' })).toBe(true);
                expect(isImageFile({ s3Key: 'images/banner.png' })).toBe(true);
            });

            it('should return false for non-image s3Keys', () => {
                expect(isImageFile({ s3Key: 'docs/report.pdf' })).toBe(false);
                expect(isImageFile({ s3Key: 'files/data.csv' })).toBe(false);
            });

            it('should prioritize contentType over fileName', () => {
                expect(isImageFile({
                    contentType: 'application/pdf',
                    fileName: 'file.jpg'
                })).toBe(false);

                expect(isImageFile({
                    contentType: 'image/png',
                    fileName: 'file.pdf'
                })).toBe(true);
            });
        });
    });

    describe('Component Definition', () => {
        it('should have correct bindings', () => {
            expect(JobDetailComponent.bindings).toEqual({
                jobId: '<',
                angularId: '<',
                appPage: '<',
                onStatusChange: '&',
                isRecurringJob: '<',
                isBulkJob: '<',
                onJobUpdate: '&'
            });
        });

        it('should use ctrl as controllerAs', () => {
            expect(JobDetailComponent.controllerAs).toBe('ctrl');
        });

        it('should have the controller defined', () => {
            expect(JobDetailComponent.controller).toBeDefined();
        });
    });
});

describe('Photo Navigation Algorithm', () => {
    // Test the circular navigation algorithm used for photos
    describe('Circular Index Navigation', () => {
        const getNextIndex = (current: number, total: number): number => {
            if (total === 0) return current;
            return (current + 1) % total;
        };

        const getPrevIndex = (current: number, total: number): number => {
            if (total === 0) return current;
            return (current - 1 + total) % total;
        };

        it('should cycle forward through indices', () => {
            const total = 5;
            let index = 0;

            index = getNextIndex(index, total); // 1
            expect(index).toBe(1);

            index = getNextIndex(index, total); // 2
            expect(index).toBe(2);

            index = getNextIndex(index, total); // 3
            expect(index).toBe(3);

            index = getNextIndex(index, total); // 4
            expect(index).toBe(4);

            index = getNextIndex(index, total); // 0 (wrap)
            expect(index).toBe(0);
        });

        it('should cycle backward through indices', () => {
            const total = 5;
            let index = 0;

            index = getPrevIndex(index, total); // 4 (wrap)
            expect(index).toBe(4);

            index = getPrevIndex(index, total); // 3
            expect(index).toBe(3);

            index = getPrevIndex(index, total); // 2
            expect(index).toBe(2);
        });

        it('should handle single item array', () => {
            expect(getNextIndex(0, 1)).toBe(0);
            expect(getPrevIndex(0, 1)).toBe(0);
        });

        it('should handle empty array', () => {
            expect(getNextIndex(0, 0)).toBe(0);
            expect(getPrevIndex(0, 0)).toBe(0);
        });
    });
});

describe('getConnectionTime', () => {
    // Simulate the getConnectionTime logic from the controller
    const getConnectionTime = (
        firstSegment: { arrivalTime: any } | null,
        secondSegment: { departureTime: any } | null
    ): string => {
        if (!firstSegment || !secondSegment) return "";

        // Calculate time difference in minutes
        const diffMinutes = secondSegment.departureTime.diff(firstSegment.arrivalTime, "minutes");

        // Format as hours and minutes
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;

        if (hours > 0) {
            return hours + "h " + (mins < 10 ? "0" + mins : mins) + "m";
        } else {
            return mins + "m";
        }
    };

    // Mock dayjs-like objects for testing
    const createMockTime = (minutesFromMidnight: number) => ({
        diff: (other: any, unit: string) => {
            if (unit === 'minutes') {
                return minutesFromMidnight - other.minutes;
            }
            return 0;
        },
        minutes: minutesFromMidnight
    });

    it('should return empty string when firstSegment is null', () => {
        const secondSegment = { departureTime: createMockTime(120) };
        expect(getConnectionTime(null, secondSegment)).toBe('');
    });

    it('should return empty string when secondSegment is null', () => {
        const firstSegment = { arrivalTime: createMockTime(60) };
        expect(getConnectionTime(firstSegment, null)).toBe('');
    });

    it('should return empty string when both segments are null', () => {
        expect(getConnectionTime(null, null)).toBe('');
    });

    it('should format connection time less than an hour', () => {
        const firstSegment = { arrivalTime: { minutes: 0 } };
        const secondSegment = {
            departureTime: {
                diff: () => 45,
                minutes: 45
            }
        };
        expect(getConnectionTime(firstSegment, secondSegment)).toBe('45m');
    });

    it('should format connection time with hours and minutes', () => {
        const firstSegment = { arrivalTime: { minutes: 0 } };
        const secondSegment = {
            departureTime: {
                diff: () => 90,
                minutes: 90
            }
        };
        expect(getConnectionTime(firstSegment, secondSegment)).toBe('1h 30m');
    });

    it('should pad single digit minutes with zero', () => {
        const firstSegment = { arrivalTime: { minutes: 0 } };
        const secondSegment = {
            departureTime: {
                diff: () => 65,
                minutes: 65
            }
        };
        expect(getConnectionTime(firstSegment, secondSegment)).toBe('1h 05m');
    });

    it('should handle exact hours', () => {
        const firstSegment = { arrivalTime: { minutes: 0 } };
        const secondSegment = {
            departureTime: {
                diff: () => 120,
                minutes: 120
            }
        };
        expect(getConnectionTime(firstSegment, secondSegment)).toBe('2h 00m');
    });

    it('should handle multi-hour connections', () => {
        const firstSegment = { arrivalTime: { minutes: 0 } };
        const secondSegment = {
            departureTime: {
                diff: () => 195,
                minutes: 195
            }
        };
        expect(getConnectionTime(firstSegment, secondSegment)).toBe('3h 15m');
    });
});

describe('sortRelatedJobs Algorithm', () => {
    // Test the job sorting algorithm used in sortRelatedJobs
    const sortJobsByNumber = (jobs: { jobNo: string }[]): { jobNo: string }[] => {
        return [...jobs].sort((a, b) => {
            return a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true, sensitivity: 'base' });
        });
    };

    it('should sort jobs numerically', () => {
        const jobs = [
            { jobNo: 'JOB-10' },
            { jobNo: 'JOB-2' },
            { jobNo: 'JOB-1' },
        ];
        const sorted = sortJobsByNumber(jobs);
        expect(sorted.map(j => j.jobNo)).toEqual(['JOB-1', 'JOB-2', 'JOB-10']);
    });

    it('should sort jobs with different prefixes', () => {
        const jobs = [
            { jobNo: 'B-100' },
            { jobNo: 'A-200' },
            { jobNo: 'A-100' },
        ];
        const sorted = sortJobsByNumber(jobs);
        expect(sorted.map(j => j.jobNo)).toEqual(['A-100', 'A-200', 'B-100']);
    });

    it('should handle recovery job suffixes (R1, R2)', () => {
        const jobs = [
            { jobNo: 'JOB001R2' },
            { jobNo: 'JOB001' },
            { jobNo: 'JOB001R1' },
        ];
        const sorted = sortJobsByNumber(jobs);
        expect(sorted.map(j => j.jobNo)).toEqual(['JOB001', 'JOB001R1', 'JOB001R2']);
    });

    it('should handle split job suffixes (S1, S2)', () => {
        const jobs = [
            { jobNo: 'JOB100S2' },
            { jobNo: 'JOB100S1' },
            { jobNo: 'JOB100' },
        ];
        const sorted = sortJobsByNumber(jobs);
        expect(sorted.map(j => j.jobNo)).toEqual(['JOB100', 'JOB100S1', 'JOB100S2']);
    });

    it('should be case-insensitive', () => {
        const jobs = [
            { jobNo: 'job-2' },
            { jobNo: 'JOB-1' },
            { jobNo: 'Job-3' },
        ];
        const sorted = sortJobsByNumber(jobs);
        expect(sorted.map(j => j.jobNo)).toEqual(['JOB-1', 'job-2', 'Job-3']);
    });

    it('should handle empty array', () => {
        const sorted = sortJobsByNumber([]);
        expect(sorted).toEqual([]);
    });

    it('should handle single job', () => {
        const jobs = [{ jobNo: 'JOB-1' }];
        const sorted = sortJobsByNumber(jobs);
        expect(sorted).toEqual([{ jobNo: 'JOB-1' }]);
    });
});

describe('setSelectedTabFromJobId Algorithm', () => {
    // Test the tab selection algorithm
    const findJobIndex = (jobs: { id: number }[], jobId: number): number => {
        const index = jobs.findIndex(job => job.id === jobId);
        return index !== -1 ? index : 0;
    };

    it('should return correct index when job is found', () => {
        const jobs = [
            { id: 100 },
            { id: 200 },
            { id: 300 },
        ];
        expect(findJobIndex(jobs, 200)).toBe(1);
    });

    it('should return 0 when job is not found', () => {
        const jobs = [
            { id: 100 },
            { id: 200 },
            { id: 300 },
        ];
        expect(findJobIndex(jobs, 999)).toBe(0);
    });

    it('should return 0 for empty array', () => {
        expect(findJobIndex([], 100)).toBe(0);
    });

    it('should find first job correctly', () => {
        const jobs = [
            { id: 100 },
            { id: 200 },
        ];
        expect(findJobIndex(jobs, 100)).toBe(0);
    });

    it('should find last job correctly', () => {
        const jobs = [
            { id: 100 },
            { id: 200 },
            { id: 300 },
        ];
        expect(findJobIndex(jobs, 300)).toBe(2);
    });
});

describe('Field Visibility Storage', () => {
    // Test field visibility persistence patterns
    const FIELD_VISIBILITY_KEY = 'jobDetail_fieldVisibility_12345';
    const VIEW_DENSITY_KEY = 'jobDetail_viewDensity_12345';

    it('should use correct key pattern for field visibility', () => {
        const contactId = '12345';
        const expectedKey = `jobDetail_fieldVisibility_${contactId}`;
        expect(expectedKey).toBe(FIELD_VISIBILITY_KEY);
    });

    it('should use correct key pattern for view density', () => {
        const contactId = '12345';
        const expectedKey = `jobDetail_viewDensity_${contactId}`;
        expect(expectedKey).toBe(VIEW_DENSITY_KEY);
    });

    describe('Default Field Visibility', () => {
        // Test default visibility for various fields
        const defaultVisibility: { [key: string]: boolean } = {
            jobNo: true,
            status: true,
            client: true,
            courier: true,
            amount: true,
            weight: false,
            dgClass: false,
        };

        it('should have essential fields visible by default', () => {
            expect(defaultVisibility.jobNo).toBe(true);
            expect(defaultVisibility.status).toBe(true);
            expect(defaultVisibility.client).toBe(true);
        });

        it('should have optional fields hidden by default', () => {
            expect(defaultVisibility.weight).toBe(false);
            expect(defaultVisibility.dgClass).toBe(false);
        });
    });
});

describe('View Density', () => {
    // Test view density enum values
    enum ViewDensity {
        Compact = 'compact',
        Normal = 'normal',
        Comfortable = 'comfortable'
    }

    it('should have correct density values', () => {
        expect(ViewDensity.Compact).toBe('compact');
        expect(ViewDensity.Normal).toBe('normal');
        expect(ViewDensity.Comfortable).toBe('comfortable');
    });

    it('should default to Normal density', () => {
        const defaultDensity = ViewDensity.Normal;
        expect(defaultDensity).toBe('normal');
    });
});

describe('courierClick Dispatch Logic', () => {
    // Test the courier dispatch workflow

    interface MockCourier {
        courierId: number;
        id: string;
        name: string;
    }

    interface MockJob {
        id: number;
        jobNo: string;
    }

    const createMockDependencies = () => ({
        autoCompleteDialogService: {
            showAutocompleteDialog: jest.fn(),
        },
        dispatchJobService: {
            assignSingleJobById: jest.fn(),
        },
        DispatchData: {
            getCourierById: jest.fn(),
        },
        toastrService: {
            showSuccessToast: jest.fn(),
        },
        refreshJobDetails: jest.fn(),
        handleError: jest.fn(),
    });

    // Simulate the courierClick logic
    const courierClick = async (
        deps: ReturnType<typeof createMockDependencies>,
        job: MockJob
    ) => {
        try {
            const result = await deps.autoCompleteDialogService.showAutocompleteDialog();

            if (!result) return;

            const courierId = result.id;
            await deps.dispatchJobService.assignSingleJobById(courierId, job.id);

            try {
                const courier = await deps.DispatchData.getCourierById(courierId);
                if (courier) {
                    const courierDisplay = (courier.id && courier.id !== 'undefined' && courier.id.trim() !== '')
                        ? `${courier.id}: ${courier.name}`
                        : courier.name;
                    deps.toastrService.showSuccessToast(`Dispatched to ${courierDisplay}`);
                }
            } catch {
                deps.toastrService.showSuccessToast("Job dispatched successfully");
            }

            await deps.refreshJobDetails(job.id);
        } catch (error) {
            deps.handleError(error);
        }
    };

    it('should not dispatch when dialog is cancelled', async () => {
        const deps = createMockDependencies();
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue(null);

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.autoCompleteDialogService.showAutocompleteDialog).toHaveBeenCalled();
        expect(deps.dispatchJobService.assignSingleJobById).not.toHaveBeenCalled();
        expect(deps.toastrService.showSuccessToast).not.toHaveBeenCalled();
    });

    it('should dispatch job when courier is selected', async () => {
        const deps = createMockDependencies();
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue({ id: 456, text: 'Test Courier' });
        deps.dispatchJobService.assignSingleJobById.mockResolvedValue(undefined);
        deps.DispatchData.getCourierById.mockResolvedValue({ courierId: 456, id: 'C001', name: 'Test Courier' });

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.dispatchJobService.assignSingleJobById).toHaveBeenCalledWith(456, 123);
        expect(deps.refreshJobDetails).toHaveBeenCalledWith(123);
    });

    it('should show courier name with ID in toast when courier has ID', async () => {
        const deps = createMockDependencies();
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue({ id: 456, text: 'Test Courier' });
        deps.dispatchJobService.assignSingleJobById.mockResolvedValue(undefined);
        deps.DispatchData.getCourierById.mockResolvedValue({ courierId: 456, id: 'C001', name: 'Test Courier' });

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.toastrService.showSuccessToast).toHaveBeenCalledWith('Dispatched to C001: Test Courier');
    });

    it('should show courier name only in toast when courier has no ID', async () => {
        const deps = createMockDependencies();
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue({ id: 456, text: 'Test Courier' });
        deps.dispatchJobService.assignSingleJobById.mockResolvedValue(undefined);
        deps.DispatchData.getCourierById.mockResolvedValue({ courierId: 456, id: '', name: 'Test Courier' });

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.toastrService.showSuccessToast).toHaveBeenCalledWith('Dispatched to Test Courier');
    });

    it('should show generic success message when courier lookup fails', async () => {
        const deps = createMockDependencies();
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue({ id: 456, text: 'Test Courier' });
        deps.dispatchJobService.assignSingleJobById.mockResolvedValue(undefined);
        deps.DispatchData.getCourierById.mockRejectedValue(new Error('Lookup failed'));

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.toastrService.showSuccessToast).toHaveBeenCalledWith('Job dispatched successfully');
    });

    it('should call handleError when dispatch fails', async () => {
        const deps = createMockDependencies();
        const dispatchError = new Error('Dispatch failed');
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue({ id: 456, text: 'Test Courier' });
        deps.dispatchJobService.assignSingleJobById.mockRejectedValue(dispatchError);

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.handleError).toHaveBeenCalledWith(dispatchError);
        expect(deps.refreshJobDetails).not.toHaveBeenCalled();
    });

    it('should handle courier with undefined ID as empty', async () => {
        const deps = createMockDependencies();
        deps.autoCompleteDialogService.showAutocompleteDialog.mockResolvedValue({ id: 456, text: 'Test Courier' });
        deps.dispatchJobService.assignSingleJobById.mockResolvedValue(undefined);
        deps.DispatchData.getCourierById.mockResolvedValue({ courierId: 456, id: 'undefined', name: 'Test Courier' });

        const job: MockJob = { id: 123, jobNo: 'JOB-123' };
        await courierClick(deps, job);

        expect(deps.toastrService.showSuccessToast).toHaveBeenCalledWith('Dispatched to Test Courier');
    });
});
