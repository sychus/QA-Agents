# 🏗️ QA Agents Architecture

## Overview

The QA Agents system is a **vision-driven, self-adapting test automation framework** that separates business intent from technical implementation. Unlike traditional test automation frameworks that rely on brittle selectors and hardcoded logic, this architecture leverages **AI Vision** to dynamically understand and interact with web applications.

### Core Philosophy

**"Let AI understand the UI, keep code generic."**

The system operates on three fundamental principles:

1. **Business Logic Separation**: Tests are written in pure business language (Gherkin), completely free of technical implementation details.

2. **Dynamic Element Discovery**: Instead of hardcoding CSS selectors or XPath expressions, the system uses Vision AI to analyze screenshots and identify elements contextually.

3. **Universal Reusability**: The same execution engine works across different web applications, frameworks, and UI patterns without modification.

---

## Design Principles

### ✅ **Generic & Reusable**

The `WebExecutorAgent` is a **pure abstraction layer** over browser automation. It contains:
- **Zero business logic** - no application-specific code
- **No hardcoded selectors** - no CSS, XPath, or data-testid assumptions
- **No framework dependencies** - works with Angular, React, Vue, or vanilla HTML
- **Universal applicability** - the same codebase tests any web application

This design ensures that adding support for a new application requires **zero code changes** - only new Gherkin feature files.

### 🧠 **Vision AI as the Intelligence Layer**

Traditional test automation suffers from **selector brittleness**: when UI changes, tests break. This architecture solves this by making Vision AI the **single source of truth** for element identification.

**How it works:**
- Before each interaction, the system captures a screenshot of the current page state
- Vision AI analyzes the screenshot and understands the visual context
- It identifies elements based on their appearance, position, and semantic meaning
- Returns appropriate selectors dynamically, adapting to UI changes automatically

**Benefits:**
- **Self-healing tests**: UI refactoring doesn't break tests
- **Zero maintenance**: No selector updates needed when UI changes
- **Context-aware**: Understands relationships between elements visually

### 📝 **Gherkin as Pure Business Language**

Gherkin feature files serve as **executable specifications** written in business language. They describe **what** should happen, not **how** it's implemented.

**Key characteristics:**
- **No technical details**: No CSS selectors, waits, or framework-specific code
- **Business vocabulary**: Uses domain language that stakeholders understand
- **Implementation-agnostic**: Same Gherkin works regardless of underlying technology

This separation enables:
- **Non-technical stakeholders** to read and validate tests
- **Business analysts** to write tests directly
- **Documentation** that doubles as executable specifications

---

## Architectural Flow

The system follows a **layered architecture** where each layer has a single, well-defined responsibility:

```
                    ┌─────────────────────────────────────┐
                    │   Legacy Playwright Tests           │
                    │   (Optional Migration Path)         │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │   ReverseEngineerAgent              │
                    │   (AI-powered migration)            │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Layer                           │
│              (Gherkin Feature Files)                        │
│                                                             │
│   Purpose: Express business intent in natural language     │
│   Format: Given/When/Then steps                            │
│   Example: "When I click on the Register button"          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Interpretation Layer                     │
│                    (GherkinAgent)                           │
│                                                             │
│   Purpose: Parse business language → structured plan       │
│   Responsibilities:                                         │
│   - Parse Gherkin syntax                                    │
│   - Extract scenarios and steps                             │
│   - Convert to generic execution plan                       │
│   - Cache results for performance                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Execution Layer                          │
│                (WebExecutorAgent)                           │
│                                                             │
│   Purpose: Execute generic actions on any web application   │
│   Responsibilities:                                         │
│   - Coordinate with Vision AI                                │
│   - Execute browser actions (click, type, select)          │
│   - Handle timing and synchronization                       │
│   - Collect diagnostics on failures                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Intelligence Layer                       │
│                    (Vision AI - GPT-4o)                     │
│                                                             │
│   Purpose: Understand UI context and identify elements    │
│   Process:                                                  │
│   1. Capture screenshot of current page state              │
│   2. Analyze visual structure and layout                   │
│   3. Identify target elements by appearance                │
│   4. Return appropriate selectors                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Automation Layer                         │
│                    (Playwright)                             │
│                                                             │
│   Purpose: Execute actions on real browser                  │
│   Responsibilities:                                         │
│   - Browser control and navigation                         │
│   - Element interaction (click, type, select)              │
│   - Wait strategies and synchronization                    │
│   - Screenshot capture for diagnostics                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. **Gherkin Feature Files** (Business Layer)

Gherkin files are **executable specifications** written in natural language. They describe test scenarios using the Given/When/Then format, focusing on **business outcomes** rather than technical implementation.

**Characteristics:**
- **Language**: Business domain vocabulary
- **Format**: Standard Gherkin syntax (Given/When/Then/And/But)
- **Content**: User actions and expected outcomes
- **Abstraction**: No technical details (selectors, waits, frameworks)

**Example:**
```gherkin
Feature: Purchase free ticket in Events webapp
  As an event attendee
  I want to register for a free ticket
  So that I can attend the event

  Scenario: Successfully register for a free event ticket
    Given I navigate to the event overview page
    When I click on the "REGISTER" button
    And I select 1 ticket from the quantity selector
    And I fill the attendee information:
      | First Name | John               |
      | Last Name  | Doe                |
      | Email      | john.doe@email.com |
    And I submit the registration form
    Then I should see "Contact Information"
    And I complete the purchase
    Then I should see "your order is complete"
