import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173';

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 350 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Opening app...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Login if login form is present
  const loginInput = page.getByPlaceholder('Enter identifier...');
  if (await loginInput.isVisible().catch(() => false)) {
    console.log('Logging in as Scorpion...');
    await loginInput.fill('Scorpion');
    await page.getByPlaceholder('Enter key...').fill('Scorpion123');
    await page.getByRole('button', { name: /authenticate/i }).click();
    await page.waitForTimeout(1500);
  }

  console.log('Navigating to Projects...');
  const projectsLink = page.getByRole('link', { name: /projects/i }).first();
  if (await projectsLink.isVisible().catch(() => false)) {
    await projectsLink.click();
    await page.waitForTimeout(1200);
  }

  // Quick visible scroll + highlight behavior
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(700);

  console.log('Navigating to Chat...');
  const chatLink = page.getByRole('link', { name: /chat/i }).first();
  if (await chatLink.isVisible().catch(() => false)) {
    await chatLink.click();
    await page.waitForTimeout(1500);
  }

  // Keep window open for user to observe
  console.log('Demo complete. Keeping browser open for 20 seconds...');
  await page.waitForTimeout(20000);

  await browser.close();
}

run().catch((err) => {
  console.error('Live demo failed:', err);
  process.exit(1);
});
