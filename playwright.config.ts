import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60000,
  retries: 1,
  workers: 1,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: 'https://student-management-system.sbcecsms3.workers.dev',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: 'Mobile',
      use: {
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
