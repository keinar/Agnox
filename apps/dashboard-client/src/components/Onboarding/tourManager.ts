import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { NavigateFunction } from 'react-router-dom';

const DRIVER_STYLE_ID = 'agnox-driver-pulse-style';

const DRIVER_BASE_CONFIG = {
    animate: true,
    overlayColor: 'rgba(15, 23, 42, 0.7)',
    stagePadding: 8,
    stageRadius: 8,
    popoverClass: 'agnox-tour-popover',
    allowClose: false,
} as const;

/**
 * Robust DOM Waiter
 * Replaces polling intervals. Uses MutationObserver to wait for an element
 * to appear in the DOM. Gracefully times out if not found to prevent memory leaks.
 */
export const waitForElement = async (selector: string, timeout = 2000): Promise<Element | null> => {
    const existing = document.querySelector(selector);
    if (existing) return existing;

    return new Promise((resolve) => {
        let observer: MutationObserver | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            if (observer) observer.disconnect();
            if (timer) clearTimeout(timer);
        };

        observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                cleanup();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        timer = setTimeout(() => {
            cleanup();
            resolve(null);
        }, timeout);
    });
};

export function injectDriverGlowStyle(): () => void {
    if (document.getElementById(DRIVER_STYLE_ID)) return () => { };

    const style = document.createElement('style');
    style.id = DRIVER_STYLE_ID;
    style.textContent = `
    @keyframes agnox-driver-glow {
      0%, 100% {
        box-shadow:
          0 0 0 3px rgba(59, 130, 246, 0.55),
          0 0 18px rgba(59, 130, 246, 0.28);
      }
      50% {
        box-shadow:
          0 0 0 6px rgba(99, 102, 241, 0.65),
          0 0 30px rgba(99, 102, 241, 0.4);
      }
    }
    .driver-active-element {
      animation: agnox-driver-glow 1.8s ease-in-out infinite !important;
      border-radius: 6px;
    }
  `;
    document.head.appendChild(style);

    return () => {
        document.getElementById(DRIVER_STYLE_ID)?.remove();
    };
}

