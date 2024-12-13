// @ts-nocheck
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function scrapeDocumentation() {
  console.log('Starting documentation scraper...');

  // Create output directory
  const outputDir = './docs/scraped/makerkit';
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);

  // Launch browser with more realistic settings
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
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

  try {
    const page = await browser.newPage();
    
    // Set a more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Enable JavaScript
    await page.setJavaScriptEnabled(true);

    // Start from the main documentation page
    console.log('Navigating to main documentation page...');
    await page.goto('https://makerkit.dev/docs/next-supabase-turbo/installation/introduction', {
      waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
      timeout: 60000
    });

    // Wait for the menu to be present
    console.log('Waiting for menu to load...');
    await page.waitForSelector('[data-sidebar="menu"]', { timeout: 10000 });

    // First, try to expand all closed menu items
    console.log('Expanding closed menu items...');
    await page.evaluate(() => {
      const closedItems = document.querySelectorAll('li[data-sidebar="menu-item"][data-state="closed"]');
      closedItems.forEach(item => {
        const button = item.querySelector('button[data-sidebar="menu-button"]');
        if (button) {
          button.click();
        }
      });
    });

    // Wait for any animations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract all menu items and their links
    console.log('Extracting menu structure...');
    const menuStructure = await page.evaluate(() => {
      const structure = new Map();
      const processedUrls = new Set();
      
      // Find all menu items
      const menuItems = document.querySelectorAll('li[data-sidebar="menu-item"]');
      
      menuItems.forEach(item => {
        // Get the button or link that contains the title
        const titleElement = item.querySelector('[data-sidebar="menu-button"]');
        if (!titleElement) return;
        
        const title = titleElement.textContent.trim();
        const links = [];

        // Check if this item is a link itself
        if (titleElement.tagName === 'A') {
          const href = titleElement.getAttribute('href');
          if (href && !href.includes('#') && !processedUrls.has(href)) {
            processedUrls.add(href);
            links.push({
              title,
              url: new URL(href, window.location.href).href
            });
          }
        }

        // Get all nested links
        const nestedLinks = item.querySelectorAll('a[data-sidebar="menu-button"]');
        nestedLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && !href.includes('#') && !processedUrls.has(href)) {
            processedUrls.add(href);
            links.push({
              title: link.textContent.trim(),
              url: new URL(href, window.location.href).href
            });
          }
        });

        if (links.length > 0) {
          // If this title already exists, merge the links
          if (structure.has(title)) {
            const existingLinks = structure.get(title);
            links.forEach(link => {
              if (!existingLinks.some(existing => existing.url === link.url)) {
                existingLinks.push(link);
              }
            });
          } else {
            structure.set(title, links);
          }
        }
      });

      return Array.from(structure.entries()).map(([title, links]) => ({
        title,
        links
      }));
    });

    console.log(`Found ${menuStructure.length} menu sections`);

    // Process each section
    for (const section of menuStructure) {
      console.log(`Processing section: ${section.title}`);
      
      const groupContent = {
        title: section.title,
        pages: []
      };

      // Process each link in the section
      const processedUrls = new Set();
      for (const link of section.links) {
        if (processedUrls.has(link.url)) {
          console.log(`Skipping duplicate URL: ${link.url}`);
          continue;
        }
        processedUrls.add(link.url);

        console.log(`Scraping page: ${link.url}`);
        
        try {
          await page.goto(link.url, {
            waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
            timeout: 30000
          });

          // Wait a bit for dynamic content
          await new Promise(resolve => setTimeout(resolve, 1000));

          const content = await extractContent(page, link.url);
          if (content) {
            groupContent.pages.push(content);
          }
        } catch (error) {
          console.error(`Error processing ${link.url}:`, error);
          continue;
        }
      }

      if (groupContent.pages.length > 0) {
        const filename = sanitizeFilename(section.title);
        const outputPath = path.join(outputDir, `${filename}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(groupContent, null, 2));
        console.log(`Saved section content to ${outputPath} (${groupContent.pages.length} pages)`);
      } else {
        console.log(`No content found for section: ${section.title}`);
      }
    }

  } catch (error) {
    console.error('Error occurred:', error);
    if (error.message) console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);
  } finally {
    await browser.close();
    console.log('Scraping completed');
  }
}

async function extractContent(page, url) {
  try {
    // Wait for content to load
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
        content = await page.$eval(selector, (element) => {
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
        
        if (content) {
          console.log(`Found content using selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Selector ${selector} not found`);
      }
    }

    if (!content) {
      // Try getting any text content as a fallback
      content = await page.$eval('body', el => el.textContent?.trim() || '');
      if (content) {
        console.log('Using fallback body text content');
      } else {
        console.error('No content found with any method');
        return null;
      }
    }

    // Try multiple title selectors
    const titleSelectors = ['h1', '.title', 'header h1', '[data-heading]'];
    let title = '';
    for (const selector of titleSelectors) {
      try {
        title = await page.$eval(selector, el => el.textContent?.trim() || '');
        if (title) {
          console.log(`Found title using selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Title selector ${selector} not found`);
      }
    }

    return {
      url,
      title: title || 'Untitled Page',
      content
    };

  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return null;
  }
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Run the scraper
scrapeDocumentation();
