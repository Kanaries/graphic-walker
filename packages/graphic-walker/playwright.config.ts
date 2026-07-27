import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 120_000,
    expect: {
        timeout: 15_000,
    },
    reporter: 'line',
    use: {
        baseURL: 'http://127.0.0.1:4175',
        viewport: {
            width: 1200,
            height: 953,
        },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
        {
            name: 'firefox',
            use: { browserName: 'firefox' },
        },
        {
            name: 'webkit',
            use: { browserName: 'webkit' },
        },
    ],
    webServer: {
        // Serve a production bundle so every isolated browser context loads a bounded
        // asset set. The dev-server module graph can crash Playwright's WebKit network
        // inspector while it processes hundreds of concurrent module responses.
        command:
            'yarn vite build --config tests/e2e/vite.config.ts && yarn vite preview --config tests/e2e/vite.config.ts',
        url: 'http://127.0.0.1:4175/tests/e2e/issue-501.html',
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
    },
});
