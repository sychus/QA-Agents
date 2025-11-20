import * as Gherkin from '@cucumber/gherkin';
import * as Messages from '@cucumber/messages';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface GherkinAgentConfig {
  cacheDir?: string;
  enableCache?: boolean;
  forceRegenerate?: boolean;
}

interface Step {
  gherkinStep: string;
  action: string;
  selector: string;
  data: any;
  description: string;
  validation?: any;
}

interface Scenario {
  name: string;
  context: string;
  steps: Step[];
}

interface ExecutionPlan {
  feature: string;
  description?: string;
  scenarios: Scenario[];
  type: string;
  metadata: {
    tags: string[];
    language: string;
  };
}

/**
 * GherkinAgent - Parses and interprets Gherkin files
 * Converts business scenarios into executable technical steps
 */
export class GherkinAgent {
  private openai: OpenAI;
  private model: string;
  private parser: any; // Gherkin.Parser requires complex type argument
  private cacheDir: string;
  private enableCache: boolean;
  private forceRegenerate: boolean;

  constructor(config: GherkinAgentConfig = {}) {
    // Configure OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    console.info(`🤖 GherkinAgent using OpenAI with model: ${this.model}`);

    // Configurar parser de Gherkin
    const uuidFn = Messages.IdGenerator.uuid();
    const builder = new Gherkin.AstBuilder(uuidFn);
    const matcher = new Gherkin.GherkinClassicTokenMatcher();
    this.parser = new Gherkin.Parser(builder, matcher);
    
    // Configure cache
    this.cacheDir = config.cacheDir || path.join(process.cwd(), '.features-cache');
    this.enableCache = config.enableCache !== false; // Default: true
    this.forceRegenerate = config.forceRegenerate || false; // Default: false
    
    // Create cache directory if it doesn't exist
    if (this.enableCache && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.info(`📦 Created cache directory: ${this.cacheDir}`);
    }
  }

  /**
   * Parse a Gherkin file and generate execution plan
   * @param {string} featureFilePath - Path to .feature file
   * @returns {Promise<ExecutionPlan>} Structured execution plan
   */
  async parseAndPlan(featureFilePath: string): Promise<ExecutionPlan> {
    console.info(`📖 Parsing Gherkin: ${featureFilePath}`);
    
    const content = fs.readFileSync(featureFilePath, 'utf-8');
    
    // Check cache first (skip if force regenerate is enabled)
    if (this.enableCache && !this.forceRegenerate) {
      const cachedPlan = this.getCachedPlan(featureFilePath, content);
      if (cachedPlan) {
        console.info(`✅ Using cached plan (saved time & API costs!)`);
        // Process dynamic placeholders (runs every time, even with cache)
        this.processDynamicPlaceholders(cachedPlan);
        // Generate Playwright Code even when using cache
        await this.generatePlaywrightCode(cachedPlan, featureFilePath);
        return cachedPlan;
      }
    } else if (this.forceRegenerate) {
      console.info(`🔄 Force regeneration enabled - bypassing cache`);
    }
    
    const gherkinDocument = this.parseGherkinFile(content);
    
    if (!gherkinDocument.feature) {
      throw new Error('No feature found in file');
    }

    // Interpret with AI
    console.info(`🤖 Interpreting with AI (this will be cached)...`);
    const executionPlan = await this.interpretWithAI(gherkinDocument);
    
    const plan: ExecutionPlan = {
      feature: gherkinDocument.feature.name,
      description: gherkinDocument.feature.description,
      scenarios: executionPlan.scenarios,
      type: executionPlan.testType,
      metadata: {
        tags: this.extractTags(gherkinDocument.feature),
        language: gherkinDocument.feature.language || 'en'
      }
    };
    
    // Save to cache (WITHOUT processing placeholders - we want to cache the template)
    if (this.enableCache) {
      this.saveToCache(featureFilePath, content, plan);
    }

    // Process dynamic placeholders AFTER loading from cache (so it runs every time)
    this.processDynamicPlaceholders(plan);

    // Generate Playwright Code
    await this.generatePlaywrightCode(plan, featureFilePath);
    
    return plan;
  }

