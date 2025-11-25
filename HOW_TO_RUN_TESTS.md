# How to Run Tests

This guide explains how to execute automated tests in the QA Agents system.

## Prerequisites

1. Ensure you have configured your `.env` file with required credentials:
   ```
   OPENAI_API_KEY=your-api-key
   WEB_APP_URL=http://localhost:4200
   HEADLESS=false
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running Tests

### Run All Tests

Execute all feature files in the `./features/` directory:

```bash
npm run test
```

This will automatically discover and run all `.feature` files.

### Run a Specific Test

Execute a single feature file:

```bash
npm run test features/purchase-free-ticket.feature
```

### Run Multiple Specific Tests

Execute several feature files:

```bash
npm run test features/test1.feature features/test2.feature
```

## Advanced Options

### Specify a Different Features Directory

```bash
npm run test -- -d ./my-custom-features
```

### Filter Tests by Tags

Run only tests with specific tags (e.g., `@web`, `@critical`):

```bash
npm run test -- -t @web,@critical
```

## Understanding Test Results

### Console Output

During execution, you'll see:
- 🤖 Step-by-step execution progress
- ✅ Successful steps
- ❌ Failed steps with diagnostics
- 📊 Final summary with success rate

### Generated Reports

Reports are organized by feature in the `reports/` directory:

```
reports/
├── purchase-free-ticket/        # Feature-specific reports
│   ├── report-2025-....json     # Detailed JSON report
│   └── report-2025-....html     # Visual HTML report
├── summary-2025-....json        # Overall summary (JSON)
└── summary-2025-....html        # Overall summary (HTML)
```

**To view reports:**
- Open the HTML files in your browser for a visual representation
- Use JSON files for programmatic analysis or CI/CD integration

### Test Artifacts

Generated artifacts are stored in `.features-cache/`:
- `*.cache.json` - Cached execution plans (saves API costs)
- `*.spec.js` - Generated Playwright test files

## Troubleshooting

### No Tests Found

If you see "❌ No .feature files found":
1. Verify your features are in `./features/` directory
2. Ensure files have `.feature` extension
3. Use `-d` option to specify a different directory

### Configuration Errors

If you see "❌ OPENAI_API_KEY not configured":
1. Create a `.env` file in the project root
2. Add your OpenAI API key: `OPENAI_API_KEY=sk-...`

### Test Failures

When tests fail:
1. Check the console output for the specific error
2. Review the HTML report for detailed diagnostics
3. Look for the "🔍 Diagnostic" section which provides:
   - Root cause category
   - Suggested fix
   - Assigned team

## Additional Commands

### Validate Configuration

Check if your system is properly configured:

```bash
npm start -- validate
```

### Manage Cache

View cache statistics:
```bash
npm start -- cache --stats
```

Clear cache (forces re-interpretation of features):
```bash
npm start -- cache --clear
```

## Features

- **Dynamic Data Generation**: Placeholders like `<email>` are automatically replaced with random values
- **Smart Caching**: Execution plans are cached to save time and API costs
- **AI-Powered Diagnostics**: Failed tests include intelligent root cause analysis
- **Self-Healing Tests**: Vision AI dynamically finds UI elements without hardcoded selectors

## Example Workflow

1. Write your test in Gherkin format (`.feature` file)
2. Run the test: `npm run test features/my-test.feature`
3. Review results in the console
4. Open the HTML report for detailed analysis
5. Fix any issues based on diagnostic suggestions
6. Re-run the test

## Reverse Engineering: Playwright → Gherkin

Convert existing Playwright tests to Gherkin features with AI-powered migration.

### Basic Usage

```bash
# Convert all tests in ./migrate directory (incremental mode)
npm run reverse

# Force regeneration of ALL files (useful after improving prompts)
npm run reverse -- --force

# Convert specific file
npm run reverse migrate/checkout.spec.ts
```

### How It Works

1. **Place Playwright tests** in `./migrate/` directory
2. **Run conversion**: `npm run reverse`
3. **Review generated Gherkin** in `./features/` directory
4. **Run tests**: `npm run test`

### Smart Caching

The system tracks processed files with SHA-256 hashes:

- **First run**: Processes all files
  ```
  📊 Summary: 5 processed, 0 skipped
  ```

- **Subsequent runs**: Only processes new/modified files
  ```
  📊 Summary: 1 processed, 4 skipped
  ```

- **Force mode**: Regenerates everything
  ```bash
  npm run reverse -- --force
  📊 Summary: 5 processed, 0 skipped
  ```

### Generated Gherkin Features

The AI extracts detailed information:

- ✅ **Specific field data** (names, emails, credit cards)
- ✅ **Exact validation messages** from assertions
- ✅ **Scenario Outlines** with Examples tables
- ✅ **Multiple scenarios** (happy/sad/edge cases)
- ✅ **Auto-generation comment** with timestamp

**Example:**

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

### Cache Management

Cache file location: `migrate/.migrate-cache.json`

**When to use `--force`:**
- After improving AI prompts
- When you want to regenerate all Gherkin files
- To ensure latest conversion logic is applied

**Cache benefits:**
- ⚡ Faster iterations (skips unchanged files)
- 💰 Cost savings (avoids unnecessary API calls)
- 🔒 Safe (never touches manually created Gherkin)

## Getting Help

For more information about the system architecture and capabilities, see:
- `README.md` - Project overview
- `ARCHITECTURE.md` - System design
- `VISION-AI.md` - Vision AI integration details
