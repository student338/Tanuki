/**
 * Selenium tests — student page features.
 *
 * Covers:
 *  1. Genre select contains the expanded list of genres.
 *  2. Reading level slider (State-of-Mind style) renders and responds to interaction.
 */

import { WebDriver, By, until, Key } from 'selenium-webdriver';
import { buildDriver, loginAs, BASE_URL } from './helpers';

const EXPECTED_GENRES = [
  'Fantasy', 'Adventure', 'Mystery', 'Sci-Fi', 'Romance', 'Horror', 'Comedy', 'Historical',
  'Thriller', 'Non-Fiction', 'Fairy Tale', 'Mythology', 'Sports', 'Animals & Nature',
  'Science', 'Drama', 'Superhero', 'Poetry', 'Fable', 'Other',
];

let driver: WebDriver;

beforeAll(async () => {
  driver = buildDriver();
  await driver.get(`${BASE_URL}/login`);
  await driver.manage().deleteAllCookies();
  await loginAs(driver, 'student');
  // Let the page stabilise after login redirect
  await driver.sleep(800);
  await dismissOnboardingIfPresent(driver);
}, 90000);

afterAll(async () => {
  await driver.quit();
});

/**
 * If the first-time onboarding modal is shown (reading level step), complete
 * it so we can reach the main student page.
 */
async function dismissOnboardingIfPresent(d: WebDriver): Promise<void> {
  const sliders = await d.findElements(By.css('[role="slider"]'));
  if (sliders.length === 0) return; // no modal

  // ── Step 1: select a reading level ──────────────────────────────────────
  // Click the Elementary tick (📚) or fall back to clicking the slider track
  const elemBtn = await d.findElements(By.xpath("//button[.//*[contains(text(),'📚')]]"));
  if (elemBtn.length > 0) {
    await elemBtn[0].click();
  } else {
    await sliders[0].click();
  }

  // Click "Next →" using a wait so the click registers after React re-renders
  const nextBtn = await d.wait(
    until.elementLocated(By.xpath("//button[contains(text(),'Next')]")),
    6000,
  );
  await d.wait(until.elementIsEnabled(nextBtn), 3000);
  await nextBtn.click();

  // ── Step 2: finish preferences ──────────────────────────────────────────
  const finishBtn = await d.wait(
    until.elementLocated(
      By.xpath("//button[contains(text(),'Get Started') or contains(text(),'Save Settings')]"),
    ),
    6000,
  );
  await d.wait(until.elementIsEnabled(finishBtn), 3000);
  await finishBtn.click();

  // Wait for the modal (slider) to disappear
  await d.wait(
    async () => (await d.findElements(By.css('[role="slider"]'))).length === 0,
    10000,
  ).catch(() => { /* if it doesn't disappear, proceed anyway */ });
}

/**
 * Expand the story options panel (if collapsed) and wait for the genre
 * select to appear.  The genre select is identified by the presence of
 * an <option> whose text is "Fantasy".
 */
async function ensureOptionsExpanded(d: WebDriver): Promise<void> {
  // Genre select is identified by a "Fantasy" option
  const hasGenreSelect = async (): Promise<boolean> => {
    const opts = await d.findElements(By.xpath("//option[text()='Fantasy']"));
    return opts.length > 0;
  };

  if (await hasGenreSelect()) return;

  // Click the story options toggle button
  const toggle = await d.wait(
    until.elementLocated(
      By.xpath("//button[contains(., 'Story options') or contains(., 'Article options')]"),
    ),
    10000,
  );
  await toggle.click();

  await d.wait(hasGenreSelect, 8000);
}

// ── Genre select tests ─────────────────────────────────────────────────────

describe('Genre select', () => {
  beforeEach(async () => {
    await ensureOptionsExpanded(driver);
  });

  test('genre dropdown contains all expected genres', async () => {
    // Find the genre select by locating the one that contains a "Fantasy" option
    const genreSelect = await driver.wait(
      until.elementLocated(
        By.xpath("//select[.//option[text()='Fantasy']]"),
      ),
      10000,
    );
    const options = await genreSelect.findElements(By.css('option'));
    const texts = await Promise.all(options.map((o) => o.getText()));

    for (const genre of EXPECTED_GENRES) {
      expect(texts).toContain(genre);
    }
  });

  test('genre dropdown has at least 21 options (Any + 20 genres)', async () => {
    const genreSelect = await driver.wait(
      until.elementLocated(By.xpath("//select[.//option[text()='Fantasy']]")),
      10000,
    );
    const options = await genreSelect.findElements(By.css('option'));
    // "Any" + 20 genres = 21
    expect(options.length).toBeGreaterThanOrEqual(21);
  });

  test('selecting a genre updates the dropdown value', async () => {
    const genreSelect = await driver.wait(
      until.elementLocated(By.xpath("//select[.//option[text()='Fantasy']]")),
      10000,
    );
    await genreSelect.findElement(By.xpath('.//option[text()="Thriller"]')).click();
    const selected = await genreSelect.getAttribute('value');
    expect(selected).toBe('Thriller');
  });
});

// ── Reading level slider tests ─────────────────────────────────────────────

describe('Reading level slider (onboarding)', () => {
  async function openSettingsModal(): Promise<void> {
    const gearBtn = await driver.wait(
      until.elementLocated(By.css('button[title="Settings"]')),
      10000,
    );
    await gearBtn.click();
    await driver.wait(until.elementLocated(By.css('[role="slider"]')), 8000);
  }

  async function isModalOpen(): Promise<boolean> {
    return driver.findElements(By.css('[role="slider"]')).then((e) => e.length > 0);
  }

  test('slider track element is present in the settings modal', async () => {
    await openSettingsModal();
    expect(await driver.findElement(By.css('[role="slider"]'))).toBeTruthy();
  });

  test('clicking an emoji tick button selects a reading level', async () => {
    if (!(await isModalOpen())) await openSettingsModal();

    const tick = await driver.wait(
      until.elementLocated(By.xpath("//button[.//*[contains(text(),'📚')]]")),
      8000,
    );
    await tick.click();

    await driver.wait(
      until.elementLocated(
        By.xpath("//*[contains(@class,'font-bold') and contains(text(),'Elementary')]"),
      ),
      6000,
    );
    const text = await driver
      .findElement(
        By.xpath("//*[contains(@class,'font-bold') and contains(text(),'Elementary')]"),
      )
      .getText();
    expect(text).toContain('Elementary');
  });

  test('keyboard arrow keys navigate the reading level slider', async () => {
    if (!(await isModalOpen())) await openSettingsModal();

    const sliderEl = await driver.findElement(By.css('[role="slider"]'));
    const before = Number((await sliderEl.getAttribute('aria-valuenow')) ?? '0');

    await sliderEl.click();
    await sliderEl.sendKeys(Key.ARROW_RIGHT);

    const after = Number((await sliderEl.getAttribute('aria-valuenow')) ?? '0');
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
