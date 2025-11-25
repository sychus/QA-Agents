import 'dotenv/config';
import { QAOrchestrator } from './QAOrchestrator';
import { GherkinAgent } from './agents/GherkinAgent';
import { ReverseEngineerAgent } from './agents/ReverseEngineerAgent';
import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main CLI for the QA Agents System
 */

program
  .name('qa-agents')
  .description('Intelligent Agent System for Automated QA')
  .version('1.0.0');

program
  .command('run [features...]')
  .description('Run tests from Gherkin files')
  .option('-d, --dir <directory>', 'Features directory', './features')
  .option('-p, --pattern <pattern>', 'File pattern', '*.feature')
  .option('-t, --tags <tags>', 'Tags to filter (e.g: @web,@critical)')
  .option('-c, --config <config>', 'Configuration file', './config/agents.config.js')
  .option('-f, --force', 'Force regeneration of cached plans and tests')
  .option('-u, --url <url>', 'Base URL for web tests (overrides WEB_APP_URL env variable)')
  .action(async (features: string[], options: any) => {
    try {
      console.info(chalk.bold.cyan('\n🤖 QA Agents - Intelligent Testing System\n'));
      
      // Validate configuration
      validateEnvironment();

      let featureFiles: string[] = [];

      if (features && features.length > 0) {
        // Specific files or directories provided
        for (const item of features) {
          const itemPath = path.resolve(item);
          
          if (!fs.existsSync(itemPath)) {
            console.error(chalk.red(`❌ Path not found: ${itemPath}`));
            process.exit(1);
          }
          
          if (fs.statSync(itemPath).isDirectory()) {
            // Recursively find .feature files in directory
            featureFiles.push(...findFeatureFiles(itemPath));
          } else if (itemPath.endsWith('.feature')) {
            featureFiles.push(itemPath);
          }
        }
      } else {
        // Search in default directory
        const featuresDir = path.resolve(options.dir);
        
        if (!fs.existsSync(featuresDir)) {
          console.error(chalk.red(`❌ Directory not found: ${featuresDir}`));
          process.exit(1);
        }

        featureFiles = findFeatureFiles(featuresDir);
      }

      if (featureFiles.length === 0) {
        console.error(chalk.red('❌ No .feature files found'));
        process.exit(1);
      }

      console.info(chalk.gray(`Running ${featureFiles.length} feature(s)...\n`));

      // Create orchestrator
      const config = fs.existsSync(options.config) 
        ? require(path.resolve(options.config))
        : {};
      
      // Add force flag to config
      if (options.force) {
        config.forceRegenerate = true;
      }
      
      // Override WEB_APP_URL if --url is provided
      if (options.url) {
        process.env.WEB_APP_URL = options.url;
        console.info(chalk.gray(`Using base URL: ${options.url}\n`));
      }
      
      const orchestrator = new QAOrchestrator(config);

      // Run suite
      const report = await orchestrator.runTestSuite(featureFiles);

      // Exit code based on results
      const exitCode = report.summary.failed > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate system configuration')
  .action(() => {
    console.info(chalk.bold.cyan('\n🔍 Validating configuration...\n'));
    
    const checks = [
      {
        name: 'OpenAI API Key',
        check: () => !!process.env.OPENAI_API_KEY,
        required: true
      },
      {
        name: 'Salesforce Credentials',
        check: () => !!(process.env.SF_USERNAME && process.env.SF_PASSWORD),
        required: false
      },
      {
        name: 'Web App URL',
        check: () => !!process.env.WEB_APP_URL,
        required: false
      },
      {
        name: 'Features Directory',
        check: () => fs.existsSync('./features'),
        required: true
      }
    ];

    let allValid = true;

    checks.forEach(({ name, check, required }) => {
      const isValid = check();
      const icon = isValid ? '✅' : (required ? '❌' : '⚠️');
      const color = isValid ? chalk.green : (required ? chalk.red : chalk.yellow);
      
      console.info(color(`${icon} ${name}`));
      
      if (!isValid && required) {
        allValid = false;
      }
    });

    console.info();

    if (allValid) {
      console.info(chalk.green('✅ Valid configuration - ready to run tests'));
    } else {
      console.error(chalk.red('❌ Incomplete configuration - review errors above'));
      process.exit(1);
    }
  });

program
  .command('cache')
  .description('Manage Gherkin parsing cache')
  .option('-c, --clear', 'Clear all cached plans')
  .option('-s, --stats', 'Show cache statistics')
  .action((options: any) => {
    const agent = new GherkinAgent();

    if (options.clear) {
      console.info(chalk.bold.cyan('\n🗑️  Clearing Gherkin cache...\n'));
      agent.clearCache();
      console.info(chalk.green('\n✅ Cache cleared successfully\n'));
    } else if (options.stats) {
      console.info(chalk.bold.cyan('\n📊 Cache Statistics\n'));
      const stats = agent.getCacheStats();
      console.info(chalk.white(`   Cached files: ${stats.count}`));
      console.info(chalk.white(`   Total size: ${stats.totalSizeKB} KB`));
      console.info(chalk.gray(`\n   Cache directory: ${agent['cacheDir']}\n`));
    } else {
      console.warn(chalk.yellow('\n⚠️  Please specify an option:'));
      console.info(chalk.white('   --clear  : Clear all cached plans'));
      console.info(chalk.white('   --stats  : Show cache statistics\n'));
    }
  });

program
  .command('reverse [files...]')
  .description('Convert Playwright tests to Gherkin features')
  .option('-i, --input <directory>', 'Input directory with Playwright tests', './migrate')
  .option('-o, --output <directory>', 'Output directory for Gherkin features', './features')
  .option('--no-preserve-structure', 'Do not preserve directory structure')
  .action(async (files: string[], options: any) => {
    try {
      console.info(chalk.bold.cyan('\n🔄 Reverse Engineering: Playwright → Gherkin\n'));
      
      // Validate configuration
      validateEnvironment();
      
      const agent = new ReverseEngineerAgent({
        preserveStructure: options.preserveStructure
      });
      
      if (files && files.length > 0) {
        // Process specific files
        console.info(chalk.gray(`Processing ${files.length} file(s)...\n`));
        
        for (const file of files) {
          const filePath = path.resolve(file);
          
          if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`❌ File not found: ${filePath}`));
            continue;
          }
          
          await agent.processFile(filePath, path.resolve(options.output));
        }
      } else {
        // Process entire directory
        const inputDir = path.resolve(options.input);
        
        if (!fs.existsSync(inputDir)) {
          console.error(chalk.red(`❌ Input directory not found: ${inputDir}`));
          process.exit(1);
        }
        
        await agent.processDirectory(inputDir, path.resolve(options.output));
      }
      
      console.info(chalk.green('\n✅ Reverse engineering completed successfully!\n'));
      console.info(chalk.gray(`Generated Gherkin files are in: ${path.resolve(options.output)}`));
      console.info(chalk.gray(`\nYou can now run: npm run test ${options.output}\n`));
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

/**
 * Recursively find all .feature files in a directory
 */
function findFeatureFiles(dir: string): string[] {
  const files: string[] = [];
  
  const traverse = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.feature')) {
        files.push(fullPath);
      }
    }
  };
  
  traverse(dir);
  return files;
}

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('❌ OPENAI_API_KEY not configured'));
    console.error(chalk.gray('   Configure your API key in the .env file'));
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error: any) => {
  console.error(chalk.red('\n❌ Unhandled error:'));
  console.error(error);
  process.exit(1);
});

// Parse arguments
program.parse();
