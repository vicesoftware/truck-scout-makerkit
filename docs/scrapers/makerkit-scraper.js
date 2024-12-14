// @ts-nocheck
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Main function to scrape the MakerKit documentation
 */
async function scrapeDocumentation() {
  console.log('Starting documentation scraper...');

  // Create base output directory
  const baseDir = './docs/scraped/makerkit';
  if (fs.existsSync(baseDir)) {
    fs.rmSync(baseDir, { recursive: true });
  }
  fs.mkdirSync(baseDir);
  console.log(`Created clean base directory: ${baseDir}`);

  const browser = await initializeBrowser();

  try {
    const page = await setupPage(browser);
    const menuStructure = await extractMenuStructure(page);
    await processMenuStructure(page, menuStructure, baseDir);
  } catch (error) {
    console.error('Error occurred:', error);
    if (error.message) console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);
  } finally {
    await browser.close();
    console.log('Scraping completed');
  }
}

/**
 * Initialize the Puppeteer browser with optimal settings
 */
async function initializeBrowser() {
  console.log('Launching browser...');
  return await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800'
    ]
  });
}

/**
 * Set up the browser page with necessary configurations
 */
async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setJavaScriptEnabled(true);

  console.log('Navigating to main documentation page...');
  await page.goto('https://makerkit.dev/docs/next-supabase-turbo/installation/introduction', {
    waitUntil: ['networkidle0', 'domcontentloaded'],
    timeout: 60000
  });

  console.log('Waiting for menu to load...');
  await page.waitForSelector('[data-sidebar="menu"]', { timeout: 10000 });

  return page;
}

/**
 * Extract the complete menu structure including top-level sections and their subpages
 */
async function extractMenuStructure(page) {
  // First expand all collapsed menu sections
  await expandAllMenuSections(page);

  // Wait for all submenus to be visible
  await page.waitForSelector('[data-sidebar="menu-sub"]');

  console.log('Extracting menu structure...');
  const menuStructure = await page.evaluate(() => {
    const structure = new Map();
    const processedUrls = new Set();

    // Helper to sanitize text for filenames
    function sanitizeForFilename(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Process each top-level menu section
    const menuSections = document.querySelectorAll('div[data-state="open"]');
    menuSections.forEach(section => {
      // Get the parent section button
      const parentButton = section.querySelector('button[data-sidebar="menu-button"]');
      if (!parentButton) return;

      const parentTitle = parentButton.textContent.trim();
      const sanitizedParentTitle = sanitizeForFilename(parentTitle);

      // Get all submenu items
      const submenu = section.querySelector('[data-sidebar="menu-sub"]');
      if (!submenu) return;

      const links = [];
      const submenuLinks = submenu.querySelectorAll('a[data-sidebar="menu-button"]');
      
      submenuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.includes('#') || processedUrls.has(href)) return;

        processedUrls.add(href);
        const childTitle = link.querySelector('span').textContent.trim();
        links.push({
          title: childTitle,
          url: new URL(href, window.location.href).href,
          filename: `${sanitizedParentTitle}.${sanitizeForFilename(childTitle)}`
        });
      });

      if (links.length > 0) {
        structure.set(parentTitle, {
          title: parentTitle,
          sanitizedTitle: sanitizedParentTitle,
          links
        });
      }
    });

    return Array.from(structure.values());
  });

  console.log(`Found ${menuStructure.length} menu sections`);
  return menuStructure;
}

/**
 * Expand all collapsed menu sections to ensure we can access all links
 */
