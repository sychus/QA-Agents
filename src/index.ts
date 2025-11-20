#!/usr/bin/env node

import 'dotenv/config';
import { QAOrchestrator } from './QAOrchestrator';
import { GherkinAgent } from './agents/GherkinAgent';
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
  .action(async (features: string[], options: any) => {
    try {
      console.info(chalk.bold.cyan('\n🤖 QA Agents - Intelligent Testing System\n'));
      
      // Validate configuration
      validateEnvironment();

      let featureFiles: string[] = [];

      if (features && features.length > 0) {
        // Specific files provided
        featureFiles = features.map(f => path.resolve(f));
      } else {
        // Search in directory
        const featuresDir = path.resolve(options.dir);
        
        if (!fs.existsSync(featuresDir)) {
          console.error(chalk.red(`❌ Directory not found: ${featuresDir}`));
          process.exit(1);
        }

        featureFiles = fs.readdirSync(featuresDir)
          .filter(file => file.endsWith('.feature'))
          .map(file => path.join(featuresDir, file));
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
