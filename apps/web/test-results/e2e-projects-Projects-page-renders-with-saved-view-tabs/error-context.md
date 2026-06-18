# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/projects.spec.ts >> Projects page renders with saved view tabs
- Location: e2e/projects.spec.ts:3:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/admin/projects", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Projects page renders with saved view tabs', async ({ page }) => {
> 4  |   await page.goto('/admin/projects');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  5  |   await expect(page.getByRole('navigation', { name: 'Saved views' })).toBeVisible();
  6  |   for (const label of ['All Projects', 'Idea Board', 'Feature Builds']) {
  7  |     await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  8  |   }
  9  | });
  10 | 
  11 | test('Create project via + New and see it in list', async ({ page }) => {
  12 |   await page.goto('/admin/projects');
  13 |   await page.getByRole('button', { name: /\+/ }).first().click();
  14 |   await page.getByRole('button', { name: 'Project' }).click();
  15 |   await page.getByLabel('Name').fill('TEST · Playwright Project');
  16 |   await page.getByRole('button', { name: 'Create project' }).click();
  17 |   await expect(page.getByText('TEST · Playwright Project')).toBeVisible();
  18 | });
  19 | 
  20 | test('Project detail renders 5 tabs', async ({ page }) => {
  21 |   await page.goto('/admin/projects');
  22 |   const firstLink = page.locator('a[href^="/admin/projects/"]').first();
  23 |   await firstLink.click();
  24 |   for (const label of ['Overview', 'Tasks', 'Activity', 'Files', 'Settings']) {
  25 |     await expect(page.getByRole('link', { name: label })).toBeVisible();
  26 |   }
  27 | });
  28 | 
```