  /**
   * Process dynamic placeholders in the execution plan
   * Replaces patterns like <email>, <random_email>, {{email}} with generated values
   */
  private processDynamicPlaceholders(plan: ExecutionPlan): void {
    plan.scenarios.forEach(scenario => {
      scenario.steps.forEach(step => {
        // Process data field
        if (step.data) {
          if (typeof step.data === 'string') {
            step.data = this.replacePlaceholder(step.data);
          } else if (typeof step.data === 'object') {
            // Process data tables
            Object.keys(step.data).forEach(key => {
              const field = step.data[key];
              if (field && typeof field === 'object' && field.value) {
                field.value = this.replacePlaceholder(field.value);
              } else if (typeof field === 'string') {
                step.data[key] = this.replacePlaceholder(field);
              }
            });
          }
        }
      });
    });
  }

  /**
   * Replace placeholder with generated value
   */
  private replacePlaceholder(value: string): string {
    // Email patterns: <email>, <random_email>, {{email}}
    const emailPatterns = [/<email>/gi, /<random_email>/gi, /\{\{email\}\}/gi];
    
    for (const pattern of emailPatterns) {
      if (pattern.test(value)) {
        const randomEmail = this.generateRandomEmail();
        console.info(`🎲 Generated random email: ${randomEmail}`);
        return value.replace(pattern, randomEmail);
      }
    }
    
    // Add more patterns here as needed
    // e.g., <random_name>, <timestamp>, etc.
    
    return value;
  }

  /**
   * Generate a random email address
   */
  private generateRandomEmail(): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const domains = ['test.com', 'example.com', 'random.test', 'qa.test'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    
    return `user_${randomStr}_${timestamp}@${domain}`;
  }

  /**
   * Parse Gherkin content using @cucumber/gherkin
   */
  parseGherkinFile(content: string): Messages.GherkinDocument {
    try {
      console.info('🔍 Parsing Gherkin content...');
      const gherkinDocument = this.parser.parse(content);
      
      if (!gherkinDocument || !gherkinDocument.feature) {
        throw new Error('No feature found in Gherkin document');
      }
      
      return gherkinDocument;
    } catch (error: any) {
      console.error('❌ Error parsing Gherkin file:', error);
      throw new Error(`Failed to parse Gherkin: ${error.message}`);
    }
  }

