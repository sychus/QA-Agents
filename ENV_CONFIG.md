# QA Agents - Environment Configuration

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-your-api-key-here

# OpenAI Model (Optional, defaults to gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini

# Web Application Base URL (Optional, can be overridden with --url flag)
WEB_APP_URL=https://your-app-url.com

# Salesforce Credentials (Optional, for Salesforce tests)
SF_USERNAME=your-salesforce-username
SF_PASSWORD=your-salesforce-password

# Report Path (Optional, defaults to ./reports)
REPORT_PATH=./reports
```

## Usage Examples

### Running Tests with Different URLs

```bash
# Use URL from .env file
npm run test

# Override with staging URL
npm run test -- --url https://staging.example.com

# Override with local development URL
npm run test -- --url http://localhost:4200

# Test specific feature against QA environment
npm run test features/checkout -- --url https://qa.example.com
```

### Complete Test Execution Examples

```bash
# Run all tests with force regeneration and custom URL
npm run test -- --force --url https://staging.example.com

# Run specific directory with custom URL
npm run test features/sessions -- --url http://localhost:3000

# Run specific feature file
npm run test features/sessions/paid-sessions.feature -- --url https://qa.example.com
```

## Configuration Priority

The system uses the following priority for configuration:

1. **Command-line arguments** (highest priority)
   - `--url` flag overrides environment variable
   - `--force` flag bypasses cache
   
2. **Environment variables** (`.env` file)
   - `WEB_APP_URL` for base URL
   - `OPENAI_API_KEY` for AI features
   
3. **Default values** (lowest priority)
   - Falls back to `http://localhost:4200` if no URL specified
   - Uses `gpt-4o-mini` if no model specified

## Tips

- Keep sensitive credentials in `.env` (already in `.gitignore`)
- Use `--url` for temporary URL changes (testing different environments)
- Set `WEB_APP_URL` in `.env` for your default testing environment
- Use environment-specific `.env` files (`.env.staging`, `.env.production`) and load them as needed
