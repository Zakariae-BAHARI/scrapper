const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

const LOGIN_URL = 'https://bdc.orange.int/login';
const USERNAME = 'MyUsername';
const PASSWORD = 'MyPassword';
const BASE_DOMAIN = 'bdc.orange.int';

const OUTPUT_DIR = path.resolve(__dirname, 'downloads');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const OUTPUT_JSONL = path.join(OUTPUT_DIR, 'output.jsonl');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const options = new chrome.Options();
options.addArguments('--headless=new', '--disable-gpu', '--window-size=1920,1080');

const driver = new Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();

function sanitizeFileName(url, index) {
  return `${String(index).padStart(3, '0')}_${url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 80)}.png`;
}

async function captureScreenshot(driver, url, index) {
  const base64Image = await driver.takeScreenshot();
  const filePath = path.join(SCREENSHOT_DIR, sanitizeFileName(url, index));
  fs.writeFileSync(filePath, base64Image, 'base64');
  console.log(`📸 Screenshot: ${filePath}`);
}

async function extractPageInfo(driver) {
  const title = await driver.getTitle();
  const body = await driver.findElement(By.tagName('body')).getText();
  const links = await driver.findElements(By.css('a[href]'));

  const hrefs = [];
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (
      href &&
      href.startsWith('http') &&
      href.includes(BASE_DOMAIN) &&
      !href.includes('logout')
    ) {
      hrefs.push(href.split('#')[0]);
    }
  }

  return { title, content: body, links: [...new Set(hrefs)] };
}

(async function main() {
  const visited = new Set();
  const toVisit = [];

  try {
    // 1. Login
    console.log('🔐 Logging in...');
    await driver.get(LOGIN_URL);
    await driver.wait(until.elementLocated(By.name('_username')), 10000);
    await driver.findElement(By.name('_username')).sendKeys(USERNAME);
    await driver.findElement(By.name('_password')).sendKeys(PASSWORD);
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.wait(until.urlContains('/home'), 10000);

    const homeUrl = await driver.getCurrentUrl();
    toVisit.push(homeUrl);

    let pageCount = 0;

    while (toVisit.length > 0) {
      const url = toVisit.shift();
      if (visited.has(url)) continue;

      try {
        await driver.get(url);
        await driver.sleep(1000); // allow page to load
        console.log(`🌐 Scraping: ${url}`);

        const { title, content, links } = await extractPageInfo(driver);
        await captureScreenshot(driver, url, ++pageCount);

        const record = {
          url,
          title,
          content,
          links,
        };
        fs.appendFileSync(OUTPUT_JSONL, JSON.stringify(record) + '\n');

        // Queue new links
        for (const link of links) {
          if (!visited.has(link) && !toVisit.includes(link)) {
            toVisit.push(link);
          }
        }

        visited.add(url);
      } catch (e) {
        console.warn(`⚠️ Failed to scrape ${url}: ${e.message}`);
      }
    }

    console.log(`✅ Scraped ${visited.size} unique pages.`);
    console.log(`📄 Results saved in: ${OUTPUT_JSONL}`);
  } catch (err) {
    console.error('❌ Fatal error:', err);
  } finally {
    await driver.quit();
  }
})();
