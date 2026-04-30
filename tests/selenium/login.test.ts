/**
 * Selenium tests — login flow (including iOS-Safari-style cookie fix).
 *
 * These tests verify:
 *  1. The login page renders with name/autocomplete attributes (iOS Safari fix).
 *  2. Submitting invalid credentials shows an error.
 *  3. Submitting valid admin credentials redirects to /admin.
 *  4. Submitting valid student credentials redirects to /student.
 */

import { WebDriver, By, until } from 'selenium-webdriver';
import { buildDriver, goto, waitFor } from './helpers';

let driver: WebDriver;

beforeAll(async () => {
  driver = buildDriver();
});

afterAll(async () => {
  await driver.quit();
});

/** Clear all cookies so each test starts unauthenticated. */
async function clearSession(): Promise<void> {
  await driver.manage().deleteAllCookies();
}

describe('Login page', () => {
  beforeEach(async () => {
    await clearSession();
  });
  test('renders username input with correct name and autocomplete attributes', async () => {
    await goto(driver, '/login');
    const usernameInput = await waitFor(driver, By.css('input[name="username"]'));
    const autoComplete = await usernameInput.getAttribute('autocomplete');
    expect(autoComplete).toBe('username');
  });

  test('renders password input with correct name and autocomplete attributes', async () => {
    await goto(driver, '/login');
    const passwordInput = await waitFor(driver, By.css('input[name="password"]'));
    const autoComplete = await passwordInput.getAttribute('autocomplete');
    expect(autoComplete).toBe('current-password');
    const type = await passwordInput.getAttribute('type');
    expect(type).toBe('password');
  });

  test('shows an error for invalid credentials', async () => {
    await goto(driver, '/login');
    const usernameInput = await waitFor(driver, By.css('input[name="username"]'));
    await usernameInput.clear();
    await usernameInput.sendKeys('nobody');
    const passwordInput = await driver.findElement(By.css('input[name="password"]'));
    await passwordInput.clear();
    await passwordInput.sendKeys('wrongpassword');
    await driver.findElement(By.css('button[type="submit"]')).click();

    // An error message should appear
    const errorEl = await driver.wait(
      until.elementLocated(By.css('.bg-red-500\\/20')),
      8000,
    );
    const text = await errorEl.getText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('redirects admin to /admin after successful login', async () => {
    await goto(driver, '/login');
    const usernameInput = await waitFor(driver, By.css('input[name="username"]'));
    await usernameInput.clear();
    await usernameInput.sendKeys('admin');
    const passwordInput = await driver.findElement(By.css('input[name="password"]'));
    await passwordInput.clear();
    await passwordInput.sendKeys('admin123');
    await driver.findElement(By.css('button[type="submit"]')).click();

    await driver.wait(until.urlContains('/admin'), 15000);
    const url = await driver.getCurrentUrl();
    expect(url).toContain('/admin');
  });

  test('redirects student to /student after successful login', async () => {
    await goto(driver, '/login');
    const usernameInput = await waitFor(driver, By.css('input[name="username"]'));
    await usernameInput.clear();
    await usernameInput.sendKeys('student');
    const passwordInput = await driver.findElement(By.css('input[name="password"]'));
    await passwordInput.clear();
    await passwordInput.sendKeys('student123');
    await driver.findElement(By.css('button[type="submit"]')).click();

    await driver.wait(until.urlContains('/student'), 15000);
    const url = await driver.getCurrentUrl();
    expect(url).toContain('/student');
  });
});
