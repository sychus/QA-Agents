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

## Getting Help

For more information about the system architecture and capabilities, see:
- `README.md` - Project overview
- `ARCHITECTURE.md` - System design
- `VISION-AI.md` - Vision AI integration details
