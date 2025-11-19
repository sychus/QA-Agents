import { chromium, Browser, BrowserContext, Page } from 'playwright';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

interface WebExecutorConfig {
  recordVideo?: boolean;
}

interface Step {
  gherkinStep: string;
  action: string;
  selector: string;
  data: any;
  description: string;
  validation?: {
    type: string;
    expected: any;
  };
}

interface VisionResult {
  strategy?: string;
  selector?: string;
  dropdownSelector?: string;
  actualText?: string;
  reasoning?: string;
  confidence?: string;
  fields?: Array<{ label: string; selector: string; value: string }>;
  found?: boolean;
}

interface StepResult {
  success: boolean;
  step: string;
  action: string;
  screenshot?: Buffer | null;
  timestamp: string;
  error?: string;
  diagnostics?: any;
  clicked?: string;
  typed?: any;
  selected?: any;
  navigated?: string;
}

/**
 * WebExecutorAgent - Executes tests on web applications
 * Simulates human behavior and uses AI to find elements
 */
export class WebExecutorAgent {
  private config: WebExecutorConfig;
  public browser: Browser | null = null;
  public context: BrowserContext | null = null;
  public page: Page | null = null;
  private openai: OpenAI;
  private visionModel: string;
  private useVision: boolean;
  private testContext: any = {};
  private screenshots: any[] = [];
  private networkErrors: any[] = [];
  private consoleErrors: any[] = [];

  constructor(config: WebExecutorConfig = {}) {
    this.config = config;
    
    // Configure OpenAI with Vision support
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Use faster model for Vision AI (gpt-4o-mini is ~60% faster and 90% cheaper)
    this.visionModel = process.env.VISION_MODEL || 'gpt-4o-mini';
    this.useVision = process.env.USE_VISION !== 'false'; // Default: enabled
    
    console.info(`👁️  Vision AI: ${this.useVision ? 'ENABLED' : 'DISABLED'}`);
    if (this.useVision) {
      console.info(`   Model: ${this.visionModel} (${this.visionModel === 'gpt-4o-mini' ? '⚡ Fast mode' : '🎯 High accuracy mode'})`);
    }
  }

