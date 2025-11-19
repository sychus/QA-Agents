import { GherkinAgent } from './agents/GherkinAgent';
import { WebExecutorAgent } from './agents/WebExecutorAgent';
import { SalesforceExecutorAgent } from './agents/SalesforceExecutorAgent';
import { DiagnosticAgent } from './agents/DiagnosticAgent';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

interface QAOrchestratorConfig {
  [key: string]: any;
}

interface Agents {
  gherkin: GherkinAgent;
  webExecutor: WebExecutorAgent;
  salesforceExecutor: SalesforceExecutorAgent;
  diagnostic: DiagnosticAgent;
}

interface StepResult {
  success: boolean;
  step: string;
  action: string;
  screenshot?: any;
  timestamp: string;
  error?: string;
  diagnostics?: any;
  diagnostic?: any;
}

interface ScenarioResult {
  name: string;
  context: string;
  steps: StepResult[];
  status: 'passed' | 'failed' | 'error' | 'running';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

interface FeatureResult {
  featureFile: string;
  scenarios: ScenarioResult[];
  startTime: Date;
  endTime?: Date;
  status: 'passed' | 'failed' | 'error' | 'running';
  error?: string;
}

interface OverallStats {
  totalFeatures: number;
  totalScenarios: number;
  totalSteps: number;
  passed: number;
  failed: number;
  startTime: Date | null;
  endTime: Date | null;
}

/**
 * QAOrchestrator - Main orchestrator for the QA agents system
 * Coordinates the collaborative execution of all agents
 */
export class QAOrchestrator {
  private config: QAOrchestratorConfig;
  private agents: Agents;
  private results: FeatureResult[];
  private overallStats: OverallStats;

  constructor(config: QAOrchestratorConfig = {}) {
    this.config = config;
    this.agents = {
      gherkin: new GherkinAgent(config),
      webExecutor: new WebExecutorAgent(config),
      salesforceExecutor: new SalesforceExecutorAgent(config),
      diagnostic: new DiagnosticAgent(config)
    };
    
    this.results = [];
    this.overallStats = {
      totalFeatures: 0,
      totalScenarios: 0,
      totalSteps: 0,
      passed: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Execute complete test suite from Gherkin files
   */
  async runTestSuite(featureFiles: string[]): Promise<any> {
    console.info(chalk.bold.cyan('\n🚀 STARTING QA AGENTS COLLABORATIVE SYSTEM\n'));
    console.info(chalk.gray('═'.repeat(70)) + '\n');
    
    this.overallStats.startTime = new Date();
    this.overallStats.totalFeatures = featureFiles.length;

    const spinner = ora('Initializing agents...').start();

    try {
      for (const featureFile of featureFiles) {
        await this.runFeature(featureFile);
      }

      this.overallStats.endTime = new Date();
      spinner.succeed('Tests completed');

      // Generate final report
      const report = await this.generateFinalReport();
      
      return report;

    } catch (error: any) {
      spinner.fail(`Critical error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute an individual feature
   */
  async runFeature(featureFile: string): Promise<void> {
    console.info(chalk.bold.blue(`\n📋 Feature: ${path.basename(featureFile)}`));
    console.info(chalk.gray('─'.repeat(70)));

    const featureResult: FeatureResult = {
      featureFile: featureFile,
      scenarios: [],
      startTime: new Date(),
      status: 'running'
    };

    try {
      // 1. GHERKIN AGENT: Parse and interpret
      const spinner = ora('🤖 Gherkin Agent parsing scenarios...').start();
      const testPlan = await this.agents.gherkin.parseAndPlan(featureFile);
      spinner.succeed(`Found ${testPlan.scenarios.length} scenario(s)`);

      this.overallStats.totalScenarios += testPlan.scenarios.length;

      // 2. Determine appropriate executor
      const executor = this.selectExecutor(testPlan.type);
      await executor.initialize();

      // 3. Execute each scenario
      for (const scenario of testPlan.scenarios) {
        const scenarioResult = await this.runScenario(scenario, executor);
        featureResult.scenarios.push(scenarioResult);
      }

      // 4. Cleanup
      await executor.cleanup();

      featureResult.status = featureResult.scenarios.every(s => s.status === 'passed') 
        ? 'passed' 
        : 'failed';
      featureResult.endTime = new Date();

      this.results.push(featureResult);

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Feature error: ${error.message}`));
      featureResult.status = 'error';
      featureResult.error = error.message;
      featureResult.endTime = new Date();
      this.results.push(featureResult);
    }
  }

  /**
   * Execute an individual scenario
   */
  async runScenario(scenario: any, executor: any): Promise<ScenarioResult> {
    console.info(chalk.yellow(`\n  📝 Scenario: ${scenario.name}`));

    const scenarioResult: ScenarioResult = {
      name: scenario.name,
      context: scenario.context,
      steps: [],
      status: 'running',
      startTime: new Date()
    };

    try {
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        this.overallStats.totalSteps++;

        // Execute step
        const stepResult = await executor.executeStep(step, i);
        scenarioResult.steps.push(stepResult);

        if (stepResult.success) {
          console.info(chalk.green(`    ✅ Step ${i + 1}: ${step.description}`));
          this.overallStats.passed++;
        } else {
          console.error(chalk.red(`    ❌ Step ${i + 1}: ${step.description}`));
          this.overallStats.failed++;

          // DIAGNOSTIC AGENT: Analyze failure immediately
          await this.analyzeFailed(stepResult, scenario);

          // Stop scenario if a step fails
          scenarioResult.status = 'failed';
          break;
        }
      }

      if (scenarioResult.status === 'running') {
        scenarioResult.status = 'passed';
      }

    } catch (error: any) {
      console.error(chalk.red(`    ⚠️  Unexpected error: ${error.message}`));
      scenarioResult.status = 'error';
      scenarioResult.error = error.message;
      this.overallStats.failed++;
    }

    scenarioResult.endTime = new Date();
    return scenarioResult;
  }

