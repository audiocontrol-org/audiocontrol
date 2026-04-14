import type { Page } from 'playwright';
// Relative import: scenarios/ is outside tsconfig rootDir (src/), so @/ paths don't resolve here.
import type { ScenarioMetadata } from '../src/types.js';

export const metadata: ScenarioMetadata = {
  name: 'hello-world',
  description: 'Minimal scenario to validate the demo video pipeline',
  mode: 'harness',
  outputTier: 'silent',
};

export const run = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    document.body.style.margin = '0';
    document.body.style.backgroundColor = '#1a1a2e';
    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'column';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.height = '100vh';
    document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  });

  await page.evaluate(() => {
    const title = document.createElement('h1');
    title.textContent = 'audiocontrol';
    title.style.color = '#ffffff';
    title.style.fontSize = '4rem';
    title.style.margin = '0';
    title.style.letterSpacing = '0.05em';
    document.body.appendChild(title);
  });

  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const subtitle = document.createElement('h2');
    subtitle.textContent = 'Demo Video Generator';
    subtitle.style.color = '#cccccc';
    subtitle.style.fontSize = '1.5rem';
    subtitle.style.margin = '1rem 0 0 0';
    subtitle.style.fontWeight = '300';
    document.body.appendChild(subtitle);
  });

  await page.waitForTimeout(2000);
};