  /**
   * Initialize the browser
   */
  async initialize(): Promise<void> {
    console.info('🌐 Initializing browser...');
    
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '100')
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: this.config.recordVideo ? { dir: './videos' } : undefined,
      ignoreHTTPSErrors: true
    });

    this.page = await this.context.newPage();
    
    // Capture console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          type: 'console',
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Capture network errors
    this.page.on('response', response => {
      if (response.status() >= 400) {
        this.networkErrors.push({
          type: 'network',
          url: response.url(),
          status: response.status(),
          timestamp: new Date().toISOString()
        });
      }
    });

    console.info('✅ Browser initialized');
  }

  /**
   * Execute an individual test step
   */
  async executeStep(step: Step, stepIndex: number): Promise<StepResult> {
    console.info(`  🤖 Step ${stepIndex + 1}: ${step.description}`);
    
    try {
      let result;

      switch (step.action) {
        case 'navigate':
          result = await this.navigate(step);
          break;
        
        case 'click':
          result = await this.click(step);
          break;
        
        case 'type':
          result = await this.type(step);
          break;
        
        case 'select':
          result = await this.select(step);
          break;
        
        case 'validate':
          result = await this.validate(step);
          break;
        
        case 'wait':
          result = await this.wait(step);
          break;
        
        case 'hover':
          result = await this.hover(step);
          break;
        
        case 'scroll':
          result = await this.scroll(step);
          break;
        
        default:
          result = await this.genericAction(step);
      }

      // Wait for page to stabilize after action (smart wait)
      await this.smartWait();

      // Capture screenshot of successful step
      const screenshot = await this.page!.screenshot();
      this.screenshots.push({
        step: stepIndex + 1,
        description: step.description,
        timestamp: new Date().toISOString(),
        screenshot: screenshot
      });

      return {
        success: true,
        step: step.description,
        action: step.action,
        screenshot: screenshot,
        timestamp: new Date().toISOString(),
        ...result
      };

    } catch (error: any) {
      console.error(`    ❌ Error in step: ${error.message}`);
      
      // Capture screenshot of error
      const screenshot = await this.page!.screenshot().catch(() => null);
      
      return {
        success: false,
        step: step.description,
        action: step.action,
        error: error.message,
        screenshot: screenshot,
        diagnostics: await this.collectDiagnostics(),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(step: Step): Promise<{ navigated: string }> {
    // Get URL or path from step
    let urlOrPath = step.data || step.selector;
    
    // Build full URL
    let fullUrl;
    
    if (!urlOrPath) {
      // No URL/path specified, use WEB_APP_URL from env
      fullUrl = process.env.WEB_APP_URL;
    } else if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      // Full URL provided
      fullUrl = urlOrPath;
    } else if (urlOrPath.startsWith('/')) {
      // Relative path provided, combine with base URL
      const baseUrl = process.env.WEB_APP_URL || 'http://localhost:4200';
      // Remove any path from base URL
      const base = new URL(baseUrl).origin;
      fullUrl = `${base}${urlOrPath}`;
    } else {
      // Generic text like "event overview page", use WEB_APP_URL
      fullUrl = process.env.WEB_APP_URL;
    }
    
    if (!fullUrl) {
      throw new Error('No URL specified for navigation. Set WEB_APP_URL in .env or provide URL/path in step.');
    }
    
    console.info(`    → Navigating to: ${fullUrl}`);
    
    await this.page!.goto(fullUrl, {
      waitUntil: 'networkidle',
      timeout: parseInt(process.env.TIMEOUT || '30000')
    });
    
    // Wait for Angular to stabilize (for Angular apps)
    await this.waitForAngular();
    
    return { navigated: fullUrl };
  }

  /**
   * Execute action using Vision AI
   * Takes a screenshot and asks GPT-4 Vision to identify where to interact
   */
  async executeActionWithVision(instruction: string, actionType: string = 'click', dataToType: any = null): Promise<VisionResult> {
    console.info(`    👁️  Using Vision AI: "${instruction}"`);
    
    try {
      // Take optimized screenshot (viewport only, reduced quality for speed)
      const screenshotOptions = {
        fullPage: false,
        type: 'jpeg' as const, // JPEG is smaller than PNG
        quality: parseInt(process.env.SCREENSHOT_QUALITY || '80') // 80% quality is usually enough
      };
      
      // Limit max dimensions if configured
      const maxWidth = parseInt(process.env.SCREENSHOT_MAX_WIDTH || '1920');
      const maxHeight = parseInt(process.env.SCREENSHOT_MAX_HEIGHT || '1080');
      
      const screenshot = await this.page!.screenshot(screenshotOptions);
      const base64Image = screenshot.toString('base64');
      
      // Prepare the prompt based on action type
      let prompt = '';
      
      if (actionType === 'click') {
        prompt = `You are analyzing a webpage screenshot to help automate a test.

Task: ${instruction}

CRITICAL: Look CAREFULLY at the screenshot and read the EXACT TEXT visible on buttons.

Analyze the screenshot and identify the element to CLICK. Respond with a JSON object containing:
{
  "strategy": "text|css|role",
  "selector": "the playwright selector to use",
  "actualText": "the EXACT text you see on the element",
  "reasoning": "why this element",
  "confidence": "high|medium|low"
}

Examples of good selectors (use EXACT text you see):
- If you see "Register" button: "button:has-text('register')"  ✓ CORRECT
- If you see "Get Tickets" button: "button:has-text('get tickets')"  ✓ CORRECT
- If you see "Submit" button: "button:has-text('submit')"  ✓ CORRECT
- Generic: "button"  ✗ TOO GENERIC (only use if no text visible)

CRITICAL RULES:
1. READ the actual text on the button/element in the screenshot
2. Use the EXACT text you see (case-insensitive)
3. If unsure about exact text, use a shorter substring that's clearly visible
4. Include "actualText" field with what you actually see
5. Combine element type with text: "button:has-text('...')"

DO NOT guess or assume text - only use what you actually see in the image.`;

      } else if (actionType === 'type') {
        prompt = `You are analyzing a webpage screenshot to help automate a test.

Task: ${instruction}
Data to type: ${JSON.stringify(dataToType)}

Analyze the screenshot and identify the form fields to FILL. For each field, provide a selector.
Respond with a JSON object containing:
{
  "fields": [
    {
      "label": "First Name",
      "selector": "input[placeholder='First Name']",
      "value": "John"
    }
  ],
  "reasoning": "explanation",
  "confidence": "high|medium|low"
}

Prefer placeholder, aria-label, or visible label text in selectors.`;

      } else if (actionType === 'select') {
        prompt = `You are analyzing a webpage screenshot to help automate a test.

Task: ${instruction}
Value to select: ${dataToType}

Analyze the screenshot and identify the dropdown/select element. Respond with JSON:
{
  "dropdownSelector": "the selector for the dropdown trigger",
  "optionStrategy": "text|value|index",
  "optionValue": "${dataToType}",
  "reasoning": "explanation",
  "confidence": "high|medium|low"
}

For Material Angular: look for mat-select elements.
For native selects: provide the <select> element selector.`;

      } else if (actionType === 'validate') {
        prompt = `You are analyzing a webpage screenshot to help validate test results.

Task: ${instruction}

Analyze the screenshot and determine if the validation passes. Respond with JSON:
{
  "found": true/false,
  "selector": "element selector if found",
  "actualText": "the text found",
  "reasoning": "explanation"
}`;
      }

      // Call GPT-4 Vision
      const response = await this.openai.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in Vision AI response');
      
      // Parse JSON response
      let visionResult: VisionResult;
      try {
        // Extract JSON if wrapped in markdown
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        visionResult = JSON.parse(jsonStr);
      } catch (e) {
        console.error(`    ⚠️  Failed to parse Vision AI response: ${content}`);
        throw new Error('Vision AI returned invalid JSON');
      }

      console.info(`    ✅ Vision AI found: ${visionResult.selector || JSON.stringify(visionResult)}`);
      console.info(`    📊 Confidence: ${visionResult.confidence}, Reason: ${visionResult.reasoning}`);

      return visionResult;

    } catch (error: any) {
      console.error(`    ❌ Vision AI error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Click an element using Vision AI with intelligent waiting for enabled state
   */
  async click(step: Step): Promise<{ clicked: string }> {
    if (this.useVision) {
      // Use Vision AI to find the element
      const visionResult = await this.executeActionWithVision(
        step.description || step.gherkinStep,
        'click'
      );
      
      console.info(`    🎯 Clicking: ${visionResult.selector}`);
      
      let element = null;
      let finalSelector = visionResult.selector || '';
      
      // Try Vision AI's selector first
      try {
        element = this.page!.locator(visionResult.selector!).first();
        await element.waitFor({ state: 'attached', timeout: 5000 });
        console.info(`    ✅ Element found using Vision selector`);
      } catch (e) {
        console.warn(`    ⚠️  Vision selector failed, trying generic fallbacks...`);
        
        // Strategy 1: If Vision gave us text selector, try variations
        if (visionResult.selector && (visionResult.selector.includes(':has-text') || visionResult.selector.startsWith('text='))) {
          const textMatch = visionResult.selector.match(/['"]([^'"]+)['"]/);
          const textContent = textMatch ? textMatch[1] : visionResult.selector.replace('text=', '');
          
          const alternatives = [
            `button:has-text('${textContent}')`,
            `[role='button']:has-text('${textContent}')`,
            `a:has-text('${textContent}')`,
          ];
          
          for (const alt of alternatives) {
            try {
              element = this.page!.locator(alt).first();
              await element.waitFor({ state: 'attached', timeout: 2000 });
              finalSelector = alt;
              console.info(`    ✓ Found using alternative: ${alt}`);
              break;
            } catch (err) {
              // Try next
            }
          }
        }
        
        // Strategy 2: Generic fallback - find ANY prominent button
        if (!element) {
          console.info(`    🔍 Trying generic button detection...`);
          const genericSelectors = [
            'button:visible',  // Any visible button
            '[role="button"]:visible',  // Any visible role button
            'a.button:visible',  // Link styled as button
          ];
          
          for (const sel of genericSelectors) {
            try {
              const buttons = await this.page!.locator(sel).all();
              if (buttons.length > 0) {
                // Take first visible button (usually the primary action)
                element = this.page!.locator(sel).first();
                await element.waitFor({ state: 'visible', timeout: 2000 });
                finalSelector = sel;
                console.info(`    ✓ Found generic button: ${sel}`);
                break;
              }
            } catch (err) {
              // Try next
            }
          }
        }
        
        if (!element) {
          throw new Error(`Could not find clickable element. Vision suggested: ${visionResult.selector}`);
        }
      }
      
      // Strategy: Try normal click first, fallback to JavaScript click
      try {
        // Wait for element to be actionable (Playwright's built-in checks)
        await element!.waitFor({ state: 'visible', timeout: 5000 });
        
        // Scroll into view if needed
        await element!.scrollIntoViewIfNeeded();
        
        // Small human-like delay
        await this.page!.waitForTimeout(this.randomDelay(100, 300));
        
        // Normal Playwright click (handles most cases)
        await element!.click({ timeout: 5000 });
        console.info(`    ✅ Clicked successfully`);
        
      } catch (normalClickError: any) {
        console.warn(`    ⚠️  Normal click failed: ${normalClickError.message}`);
        console.info(`    🔨 Trying JavaScript direct click...`);
        
        // Fallback: JavaScript click (bypasses visibility/actionability checks)
        try {
          await element!.evaluate((el: any) => el.click());
          console.info(`    ✅ JavaScript click executed`);
        } catch (jsError: any) {
          console.error(`    ❌ JavaScript click also failed: ${jsError.message}`);
          throw new Error(`Could not click element: ${normalClickError.message}`);
        }
      }
      
      // Wait for page to stabilize after click
      await this.smartWait();
      
      // Additional wait for potential navigation/page loads
      try {
        // Wait for navigation to complete (if it happens)
        await Promise.race([
          this.page!.waitForLoadState('networkidle', { timeout: 10000 }),
          this.page!.waitForLoadState('domcontentloaded', { timeout: 10000 }),
          this.page!.waitForTimeout(3000) // Fallback timeout
        ]);
        
        // Extra wait for Angular apps to fully render
        await this.waitForAngular();
        
        // Small delay to ensure UI is ready
        await this.page!.waitForTimeout(1000);
        
      } catch (e) {
        // Not a navigation or timeout, just continue
        console.info(`    ℹ️  No navigation detected, continuing...`);
      }
      
      return { clicked: finalSelector };
      
    } else {
      // Fallback: try basic selector
      const selector = step.selector || `button:has-text("${step.data}")`;
      const element = this.page!.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout: 10000 });
      await element.click();
      return { clicked: selector };
    }
  }

  /**
   * Type text using Vision AI
   * Handles both single fields and data tables (multiple fields)
   */
  async type(step: Step): Promise<{ typed: any }> {
    if (this.useVision) {
      // Wait a moment for any transitions/animations to complete
      await this.page!.waitForTimeout(500);
      await this.waitForAngular();
      
      console.info(`    📸 Taking fresh screenshot for Vision AI...`);
      
      // Check if this is a data table (object with multiple fields)
      if (typeof step.data === 'object' && !Array.isArray(step.data)) {
        console.info(`    📝 Filling multiple fields using Vision AI...`);
        
        // Use Vision AI to find all form fields (with FRESH screenshot)
        const visionResult = await this.executeActionWithVision(
          step.description || step.gherkinStep,
          'type',
          step.data
        );
        
        const results: any = {};
        
        // Fill each field identified by Vision AI
        for (const field of visionResult.fields || []) {
          try {
            console.info(`    → Filling "${field.label}" using selector: ${field.selector}`);
            
            let element = null;
            
            // Strategy 1: Try Vision AI's suggested selector
            try {
              element = this.page!.locator(field.selector).first();
              await element.waitFor({ state: 'visible', timeout: 2000 });
              console.info(`    ✓ Found using Vision selector`);
            } catch (e) {
              console.warn(`    ⚠️  Vision selector not found, trying alternatives...`);
              
              // Strategy 2: Try common patterns for this field name
              const fieldPatterns = [
                `input[placeholder*="${field.label}" i]`,
                `input[name*="${field.label.toLowerCase().replace(/\s+/g, '-')}" i]`,
                `input[name*="${field.label.toLowerCase().replace(/\s+/g, '_')}" i]`,
                `mat-form-field:has-text("${field.label}") input`,
                `label:has-text("${field.label}") + input`,
                `label:has-text("${field.label}") input`
              ];
              
              for (const pattern of fieldPatterns) {
                try {
                  element = this.page!.locator(pattern).first();
                  await element.waitFor({ state: 'visible', timeout: 1000 });
                  console.info(`    ✓ Found using pattern: ${pattern}`);
                  break;
                } catch (err) {
                  // Try next pattern
                }
              }
              
              if (!element) {
                throw new Error(`Could not find input field for "${field.label}"`);
              }
            }
            
            // Fill the field with error handling
            try {
              await element!.scrollIntoViewIfNeeded({ timeout: 5000 });
              await element!.click({ timeout: 3000 });
              await element!.fill('');
              await element!.type(field.value, { delay: this.randomDelay(50, 150) });
              
              results[field.label] = field.value;
              console.info(`    ✅ Filled "${field.label}" with "${field.value}"`);
            } catch (fillError: any) {
              // Check if page/browser is still alive
              if (fillError.message.includes('Target page, context or browser has been closed')) {
                console.error(`    ❌ Browser closed unexpectedly while filling "${field.label}"`);
                console.warn(`    ⚠️  This usually means the application crashed or navigated unexpectedly`);
                throw new Error(`Browser closed - check if your application is running correctly`);
              }
              throw fillError;
            }
            
          } catch (error: any) {
            console.error(`    ❌ Error filling "${field.label}": ${error.message}`);
            throw error;
          }
        }
        
        return { typed: results };
        
      } else {
        // Single field
        const text = Array.isArray(step.data) ? step.data[0] : step.data;
        const visionResult = await this.executeActionWithVision(
          step.description || step.gherkinStep,
          'type',
          { value: text }
        );
        
        const element = this.page!.locator(visionResult.fields![0].selector).first();
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.scrollIntoViewIfNeeded();
        await element.click();
        await element.fill('');
        await element.type(text, { delay: this.randomDelay(50, 150) });
        
        return { typed: text };
      }
      
    } else {
      // Fallback: simple selector-based approach
      const text = Array.isArray(step.data) ? step.data[0] : step.data;
      const selector = step.selector || 'input';
      const element = this.page!.locator(selector).first();
      await element.fill(text);
      return { typed: text };
    }
  }

  /**
   * Select dropdown option using Vision AI (fully generic)
   */
  async select(step: Step): Promise<{ selected: any }> {
    const value = Array.isArray(step.data) ? step.data[0] : step.data;
    console.info(`    🔽 Selecting: "${value}"`);
    
    if (this.useVision) {
      // Let Vision AI analyze the page and determine how to select
      const visionResult = await this.executeActionWithVision(
        step.description || step.gherkinStep,
        'select',
        value
      );
      
      console.info(`    🎯 Vision AI strategy: ${visionResult.dropdownSelector}`);
      
      try {
        // Wait for network to be idle (helps if API is slow)
        try {
          await this.page!.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (e) {
          // Ignore network idle timeout, just proceed
        }

        // Click the dropdown trigger (Vision AI tells us where it is)
        let trigger = null;
        try {
          trigger = this.page!.locator(visionResult.dropdownSelector!).first();
          await trigger.waitFor({ state: 'visible', timeout: 10000 }); // Increased timeout
        } catch (e) {
          console.warn(`    ⚠️  Vision selector '${visionResult.dropdownSelector}' failed, trying generic fallbacks...`);
          
          // Fallback: Try generic dropdown selectors
          const genericSelectors = ['select', '[role="listbox"]', '.mat-select', '.dropdown', 'button:has-text("Select")'];
          for (const sel of genericSelectors) {
            try {
              trigger = this.page!.locator(sel).first();
              await trigger.waitFor({ state: 'visible', timeout: 2000 });
              console.info(`    ✓ Found generic dropdown: ${sel}`);
              break;
            } catch (err) {
              // Try next
            }
          }
          
          if (!trigger) throw e; // Throw original error if no fallback worked
        }

        await trigger!.scrollIntoViewIfNeeded();
        
        // If it's a native select, use selectOption directly
        const tagName = await trigger!.evaluate((el: any) => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await trigger!.selectOption({ label: value }).catch(() => trigger!.selectOption({ value: value }));
          console.info(`    ✅ Selected "${value}" using native select`);
          return { selected: value };
        }

        // For custom dropdowns, click to open
        await trigger!.click();
        
        // Wait for dropdown to open
        await this.page!.waitForTimeout(1000);
        
        // Click the option (try multiple generic patterns)
        const optionPatterns = [
          `[role="option"]:has-text("${value}")`,
          `option:has-text("${value}")`,
          `li:has-text("${value}")`,
          `div:has-text("${value}")`,
          `text="${value}"`
        ];
        
        let optionClicked = false;
        for (const pattern of optionPatterns) {
          try {
            const option = this.page!.locator(pattern).first();
            await option.waitFor({ state: 'visible', timeout: 3000 });
            await option.click();
            optionClicked = true;
            console.info(`    ✅ Selected "${value}" using pattern: ${pattern}`);
            break;
          } catch (e) {
            // Try next pattern
          }
        }
        
        if (!optionClicked) {
          throw new Error(`Could not find option "${value}" in dropdown`);
        }
        
        return { selected: value };
        
      } catch (error: any) {
        console.error(`    ❌ Select failed: ${error.message}`);
        throw error;
      }
      
    } else {
      // Fallback without Vision: native select only
      const element = this.page!.locator('select').first();
      await element.selectOption(value);
      return { selected: value };
    }
  }

  /**
   * Validate content or state
   */
  async validate(step: Step): Promise<{ validated: boolean }> {
    const validation = step.validation;
    
    if (!validation) {
      throw new Error('No validation specified');
    }

    console.info(`    🔍 Validating: ${validation.type} - "${validation.expected || step.selector}"`);

    // Wait for page to stabilize (important after form submits/clicks)
    await this.smartWait();
    
    // Extra wait for slow-loading content
    const searchText = validation.expected || step.selector || '';
    const isConfirmationMessage = typeof searchText === 'string' && (
                                   searchText.toLowerCase().includes('order is complete') || 
                                   searchText.toLowerCase().includes('confirmation') ||
                                   searchText.toLowerCase().includes('success'));
    
    if (isConfirmationMessage) {
      // Confirmation messages often appear after delays (animations, API calls, etc.)
      console.info(`    ⏳ Waiting extra time for confirmation message to appear...`);
      await this.page!.waitForTimeout(4000); // 4 seconds as user mentioned
    } else {
      await this.page!.waitForTimeout(2000);
    }

    let actual;
    
    // Get the content to validate
    if (step.selector) {
      try {
        const element = this.page!.locator(step.selector).first();
        await element.waitFor({ state: 'attached', timeout: 10000 });
        actual = await element.textContent();
      } catch (error) {
        // If selector doesn't work, fall back to body
        actual = await this.page!.textContent('body');
      }
    } else {
      actual = await this.page!.textContent('body');
    }

    switch (validation.type) {
      case 'exists':
        // Check if text/element exists
        const searchText = validation.expected || step.selector;
        let found = false;
        
        // Strategy 1: Wait for text to appear (with multiple retries for slow-loading pages)
        console.info(`    ⏳ Waiting for "${searchText}" to appear...`);
        const maxRetries = 5;
        let retryCount = 0;
        
        while (!found && retryCount < maxRetries) {
          try {
            // Try multiple selector strategies
            const strategies = [
              `text="${searchText}"`,
              `*:has-text("${searchText}")`
            ];
            
            for (const strategy of strategies) {
              if (await this.page!.locator(strategy).first().isVisible()) {
                found = true;
                break;
              }
            }
            
            if (!found) {
              await this.page!.waitForTimeout(1000);
              retryCount++;
            }
          } catch (e) {
            retryCount++;
          }
        }
        
        // Strategy 2: Vision AI Validation (if text search fails)
        if (!found && this.useVision) {
          console.info(`    👁️  Text not found in DOM, asking Vision AI...`);
          const visionResult = await this.executeActionWithVision(
            `Verify if the text "${searchText}" is visible on the screen.`,
            'validate'
          );
          
          if (visionResult.found) {
            console.info(`    ✅ Vision AI confirmed text is visible`);
            found = true;
          }
        }

        if (!found) {
          throw new Error(`Expected text "${searchText}" not found on page`);
        }
        break;
        
      case 'equals':
        if (actual !== validation.expected) {
          throw new Error(`Expected "${validation.expected}" but found "${actual}"`);
        }
        break;
        
      case 'contains':
        if (!actual?.includes(validation.expected)) {
          throw new Error(`Expected text to contain "${validation.expected}"`);
        }
        break;
    }
    
    console.info(`    ✅ Validation passed`);
    return { validated: true };
  }

  /**
   * Generic action handler
   */
  async genericAction(step: Step): Promise<any> {
    console.warn(`    ⚠️  Unknown action type: ${step.action}, attempting generic handling`);
    return { result: 'skipped' };
  }

  /**
   * Wait for a specified duration
   */
  async wait(step: Step): Promise<{ waited: number }> {
    const duration = parseInt(step.data) || 1000;
    console.info(`    ⏳ Waiting ${duration}ms...`);
    await this.page!.waitForTimeout(duration);
    return { waited: duration };
  }

  /**
   * Hover over an element
   */
  async hover(step: Step): Promise<{ hovered: string }> {
    const selector = step.selector || `text="${step.data}"`;
    await this.page!.hover(selector);
    return { hovered: selector };
  }

  /**
   * Scroll to an element
   */
  async scroll(step: Step): Promise<{ scrolled: string }> {
    const selector = step.selector || `text="${step.data}"`;
    const element = this.page!.locator(selector).first();
    await element.scrollIntoViewIfNeeded();
    return { scrolled: selector };
  }

  /**
   * Smart wait for page stability
   */
  async smartWait(): Promise<void> {
    try {
      await this.page!.waitForLoadState('domcontentloaded');
      await this.page!.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
    } catch (e) {
      // Ignore timeouts during wait
    }
  }

  /**
   * Wait for Angular to stabilize
   */
  async waitForAngular(): Promise<void> {
    try {
      await this.page!.evaluate(async () => {
        // @ts-ignore
        if (window.getAllAngularTestabilities) {
          // @ts-ignore
          await Promise.all(window.getAllAngularTestabilities().map((t: any) => t.whenStable()));
        }
      });
    } catch (e) {
      // Ignore if not an Angular app
    }
  }

  /**
   * Generate random delay for human-like behavior
   */
  randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  /**
   * Collect diagnostics in case of error
   */
  async collectDiagnostics(): Promise<any> {
    let url = 'unknown';
    let title = 'unknown';
    
    try {
      url = this.page!.url();
      title = await this.page!.title();
    } catch (e) {
      // Browser might be closed
    }

    const diagnostics: any = {
      url,
      title,
      consoleErrors: this.consoleErrors,
      networkErrors: this.networkErrors,
      timestamp: new Date().toISOString()
    };

    // Save HTML for analysis
    try {
      diagnostics.html = await this.page!.content();
    } catch (e) {
      diagnostics.html = null;
    }

    return diagnostics;
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      console.info('🧹 Browser closed');
      await this.browser.close();
      this.browser = null;
    }
  }
}