  /**
   * Analyze failed step with Diagnostic Agent
   */
  async analyzeFailed(stepResult: any, scenario: any): Promise<void> {
    console.info(chalk.cyan('\n    🔍 Diagnostic Agent analyzing failure...'));

    try {
      const diagnostic = await this.agents.diagnostic.analyzeFailure(
        stepResult,
        { scenario: scenario.name }
      );

      // Show diagnostic
      console.info(chalk.cyan(`\n    📊 DIAGNOSTIC:`));
      console.info(chalk.white(`       Category: ${chalk.bold(diagnostic.rootCause.category)}`));
      console.info(chalk.white(`       Confidence: ${diagnostic.rootCause.confidence}%`));
      console.info(chalk.white(`       Severity: ${chalk.bold(diagnostic.impact.severity.toUpperCase())}`));
      console.info(chalk.white(`       Immediate fix: ${diagnostic.fix.immediate}`));
      console.info(chalk.white(`       Assigned to: ${diagnostic.suggestedAssignee}`));

      // Save diagnostic
      stepResult.diagnostic = diagnostic;

      // Generate ticket if critical
      if (diagnostic.impact.severity === 'high') {
        console.error(chalk.red(`\n    🚨 CRITICAL issue detected - requires immediate attention`));
      }

    } catch (error: any) {
      console.warn(chalk.yellow(`    ⚠️  Error generating diagnostic: ${error.message}`));
    }
  }

  /**
   * Select the appropriate executor based on test type
   */
  selectExecutor(testType: string): any {
    switch (testType) {
      case 'web':
        console.info(chalk.gray('   → Using Web Executor Agent (Playwright)'));
        return this.agents.webExecutor;
      
      case 'salesforce':
        console.info(chalk.gray('   → Using Salesforce Executor Agent (jsforce)'));
        return this.agents.salesforceExecutor;
      
      case 'api':
        console.info(chalk.gray('   → Using API Executor Agent'));
        // TODO: Implement API executor
        return this.agents.webExecutor;
      
      default:
        console.warn(chalk.gray('   → Unknown type, using Web Executor by default'));
        return this.agents.webExecutor;
    }
  }

