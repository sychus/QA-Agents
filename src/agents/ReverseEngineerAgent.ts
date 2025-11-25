import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';

interface ReverseEngineerConfig {
  preserveStructure?: boolean;
  forceRegeneration?: boolean;
}

interface MigrationCacheEntry {
  hash: string;
  processedAt: string;
  generatedFiles: string[];
}

interface MigrationCache {
  [sourceFile: string]: MigrationCacheEntry;
}

interface TestStructure {
  describeBlock: string;
  tests: TestCase[];
  imports: string[];
  helpers: string[];
}

interface TestCase {
  name: string;
  tags: string[];
  code: string;
  lineNumber: number;
}

interface GherkinScenario {
  name: string;
  tags: string[];
  steps: string[];
  isOutline?: boolean;
  examples?: {
    headers: string[];
    rows: string[][];
  };
}

interface GherkinFeature {
  name: string;
  description: string;
  scenarios: GherkinScenario[];
}

/**
 * ReverseEngineerAgent - Converts Playwright tests to Gherkin features
 * Uses AI to infer business intent from technical test code
 */
export class ReverseEngineerAgent {
  private openai: OpenAI;
  private model: string;
  private preserveStructure: boolean;
  private cacheFilePath: string;
  private forceRegeneration: boolean;

  constructor(config: ReverseEngineerConfig = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.preserveStructure = config.preserveStructure !== false;
    this.cacheFilePath = path.join(process.cwd(), 'migrate', '.migrate-cache.json');
    this.forceRegeneration = config.forceRegeneration || false;
    
    console.info(`🔄 ReverseEngineerAgent initialized with model: ${this.model}`);
    if (this.forceRegeneration) {
      console.info(`⚡ Force regeneration mode enabled`);
    }
  }