async function expandAllMenuSections(page) {
  console.log('Expanding closed menu items...');
  await page.evaluate(() => {
    const closedItems = document.querySelectorAll('div[data-state="closed"]');
    closedItems.forEach(item => {
      const button = item.querySelector('button[data-sidebar="menu-button"]');
      if (button) button.click();
    });
  });

  // Wait for animations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Process the extracted menu structure and save content for each page
 */
async function processMenuStructure(page, menuStructure, baseDir) {
  const processedUrls = new Set();
  const processedPages = [];

  // Add index to each section
  menuStructure.forEach((section, index) => {
    section.index = index + 1;
    section.indexedTitle = `${section.index}. ${section.title}`;
    section.indexedDirName = `${String(section.index).padStart(2, '0')}-${section.sanitizedTitle}`;
  });

  for (const section of menuStructure) {
    console.log(`Processing section: ${section.indexedTitle}`);

    // Create directory for this section using the indexed name
    const sectionDir = path.join(baseDir, section.indexedDirName);
    fs.mkdirSync(sectionDir);

    for (const link of section.links) {
      if (processedUrls.has(link.url)) {
        console.log(`Skipping duplicate URL: ${link.url}`);
        continue;
      }
      processedUrls.add(link.url);

      console.log(`Scraping page: ${link.url}`);
      try {
        await page.goto(link.url, {
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000
        });

        // Wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));

        const content = await extractContent(page, link.url);
        if (content) {
          // Create the page content object
          const pageContent = {
            parentSection: section.indexedTitle,
            title: link.title,
            url: link.url,
            content: content.content
          };

          // Save the page content in its section directory
          const outputPath = path.join(sectionDir, `${link.filename}.json`);
          fs.writeFileSync(outputPath, JSON.stringify(pageContent, null, 2));
          console.log(`Saved page content to ${outputPath}`);

          // Add to processed pages for menu structure
          processedPages.push({
            parentSection: section.indexedTitle,
            title: link.title,
            path: path.relative(baseDir, outputPath)
          });
        }
      } catch (error) {
        console.error(`Error processing ${link.url}:`, error);
        continue;
      }
    }
  }

  // Save the menu structure separately for navigation
  const menuStructureOutput = {
    sections: menuStructure.map(section => ({
      index: section.index,
      title: section.indexedTitle,
      directory: section.indexedDirName,
      pages: section.links.map(link => ({
        title: link.title,
        filename: `${link.filename}.json`
      }))
    }))
  };

  const menuOutputPath = path.join(baseDir, 'menu-structure.json');
  fs.writeFileSync(menuOutputPath, JSON.stringify(menuStructureOutput, null, 2));
  console.log(`Saved menu structure to ${menuOutputPath}`);

  // Save a list of all processed pages
  const pagesOutputPath = path.join(baseDir, 'processed-pages.json');
  fs.writeFileSync(pagesOutputPath, JSON.stringify(processedPages, null, 2));
  console.log(`Saved processed pages list to ${pagesOutputPath}`);
}

/**
 * Extract content from a single documentation page
 */
async function extractContent(page, url) {
  try {
    const contentSelectors = [
      '.html-renderer_HTML__5Eai9',
      'article',
      'main',
      '.content',
      '.documentation-content',
      '.markdown-body',
      '.prose',
      '[role="main"]',
      '[data-content="main"]',
      '.documentation',
      '.doc-content'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        content = await extractFormattedContent(page, selector);
        if (content) {
          console.log(`Found content using selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Selector ${selector} not found`);
      }
    }

    if (!content) {
      content = await page.$eval('body', el => el.textContent?.trim() || '');
      console.log(content ? 'Using fallback body text content' : 'No content found with any method');
    }

    return {
      content
    };
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return null;
  }
}

/**
 * Extract formatted content from a page element
 */
async function extractFormattedContent(page, selector) {
  return page.$eval(selector, (element) => {
    function getElementText(element) {
      return (element.textContent || '').trim();
    }

    function processElement(el) {
      const text = getElementText(el);

      if (el.tagName === 'PRE' || el.tagName === 'CODE') {
        return '\n```\n' + text + '\n```\n';
      }

      if (el.tagName.match(/^H[1-6]$/)) {
        const level = parseInt(el.tagName.charAt(1));
        const prefix = '#'.repeat(level);
        return `\n${prefix} ${text}\n`;
      }

      if (el.tagName === 'UL' || el.tagName === 'OL') {
        return '\n' + Array.from(el.children)
          .map(li => `- ${getElementText(li)}`)
          .join('\n') + '\n';
      }

      return '\n' + text + '\n';
    }

    return Array.from(element.children)
      .map(processElement)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  });
}

// Run the scraper
scrapeDocumentation();
