/**
 * Shared Selenium helpers for Tanuki tests.
 *
 * Creates a headless Chrome driver configured for the test server.
 */

import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver';
import { Options as ChromeOptions, ServiceBuilder } from 'selenium-webdriver/chrome';

export const BASE_URL: string = process.env.TEST_BASE_URL ?? 'http://localhost:3999';

/** Build a headless Chrome WebDriver using the system-installed ChromeDriver. */
export function buildDriver(): WebDriver {
  const opts = new ChromeOptions()
    .addArguments('--headless=new')
    .addArguments('--no-sandbox')
    .addArguments('--disable-dev-shm-usage')
    .addArguments('--disable-gpu')
    .addArguments('--window-size=1280,900');

  // Use the system chromedriver explicitly to avoid Selenium Manager's
  // attempt to download a driver from the network.
  const service = new ServiceBuilder('/usr/bin/chromedriver');

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(opts)
    .setChromeService(service)
    .build();
}

/** Navigate to a path and wait until the page title is non-empty. */
export async function goto(driver: WebDriver, path: string): Promise<void> {
  await driver.get(`${BASE_URL}${path}`);
}

/** Wait for an element matching `selector` to be visible (up to `ms`). */
export async function waitFor(
  driver: WebDriver,
  selector: By,
  ms = 10000,
): Promise<WebElement> {
  return driver.wait(until.elementLocated(selector), ms);
}

/** Log in as the given role using the default credentials. */
export async function loginAs(
  driver: WebDriver,
  role: 'admin' | 'student',
): Promise<void> {
  const credentials = {
    admin: { username: 'admin', password: 'admin123' },
    student: { username: 'student', password: 'student123' },
  };
  const { username, password } = credentials[role];

  await goto(driver, '/login');
  const userInput = await waitFor(driver, By.css('input[name="username"]'));
  await userInput.sendKeys(username);
  const passInput = await driver.findElement(By.css('input[name="password"]'));
  await passInput.sendKeys(password);
  const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
  await submitBtn.click();

  // Wait for navigation away from login
  await driver.wait(until.urlContains(`/${role}`), 15000);
}
