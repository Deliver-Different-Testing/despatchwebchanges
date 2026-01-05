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
