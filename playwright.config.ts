import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    timeout: 30_000,
    expect: { timeout: 5000 },
    use: {
        baseURL: 'http://127.0.0.1:4399',
        browserName: 'chromium',
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
        colorScheme: 'light',
        trace: 'retain-on-failure',
    },
    webServer: {
        command:
            'node node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4399 --ignore-lock',
        url: 'http://127.0.0.1:4399',
        reuseExistingServer: process.env.HOME_TEST_REUSE_SERVER === '1',
        timeout: 60_000,
    },
});
