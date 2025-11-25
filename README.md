# 🤖 QA Agents - Intelligent Collaborative Testing System

Intelligent agent system that automates QA work by following Gherkin specifications, executing tests like humans, and generating actionable diagnostics with AI.

## 🎯 Key Features

- ✅ **Gherkin Interpretation with AI**: Converts business scenarios into executable technical steps
- 🌐 **Web Testing**: Automation for Angular, React, Node.js with Playwright
- ⚡ **Salesforce Testing**: Apex, SOQL, Triggers, Flows with Governor Limits handling
- 🧠 **Intelligent Diagnostics**: Root cause analysis and recommendations with GPT-4/Claude
- 🤝 **Collaborative Execution**: Agents work together to complete tests
- 📊 **Detailed Reports**: JSON, HTML, and console with trend analysis

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API Key (required for AI)
- Salesforce credentials (optional, only for SF tests)
- Chrome/Chromium installed (for Playwright)

## 🚀 Quick Installation

```bash
# 1. Clone or navigate to project
cd qa-agents

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp env-template.txt .env
# Edit .env with your credentials

# 4. Initialize structure
npm run demo
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo

# Salesforce (optional)
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=your-username@domain
SF_PASSWORD=your-password
SF_TOKEN=your-security-token
SF_INSTANCE_URL=https://domain.my.salesforce.com

# Web Application
WEB_APP_URL=http://localhost:4200
API_BASE_URL=http://localhost:3000

# Test Configuration
HEADLESS=false
SLOW_MO=100
TIMEOUT=30000
SCREENSHOT_ON_FAILURE=true

# Reporting
REPORT_PATH=./reports
```

### Agent Configuration (config/agents.config.js)

The `config/agents.config.js` file allows you to customize agent behavior:

```javascript
module.exports = {
  agents: {
    gherkinInterpreter: {
      model: 'gpt-4-turbo',
      temperature: 0.3
    },
    webTestExecutor: {
      humanSimulation: {
        enabled: true,
        typingSpeed: { min: 50, max: 150 }
      }
    },
    // ... more configuration
  }
};
```

## 📝 Writing Tests with Gherkin

### Example: Web Test (Angular/Node.js)

```gherkin
# features/web-login.feature
# language: en
Feature: User Login
  
  @web @critical
  Scenario: Successful login
    Given I navigate to the login page
    When I enter "user@domain.com" in the email field
    And I enter "Password123!" in the password field
    And I click the "Sign In" button
    Then I should see the user dashboard
    And I should see the "Welcome" message
```

### Example: Salesforce Test

```gherkin
# features/salesforce-capacity-service.feature
# language: en
@salesforce @critical
Scenario: CapacityService with 300+ sessions
  Given I have an event in Salesforce with ID "Event__c"
  When I create 350 sessions for that event
  And I execute the CapacityService
  Then the capacity calculation should complete successfully
  And it should not exceed the limit of 300 aggregate queries
```

## 🎮 Usage

### Main Commands

```bash
# Run all tests
npm test

# Run specific tests
npm start run features/web-login.feature

# Run tests from a directory (recursive)
npm start run features/checkout/

# Web tests only
npm run test:web

# Salesforce tests only
npm run test:salesforce

# Run demo
npm run demo

# Validate configuration
npm start validate

# Initialize project
npm start init
```

### 🔄 Reverse Engineering: Migrate Playwright → Gherkin

Convert existing Playwright tests to Gherkin features using AI with **intelligent caching** and **detailed field extraction**:

```bash
# Convert all tests in ./migrate directory (incremental - only new/changed files)
npm run reverse

# Force regeneration of ALL files (useful after improving prompts)
npm run reverse -- --force

# Convert specific file
npm run reverse path/to/test.spec.ts

# Convert multiple files
npm start reverse file1.spec.ts file2.spec.ts

# Custom input/output directories
npm start reverse -- --input ./tests --output ./features

# Disable directory structure preservation
npm start reverse -- --no-preserve-structure
```