  /**
   * Load cache from disk
   */
  private loadCache(): MigrationCache {
    if (!fs.existsSync(this.cacheFilePath)) {
      return {};
    }
    try {
      const content = fs.readFileSync(this.cacheFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️  Failed to load cache, starting fresh`);
      return {};
    }
  }

  /**
   * Save cache to disk
   */
  private saveCache(cache: MigrationCache): void {
    try {
      const dir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 2));
    } catch (error: any) {
      console.warn(`⚠️  Failed to save cache: ${error.message}`);
    }
  }

  /**
   * Calculate file hash using SHA-256
   */
  private calculateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if file needs processing
   */
  private needsProcessing(filePath: string, cache: MigrationCache): boolean {
    if (this.forceRegeneration) {
      return true; // Force mode: always process
    }

    const fileName = path.basename(filePath);
    const cacheEntry = cache[fileName];

    if (!cacheEntry) {
      return true; // Not in cache: needs processing
    }

    const currentHash = this.calculateFileHash(filePath);
    if (currentHash !== cacheEntry.hash) {
      return true; // File changed: needs processing
    }

    return false; // File unchanged: skip
  }

  /**
   * Update cache after processing
   */
  private updateCache(
    sourceFile: string,
    generatedFiles: string[],
    cache: MigrationCache
  ): void {
    const fileName = path.basename(sourceFile);
    const hash = this.calculateFileHash(sourceFile);

    cache[fileName] = {
      hash,
      processedAt: new Date().toISOString(),
      generatedFiles
    };

    this.saveCache(cache);
  }


  /**
   * Process a single Playwright file
   */
  async processFile(
    playwrightFile: string,
    outputDir: string,
    cache?: MigrationCache
  ): Promise<string[]> {
    const loadedCache = cache || this.loadCache();
    
    // Check if processing is needed
    if (!this.needsProcessing(playwrightFile, loadedCache)) {
      console.info(`⏭️  Skipping ${path.basename(playwrightFile)} (unchanged)`);
      return [];
    }
    
    console.info(`\n📖 Processing: ${path.basename(playwrightFile)}`);
    
    const generatedFiles: string[] = [];
    
    try {
      // 1. Parse the Playwright file
      const structure = await this.parsePlaywrightFile(playwrightFile);
      
      // 2. Infer Gherkin from test structure
      const feature = await this.inferGherkinFeature(structure, playwrightFile);
      
      // 3. Write Gherkin files and track generated files
      const files = await this.writeGherkinFiles(feature, playwrightFile, outputDir);
      generatedFiles.push(...files);
      
      // 4. Update cache
      this.updateCache(playwrightFile, generatedFiles, loadedCache);
      
      console.info(`✅ Successfully converted ${path.basename(playwrightFile)}`);
      return generatedFiles;
    } catch (error: any) {
      console.error(`❌ Error processing ${playwrightFile}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a directory recursively
   */
  async processDirectory(inputDir: string, outputDir: string): Promise<void> {
    console.info(`\n📂 Processing directory: ${inputDir}`);
    
    const files = this.findPlaywrightFiles(inputDir);
    
    if (files.length === 0) {
      console.warn(`⚠️  No Playwright test files found in ${inputDir}`);
      return;
    }
    
    console.info(`Found ${files.length} Playwright test file(s)\n`);
    
    // Load cache once
    const cache = this.loadCache();
    let processed = 0;
    let skipped = 0;
    
    for (const file of files) {
      const generatedFiles = await this.processFile(file, outputDir, cache);
      if (generatedFiles.length > 0) {
        processed++;
      } else {
        skipped++;
      }
    }
    
    console.info(`\n📊 Summary: ${processed} processed, ${skipped} skipped`);
  }

  /**
   * Find all Playwright test files in a directory
   */
  private findPlaywrightFiles(dir: string): string[] {
    const files: string[] = [];
    
    const traverse = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            traverse(fullPath);
          }
        } else if (entry.isFile()) {
          // Match .spec.ts, .spec.js, .test.ts, .test.js
          if (/\.(spec|test)\.(ts|js)$/.test(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    traverse(dir);
    return files;
  }

  /**
   * Parse Playwright file and extract test structure
   */
  private async parsePlaywrightFile(filePath: string): Promise<TestStructure> {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.extractTestStructureRegex(content);
  }

  /**
   * Extract test structure using regex
   */
  private extractTestStructureRegex(content: string): TestStructure {
    const structure: TestStructure = {
      describeBlock: '',
      tests: [],
      imports: [],
      helpers: []
    };
    
    const lines = content.split('\n');
    structure.imports = lines.filter(line => line.trim().startsWith('import'));
    
    const describeMatch = content.match(/test\.describe\(['"](.*?)['"]/);
    if (describeMatch) {
      structure.describeBlock = describeMatch[1];
    }
    
    const testRegex = /test\(['"](.*?)['"],\s*async\s*\(\{?\s*page\s*\}?\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/g;
    let match;
    
    while ((match = testRegex.exec(content)) !== null) {
      structure.tests.push({
        name: match[1],
        tags: this.extractTags(match[1]),
        code: match[2],
        lineNumber: 0
      });
    }
    
    return structure;
  }

  /**
   * Extract tags from test name
   */
  private extractTags(testName: string): string[] {
    const tags: string[] = [];
    const tagRegex = /\[([^\]]+)\]/g;
    let match;
    
    while ((match = tagRegex.exec(testName)) !== null) {
      tags.push(`@${match[1].replace(/[:\s]/g, '-').toLowerCase()}`);
    }
    
    return tags;
  }

  /**
   * Use AI to infer Gherkin feature from test structure
   */
  private async inferGherkinFeature(structure: TestStructure, filePath: string): Promise<GherkinFeature> {
    console.info(`🤖 Using AI to infer Gherkin scenarios...`);
    
    const prompt = this.buildInferencePrompt(structure, filePath);
    
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
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      const content = completion.choices[0].message.content;
      if (!content) throw new Error('No content in AI response');
      
      const result = JSON.parse(content);
      return result as GherkinFeature;
    } catch (error: any) {
      console.error(`❌ AI inference failed: ${error.message}`);
      // Fallback to basic conversion
      return this.basicConversion(structure);
    }
  }

  /**
   * Build prompt for AI inference
   */
  private buildInferencePrompt(structure: TestStructure, filePath: string): string {
    return `Convert this Playwright test file into detailed Gherkin format with specific field data.

File: ${path.basename(filePath)}
Describe Block: ${structure.describeBlock}

Tests (${structure.tests.length}):
${structure.tests.map((test, i) => `
Test ${i + 1}: ${test.name}
Tags: ${test.tags.join(', ') || 'none'}
Code:
${test.code}
`).join('\n---\n')}

CRITICAL INSTRUCTIONS:

1. **Extract ALL specific field data** from method calls:
   - fillAttendeeInfo(0, "John", "Doe", "john@example.com") → Create data table with First Name, Last Name, Email
   - fillPaymentForm({ cardNumber: "4111...", cardholderName: "John Doe", ... }) → Extract ALL payment fields
   - navigateToEvent("http://localhost:4200/event/123") → Include full URL

2. **Create Scenario Outlines when appropriate**:
   - If test has multiple data sets or could be parametrized, use Scenario Outline
   - Add "isOutline": true to the scenario
   - Include "examples" with headers and rows
   - Use <parameter_name> placeholders in steps

3. **Generate multiple scenarios for different paths**:
   - @happy-path: Successful flow with valid data
   - @error-case: Validation failures, error messages
   - @edge-case: Boundary conditions, special cases

4. **Preserve exact validation text**:
   - page.getByText("Thank you for registering Barrett Powell!") → 'Then I should see the message "Thank you for registering Barrett Powell!"'
   - Include button colors, positions, exact wording

5. **Example conversions**:
   BAD:  "And I fill attendee information"
   GOOD: "And I fill the following attendee information:\n    | Field      | Value              |\n    | First Name | John               |\n    | Last Name  | Doe                |\n    | Email      | john@example.com   |"

   BAD:  "When I fill payment form"
   GOOD: "When I fill the following payment information:\n    | Field           | Value              |\n    | Card Number     | 4111111111111111   |\n    | Cardholder Name | John Doe           |\n    | Expiry Date     | 12/2025            |\n    | CVV             | 123                |"

Respond in JSON format:
{
  "name": "Feature name",
  "description": "Feature description (2-3 lines)",
  "scenarios": [
    {
      "name": "Scenario name",
      "tags": ["@happy-path"],
      "isOutline": false,
      "steps": [
        "Given I navigate to the event page",
        "When I fill the following attendee information:",
        "  | Field      | Value            |",
        "  | First Name | John             |",
        "  | Last Name  | Doe              |",
        "  | Email      | john@example.com |",
        "And I click on the \"Submit\" button",
        "Then I should see the message \"Registration successful\""
      ]
    },
    {
      "name": "Scenario Outline name",
      "tags": ["@happy-path"],
      "isOutline": true,
      "steps": [
        "Given I navigate to \"<url>\"",
        "When I fill \"<first_name>\" in First Name field",
        "Then I should see \"<expected_message>\""
      ],
      "examples": {
        "headers": ["url", "first_name", "expected_message"],
        "rows": [
          ["http://localhost:4200/event/1", "John", "Thank you John"],
          ["http://localhost:4200/event/2", "Jane", "Thank you Jane"]
        ]
      }
    }
  ]
}`;
  }

  /**
   * System prompt for AI
   */
  private getSystemPrompt(): string {
    return `You are an expert QA engineer specializing in converting technical test code into business-readable Gherkin scenarios.

Your task is to analyze Playwright test code and infer the business intent behind each action. You should:

1. **Extract specific field data**: When you see method calls with parameters (e.g., fillAttendeeInfo("John", "Doe", "john@example.com")), extract ALL field names and values:
   - GOOD: "And I fill the following attendee information:\n  | First Name | John |\n  | Last Name | Doe |\n  | Email | john@example.com |"
   - BAD: "And I fill attendee information"

2. **Create Scenario Outlines for parametrized data**: When you see multiple similar tests or data sets, create Scenario Outlines with Examples tables:
   - Use "<parameter_name>" placeholders in steps
   - Create Examples table with headers and data rows
   - Include @happy-path, @error-case, or @edge-case tags

3. **Generate multiple scenarios per test**: Identify different test paths:
   - Happy path: Successful flow with valid data
   - Error cases: Invalid data, validation failures
   - Edge cases: Boundary conditions, special scenarios

4. **Preserve exact validation messages**: Include specific text from assertions:
   - GOOD: 'Then I should see the message "Thank you for registering Barrett Powell!"'
   - BAD: 'Then I should see success message'

5. **Include UI element details**: Describe buttons, fields, and elements specifically:
   - GOOD: 'And I should see a red button with the text "Cancel Registration"'
   - BAD: 'And I should see a button'

6. **Extract URLs and specific values**: Include full URLs, credit card test data, etc.

7. **Follow Gherkin best practices**:
   - Given: Setup and preconditions
   - When: Actions performed by the user
   - Then: Expected outcomes and validations
   - And/But: Continuation of previous step type

Always respond with valid JSON matching the requested structure.`;
  }

  /**
   * Basic conversion fallback (no AI)
   */
  private basicConversion(structure: TestStructure): GherkinFeature {
    return {
      name: structure.describeBlock || 'Converted Feature',
      description: 'Automatically converted from Playwright tests',
      scenarios: structure.tests.map(test => ({
        name: test.name.replace(/\[.*?\]/g, '').trim(),
        tags: test.tags,
        steps: [
          'Given the test environment is set up',
          'When the test actions are performed',
          'Then the test assertions should pass'
        ]
      }))
    };
  }

  /**
   * Write Gherkin files to output directory
   */
  private async writeGherkinFiles(
    feature: GherkinFeature,
    sourceFile: string,
    outputDir: string
  ): Promise<string[]> {
    const generatedFiles: string[] = [];
    
    // Determine output directory structure
    const baseName = path.basename(sourceFile, path.extname(sourceFile));
    const featureDir = this.preserveStructure
      ? path.join(outputDir, baseName.replace(/\.spec$|\.test$/, ''))
      : outputDir;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(featureDir)) {
      fs.mkdirSync(featureDir, { recursive: true });
    }
    
    // Write each scenario as a separate feature file
    for (let i = 0; i < feature.scenarios.length; i++) {
      const scenario = feature.scenarios[i];
      const fileName = this.sanitizeFileName(scenario.name);
      const featureFile = path.join(featureDir, `${fileName}.feature`);
      
      const gherkinContent = this.formatGherkin(feature, scenario);
      
      fs.writeFileSync(featureFile, gherkinContent);
      generatedFiles.push(path.relative(process.cwd(), featureFile));
      console.info(`  📝 Created: ${path.relative(process.cwd(), featureFile)}`);
    }
    
    return generatedFiles;
  }

  /**
   * Format Gherkin content
   */
  private formatGherkin(feature: GherkinFeature, scenario: GherkinScenario): string {
    const lines: string[] = [];
    
    // Auto-generation comment
    const generationDate = new Date().toISOString();
    lines.push(`# 🤖 Auto-generated from Playwright test`);
    lines.push(`# Generated on: ${generationDate}`);
    lines.push('');
    
    // Feature header
    lines.push(`Feature: ${feature.name}`);
    if (feature.description) {
      lines.push(`  ${feature.description.split('\n').join('\n  ')}`);
    }
    lines.push('');
    
    // Tags
    if (scenario.tags.length > 0) {
      lines.push(scenario.tags.join(' '));
    }
    
    // Scenario or Scenario Outline
    const scenarioKeyword = scenario.isOutline ? 'Scenario Outline' : 'Scenario';
    lines.push(`${scenarioKeyword}: ${scenario.name}`);
    
    // Steps
    scenario.steps.forEach(step => {
      lines.push(`  ${step}`);
    });
    
    // Examples table (for Scenario Outlines)
    if (scenario.isOutline && scenario.examples) {
      lines.push('');
      lines.push('  Examples:');
      
      // Format headers
      const headers = scenario.examples.headers;
      const headerRow = '    | ' + headers.join(' | ') + ' |';
      lines.push(headerRow);
      
      // Format data rows
      scenario.examples.rows.forEach(row => {
        const dataRow = '    | ' + row.join(' | ') + ' |';
        lines.push(dataRow);
      });
    }
    
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\[.*?\]/g, '') // Remove tags
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .substring(0, 50); // Limit length
  }
}
