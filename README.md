# Code Explanation: Web Scraper for Internal Platform

This code is a Node.js script that uses Selenium WebDriver to scrape content from an internal company platform (Orange Business) after authenticating with provided credentials.

## Global Overview

The script performs two main tasks:
1. **Link Discovery**: Logs into the platform and crawls through pages to collect internal URLs
2. **Content Scraping**: Visits each discovered URL and extracts page titles and content

The results are saved in two CSV files:
- `internal_platform_urls.csv` - Contains all discovered URLs
- `internal_platform_content.csv` - Contains scraped content with URLs and titles

## Function-by-Function Breakdown

### 1. Configuration Constants
```javascript
const LOGIN_URL = 'https://bdc.orange.int/login';
const USERNAME = 'MyUsername';
const PASSWORD = 'MyPassword';
// ... other configs
```
- Sets up login credentials, delays, and file paths
- Configures scraping limits (max pages to crawl)

### 2. Helper Functions

**`delay(ms)`**
```javascript
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```
- Creates a delay between requests to avoid overwhelming the server

**`isValidInternalLink(href, baseHost)`**
```javascript
function isValidInternalLink(href, baseHost) {
    // Checks if link is:
    // - HTTP/HTTPS protocol
    // - Same domain as baseHost
    // - Not a logout link
    // - Not a JavaScript link
    // - Not an anchor link
}
```
- Validates whether a link should be included in scraping

### 3. Core Functions

**`login(driver)`**
```javascript
async function login(driver) {
    // Navigates to login page
    // Enters username/password
    // Clicks submit button
    // Waits for successful redirect
}
```
- Handles the authentication process
- Returns true/false based on login success

**`getLinksFromCurrentPage(driver, baseHost)`**
```javascript
async function getLinksFromCurrentPage(driver, baseHost) {
    // Finds all <a> tags on current page
    // Extracts href attributes
    // Filters using isValidInternalLink
    // Returns unique links
}
```
- Collects all valid internal links from the current page

**`scrapeCurrentPage(driver)`**
```javascript
async function scrapeCurrentPage(driver) {
    // Gets current URL
    // Gets page title
    // Extracts text content from <body>
    // Trims and limits content length
    // Returns {url, title, content} object
}
```
- Extracts key information from the current page
- Handles errors gracefully

### 4. Output Functions

**`saveUrlsToCSV(urls, filename)`**
```javascript
function saveUrlsToCSV(urls, filename) {
    // Creates CSV with URL column
    // Writes to specified file
}
```
- Saves discovered URLs to a simple CSV file

**`saveDataToCSV(data, filename)`**
```javascript
function saveDataToCSV(data, filename) {
    // Creates CSV with URL, Title, Content columns
    // Properly escapes quotes in content
    // Writes to specified file
}
```
- Saves scraped content in a structured CSV format

### 5. Main Function

**`main()`**
```javascript
async function main() {
    // 1. Sets up Chrome WebDriver with options
    // 2. Attempts login
    // 3. Discovers links (BFS approach):
    //    - Starts from home page
    //    - Visits each page and collects links
    //    - Respects MAX_PAGES_FOR_LINKS limit
    // 4. Scrapes content from discovered URLs:
    //    - Respects MAX_PAGES_FOR_CONTENT limit
    //    - Tracks success/failure stats
    // 5. Saves results to CSV files
    // 6. Prints summary and sample results
    // 7. Cleans up by closing browser
}
```
- Orchestrates the entire scraping process
- Handles errors gracefully
- Provides detailed console output about progress

## Execution Flow

1. Configures Chrome WebDriver with anti-detection settings
2. Logs into the platform
3. Discovers internal links using breadth-first search
4. Scrapes content from discovered pages
5. Saves results to CSV files
6. Prints summary statistics and sample results
7. Cleans up resources

The script includes careful error handling, rate limiting with delays, and produces structured output files for analysis.