**What it does:**
- 🤖 Uses AI to infer business intent from technical code
- 📝 Generates **detailed** Gherkin scenarios with specific field data
- 📊 Creates **Scenario Outlines** with Examples tables for data-driven tests
- 🎯 Extracts exact validation messages, URLs, and field values
- 🔄 Generates multiple scenarios (happy path, error cases, edge cases)
- 🏷️ Preserves tags from test names
- 📁 Maintains directory structure (optional)
- ⚡ **Smart caching**: Only processes new or modified files
- 🔁 **Force mode**: Regenerate all when improving prompts
- ✅ Creates one `.feature` file per test scenario

**Example Conversion:**

**Input (Playwright):**
```javascript
test('should complete checkout', async ({ page }) => {
  await page.goto('http://localhost:4200/checkout');
  await page.fill('#firstName', 'John');
  await page.fill('#lastName', 'Doe');
  await page.fill('#email', 'john@example.com');
  await page.fill('#cardNumber', '4111111111111111');
  await page.click('button:has-text("Complete Purchase")');
  await expect(page.getByText('Payment successful')).toBeVisible();
});
```

**Output (Gherkin):**
```gherkin
# 🤖 Auto-generated from Playwright test
# Generated on: 2025-11-25T18:30:00.000Z

Feature: Checkout Flow
  Validate payment processing

@happy-path
Scenario: Complete checkout with credit card
  Given I navigate to "http://localhost:4200/checkout"
  When I fill the following information:
    | Field       | Value              |
    | First Name  | John               |
    | Last Name   | Doe                |
    | Email       | john@example.com   |
    | Card Number | 4111111111111111   |
  And I click on the "Complete Purchase" button
  Then I should see the message "Payment successful"
```

**Cache System:**
- Tracks processed files with SHA-256 hash in `migrate/.migrate-cache.json`
- Skips unchanged files automatically (saves time and API costs)
- Use `--force` to regenerate all when you improve AI prompts
- Never touches manually created Gherkin files

**Usage Example:**

```bash
# Place your Playwright tests in ./migrate/
npm run reverse
# Output: 📊 Summary: 2 processed, 3 skipped

# Modify one test file and run again
npm run reverse
# Output: 📊 Summary: 1 processed, 4 skipped

# Force regenerate everything (e.g., after improving prompts)
npm run reverse -- --force
# Output: 📊 Summary: 5 processed, 0 skipped

# Generated Gherkin files will be in ./features/
# Now you can run them:
npm test
```

### Programmatic Usage

```javascript
const QAOrchestrator = require('./src/QAOrchestrator');

async function runTests() {
  const orchestrator = new QAOrchestrator({
    reportPath: './reports',
    screenshotOnFailure: true
  });

  const report = await orchestrator.runTestSuite([
    './features/web-login.feature',
    './features/salesforce-capacity-service.feature'
  ]);

  console.log(`Tests: ${report.summary.passed}/${report.summary.totalSteps} successful`);
}

runTests();
```

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    QA Orchestrator                       │
│              (Coordinates all agents)                    │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│ Gherkin Agent  │  │ Web Executor │  │ SF Executor    │
│                │  │   Agent      │  │   Agent        │
│ • Parse        │  │              │  │                │
│ • Interpret    │  │ • Playwright │  │ • jsforce      │
│ • AI Planning  │  │ • Selenium   │  │ • Selenium     │
└────────────────┘  └──────────────┘  └────────────────┘
                            │
                   ┌────────▼──────────┐
                   │ Diagnostic Agent  │
                   │                   │
                   │ • IA Analysis     │
                   │ • root cause      │
                   │ • Recommendations │
                   └───────────────────┘