  /**
   * Generate consolidated final report
   */
  async generateFinalReport(): Promise<any> {
    console.info(chalk.bold.cyan('\n\n📊 FINAL EXECUTION REPORT'));
    console.info(chalk.gray('═'.repeat(70)));

    const endTime = this.overallStats.endTime || new Date();
    const startTime = this.overallStats.startTime || new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    
    const successRate = this.overallStats.totalSteps > 0
      ? ((this.overallStats.passed / this.overallStats.totalSteps) * 100).toFixed(2)
      : '0';

    console.info(chalk.white(`\n📈 Overall Statistics:`));
    console.info(chalk.white(`   Features executed: ${this.overallStats.totalFeatures}`));
    console.info(chalk.white(`   Scenarios executed: ${this.overallStats.totalScenarios}`));
    console.info(chalk.white(`   Total steps: ${this.overallStats.totalSteps}`));
    console.info(chalk.green(`   ✅ Passed steps: ${this.overallStats.passed}`));
    console.error(chalk.red(`   ❌ Failed steps: ${this.overallStats.failed}`));
    console.info(chalk.white(`   Success rate: ${successRate}%`));
    console.info(chalk.white(`   Total duration: ${duration.toFixed(2)}s`));

    // Summary by feature
    console.info(chalk.white(`\n📋 Summary by Feature:`));
    for (const featureResult of this.results) {
      const icon = featureResult.status === 'passed' ? '✅' : '❌';
      const statusColor = featureResult.status === 'passed' ? chalk.green : chalk.red;
      
      console.info(statusColor(`   ${icon} ${path.basename(featureResult.featureFile)}: ${featureResult.status.toUpperCase()}`));
      
      // Show failed scenarios
      const failedScenarios = featureResult.scenarios.filter(s => s.status === 'failed');
      if (failedScenarios.length > 0) {
        failedScenarios.forEach(scenario => {
          console.error(chalk.red(`      └─ Failed scenario: ${scenario.name}`));
          
          const failedSteps = scenario.steps.filter(s => !s.success);
          failedSteps.forEach(step => {
            console.error(chalk.red(`         • ${step.step}`));
            if (step.diagnostic) {
              console.info(chalk.cyan(`           Fix: ${step.diagnostic.fix.immediate}`));
            }
          });
        });
      }
    }

    // Diagnostics analysis
    const allDiagnostics = this.collectAllDiagnostics();
    if (allDiagnostics.length > 0) {
      console.info(chalk.white(`\n🔍 Diagnostics Summary:`));
      
      const categoryCounts = this.groupByCategory(allDiagnostics);
      Object.entries(categoryCounts).forEach(([category, count]) => {
        console.warn(chalk.yellow(`   • ${category}: ${count} occurrence(s)`));
      });

      // Top issues
      console.warn(chalk.white(`\n🚨 Top Issues Detected:`));
      const topIssues = allDiagnostics
        .filter((d: any) => d.impact.severity === 'high')
        .slice(0, 5);
      
      topIssues.forEach((diag: any, i: number) => {
        console.error(chalk.red(`   ${i + 1}. ${diag.summary}`));
        console.info(chalk.white(`      Category: ${diag.rootCause.category}`));
        console.info(chalk.white(`      Assigned to: ${diag.suggestedAssignee}`));
        console.info(chalk.white(`      Fix: ${diag.fix.immediate}`));
      });
    }

    // Recommendations
    const recommendations = await this.generateRecommendations();
    if (recommendations.length > 0) {
      console.info(chalk.white(`\n💡 Recommendations:`));
      recommendations.forEach((rec, i) => {
        console.info(chalk.cyan(`   ${i + 1}. ${rec}`));
      });
    }

    console.info(chalk.gray('\n' + '═'.repeat(70)));

    // Save report to file
    const report = {
      summary: {
        features: this.overallStats.totalFeatures,
        scenarios: this.overallStats.totalScenarios,
        totalSteps: this.overallStats.totalSteps,
        passed: this.overallStats.passed,
        failed: this.overallStats.failed,
        successRate: parseFloat(successRate),
        duration: duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      },
      results: this.results,
      diagnostics: allDiagnostics,
      recommendations: recommendations
    };

    await this.saveReport(report);

    return report;
  }

  /**
   * Collect all diagnostics from results
   */
  collectAllDiagnostics(): any[] {
    const diagnostics: any[] = [];
    
    for (const feature of this.results) {
      for (const scenario of feature.scenarios) {
        for (const step of scenario.steps) {
          if (step.diagnostic) {
            diagnostics.push(step.diagnostic);
          }
        }
      }
    }
    
    return diagnostics;
  }

  /**
   * Group diagnostics by category
   */
  groupByCategory(diagnostics: any[]): { [key: string]: number } {
    const groups: { [key: string]: number } = {};
    
    for (const diag of diagnostics) {
      const category = diag.rootCause.category;
      groups[category] = (groups[category] || 0) + 1;
    }
    
    return groups;
  }

  /**
   * Generate recommendations based on results
   */
  async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    const diagnostics = this.collectAllDiagnostics();
    const categoryGroups = this.groupByCategory(diagnostics);

    // Recomendaciones basadas en patrones
    if (categoryGroups['UI_CHANGE'] >= 2) {
      recommendations.push('Múltiples fallos por cambios en UI - considerar usar data-testid en lugar de selectores CSS');
    }

    if (categoryGroups['TIMING_ISSUE'] >= 2) {
      recommendations.push('Problemas de timing detectados - revisar performance de la aplicación');
    }

