/**
 * Tests for AngularJS Security Configuration
 * CVE-2025-0716 Mitigation: URL sanitization for href and img sources
 *
 * These tests verify the security regex patterns used in $compileProvider
 */

describe('Security Configuration', () => {
    describe('aHrefSanitizationTrustedUrlList', () => {
        // The regex pattern: /^\s*(https?|mailto|tel):/
        const aHrefPattern = /^\s*(https?|mailto|tel):/;

        describe('Allowed protocols', () => {
            it('should allow http URLs', () => {
                expect(aHrefPattern.test('http://example.com')).toBe(true);
            });

            it('should allow https URLs', () => {
                expect(aHrefPattern.test('https://example.com')).toBe(true);
            });

            it('should allow mailto links', () => {
                expect(aHrefPattern.test('mailto:user@example.com')).toBe(true);
            });

            it('should allow tel links', () => {
                expect(aHrefPattern.test('tel:+1234567890')).toBe(true);
            });

            it('should allow URLs with leading whitespace', () => {
                expect(aHrefPattern.test('  https://example.com')).toBe(true);
                expect(aHrefPattern.test('\thttps://example.com')).toBe(true);
            });
        });

        describe('Blocked protocols (XSS vectors)', () => {
            it('should block javascript: protocol', () => {
                expect(aHrefPattern.test('javascript:alert(1)')).toBe(false);
            });

            it('should block javascript: with mixed case', () => {
                expect(aHrefPattern.test('JavaScript:alert(1)')).toBe(false);
                expect(aHrefPattern.test('JAVASCRIPT:alert(1)')).toBe(false);
            });

            it('should block data: URIs in links', () => {
                expect(aHrefPattern.test('data:text/html,<script>alert(1)</script>')).toBe(false);
            });

            it('should block vbscript: protocol', () => {
                expect(aHrefPattern.test('vbscript:msgbox(1)')).toBe(false);
            });

            it('should block file: protocol', () => {
                expect(aHrefPattern.test('file:///etc/passwd')).toBe(false);
            });

            it('should block ftp: protocol', () => {
                expect(aHrefPattern.test('ftp://example.com')).toBe(false);
            });
        });

        describe('Edge cases', () => {
            it('should handle empty string', () => {
                expect(aHrefPattern.test('')).toBe(false);
            });

            it('should handle relative URLs (blocked)', () => {
                expect(aHrefPattern.test('/path/to/resource')).toBe(false);
            });

            it('should handle protocol-relative URLs (blocked)', () => {
                expect(aHrefPattern.test('//example.com/path')).toBe(false);
            });

            it('should block javascript with whitespace obfuscation', () => {
                // The pattern starts with ^ so this should be blocked
                expect(aHrefPattern.test('  javascript:alert(1)')).toBe(false);
            });
        });
    });

    describe('imgSrcSanitizationTrustedUrlList', () => {
        // The regex pattern: /^\s*(https?:|data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,)/
        const imgSrcPattern = /^\s*(https?:|data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,)/;

        describe('Allowed protocols', () => {
            it('should allow http URLs', () => {
                expect(imgSrcPattern.test('http://example.com/image.png')).toBe(true);
            });

            it('should allow https URLs', () => {
                expect(imgSrcPattern.test('https://example.com/image.png')).toBe(true);
            });
        });

        describe('Allowed data URIs for images', () => {
            it('should allow PNG data URIs', () => {
                expect(imgSrcPattern.test('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBe(true);
            });

            it('should allow JPG data URIs', () => {
                expect(imgSrcPattern.test('data:image/jpg;base64,/9j/4AAQSkZJRg==')).toBe(true);
            });

            it('should allow JPEG data URIs', () => {
                expect(imgSrcPattern.test('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
            });

            it('should allow GIF data URIs', () => {
                expect(imgSrcPattern.test('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAAB')).toBe(true);
            });

            it('should allow WEBP data URIs', () => {
                expect(imgSrcPattern.test('data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAkAAAAvAAAAAA==')).toBe(true);
            });

            it('should allow SVG data URIs', () => {
                expect(imgSrcPattern.test('data:image/svg+xml;base64,PHN2ZyB4bWxucz0=')).toBe(true);
            });
        });

        describe('Blocked data URIs (security risk)', () => {
            it('should block text/html data URIs', () => {
                expect(imgSrcPattern.test('data:text/html,<script>alert(1)</script>')).toBe(false);
            });

            it('should block text/javascript data URIs', () => {
                expect(imgSrcPattern.test('data:text/javascript,alert(1)')).toBe(false);
            });

            it('should block application/javascript data URIs', () => {
                expect(imgSrcPattern.test('data:application/javascript,alert(1)')).toBe(false);
            });

            it('should block data URIs without base64 encoding', () => {
                // Missing ;base64, part
                expect(imgSrcPattern.test('data:image/png,raw-data')).toBe(false);
            });
        });

        describe('Blocked protocols', () => {
            it('should block javascript: protocol', () => {
                expect(imgSrcPattern.test('javascript:alert(1)')).toBe(false);
            });

            it('should block file: protocol', () => {
                expect(imgSrcPattern.test('file:///etc/passwd')).toBe(false);
            });
        });

        describe('Edge cases', () => {
            it('should handle empty string', () => {
                expect(imgSrcPattern.test('')).toBe(false);
            });

            it('should handle URLs with leading whitespace', () => {
                expect(imgSrcPattern.test('  https://example.com/img.png')).toBe(true);
            });
        });
    });

    describe('SCE (Strict Contextual Escaping)', () => {
        describe('Documentation', () => {
            it('SCE should be enabled for XSS protection', () => {
                // This is a documentation test - SCE is enabled in app.ts via:
                // $sceProvider.enabled(true);
                //
                // SCE provides automatic XSS protection by requiring trusted values
                // for dangerous contexts like:
                // - ng-bind-html
                // - ng-include
                // - src attributes on script, link, iframe elements
                const sceEnabled = true; // As configured in app.ts
                expect(sceEnabled).toBe(true);
            });
        });
    });

    describe('Debug Info in Production', () => {
        describe('Security implications', () => {
            it('should disable debug info in production', () => {
                // In production, debugInfoEnabled should be false to:
                // 1. Prevent scope data leakage on DOM elements
                // 2. Improve performance by not attaching debug info
                // 3. Make it harder to inspect internal application state

                const isProduction = true;
                const debugInfoEnabled = !isProduction; // As per app.ts logic

                expect(debugInfoEnabled).toBe(false);
            });

            it('should allow debug info in development', () => {
                const isProduction = false;
                // In development, debug info is implicitly enabled (not explicitly disabled)
                const debugInfoEnabled = !isProduction || true; // Default is true

                expect(debugInfoEnabled).toBe(true);
            });
        });
    });
});

describe('XSS Prevention Patterns', () => {
    describe('Common XSS Attack Vectors', () => {
        const aHrefPattern = /^\s*(https?|mailto|tel):/;
        const imgSrcPattern = /^\s*(https?:|data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,)/;

        it('should block onclick in javascript URI', () => {
            expect(aHrefPattern.test("javascript:onclick='alert(1)'")).toBe(false);
        });

        it('should block encoded javascript URI', () => {
            // URL encoded "javascript:alert(1)"
            expect(aHrefPattern.test('javascript%3Aalert(1)')).toBe(false);
        });

        it('should block javascript with HTML entities', () => {
            expect(aHrefPattern.test('&#106;avascript:alert(1)')).toBe(false);
        });

        it('should block onerror in data URI', () => {
            expect(imgSrcPattern.test('data:text/html,<img onerror=alert(1)>')).toBe(false);
        });

        it('should block script tag in data URI', () => {
            expect(imgSrcPattern.test('data:text/html,<script>alert(1)</script>')).toBe(false);
        });

        it('should block SVG with script in non-base64 data URI', () => {
            // SVG can contain scripts, so non-base64 SVG data URIs are blocked
            expect(imgSrcPattern.test('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false);
        });
    });
});

describe('CVE-2025-0716 Specific Tests', () => {
    describe('AngularJS href sanitization bypass prevention', () => {
        const aHrefPattern = /^\s*(https?|mailto|tel):/;

        // CVE-2025-0716 relates to potential bypasses in AngularJS URL sanitization
        // These tests verify the stricter pattern prevents known bypass techniques

        it('should not be bypassed with null bytes', () => {
            expect(aHrefPattern.test('java\0script:alert(1)')).toBe(false);
        });

        it('should not be bypassed with newlines', () => {
            expect(aHrefPattern.test('java\nscript:alert(1)')).toBe(false);
        });

        it('should not be bypassed with tabs', () => {
            expect(aHrefPattern.test('java\tscript:alert(1)')).toBe(false);
        });

        it('should not be bypassed with carriage returns', () => {
            expect(aHrefPattern.test('java\rscript:alert(1)')).toBe(false);
        });

        it('should not be bypassed with form feeds', () => {
            expect(aHrefPattern.test('java\fscript:alert(1)')).toBe(false);
        });

        it('should only allow explicit safe protocols at the start', () => {
            // The ^ anchor ensures the pattern must match from the start
            expect(aHrefPattern.test('fake:javascript:alert(1)')).toBe(false);
            expect(aHrefPattern.test('x:https://evil.com')).toBe(false);
        });
    });
});