```

### Main Agents

#### 1. **GherkinAgent** 
- Parses `.feature` files
- Interprets with AI
- Generates technical execution plan

#### 2. **WebExecutorAgent**
- Executes tests in web apps (Angular, React, etc)
- Simulates human behavior
- Uses AI to find elements when selectors fail

#### 3. **SalesforceExecutorAgent**
- Executes tests in Salesforce
- Handles Apex, SOQL, Triggers, Flows
- Monitors Governor Limits
- **Specific for your case**: Handles CapacityService problem with >300 sessions

#### 4. **DiagnosticAgent**
- Analyzes failures with GPT-4/Claude
- Identifies root cause
- Suggests immediate and long-term fixes
- Determines severity and assigns responsibility

#### 5. **ReverseEngineerAgent** 🆕
- Converts existing Playwright tests to Gherkin features
- Uses AI to infer business intent from technical code
- **Extracts specific field data** (names, emails, credit cards, URLs)
- **Generates Scenario Outlines** with Examples tables
- **Creates multiple scenarios** (happy/sad/edge cases)
- **Smart caching** to avoid regenerating unchanged files
- Accelerates migration to vision-driven testing
- Preserves tags and directory structure

## 📊 Reports

### Console Report

```
🚀 STARTING COLLABORATIVE QA AGENT SYSTEM
══════════════════════════════════════════════════

📋 Feature: web-login.feature
──────────────────────────────────────────────────
  📝 Scenario: Successful login
    ✅ Step 1: Navigate to login page
    ✅ Step 2: Enter email
    ✅ Step 3: Enter password
    ✅ Step 4: Click button
    ✅ Step 5: Validate dashboard

📊 FINAL REPORT
══════════════════════════════════════════════════
Features executed: 1
Total steps: 5
✅ Successful steps: 5
❌ Failed steps: 0
Success rate: 100%
```

### HTML Report

Automatically generated in `reports/qa-report-[timestamp].html` with:
- Visual dashboard
- Success/failure charts
- Detailed diagnostics
- Screenshots
- Recommendations

### JSON Report

```json
{
  "summary": {
    "features": 1,
    "totalSteps": 5,
    "passed": 5,
    "failed": 0,
    "successRate": 100,
    "duration": 12.5
  },
  "results": [...],
  "diagnostics": [...],
  "recommendations": [...]
}
```

## 🔍 Intelligent Diagnostics

When a test fails, the **DiagnosticAgent** automatically:

1. **Analyzes the error** with AI
2. **Identifies the category**:
   - `UI_CHANGE`: UI changes
   - `API_ERROR`: API errors
   - `TIMING_ISSUE`: Timing problems
   - `SALESFORCE_GOVERNOR_LIMIT`: Salesforce limits
   - `SELECTOR_INVALID`: Incorrect selector
   - etc.

3. **Generates diagnostic**:
   ```
   📊 DIAGNOSTIC:
      Category: UI_CHANGE
      Confidence: 85%
      Severity: MEDIUM
      Immediate fix: Update CSS selector to data-testid
      Assigned to: Frontend Team
   ```

4. **Suggests solutions**:
   - Immediate: what to do now
   - Long-term: how to prevent
   - Preventive: process improvements

## 🎯 Specific Use Cases

### Case 1: Testing CapacityService (Your current problem)

```gherkin
@salesforce @capacity
Scenario: Calculate capacity for event with 350+ sessions
  Given I have an event in Salesforce
  When I create 350 sessions for that event
  And I execute the CapacityService
  Then it should not exceed governor limits
  And capacity should be calculated correctly
```

The agent:
- Creates event and 350 sessions automatically
- Executes `CapacityService`
- Monitors aggregate queries (limit of 300)
- Validates calculation
- Cleans up test data

### Case 2: Testing Asynchronous Triggers

```gherkin
@salesforce @trigger
Scenario: Event Trigger should execute
  Given I have the trigger "conference360.Event_Trigger" active
  When I create a new Event__c
  Then the trigger should execute without errors
  And async processes should complete