export function buildTour(onStepComplete: (id: string) => void): ReturnType<typeof driver> {
    let tourDriver: ReturnType<typeof driver>;

    tourDriver = driver({
        ...DRIVER_BASE_CONFIG,
        showProgress: true,
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Done',

        onDestroyStarted: () => {
            onStepComplete('view-execution');
            tourDriver.destroy();
        },

        steps: [
            {
                element: '[data-testid="sidebar-desktop"]',
                popover: {
                    title: 'Navigation Sidebar',
                    description:
                        'This is your command center. Switch between Dashboard, Test Cases, Test Cycles, and Settings from here. Collapse it to gain more screen space.',
                    side: 'right',
                    align: 'start',
                },
            },
            {
                element: '[data-testid="filter-bar"]',
                popover: {
                    title: 'Smart Filters',
                    description:
                        'Slice your executions by status, environment, date range, or group. Combine filters for pinpoint precision — no more scrolling through hundreds of runs.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-testid="executions-table"]',
                popover: {
                    title: 'Executions Table',
                    description:
                        'Every test run appears here in real-time. <strong>Click any row to continue the tour</strong> — the detail drawer will open with logs, AI triage, and artifact links.',
                    side: 'top',
                    align: 'start',
                    showButtons: ['previous', 'close'],
                },
                onHighlightStarted: () => {
                    // Wait for drawer, which triggers from user clicking a row.
                    waitForElement('[data-testid="execution-drawer-tab-bar"]', 60000).then((el) => {
                        if (el) tourDriver.moveNext();
                    });
                },
            },
            {
                element: '[data-testid="execution-drawer-tab-bar"]',
                popover: {
                    title: 'Execution Detail Tabs',
                    description:
                        'Once you open an execution, explore tabs for live Logs, AI-powered Triage analysis, and downloadable Artifacts — all in one panel.',
                    side: 'left',
                    align: 'start',
                },
            },
        ],
    });

    return tourDriver;
}

export function buildEmptyStateTour(
    onStepComplete: (id: string) => void,
    navigate: NavigateFunction
): ReturnType<typeof driver> {
    let emptyTourDriver: ReturnType<typeof driver>;

    emptyTourDriver = driver({
        ...DRIVER_BASE_CONFIG,
        showProgress: true,
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Done',

        onDestroyStarted: () => {
            onStepComplete('view-execution');
            emptyTourDriver.destroy();
        },

        steps: [
            {
                element: '[data-testid="sidebar-nav-settings"]',
                popover: {
                    title: "🚀 Let's run your first test!",
                    description:
                        'First, we need to tell Agnox which Docker image to execute. We will guide you there.',
                    side: 'right',
                    align: 'center',
                },
                onNextClick: () => {
                    navigate('/settings?tab=run-settings');
                    waitForElement('[data-testid="sidebar-settings-tab-run-settings"]').then((el) => {
                        if (el) emptyTourDriver.moveNext();
                        else emptyTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="sidebar-settings-tab-run-settings"]',
                popover: {
                    title: 'Run Settings',
                    description:
                        'This is where you configure the Docker image and environment URLs that Agnox uses every time you trigger a test.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/dashboard');
                    waitForElement('[data-testid="sidebar-nav-settings"]').then((el) => {
                        if (el) emptyTourDriver.movePrevious();
                        else emptyTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="run-settings-docker-image"]',
                popover: {
                    title: 'Your Docker Image',
                    description:
                        'Enter the full Docker Hub image name for your test suite — for example, <code>myorg/playwright-tests:latest</code>. Agnox pulls this image and runs it in a secure, isolated container. No Git URL needed.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-testid="run-settings-dev-url"]',
                popover: {
                    title: 'Target Environment URLs',
                    description:
                        'Set the base URL for each environment (Dev, Staging, Prod). Agnox injects the selected URL as <code>BASE_URL</code> into your container at runtime — no hardcoded URLs in your tests required.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-testid="run-settings-submit"]',
                popover: {
                    title: 'Save & Head Back',
                    description:
                        'Hit <strong>Save Settings</strong> to lock in your configuration. Then we will return to the Dashboard.',
                    side: 'top',
                    align: 'start',
                },
                onNextClick: () => {
                    navigate('/dashboard');
                    waitForElement('[data-testid="dashboard-run-button"]').then((el) => {
                        if (el) emptyTourDriver.moveNext();
                        else emptyTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="dashboard-run-button"]',
                popover: {
                    title: 'Fire it up!',
                    description:
                        'Click <strong>Run</strong> to open the Launch Modal. Everything will be pre-filled with the image and URL you just configured.',
                    side: 'bottom',
                    align: 'end',
                    showButtons: ['previous', 'close'],
                },
                onPrevClick: () => {
                    navigate('/settings?tab=run-settings');
                    waitForElement('[data-testid="run-settings-submit"]').then((el) => {
                        if (el) emptyTourDriver.movePrevious();
                        else emptyTourDriver.destroy();
                    });
                },
                onHighlightStarted: () => {
                    waitForElement('[data-testid="modal-launch-button"]', 60000).then((el) => {
                        if (el) emptyTourDriver.moveNext();
                    });
                },
            },
            {
                element: '[data-testid="modal-environment-select"]',
                popover: {
                    title: 'Choose Your Environment',
                    description:
                        'Select the target environment for this run (e.g., Staging, Production). You can also manually override the base URL below if you need to test a specific PR preview.',
                    side: 'top',
                    align: 'start',
                },
            },
            {
                element: '[data-testid="modal-schedule-tab"]',
                popover: {
                    title: 'Scheduled Runs',
                    description:
                        'Need to run this nightly? You can switch to this tab later to configure a Cron schedule.<br><br><strong>👉 Please click Next to continue (do not click the tab yet!).</strong>',
                    side: 'bottom',
                    align: 'center',
                },
            },
            {
                element: '[data-testid="modal-launch-button"]',
                popover: {
                    title: 'Confirm & Launch',
                    description:
                        'Everything is pre-filled. Hit <strong>Launch Execution</strong> to spin up the container and start streaming live logs immediately.',
                    side: 'top',
                    align: 'end',
                    showButtons: ['previous', 'close'],
                },
                onHighlightStarted: () => {
                    waitForElement('[data-testid="executions-table"] tbody tr[data-execution-id]', 60000).then((el) => {
                        if (el) emptyTourDriver.moveNext();
                    });
                },
            },
            {
                element: '[data-testid="executions-table"]',
                popover: {
                    title: 'Your Test is Running!',
                    description:
                        'Your execution just appeared in the table. The status badge updates in real-time from <strong>PENDING → RUNNING → PASSED / FAILED</strong> via WebSocket. <strong>Click any row</strong> to open the detail drawer and continue the tour.',
                    side: 'top',
                    align: 'start',
                    showButtons: ['previous', 'close'],
                },
                onHighlightStarted: () => {
                    waitForElement('[data-testid="execution-drawer-tab-bar"]', 60000).then((el) => {
                        if (el) emptyTourDriver.moveNext();
                    });
                },
            },
            {
                element: '[data-testid="execution-drawer-tab-bar"]',
                popover: {
                    title: 'Your Execution at a Glance',
                    description:
                        'The detail drawer gives you everything in one place:<br><br>' +
                        '• <strong>Logs</strong> — live Docker stdout/stderr streamed in real-time<br>' +
                        '• <strong>AI Triage</strong> — Gemini automatically analyses failures and suggests root causes<br>' +
                        '• <strong>Artifacts</strong> — download HTML and Allure reports when the run completes<br><br>' +
                        "You're all set. Happy testing! 🎉",
                    side: 'left',
                    align: 'start',
                },
            },
        ] as any[],
    });

    return emptyTourDriver;
}

export function buildFeatureTour(
    onStepComplete: (id: string) => void,
    navigate: NavigateFunction
): ReturnType<typeof driver> {
    let featureTourDriver: ReturnType<typeof driver>;

    featureTourDriver = driver({
        ...DRIVER_BASE_CONFIG,
        showProgress: true,
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Done',

        onDestroyStarted: () => {
            onStepComplete('platform-tour');
            featureTourDriver.destroy();
        },

        steps: [
            {
                element: '[data-testid="filter-bar"]',
                popover: {
                    title: 'Smart Filters',
                    description:
                        'Slice your executions by status, environment, date range, or group. Combine filters for pinpoint precision.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-testid="sidebar-nav-test-cases"]',
                popover: {
                    title: 'Test Cases Repository',
                    description:
                        'Build and maintain a living library of manual and automated test cases. Organise them into suites, assign ownership, and link them to execution runs.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    featureTourDriver.movePrevious();
                },
                onNextClick: () => {
                    navigate('/test-cases');
                    waitForElement('[data-testid="sidebar-nav-test-cycles"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="sidebar-nav-test-cycles"]',
                popover: {
                    title: 'Hybrid Test Cycles',
                    description:
                        'Combine automated Docker runs with manual test cases into a single release cycle — track mixed results in one place.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/dashboard');
                    waitForElement('[data-testid="sidebar-nav-test-cases"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/test-cycles');
                    waitForElement('[data-testid="sidebar-nav-ask-ai"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="sidebar-nav-ask-ai"]',
                popover: {
                    title: 'AI Quality Assistant',
                    description:
                        'Ask plain-English questions about your test data — "Which group failed most last week?" — and get instant answers and charts.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/test-cases');
                    waitForElement('[data-testid="sidebar-nav-test-cycles"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/chat');
                    waitForElement('[data-testid="sidebar-nav-settings"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="sidebar-nav-settings"]',
                popover: {
                    title: "Now let's check Team Settings",
                    description:
                        'We will explore team management and your AI key configuration.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/test-cycles');
                    waitForElement('[data-testid="sidebar-nav-ask-ai"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/settings?tab=run-settings');
                    waitForElement('[data-testid="sidebar-settings-tab-run-settings"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                },
            },
            {
                element: '[data-testid="sidebar-settings-tab-run-settings"]',
                popover: {
                    title: 'Run Settings',
                    description:
                        'Configure your Docker images and target environment URLs centrally.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/chat');
                    waitForElement('[data-testid="sidebar-nav-settings"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/settings?tab=run-settings');
                    waitForElement('[data-testid="run-settings-submit"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                },
            },
            {
                element: '[data-testid="run-settings-submit"]',
                popover: {
                    title: '🛡️ Smart Analytics: Auto-Quarantine',
                    description:
                        'Phase 5 introduces <strong>Smart Execution Analytics</strong> — scroll down in Run Settings to see the Auto-Quarantine toggle.<br><br>' +
                        '• <strong>Auto-Quarantine</strong> — Prevents flaky tests from blocking your CI/CD pipelines by automatically quarantining them after 3 consecutive failures. They self-heal on the next passing run.<br>' +
                        '• <strong>A–F Stability Scoring</strong> — Every test case gets a grade based on its historical pass rate and retry usage.<br>' +
                        '• <strong>🐌 Performance Degradation</strong> — A badge shown when a test runs significantly slower than its historical average.',
                    side: 'top',
                    align: 'start',
                },
                onPrevClick: () => {
                    navigate('/chat');
                    waitForElement('[data-testid="sidebar-nav-settings"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/settings/members');
                    waitForElement('[data-testid="sidebar-settings-tab-members"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                },
            },
            {
                element: '[data-testid="sidebar-settings-tab-members"]',
                popover: {
                    title: 'Team Members & RBAC',
                    description:
                        'Invite colleagues, assign roles (Admin, Member, Viewer), and control who can trigger runs or access billing.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/settings?tab=run-settings');
                    waitForElement('[data-testid="sidebar-settings-tab-run-settings"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/settings/env-vars');
                    waitForElement('[data-testid="sidebar-settings-tab-env-vars"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="sidebar-settings-tab-env-vars"]',
                popover: {
                    title: 'Secure Environment Variables',
                    description:
                        'Store API keys and secrets here — encrypted with AES-256-GCM and injected into your containers at runtime.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/settings/members');
                    waitForElement('[data-testid="sidebar-settings-tab-members"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                },
                onNextClick: () => {
                    navigate('/settings/security');
                    waitForElement('[data-testid="sidebar-settings-tab-security"]').then((el) => {
                        if (el) featureTourDriver.moveNext();
                        else featureTourDriver.destroy();
                    });
                }
            },
            {
                element: '[data-testid="sidebar-settings-tab-security"]',
                popover: {
                    title: 'Bring Your Own LLM Key (BYOK)',
                    description:
                        'Plug in your own Gemini, OpenAI, or Anthropic API key. It takes priority over the platform default and is encrypted with AES-256-GCM before storage.',
                    side: 'right',
                    align: 'center',
                },
                onPrevClick: () => {
                    navigate('/settings/env-vars');
                    waitForElement('[data-testid="sidebar-settings-tab-env-vars"]').then((el) => {
                        if (el) featureTourDriver.movePrevious();
                        else featureTourDriver.destroy();
                    });
                }
            }
        ] as any[],
    });

    return featureTourDriver;
}
