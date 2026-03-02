/**
 * Diagnostic script for AI Summary Panel rendering issues.
 * Run from browser console: window.__diagAiPanel()
 *
 * Checks each step in the rendering pipeline and reports what's failing.
 */

export function registerAiPanelDiagnostic(): void {
    (window as any).__diagAiPanel = () => {
        const results: string[] = [];
        const log = (msg: string) => {
            results.push(msg);
            console.log(`[AI-DIAG] ${msg}`);
        };

        log('=== AI Summary Panel Diagnostic ===');

        // 1. Check if aiSettings module is loaded
        try {
            const aiEnabled = localStorage.getItem(
                Object.keys(localStorage).find(k => k.startsWith('aiEnabled_')) || ''
            );
            log(`1. localStorage aiEnabled key found: ${aiEnabled !== null}, value: ${aiEnabled}`);
        } catch (e) {
            log(`1. FAIL: Cannot read localStorage: ${e}`);
        }

        // 2. Check if ReactAiAssistant is loaded on window
        const reactAi = (window as any).ReactAiAssistant;
        log(`2. window.ReactAiAssistant exists: ${!!reactAi}`);
        if (reactAi) {
            log(`   - renderSummaryPanel: ${typeof reactAi.renderSummaryPanel}`);
            log(`   - unmountSummaryPanel: ${typeof reactAi.unmountSummaryPanel}`);
        }

        // 3. Find all AI panel containers in the DOM
        const containers = document.querySelectorAll('[id^="ai-summary-panel-container"]');
        log(`3. AI panel containers found in DOM: ${containers.length}`);
        containers.forEach((el, i) => {
            const htmlEl = el as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            const styles = window.getComputedStyle(htmlEl);
            log(`   Container [${i}]: id="${htmlEl.id}"`);
            log(`     - display: ${styles.display}`);
            log(`     - visibility: ${styles.visibility}`);
            log(`     - opacity: ${styles.opacity}`);
            log(`     - height: ${styles.height}`);
            log(`     - overflow: ${styles.overflow}`);
            log(`     - position: ${styles.position}`);
            log(`     - boundingRect: ${JSON.stringify({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            })}`);
            log(`     - childNodes: ${htmlEl.childNodes.length}`);
            log(`     - innerHTML length: ${htmlEl.innerHTML.length}`);
            if (htmlEl.innerHTML.length > 0) {
                log(`     - innerHTML preview: ${htmlEl.innerHTML.substring(0, 200)}`);
            }

            // Check parent chain for hidden ancestors
            let parent: HTMLElement | null = htmlEl.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
                const ps = window.getComputedStyle(parent);
                const isHiding =
                    ps.display === 'none' ||
                    ps.visibility === 'hidden' ||
                    ps.opacity === '0' ||
                    (ps.overflow === 'hidden' && parent.scrollHeight > parent.clientHeight);

                if (isHiding) {
                    log(`     - HIDDEN ANCESTOR at depth ${depth}: <${parent.tagName.toLowerCase()} class="${parent.className.substring(0, 80)}">`);
                    log(`       display=${ps.display}, visibility=${ps.visibility}, opacity=${ps.opacity}, overflow=${ps.overflow}`);
                    log(`       scrollHeight=${parent.scrollHeight}, clientHeight=${parent.clientHeight}, height=${ps.height}`);
                }
                parent = parent.parentElement;
                depth++;
            }
        });

        // 4. Check Angular scope for the controller
        if (containers.length > 0) {
            try {
                const angular = (window as any).angular;
                if (angular) {
                    const el = angular.element(containers[0]);
                    const scope = el.scope();
                    if (scope) {
                        const ctrl = scope.ctrl || scope.$ctrl;
                        log(`4. Angular controller found: ${!!ctrl}`);
                        if (ctrl) {
                            log(`   - ctrl.aiEnabled: ${ctrl.aiEnabled}`);
                            log(`   - ctrl.showAiPanel: ${ctrl.showAiPanel}`);
                            log(`   - ctrl.job?.id: ${ctrl.job?.id}`);
                            log(`   - ctrl.angularId: ${ctrl.angularId}`);
                        }
                    } else {
                        log(`4. Angular scope NOT found on container element`);
                    }
                }
            } catch (e) {
                log(`4. FAIL reading Angular scope: ${e}`);
            }
        } else {
            log(`4. SKIP (no containers found) — checking if ng-if="ctrl.aiEnabled" is false`);

            // Try to find the controller from the job-detail-page element
            try {
                const angular = (window as any).angular;
                const page = document.querySelector('.job-detail-page');
                if (angular && page) {
                    const scope = angular.element(page).scope();
                    const ctrl = scope?.ctrl || scope?.$ctrl;
                    log(`   Found controller from .job-detail-page: ${!!ctrl}`);
                    if (ctrl) {
                        log(`   - ctrl.aiEnabled: ${ctrl.aiEnabled}`);
                        log(`   - ctrl.showAiPanel: ${ctrl.showAiPanel}`);
                        log(`   - ctrl.job?.id: ${ctrl.job?.id}`);
                        log(`   - ctrl.angularId: ${ctrl.angularId}`);
                    }
                }
            } catch (e) {
                log(`   FAIL: ${e}`);
            }
        }

        // 5. Try to manually render
        if (containers.length > 0 && reactAi?.renderSummaryPanel) {
            log('5. Attempting manual render...');
            try {
                const container = containers[0] as HTMLElement;
                // Get jobId from controller
                const angular = (window as any).angular;
                const scope = angular?.element(container).scope();
                const ctrl = scope?.ctrl || scope?.$ctrl;
                const jobId = ctrl?.job?.id;

                if (jobId) {
                    reactAi.renderSummaryPanel(container, jobId);
                    log(`   Manual render called with jobId=${jobId}. Check container now.`);

                    // Check after a short delay
                    setTimeout(() => {
                        const rect = container.getBoundingClientRect();
                        console.log(`[AI-DIAG] 5b. After render - childNodes: ${container.childNodes.length}, height: ${rect.height}, innerHTML length: ${container.innerHTML.length}`);
                        if (container.innerHTML.length > 0) {
                            console.log(`[AI-DIAG]    innerHTML preview: ${container.innerHTML.substring(0, 300)}`);
                        }
                    }, 500);
                } else {
                    log('   SKIP manual render: no jobId found');
                }
            } catch (e) {
                log(`   FAIL manual render: ${e}`);
            }
        } else {
            log('5. SKIP manual render (no container or ReactAiAssistant not loaded)');
        }

        log('=== Diagnostic Complete ===');
        return results;
    };
}
