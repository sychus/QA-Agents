module.exports = {
  agents: {
    gherkinInterpreter: {
      role: 'Gherkin Test Interpreter',
      model: 'gpt-4-turbo',
      systemPrompt: `You are a QA expert who analyzes Gherkin scenarios and converts them into executable steps.
      
      Responsibilities:
      1. Parse and understand Gherkin scenarios in English
      2. Identify specific actions (click, type, navigate, validate)
      3. Map business descriptions to technical selectors
      4. Identify required data and validations
      5. Detect context (Web, Salesforce, API)
      
      Respond in structured JSON format with:
      - test type (web, salesforce, api)
      - executable steps with selectors
      - required test data
      - validation points`,
      temperature: 0.3
    },
    
    webTestExecutor: {
      role: 'Web UI Test Executor',
      capabilities: [
        'navigate',
        'click',
        'type',
        'select',
        'validate',
        'screenshot',
        'wait',
        'hover',
        'drag-drop'
      ],
      tools: ['playwright'],
      humanSimulation: {
        enabled: true,
        typingSpeed: { min: 50, max: 150 },
        mouseMovement: true,
        scrollBehavior: 'smooth'
      }
    },
    
    salesforceTestExecutor: {
      role: 'Salesforce Test Executor',
      capabilities: [
        'apex-test',
        'soql-query',
        'ui-automation',
        'flow-test',
        'lwc-test',
        'trigger-test',
        'validation-rule-test'
      ],
      tools: ['jsforce'],
      specialHandling: {
        asyncContext: true,
        governorLimits: true,
        aggregateQueryLimit: 300
      }
    },
    
    diagnosticAnalyzer: {
      role: 'Test Results Analyzer',
      model: 'gpt-4-turbo',
      systemPrompt: `You are an expert analyzing test failures and generating actionable diagnostics.
      
      When analyzing a failure:
      1. Identify root cause (UI change, API error, data issue, timing, etc)
      2. Provide specific steps to reproduce
      3. Suggest immediate fix and long-term solution
      4. Assess impact and priority
      5. Identify related issues
      6. Suggest responsible team (frontend, backend, salesforce)
      
      Respond with structured, actionable format.`,
      temperature: 0.4,
      capabilities: [
        'error-analysis',
        'screenshot-analysis',
        'log-analysis',
        'pattern-matching',
        'recommendation-engine'
      ]
    },
    
    apiTestExecutor: {
      role: 'API Test Executor',
      capabilities: [
        'http-request',
        'response-validation',
        'authentication',
        'data-transformation',
        'performance-check'
      ],
      tools: ['axios', 'supertest']
    }
  },
  
  orchestration: {
    maxConcurrentAgents: 3,
    retryFailedTests: true,
    maxRetries: 2,
    timeoutPerTest: 30000,
    collaborationMode: 'sequential' // 'sequential' or 'parallel'
  },
  
  reporting: {
    formats: ['json', 'html', 'console'],
    screenshotOnFailure: true,
    videoRecording: false,
    detailedLogs: true
  }
};
