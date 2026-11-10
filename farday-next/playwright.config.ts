import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'**/*.e2e.ts',use:{baseURL:'http://127.0.0.1:1430',browserName:'chromium',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}} ,webServer:{command:'npm run dev',url:'http://127.0.0.1:1430',reuseExistingServer:!process.env.CI,timeout:30000}});