```

The agent:
- Creates the record
- Waits for async processes to complete
- Validates trigger results
- Reports any errors

### Case 3: Testing Angular App

```gherkin
@web @angular
Scenario: Create event in web app
  When I click "New Event"
  And I complete the form with:
    | Name               | Tech Conference 2025 |
    | Start Date         | 2025-06-15           |
    | Maximum Capacity   | 500                  |
  And I click "Save"
  Then I should see "Event created successfully"
```

The agent:
- Waits for Angular to stabilize
- Simulates human interaction
- Captures screenshots
- Validates results

## 🛠️ Troubleshooting

### Error: "OpenAI API Key not configured"

```bash
# Configure in .env
OPENAI_API_KEY=sk-your-key-here
```

### Error: "Element not found"

The agent automatically:
1. Tries to find element with AI
2. Generates diagnostic
3. Suggests fix (use data-testid)

### Error: "Salesforce Governor Limit exceeded"

The agent:
1. Detects specific limit
2. Suggests optimization
3. Reports usage metrics

### Slow tests

```bash
# Configure in .env
HEADLESS=true
SLOW_MO=0
```

## 📁 Project Structure

```
qa-agents/
├── config/
│   └── agents.config.js      # Agent configuration
├── features/                  # Gherkin files
│   ├── web-login.feature
│   ├── web-event-management.feature
│   └── salesforce-capacity-service.feature
├── migrate/                   # Playwright tests to convert (optional)
│   ├── *.spec.ts
│   └── .migrate-cache.json    # Cache for incremental processing
├── src/
│   ├── agents/
│   │   ├── GherkinAgent.ts
│   │   ├── WebExecutorAgent.ts
│   │   ├── SalesforceExecutorAgent.ts
│   │   ├── DiagnosticAgent.ts
│   │   └── ReverseEngineerAgent.ts  # NEW: Playwright → Gherkin
│   ├── examples/
│   │   ├── run-test.js
│   │   ├── test-salesforce.js
│   │   └── demo.js
│   ├── QAOrchestrator.ts     # Main orchestrator
│   └── index.ts              # CLI
├── reports/                   # Generated reports
├── screenshots/               # Test screenshots
├── .features-cache/           # Generated Playwright tests
├── package.json
├── .env                       # Environment variables
└── README.md
```

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/qa-agents.yml
name: QA Agent Testing

on:
  pull_request:
    branches: [main, develop]

jobs:
  qa-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run QA Agents
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          SF_USERNAME: ${{ secrets.SF_USERNAME }}
          SF_PASSWORD: ${{ secrets.SF_PASSWORD }}
          SF_TOKEN: ${{ secrets.SF_TOKEN }}
          HEADLESS: true
        run: npm test
      
      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: qa-reports
          path: reports/
```

## 📈 Roadmap

- [x] Basic agents (Gherkin, Web, Salesforce, Diagnostic)
- [x] Collaborative orchestrator
- [x] HTML/JSON reports
- [x] **Reverse Engineering: Playwright → Gherkin** ✅
- [x] **Enhanced Gherkin Generation** (detailed fields, Scenario Outlines) ✅
- [x] **Migration Cache System** (incremental processing) ✅
- [ ] API Testing Agent
- [ ] Visual Regression Testing
- [ ] Jira/TestRail integration
- [ ] Real-time web dashboard
- [ ] Parallel test execution
- [ ] Support for more frameworks (Vue, Svelte)
- [ ] Mobile testing (iOS/Android)

## 🤝 Contributing

This is Sychus project. To contribute:

1. Create feature branch
2. Implement changes
3. Add tests
4. Create PR

## 📝 License

MIT - Sychus

## 🆘 Support

For issues or questions:
- Email: hugo@blackthorn.io

---

**Built with ❤️ by Sychus**

*"Automating QA, one agent at a time"* 🤖