```

**What makes this good:**
- ✅ Uses business language ("register for ticket", "complete purchase")
- ✅ No technical details (no URLs, selectors, waits)
- ✅ Readable by non-technical stakeholders
- ✅ Describes user journey, not implementation

---

### 2. **GherkinAgent** (Interpretation Layer)

The `GherkinAgent` is responsible for **parsing and interpreting** Gherkin feature files into executable test plans. It acts as a **translator** between business language and technical execution.

**Responsibilities:**
- **Parse Gherkin syntax** using `@cucumber/gherkin` library
- **Extract structured data** (scenarios, steps, data tables)
- **Interpret business intent** using AI to understand context
- **Generate execution plan** with generic actions (click, type, select, validate)
- **Cache results** to avoid re-parsing and reduce API costs

**Key characteristics:**
- **No framework assumptions**: Doesn't know about Material, Bootstrap, etc.
- **No selector generation**: Leaves selectors empty - Vision AI will find them
- **Context-aware**: Understands business context (e.g., "registration form" vs "login form")
- **Caching**: Stores parsed plans to improve performance

**Output format:**
```json
{
  "action": "click",
  "selector": "",
  "description": "Click on the Register button",
  "data": null,
  "validation": null
}
```

Notice: `selector` is empty - Vision AI will determine it dynamically.

---

### 3. **WebExecutorAgent** (Execution Layer)

The `WebExecutorAgent` is a **generic browser automation wrapper** that executes actions on any web application. It contains **zero application-specific logic**.

**Core responsibilities:**
- **Execute generic actions**: click, type, select, validate, navigate
- **Coordinate with Vision AI**: Request element identification when needed
- **Handle browser automation**: Manage Playwright browser instances
- **Provide fallback strategies**: Multiple ways to find/interact with elements
- **Collect diagnostics**: Capture screenshots and error details on failures

**Key methods:**

#### `click(step)`
Executes a click action on an element identified by Vision AI.

**Process:**
1. Request Vision AI to identify the clickable element
2. Try Vision AI's suggested selector
3. Fallback to alternative selectors if needed
4. Wait for element to be actionable
5. Execute click (normal or JavaScript fallback)

#### `type(step)`
Fills form fields with provided data.

**Process:**
1. Wait for page to stabilize
2. Capture fresh screenshot
3. Request Vision AI to identify form fields
4. For each field: try Vision selector, fallback to label/placeholder matching
5. Fill field with appropriate value

#### `select(step)`
Selects an option from a dropdown.

**Process:**
1. Request Vision AI to identify dropdown type
2. Click dropdown trigger
3. Wait for options to appear
4. Select option by visible text

#### `validate(step)`
Validates that expected content exists on the page.

**Process:**
1. Wait for page to stabilize
2. Search for expected text using multiple strategies
3. Retry with increasing timeouts for slow-loading content
4. Provide detailed error messages if not found

**What it does NOT contain:**
- ❌ Framework-specific code (Material Angular, Bootstrap)
- ❌ Application-specific selectors
- ❌ Hardcoded UI patterns
- ❌ Business logic

---

### 4. **Vision AI Integration** (Intelligence Layer)

Vision AI serves as the **intelligence layer** that understands UI context and identifies elements dynamically. It uses **GPT-4o Vision** to analyze screenshots and provide actionable selectors.

**How it works:**

1. **Screenshot Capture**
   - Captures current page state as PNG image
   - Converts to base64 for API transmission
   - Ensures fresh screenshot before each Vision AI call

2. **Vision Analysis**
   - Sends screenshot + instruction to GPT-4o Vision
   - AI analyzes visual structure, layout, and element appearance
   - Understands context (e.g., "primary button", "form field", "dropdown")
   - Identifies elements by their visual characteristics

3. **Selector Generation**
   - Returns appropriate Playwright selector
   - Provides confidence level and reasoning
   - Suggests fallback strategies if needed

4. **Execution with Fallbacks**
   - Tries Vision AI's suggested selector first
   - Falls back to alternative strategies if needed
   - Provides detailed diagnostics on failures

**Example interaction:**

**Input (instruction):**
```
"Click on the Register button"
```

**Vision AI response:**
```json
{
  "selector": "button:has-text('register')",
  "strategy": "text",
  "confidence": "high",
  "reasoning": "Primary CTA button visible at bottom of form"
}
```

**Benefits:**
- **Adaptive**: Works with any UI design
- **Self-healing**: Adapts to UI changes automatically
- **Context-aware**: Understands element relationships visually
- **Maintenance-free**: No selector updates needed

---

## Reverse Engineering: Playwright → Gherkin

### 5. **ReverseEngineerAgent** (Migration Layer)

The `ReverseEngineerAgent` enables **migration from existing Playwright tests to Gherkin features**. This agent uses AI to analyze technical test code and infer the underlying business intent, automatically generating **detailed, human-readable Gherkin scenarios** with specific field data and Scenario Outlines.

**Purpose:**
- Convert legacy Playwright tests into maintainable Gherkin features
- **Extract specific field data** (names, emails, credit cards, URLs)
- **Generate Scenario Outlines** with Examples tables for data-driven tests
- **Create multiple scenarios** (happy path, error cases, edge cases)
- Preserve business logic while adopting the new architecture
- Accelerate migration to the vision-driven testing approach
- **Smart caching** to avoid regenerating unchanged files

**How it works:**

1. **Parse Playwright Files**
   - Scans `.spec.ts`, `.spec.js`, `.test.ts`, `.test.js` files
   - Extracts test structure using regex patterns
   - Identifies `test.describe()` blocks and individual `test()` cases
   - Captures test names, code blocks, and embedded tags

2. **AI-Powered Inference**
   - Sends test code to GPT-4o with specialized prompts
   - AI analyzes technical code to understand business intent
   - **Extracts ALL specific field data** from method calls
   - Converts technical actions into natural language steps with details
   - Generates Given/When/Then scenarios following Gherkin best practices
   - **Creates Scenario Outlines** when multiple data sets are detected
   - **Generates multiple scenarios** for different test paths

3. **Gherkin Generation**
   - Creates one `.feature` file per scenario
   - **Adds auto-generation comment** with timestamp
   - Preserves directory structure (optional)
   - Maintains tags from original tests
   - **Supports Scenario Outlines** with Examples tables
   - Formats output following standard Gherkin syntax

4. **Migration Cache System** 🆕
   - Tracks processed files with SHA-256 hash in `migrate/.migrate-cache.json`
   - Skips unchanged files automatically (saves time and API costs)
   - Detects file modifications and reprocesses only changed files
   - Force regeneration mode available via `--force` flag

**Example Conversion:**

**Input (Playwright):**
```javascript
test.describe('Free checkout flow', () => {
  test('should complete registration without payment', async ({ page }) => {
    await navigateToEvent(page);
    await selectTickets(page, 1);
    await fillAttendeeInfo(page, {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com'
    });
    await submitRegistration(page);
    await verifyRegistrationSuccess(page);
  });
});
```

**Output (Gherkin):**
```gherkin
# 🤖 Auto-generated from Playwright test
# Generated on: 2025-11-25T18:30:00.000Z

