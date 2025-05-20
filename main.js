const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const urlLib = require('url');

const LOGIN_URL = 'https://bdc.orange.int/login';
const USERNAME = 'MyUsername';
const PASSWORD = 'MyPassword';
const OUTPUT_JSONL = path.resolve(__dirname, 'output.jsonl');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
const chromePath = 'C:\\Users\\M2656\\Desktop\\2025_S1\\chromedriver-win64\\chromedriver.exe';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_JSONL, ''); // clear previous data

function sanitizeFileName(url) {
  return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 80);
}

function isValidLink(href, baseHost) {
  try {
    const urlObj = new URL(href);
    return (
      urlObj.protocol.startsWith('http') &&
      urlObj.hostname === baseHost &&
      !href.includes('logout') &&
      !href.includes('javascript:')
    );
  } catch {
    return false;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(driver, url) {
  const screenshot = await driver.takeScreenshot();
  const filename = path.join(SCREENSHOT_DIR, sanitizeFileName(url) + '.png');
  fs.writeFileSync(filename, screenshot, 'base64');
  console.log(`🖼️ Screenshot saved: ${filename}`);
}

async function extractPageInfo(driver) {
  const title = await driver.getTitle();
  const body = await driver.findElement(By.tagName('body'));
  const content = await body.getText();

  const linkElements = await driver.findElements(By.css('a[href]'));
  const links = [];
  for (const el of linkElements) {
    try {
      const href = await el.getAttribute('href');
      links.push(href);
    } catch {
      continue;
    }
  }

  return { title, content, links: [...new Set(links)] };
}

async function login(driver) {
  console.log('🔐 Logging in...');
  await driver.get(LOGIN_URL);
  await driver.wait(until.elementLocated(By.name('_username')), 10000);
  await driver.findElement(By.name('_username')).sendKeys(USERNAME);
  await driver.findElement(By.name('_password')).sendKeys(PASSWORD);
  await driver.findElement(By.css('button[type="submit"]')).click();
  await driver.wait(until.urlContains('/home'), 10000);
  await delay(2000);
}

async function crawlAllInternalLinks(driver, startUrl) {
  const baseHost = new URL(startUrl).hostname;
  const toVisit = [startUrl];
  const visited = new Set();

  while (toVisit.length > 0) {
    const url = toVisit.shift();
    if (visited.has(url)) continue;

    try {
      console.log(`🌐 Visiting: ${url}`);
      await driver.get(url);
      await delay(2000);
      visited.add(url);

      const { title, content, links } = await extractPageInfo(driver);
      await captureScreenshot(driver, url);

      const internalLinks = links.filter(link => isValidLink(link, baseHost));

      // Write to JSONL
      const record = {
        url,
        title,
        content,
        links: internalLinks
      };
      fs.appendFileSync(OUTPUT_JSONL, JSON.stringify(record) + '\n');

      // Queue new internal links
      for (const link of internalLinks) {
        if (!visited.has(link) && !toVisit.includes(link)) {
          toVisit.push(link);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Error visiting ${url}: ${err.message}`);
    }
  }

  console.log(`✅ Finished crawling ${visited.size} pages.`);
}

(async function main() {
  const options = new chrome.Options();
  options.addArguments('--start-maximized', '--headless=new');

  const service = new chrome.ServiceBuilder(chromePath);

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setChromeService(service)
    .build();

  try {
    await login(driver);
    const startUrl = await driver.getCurrentUrl();
    await crawlAllInternalLinks(driver, startUrl);
  } catch (err) {
    console.error('❌ Fatal Error:', err);
  } finally {
    await driver.quit();
    console.log('🧹 Browser closed.');
  }
})();