  /**
   * Interpret Gherkin document with AI
   * Converts business steps into technical executable actions
   */
  async interpretWithAI(gherkinDocument: Messages.GherkinDocument): Promise<any> {
    const feature = gherkinDocument.feature!;
    
    const prompt = this.buildInterpretationPrompt(feature);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('No content in OpenAI response');
      
      const interpretation = JSON.parse(content);
      return interpretation;
      
    } catch (error: any) {
      console.error('❌ Error interpreting with AI:', error.message);
      // Fallback: basic interpretation without AI
      return this.basicInterpretation(feature);
    }
  }

  /**
   * Build prompt for AI
   */
  buildInterpretationPrompt(feature: Messages.Feature): string {
    const scenarios: any[] = [];
    
    feature.children
      .filter(child => child.scenario)
      .forEach(child => {
        const scenario = child.scenario!;
        
        // Check if this is a Scenario Outline with Examples
        if (scenario.examples && scenario.examples.length > 0) {
          // Expand each example row into a separate scenario
          scenario.examples.forEach(exampleTable => {
            if (exampleTable.tableHeader && exampleTable.tableBody) {
              const headers = exampleTable.tableHeader.cells.map(cell => cell.value);
              
              exampleTable.tableBody.forEach((row, index) => {
                const values = row.cells.map(cell => cell.value);
                
                // Create a mapping of parameter names to values
                const paramMap: { [key: string]: string } = {};
                headers.forEach((header, i) => {
                  paramMap[header] = values[i];
                });
                
                // Replace placeholders in steps
                const expandedSteps = scenario.steps.map(step => {
                  let expandedText = step.text;
                  
                  // Replace <parameter> placeholders
                  Object.keys(paramMap).forEach(param => {
                    const placeholder = `<${param}>`;
                    expandedText = expandedText.replace(new RegExp(placeholder, 'g'), paramMap[param]);
                  });
                  
                  return {
                    keyword: step.keyword.trim(),
                    text: expandedText,
                    dataTable: step.dataTable
                  };
                });
                
                scenarios.push({
                  name: `${scenario.name} (Example ${index + 1})`,
                  steps: expandedSteps
                });
              });
            }
          });
        } else {
          // Regular scenario without examples
          scenarios.push({
            name: scenario.name,
            steps: scenario.steps.map(step => ({
              keyword: step.keyword.trim(),
              text: step.text,
              dataTable: step.dataTable
            }))
          });
        }
      });

    return `Analyze these Gherkin scenarios and convert them into executable technical steps:

CRITICAL ARCHITECTURE RULES:
1. DO NOT GENERATE HARDCODED SELECTORS - Vision AI will find elements dynamically
2. Leave "selector" field EMPTY ("") for all actions (click, type, select)
3. Only provide clear "description" - Vision AI uses this to understand the intent
4. For data tables, use format: { "fieldName": { "selector": "", "value": "..." } }
5. For validations like "I should see X", set: { "type": "exists", "expected": "X" }

Feature: ${feature.name}
${feature.description || ''}

Scenarios:
${JSON.stringify(scenarios, null, 2)}

Instructions:
1. Determine test type: "web", "salesforce", or "api"
2. For each step, generate:
   - action: type of action (navigate, click, type, select, validate)
   - selector: ALWAYS "" (empty string) - Vision AI will find it
   - data: required data for the step
     * For data tables: { "Field Name": { "selector": "", "value": "actual value" } }
     * For single values: use string directly
     * For navigate: full URL or path
   - validation: what to validate (if applicable)
     * For "I should see X": { "type": "exists", "expected": "X" }
     * For "I should see a Y": { "type": "exists", "expected": true }
     * For contains: { "type": "contains", "expected": "text to contain" }
   - description: clear, actionable description for Vision AI to understand
3. Identify context (Angular app, Salesforce UI, API)

EXAMPLES:

Gherkin: When I click on the "Register" button
Output: {
  "action": "click",
  "selector": "",
  "data": null,
  "validation": null,
  "description": "Click on the Register button"
}

Gherkin: Then I should see "Contact Information"
Output: {
  "action": "validate",
  "selector": "",
  "data": null,
  "validation": { "type": "exists", "expected": "Contact Information" },
  "description": "Validate that Contact Information text is visible"
}

Gherkin: And I fill the form:
  | First Name | John |
  | Email      | john@email.com |
Output: {
  "action": "type",
  "selector": "",
  "data": {
    "First Name": { "selector": "", "value": "John" },
    "Email": { "selector": "", "value": "john@email.com" }
  },
  "validation": null,
  "description": "Fill form with First Name and Email"
}

Respond in JSON with this structure:
{
  "testType": "web|salesforce|api",
  "scenarios": [
    {
      "name": "scenario name",
      "context": "specific context",
      "steps": [
        {
          "gherkinStep": "original Given/When/Then",
          "action": "navigate|click|type|select|validate",
          "selector": "",
          "data": "data if applicable",
          "validation": { "type": "exists|equals|contains", "expected": "the actual text to find" },
          "description": "clear description for Vision AI"
        }
      ]
    }
  ]
}`;
  }

  /**
   * System prompt for the agent
   */
  getSystemPrompt(): string {
    return `You are a QA and test automation expert. You analyze Gherkin scenarios written in natural language English and convert them into executable technical steps.

ARCHITECTURE: This system uses Vision AI to find elements dynamically. Your role is to:
1. Parse Gherkin into structured actions
2. Extract business intent (NO technical selectors)
3. Let Vision AI handle element location

Contexts you handle:
- Web Applications (Angular, React, Vue, etc.)
- Backend Applications (Node.js)
- Salesforce (Apex, SOQL, Lightning Web Components, Flows)
- REST APIs

Conventions:
- Given: setup/preparation
- When: main action
- Then: validation/assert
- And/But: continuation of previous step

CRITICAL RULES:
1. NEVER generate hardcoded selectors (data-testid, id, CSS, XPath)
2. Always set "selector": "" (empty string) - Vision AI will find it
3. For "I should see X" validations: "expected": "X" (the actual text, not true/false)
4. Focus on clear "description" field - Vision AI reads this
5. Extract data values accurately from Gherkin tables

For Salesforce:
- Detect API names of objects and fields
- Identify operations (insert, update, query, delete)
- Recognize Lightning components
- Identify governor limits (e.g., aggregate queries)

Always respond in valid, structured JSON.`;
  }

  /**
   * Basic interpretation without AI (fallback)
   */
  basicInterpretation(feature: Messages.Feature): any {
    const scenarios = feature.children
      .filter(child => child.scenario)
      .map(child => {
        const scenario = child.scenario!;
        return {
          name: scenario.name,
          context: 'web',
          steps: scenario.steps.map(step => {
            const action = this.guessAction(step.keyword, step.text);
            const selector = this.guessSelector(step.text);
            const data = this.extractData(step.text);
            
            return {
              gherkinStep: `${step.keyword}${step.text}`,
              action: action,
              selector: selector,
              data: data,
              description: step.text
            };
          })
        };
      });

    return {
      testType: 'web',
      scenarios: scenarios
    };
  }

  /**
   * Guess action based on common keywords
   */
  guessAction(keyword: string, text: string): string {
    const lowerText = text.toLowerCase();
    
    if (keyword.trim() === 'Given') {
      if (lowerText.includes('navig') || lowerText.includes('visit') || lowerText.includes('open'))
        return 'navigate';
      return 'setup';
    }
    
    if (keyword.trim() === 'When') {
      if (lowerText.includes('click') || lowerText.includes('press'))
        return 'click';
      if (lowerText.includes('type') || lowerText.includes('enter') || lowerText.includes('fill'))
        return 'type';
      if (lowerText.includes('select'))
        return 'select';
      return 'action';
    }
    
    if (keyword.trim() === 'Then') {
      return 'validate';
    }
    
    return 'action';
  }

  /**
   * Try to extract a selector from text
   */
  guessSelector(text: string): string | null {
    // Look for words in quotes (including paths and URLs)
    const quoted = text.match(/"([^"]+)"/);
    if (quoted) return quoted[1];
    
    const singleQuoted = text.match(/'([^']+)'/);
    if (singleQuoted) return singleQuoted[1];
    
    // Check if text contains a path or URL pattern
    const urlPattern = text.match(/(https?:\/\/[^\s]+|\/[^\s]+)/);
    if (urlPattern) return urlPattern[1];
    
    return null;
  }

  /**
   * Extract data from text (values in quotes)
   */
  extractData(text: string): any {
    // First try to extract quoted strings
    const matches = text.match(/"([^"]+)"|'([^']+)'/g);
    if (matches) {
      return matches.map(m => m.replace(/['"]/g, ''));
    }
    
    // If no quotes, try to extract URLs or paths
    const urlPattern = text.match(/(https?:\/\/[^\s]+|\/[a-zA-Z0-9/_-]+)/);
    if (urlPattern) {
      return urlPattern[1];
    }
    
    return null;
  }

  /**
   * Extract tags from feature
   */
  extractTags(feature: Messages.Feature): string[] {
    return feature.tags ? feature.tags.map(tag => tag.name) : [];
  }

  /**
   * Validate that an execution plan is valid
   */
  validatePlan(plan: ExecutionPlan): { valid: boolean; error?: string } {
    if (!plan.scenarios || plan.scenarios.length === 0) {
      return { valid: false, error: 'No scenarios found' };
    }

    for (const scenario of plan.scenarios) {
      if (!scenario.steps || scenario.steps.length === 0) {
        return { 
          valid: false, 
          error: `Scenario "${scenario.name}" has no steps` 
        };
      }
    }

    return { valid: true };
  }

  /**
   * Generate hash for content (to detect changes)
   */
  generateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get cache file path for a feature file
   */
  getCacheFilePath(featureFilePath: string): string {
    const filename = path.basename(featureFilePath, '.feature');
    return path.join(this.cacheDir, `${filename}.cache.json`);
  }

  /**
   * Get cached plan if available and valid
   */
  getCachedPlan(featureFilePath: string, content: string): ExecutionPlan | null {
    try {
      const cacheFile = this.getCacheFilePath(featureFilePath);
      
      if (!fs.existsSync(cacheFile)) {
        return null;
      }

      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const currentHash = this.generateHash(content);

      // Check if content has changed
      if (cached.contentHash !== currentHash) {
        console.info(`📝 Feature file changed, cache invalidated`);
        return null;
      }

      // Check cache age (optional: invalidate after 7 days)
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (cacheAge > maxAge) {
        console.info(`⏰ Cache expired (older than 7 days)`);
        return null;
      }

      return cached.plan;
    } catch (error: any) {
      console.info(`⚠️  Error reading cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Save plan to cache
   */
  saveToCache(featureFilePath: string, content: string, plan: ExecutionPlan): void {
    try {
      const cacheFile = this.getCacheFilePath(featureFilePath);
      const contentHash = this.generateHash(content);

      const cacheData = {
        featureFile: path.basename(featureFilePath),
        contentHash: contentHash,
        timestamp: new Date().toISOString(),
        plan: plan
      };

      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      console.info(`💾 Cached plan saved to: ${path.basename(cacheFile)}`);
    } catch (error: any) {
      console.warn(`⚠️  Error saving cache: ${error.message}`);
    }
  }

  /**
   * Clear all cached plans
   */
  clearCache(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        files.forEach(file => {
          if (file.endsWith('.cache.json')) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        });
        console.info(`🗑️  Cache cleared (${files.length} files removed)`);
      }
    } catch (error: any) {
      console.warn(`⚠️  Error clearing cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { count: number; totalSize: number; totalSizeKB?: string; error?: string } {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return { count: 0, totalSize: 0 };
      }

      const files = fs.readdirSync(this.cacheDir)
        .filter(file => file.endsWith('.cache.json'));

      let totalSize = 0;
      files.forEach(file => {
        const stats = fs.statSync(path.join(this.cacheDir, file));
        totalSize += stats.size;
      });

      return {
        count: files.length,
        totalSize: totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2)
      };
    } catch (error: any) {
      return { count: 0, totalSize: 0, error: error.message };
    }
  }
  /**
   * Generate Playwright test code from execution plan
   */
  async generatePlaywrightCode(plan: ExecutionPlan, featureFilePath: string): Promise<void> {
    try {
      const featureName = path.basename(featureFilePath, '.feature');
      // Save in the same cache directory as the feature cache
      const testDir = this.cacheDir;
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const testFilePath = path.join(testDir, `${featureName}.spec.js`);
      
      let code = `/**
 * 🤖 GENERATED PLAYWRIGHT TEST
 * Feature: ${plan.feature}
 * Generated by: QA Agents System
 * Date: ${new Date().toISOString()}
 */

const { test, expect } = require('@playwright/test');
const WebExecutorAgent = require('../../../src/agents/WebExecutorAgent');

test.describe('${plan.feature.replace(/'/g, "\\'")}', () => {
  let agent;

  test.beforeAll(async () => {
    agent = new WebExecutorAgent();
    await agent.initialize();
  });

  test.afterAll(async () => {
    await agent.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    // Sync Playwright page with Agent
    agent.page = page;
  });
`;

      for (const scenario of plan.scenarios) {
        code += `
  test('${scenario.name.replace(/'/g, "\\'")}', async () => {
    console.log('📝 Starting Scenario: ${scenario.name}');
`;

        for (const step of scenario.steps) {
          // Serialize step data safely
          const stepJson = JSON.stringify(step).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          
          code += `
    // ${step.gherkinStep}
    await agent.executeStep(JSON.parse('${stepJson}'), 0);
`;
        }

        code += `  });\n`;
      }

      code += `});\n`;

      fs.writeFileSync(testFilePath, code);
      console.info(`💾 Generated Playwright test: ${testFilePath}`);

    } catch (error: any) {
      console.error(`❌ Error generating Playwright code: ${error.message}`);
    }
  }
}