Feature: Free checkout flow
  Validate free ticket registration without payment gateway

@happy-path
Scenario: Complete registration without payment
  Given I navigate to the event registration page
  When I select 1 ticket
  And I fill the following attendee information:
    | Field      | Value            |
    | First Name | John             |
    | Last Name  | Doe              |
    | Email      | john@example.com |
  And I submit the registration
  Then I should see registration success confirmation
```

**CLI Usage:**

```bash
# Convert a single file
npm run reverse path/to/test.spec.ts

# Convert entire directory (incremental - only new/changed files)
npm run reverse

# Force regeneration of ALL files (useful after improving prompts)
npm run reverse -- --force

# Specify custom input/output directories
npm start reverse -- --input ./tests --output ./features

# Process specific files
npm start reverse file1.spec.ts file2.spec.ts

# Disable directory structure preservation
npm start reverse -- --no-preserve-structure
```

**Configuration:**

The agent can be configured programmatically:

```typescript
const agent = new ReverseEngineerAgent({
  preserveStructure: true,     // Maintain original directory structure
  forceRegeneration: false     // Set to true to ignore cache
});

// Process single file
await agent.processFile('tests/login.spec.ts', './features');

// Process entire directory
await agent.processDirectory('./tests', './features');
```

**AI Prompt Strategy:**

The agent uses a specialized system prompt that instructs the AI to:
- **Extract specific field data**: All field names and values from method calls
- **Create Scenario Outlines**: For parametrized data with Examples tables
- **Generate multiple scenarios**: Happy path, error cases, edge cases
- **Preserve exact validation messages**: Include specific text from assertions
- **Include UI element details**: Button colors, positions, exact wording
- Understand business context from method names and assertions
- Create natural language steps readable by non-technical stakeholders
- Follow Gherkin best practices (Given/When/Then structure)
- Keep steps concise and actionable

**Fallback Mechanism:**

If AI inference fails (API error, timeout, etc.), the agent falls back to basic conversion:
- Uses test names as scenario names
- Creates generic Given/When/Then placeholders
- Preserves test structure and tags
- Ensures migration continues even without AI

**Benefits:**

- ✅ **Accelerated Migration**: Convert hundreds of tests automatically
- ✅ **Detailed Field Extraction**: Specific data instead of generic steps
- ✅ **Data-Driven Testing**: Scenario Outlines with Examples tables
- ✅ **Multiple Test Paths**: Happy/sad/edge case scenarios
- ✅ **Business Intent Preservation**: AI infers "why" behind technical "how"
- ✅ **Consistency**: All Gherkin follows same format and best practices
- ✅ **Tag Preservation**: Maintains test categorization and filtering
- ✅ **Directory Structure**: Optional preservation of original organization
- ✅ **Smart Caching**: Only processes new or modified files
- ✅ **Cost Optimization**: Avoids unnecessary API calls
- ✅ **Iterative Refinement**: Generated Gherkin can be manually improved

**Workflow Integration:**

```
┌─────────────────────────────────────────────────────────────┐
│              Legacy Playwright Tests                        │
│         (tests/*.spec.ts, tests/*.spec.js)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ReverseEngineerAgent                           │
│                                                             │
│   1. Parse test structure (regex)                          │
│   2. Infer business intent (AI)                             │
│   3. Generate Gherkin features                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Gherkin Feature Files                          │
│              (features/*.feature)                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              QA Orchestrator                                │
│         (Executes with Vision AI)                           │
└─────────────────────────────────────────────────────────────┘
```

**Best Practices:**

1. **Review Generated Gherkin**: AI inference is good but not perfect - review and refine
2. **Preserve Original Tests**: Keep Playwright tests until Gherkin versions are validated
3. **Batch Processing**: Process entire directories for consistency
4. **Tag Preservation**: Use tags in test names: `test('[critical] Login flow', ...)`
5. **Iterative Migration**: Migrate module by module, not all at once
6. **Use Incremental Mode**: Let cache skip unchanged files (default behavior)
7. **Force Regeneration**: Use `--force` when you improve AI prompts
8. **Monitor Cache**: Check `migrate/.migrate-cache.json` for tracking

---

## Benefits of This Architecture

### 🎯 **True Reusability**

The same `WebExecutorAgent` codebase works across:
- **Different applications**: E-commerce, SaaS dashboards, event management
- **Different frameworks**: Angular, React, Vue, vanilla HTML
- **Different UI libraries**: Material Design, Bootstrap, custom components
- **Different screen sizes**: Desktop, tablet, mobile (with responsive design)

**Zero code changes** required when switching between applications.

### 🔄 **Self-Healing Tests**

Traditional test automation breaks when:
- CSS classes change
- HTML structure is refactored
- UI components are redesigned
- Selectors become outdated

This architecture **adapts automatically** because:
- Vision AI analyzes current UI state
- No reliance on brittle selectors
- Visual understanding survives structural changes

### 📈 **Scalability**

Adding new tests requires:
- ✅ Writing Gherkin feature files
- ❌ No code changes in `WebExecutorAgent`
- ❌ No selector maintenance
- ❌ No framework-specific logic

**Scaling is linear**: More tests = More Gherkin files, not more code.

### 🧪 **Testability**

The architecture supports:
- **Toggle Vision AI**: Can disable for debugging or cost control
- **Fallback strategies**: Multiple ways to find elements
- **Clear separation**: Each layer is independently testable
- **Diagnostics**: Detailed error reporting and screenshots

### 📝 **Business-Friendly**

Gherkin files serve as:
- **Executable specifications**: Tests that document requirements
- **Stakeholder communication**: Non-technical people can read and validate
- **Living documentation**: Always up-to-date with implementation
- **Business vocabulary**: Uses domain language, not technical jargon

---

## Example Test Flow

To illustrate how the architecture works in practice, here's a complete example:

### Gherkin Step
```gherkin
When I click on the "Register" button
```

### Execution Flow

**Step 1: GherkinAgent Parses**
```json
{
  "action": "click",
  "selector": "",
  "description": "Click on the Register button",
  "data": null
}
```

**Step 2: WebExecutorAgent Receives Plan**
- Calls `click(step)` method
- Determines Vision AI is needed

**Step 3: Vision AI Analysis**
- Captures screenshot of current page
- Sends to GPT-4o Vision with instruction: "Click on the Register button"
- Receives response: `{ "selector": "button:has-text('register')", "confidence": "high" }`

**Step 4: Element Location**
- Tries `page.locator("button:has-text('register')")`
- Waits for element to be visible and actionable

**Step 5: Execution**
- Executes `element.click()`
- Waits for page to stabilize

**Step 6: Success**
- Returns success result
- Continues to next step

### Why This Works Across Different UIs

The same Gherkin step works regardless of:
- ✅ Button class: `btn-primary`, `mat-raised-button`, `custom-button`
- ✅ Button text: "Register", "REGISTER", "register"
- ✅ Button location: Top, bottom, sidebar, modal
- ✅ Framework: Angular, React, Vue, vanilla HTML

**Vision AI adapts to all of these automatically.**

---

## Configuration

### Enable/Disable Vision AI

```env
# Enable Vision AI (default: true)
USE_VISION=true

# Fallback to basic selectors only (for debugging or cost control)
USE_VISION=false
```

### Cost Optimization

```env
# Enable caching (saves Vision AI calls and API costs)
ENABLE_CACHE=true

# Use headless mode (faster execution)
HEADLESS=true
```

---

## Anti-Patterns to Avoid

### ❌ DON'T: Hardcode Framework-Specific Logic

```javascript
// BAD!
if (isMaterialAngular) {
  await page.locator('mat-expansion-panel').click();
}
```

**Problem**: Code only works for Material Angular. Breaks for other frameworks.

**Solution**: Let Vision AI identify the element dynamically.

### ✅ DO: Use Generic Methods

```javascript
// GOOD!
const vision = await executeActionWithVision(description, 'click');
await page.locator(vision.selector).click();
```

**Benefit**: Works with any framework or UI library.

---

### ❌ DON'T: Put Technical Details in Gherkin

```gherkin
# BAD!
And I wait for mat-select to be visible
And I click on CSS selector "[data-testid='dropdown']"
And I wait 500 milliseconds
```

**Problem**: Gherkin becomes technical implementation, not business language.

**Solution**: Use business language only.

### ✅ DO: Use Business Language

```gherkin
# GOOD!
And I select 1 ticket from the quantity selector
```

**Benefit**: Readable by stakeholders, adaptable to UI changes.

---

### ❌ DON'T: Create Application-Specific Methods

```javascript
// BAD!
async clickOnCartIcon() { ... }
async expandTicketPanel() { ... }
async dismissCookiePopup() { ... }
```

**Problem**: Methods are tied to specific applications. Not reusable.

**Solution**: Keep methods generic and let Vision AI handle specifics.

### ✅ DO: Keep Methods Generic

```javascript
// GOOD!
async click(step) { /* generic logic */ }
async select(step) { /* generic logic */ }
```

**Benefit**: One method works for all applications.

---

## Future Enhancements

- [x] **Reverse Engineering**: Playwright → Gherkin conversion with AI ✅
- [ ] Multi-browser support (Firefox, Safari)
- [ ] Mobile/responsive testing
- [ ] Visual regression detection
- [ ] Performance metrics collection
- [ ] A/B testing support
- [ ] Claude Vision as alternative to GPT-4o
- [ ] Self-healing selector updates
- [ ] Batch test generation from user recordings
- [ ] Integration with CI/CD pipelines (GitHub Actions, Jenkins)
- [ ] Real-time test monitoring dashboard

---

## Conclusion

This architecture achieves **true separation of concerns**:

- **Business Layer** (Gherkin): What should happen
- **Interpretation Layer** (GherkinAgent): Understanding intent
- **Execution Layer** (WebExecutorAgent): How to execute generically
- **Intelligence Layer** (Vision AI): Understanding UI context
- **Automation Layer** (Playwright): Browser control

**The key insight:** By making Vision AI the intelligence layer, we eliminate the need for hardcoded selectors and framework-specific code. The system becomes **truly generic and reusable**, while remaining **self-healing and adaptable**.

This architecture scales linearly: adding support for new applications requires only new Gherkin files, not new code. The same execution engine works across all web applications, making it a **universal test automation framework**.
