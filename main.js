const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

// Configuration
const LOGIN_URL = 'https://bdc.orange.int/login';
const USERNAME = 'MyUsername';
const PASSWORD = 'MyPassword';
const DELAY_MS = 2000; // 2 seconds delay between requests
const MAX_CONTENT_LENGTH = 50000;
const chromePath = 'C:\\Users\\M2656\\Desktop\\2025_S1\\chromedriver-win64\\chromedriver.exe';

// Scraping limits
const MAX_PAGES_FOR_LINKS = 1000;
const MAX_PAGES_FOR_CONTENT = 1000; // 0 = scrape all

// Output files
const URLS_CSV = 'internal_platform_urls.csv';
const CONTENT_CSV = 'internal_platform_content.csv';

// Helper function to delay
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if a link is valid and internal
function isValidInternalLink(href, baseHost) {
    try {
        const urlObj = new URL(href);
        return (
            urlObj.protocol.startsWith('http') &&
            urlObj.hostname === baseHost &&
            !href.includes('logout') &&
            !href.includes('javascript:') &&
            !href.includes('#')
        );
    } catch {
        return false;
    }
}

// Login to platform
async function login(driver) {
    try {
        console.log('🔐 Logging in...');
        await driver.get(LOGIN_URL);
        await driver.wait(until.elementLocated(By.name('_username')), 15000);
        await driver.findElement(By.name('_username')).sendKeys(USERNAME);
        await driver.findElement(By.name('_password')).sendKeys(PASSWORD);
        await driver.findElement(By.css('button[type="submit"]')).click();
        await driver.wait(until.urlContains('/home'), 15000);
        await delay(2000);
        console.log('✅ Login successful!');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        return false;
    }
}

// Extract links from page
async function getLinksFromCurrentPage(driver, baseHost) {
    try {
        const linkElements = await driver.findElements(By.css('a[href]'));
        const links = [];
        for (const element of linkElements) {
            try {
                const href = await element.getAttribute('href');
                if (href && isValidInternalLink(href, baseHost)) {
                    links.push(href);
                }
            } catch {}
        }
        return [...new Set(links)];
    } catch (error) {
        console.error('Error getting links:', error.message);
        return [];
    }
}

// Scrape content from current page
async function scrapeCurrentPage(driver) {
    try {
        const url = await driver.getCurrentUrl();
        const title = await driver.getTitle() || 'Titre inconnu';
        let content = '';
        try {
            const bodyElement = await driver.findElement(By.tagName('body'));
            content = (await bodyElement.getText()).substring(0, MAX_CONTENT_LENGTH);
        } catch {
            content = 'Erreur lors de l\'extraction du contenu';
        }
        return { url, title: title.trim(), content: content.trim() };
    } catch (error) {
        const url = await driver.getCurrentUrl().catch(() => 'URL inconnue');
        return { url, title: 'Erreur', content: error.message };
    }
}

// Save URLs to CSV
function saveUrlsToCSV(urls, filename) {
    const csvContent = 'URL\n' + urls.join('\n');
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`📁 URLs saved to ${filename}`);
}

// Save scraped content to CSV
function saveDataToCSV(data, filename) {
    const csvHeader = 'URL,Title,Content\n';
    const csvRows = data.map(item => {
        const url = `"${item.url.replace(/"/g, '""')}"`;
        const title = `"${item.title.replace(/"/g, '""')}"`;
        const content = `"${item.content.replace(/"/g, '""')}"`;
        return `${url},${title},${content}`;
    });
    const csvContent = csvHeader + csvRows.join('\n');
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`📁 Scraped data saved to ${filename}`);
}

// Main function
async function main() {
    const options = new chrome.Options();
    options.addArguments(
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--no-sandbox',
        '--disable-dev-shm-usage'
    );

    const service = new chrome.ServiceBuilder(chromePath);
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .setChromeService(service)
        .build();

    try {
        console.log('🚀 Starting authenticated web scraper...');
        const loginSuccess = await login(driver);
        if (!loginSuccess) return;

        const startUrl = await driver.getCurrentUrl();
        const baseHost = new URL(startUrl).hostname;
        console.log(`🏠 Starting from: ${startUrl}`);

        console.log('\n=== Step 1: Discovering links ===');
        const allUrls = new Set();
        const toVisit = [startUrl];
        const visitedForLinks = new Set();
        let pagesScrapedForLinks = 0;

        while (toVisit.length > 0 && pagesScrapedForLinks < MAX_PAGES_FOR_LINKS) {
            const url = toVisit.shift();
            if (visitedForLinks.has(url)) continue;
            visitedForLinks.add(url);
            pagesScrapedForLinks++;
            try {
                console.log(`🔍 [${pagesScrapedForLinks}/${MAX_PAGES_FOR_LINKS}] Discovering from: ${url}`);
                await driver.get(url);
                await delay(DELAY_MS);
                const links = await getLinksFromCurrentPage(driver, baseHost);
                console.log(`   Found ${links.length} internal links`);
                links.forEach(link => {
                    allUrls.add(link);
                    if (!visitedForLinks.has(link) && !toVisit.includes(link)) {
                        toVisit.push(link);
                    }
                });
            } catch (error) {
                console.error(`   ⚠️ Error discovering from ${url}:`, error.message);
            }
        }

        const urlsArray = Array.from(allUrls);
        console.log(`📊 Total unique URLs discovered: ${urlsArray.length}`);
        saveUrlsToCSV(urlsArray, URLS_CSV);

        console.log('\n=== Step 2: Scraping content ===');
        const scrapedData = [];
        const urlsToScrape = MAX_PAGES_FOR_CONTENT === 0 ? urlsArray : urlsArray.slice(0, MAX_PAGES_FOR_CONTENT);
        console.log(`📝 Scraping content from ${urlsToScrape.length} pages...`);

        let successful = 0;
        let failed = 0;

        for (let i = 0; i < urlsToScrape.length; i++) {
            const url = urlsToScrape[i];
            console.log(`📄 [${i + 1}/${urlsToScrape.length}] Scraping: ${url.substring(0, 80)}...`);
            try {
                await driver.get(url);
                await delay(DELAY_MS);
                const pageData = await scrapeCurrentPage(driver);
                scrapedData.push(pageData);
                if (pageData.title !== 'Erreur') successful++;
                else failed++;
            } catch (error) {
                console.error(`   ⚠️ Error scraping ${url}:`, error.message);
                scrapedData.push({ url, title: 'Erreur', content: error.message });
                failed++;
            }
        }

        saveDataToCSV(scrapedData, CONTENT_CSV);

        console.log('\n🎉 === Scraping completed! ===');
        console.log(`📊 Total URLs discovered: ${allUrls.size}`);
        console.log(`📝 Content scraped from: ${scrapedData.length} pages`);
        console.log(`✅ Successful: ${successful}, ❌ Failed: ${failed}`);
        console.log('\n📁 Files created:');
        console.log(`   - ${URLS_CSV} (all URLs found)`);
        console.log(`   - ${CONTENT_CSV} (scraped content)`);

        console.log('\n📋 === Sample Results ===');
        scrapedData.slice(0, 3).forEach((item, index) => {
            console.log(`\n--- Page ${index + 1} ---`);
            console.log(`URL: ${item.url}`);
            console.log(`Title: ${item.title}`);
            console.log(`Content (first 200 chars): ${item.content.substring(0, 200)}...`);
        });

    } catch (error) {
        console.error('💥 Fatal error in main function:', error);
    } finally {
        await driver.quit();
        console.log('🧹 Browser closed.');
    }
}

if (require.main === module) {
    main().catch(console.error);
}