    if (categoryGroups['SALESFORCE_GOVERNOR_LIMIT'] >= 1) {
      recommendations.push('Límites de Governor alcanzados - optimizar queries SOQL y lógica de negocio');
    }

    if (this.overallStats.failed > this.overallStats.passed) {
      recommendations.push('Alta tasa de fallos - considerar revisar la estabilidad del entorno de testing');
    }

    const avgSuccessRate = (this.overallStats.passed / this.overallStats.totalSteps) * 100;
    if (avgSuccessRate < 70) {
      recommendations.push('Tasa de éxito baja - priorizar estabilización de tests antes de agregar nuevos');
    }

    return recommendations;
  }

  /**
   * Analyze failure trends
   */
  analyzeTrends(): any {
    // TODO: Implement trend analysis comparing with previous executions
    return {
      improvement: 0,
      newIssues: [],
      resolvedIssues: []
    };
  }

  /**
   * Save report to file
   */
  async saveReport(report: any): Promise<{ jsonPath: string; htmlPath: string }> {
    const baseReportDir = process.env.REPORT_PATH || './reports';
    
    // Create subdirectory for each feature
    const featureReports: { [featureName: string]: any } = {};
    
    // Group results by feature
    for (const featureResult of this.results) {
      const featureName = path.basename(featureResult.featureFile, '.feature');
      const featureDir = path.join(baseReportDir, featureName);
      
      if (!fs.existsSync(featureDir)) {
        fs.mkdirSync(featureDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create individual feature report
      const featureReport = {
        summary: {
          feature: featureName,
          scenarios: featureResult.scenarios.length,
          totalSteps: featureResult.scenarios.reduce((sum: number, s: any) => sum + s.steps.length, 0),
          passed: featureResult.scenarios.reduce((sum: number, s: any) => 
            sum + s.steps.filter((st: any) => st.success).length, 0),
          failed: featureResult.scenarios.reduce((sum: number, s: any) => 
            sum + s.steps.filter((st: any) => !st.success).length, 0),
          status: featureResult.status,
          startTime: featureResult.startTime,
          endTime: featureResult.endTime,
          duration: featureResult.endTime ? 
            ((new Date(featureResult.endTime).getTime() - new Date(featureResult.startTime).getTime()) / 1000) : 0
        },
        scenarios: featureResult.scenarios,
        diagnostics: this.collectFeatureDiagnostics(featureResult)
      };
      
      // Save feature-specific JSON
      const featureJsonPath = path.join(featureDir, `report-${timestamp}.json`);
      fs.writeFileSync(featureJsonPath, JSON.stringify(featureReport, null, 2));
      
      // Save feature-specific HTML
      const featureHtmlPath = path.join(featureDir, `report-${timestamp}.html`);
      const featureHtml = this.generateFeatureHTMLReport(featureReport);
      fs.writeFileSync(featureHtmlPath, featureHtml);
      
      console.info(chalk.gray(`📄 ${featureName} report: ${featureDir}/`));
      
      featureReports[featureName] = { jsonPath: featureJsonPath, htmlPath: featureHtmlPath };
    }

    // Also save overall summary report in base directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(baseReportDir, `summary-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    console.info(chalk.gray(`\n📄 Overall summary: ${jsonPath}`));

    // HTML summary report
    const htmlPath = path.join(baseReportDir, `summary-${timestamp}.html`);
    const html = this.generateHTMLReport(report);
    fs.writeFileSync(htmlPath, html);
    
    console.info(chalk.gray(`📄 HTML Summary: ${htmlPath}`));

    return { jsonPath, htmlPath };
  }

  /**
   * Collect diagnostics for a specific feature
   */
  collectFeatureDiagnostics(featureResult: any): any[] {
    const diagnostics: any[] = [];
    
    for (const scenario of featureResult.scenarios) {
      for (const step of scenario.steps) {
        if (step.diagnostic) {
          diagnostics.push(step.diagnostic);
        }
      }
    }
    
    return diagnostics;
  }

  /**
   * Generate HTML report for a single feature
   */
  generateFeatureHTMLReport(report: any): string {
    const successRate = report.summary.totalSteps > 0 
      ? ((report.summary.passed / report.summary.totalSteps) * 100).toFixed(2)
      : '0';
    const statusColor = parseFloat(successRate) >= 80 ? 'green' : parseFloat(successRate) >= 50 ? 'orange' : 'red';

    return `<!DOCTYPE html>
<html>
<head>
  <title>${report.summary.feature} - Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card.success { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); }
    .stat-card.failed { background: linear-gradient(135deg, #f44336 0%, #da190b 100%); }
    .stat-value { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    .scenario { margin: 20px 0; padding: 15px; border-left: 4px solid #2196F3; background: #f9f9f9; }
    .passed { border-left-color: #4CAF50; }
    .failed { border-left-color: #f44336; }
    .step { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .step.success { border-left: 3px solid #4CAF50; }
    .step.error { border-left: 3px solid #f44336; }
    .diagnostic { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 ${report.summary.feature}</h1>
    <p><strong>Status:</strong> ${report.summary.status.toUpperCase()}</p>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${report.summary.scenarios}</div>
        <div class="stat-label">Scenarios</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${report.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #${statusColor === 'green' ? '4CAF50' : statusColor === 'orange' ? 'FF9800' : 'f44336'} 0%, #667eea 100%);">
        <div class="stat-value">${successRate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>

    <h2>📋 Scenarios</h2>
    ${report.scenarios.map((scenario: any) => `
      <div class="scenario ${scenario.status}">
        <h3>${scenario.status === 'passed' ? '✅' : '❌'} ${scenario.name}</h3>
        <p><strong>Steps:</strong> ${scenario.steps.length} | <strong>Status:</strong> ${scenario.status.toUpperCase()}</p>
        
        ${scenario.steps.map((step: any) => `
          <div class="step ${step.success ? 'success' : 'error'}">
            <strong>${step.success ? '✅' : '❌'} ${step.step}</strong>
            ${!step.success && step.error ? `<p style="color: #d32f2f; margin: 5px 0;">Error: ${step.error}</p>` : ''}
            ${!step.success && step.diagnostic ? `
              <div class="diagnostic">
                <strong>🔍 Diagnostic:</strong> ${step.diagnostic.rootCause.category}<br>
                <strong>Fix:</strong> ${step.diagnostic.fix.immediate}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `).join('')}

    <p style="text-align: center; color: #999; margin-top: 40px;">
      Generated on ${new Date(report.summary.endTime || Date.now()).toLocaleString()} | Duration: ${report.summary.duration.toFixed(2)}s
    </p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report: any): string {
    const successRate = report.summary.successRate;
    const statusColor = successRate >= 80 ? 'green' : successRate >= 50 ? 'orange' : 'red';

    return `<!DOCTYPE html>
<html>
<head>
  <title>QA Agents Report - ${report.summary.startTime}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card.success { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); }
    .stat-card.failed { background: linear-gradient(135deg, #f44336 0%, #da190b 100%); }
    .stat-value { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    .feature { margin: 20px 0; padding: 15px; border-left: 4px solid #2196F3; background: #f9f9f9; }
    .passed { border-left-color: #4CAF50; }
    .failed { border-left-color: #f44336; }
    .diagnostic { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffc107; }
    .recommendation { background: #d1ecf1; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #17a2b8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 QA Agents - Execution Report</h1>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${report.summary.features}</div>
        <div class="stat-label">Features</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.summary.scenarios}</div>
        <div class="stat-label">Scenarios</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${report.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #${statusColor === 'green' ? '4CAF50' : statusColor === 'orange' ? 'FF9800' : 'f44336'} 0%, #667eea 100%);">
        <div class="stat-value">${successRate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>

    <h2>📋 Results by Feature</h2>
    ${report.results.map((feature: any) => `
      <div class="feature ${feature.status}">
        <h3>${feature.status === 'passed' ? '✅' : '❌'} ${path.basename(feature.featureFile)}</h3>
        <p><strong>Scenarios:</strong> ${feature.scenarios.length} | <strong>Status:</strong> ${feature.status.toUpperCase()}</p>
        ${feature.scenarios.filter((s: any) => s.status === 'failed').map((scenario: any) => `
          <div style="margin-left: 20px;">
            <p><strong>Failed scenario:</strong> ${scenario.name}</p>
            ${scenario.steps.filter((s: any) => !s.success && s.diagnostic).map((step: any) => `
              <div class="diagnostic">
                <strong>🔍 Diagnostic:</strong> ${step.diagnostic.rootCause.category}<br>
                <strong>Fix:</strong> ${step.diagnostic.fix.immediate}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `).join('')}

    ${report.recommendations.length > 0 ? `
      <h2>💡 Recommendations</h2>
      ${report.recommendations.map((rec: string, i: number) => `
        <div class="recommendation">
          <strong>${i + 1}.</strong> ${rec}
        </div>
      `).join('')}
    ` : ''}

    <p style="text-align: center; color: #999; margin-top: 40px;">
      Generated on ${new Date(report.summary.endTime).toLocaleString()} | Duration: ${report.summary.duration.toFixed(2)}s
    </p>
  </div>
</body>
</html>`;
  }
}
