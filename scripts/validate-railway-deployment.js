#!/usr/bin/env node

/**
 * Railway Deployment Validation Script
 * 
 * This script validates your project before deploying to Railway:
 * - Checks Git status
 * - Validates builds
 * - Checks environment variables
 * - Verifies database migrations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let issueCount = 0;
let warningCount = 0;

function log(message, type = 'info') {
  const prefix = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  console.log(`${prefix[type]} ${message}`);
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(60)}`);
}

function checkGitStatus() {
  logSection('Checking Git Status');
  try {
    const status = execSync('git status --short', { encoding: 'utf-8' }).trim();
    if (status) {
      log('Uncommitted changes detected:', 'warning');
      console.log(status);
      warningCount++;
      log('Please commit all changes before deploying', 'warning');
    } else {
      log('Git working directory is clean', 'success');
    }
  } catch (error) {
    log('Git not found or not a repository', 'error');
    issueCount++;
  }
}

function checkBackendBuild() {
  logSection('Checking Backend Build');
  try {
    log('Building backend...', 'info');
    execSync('npm run build --prefix backend', { stdio: 'pipe' });
    log('Backend built successfully', 'success');
  } catch (error) {
    log('Backend build failed!', 'error');
    issueCount++;
    log('Run: npm run build --prefix backend', 'info');
  }
}

function checkFrontendBuild() {
  logSection('Checking Frontend Build');
  try {
    log('Building frontend...', 'info');
    execSync('npm run build --prefix frontend', { stdio: 'pipe' });
    log('Frontend built successfully', 'success');
  } catch (error) {
    log('Frontend build failed!', 'error');
    issueCount++;
    log('Run: npm run build --prefix frontend', 'info');
  }
}

function checkEnvFiles() {
  logSection('Checking Environment Files');
  
  const checks = [
    { path: 'backend/.env.example', name: 'Backend .env.example' },
    { path: 'frontend/.env.example', name: 'Frontend .env.example' }
  ];

  checks.forEach(check => {
    if (fs.existsSync(check.path)) {
      log(`${check.name} exists`, 'success');
      const content = fs.readFileSync(check.path, 'utf-8');
      const vars = content.split('\n').filter(line => line && !line.startsWith('#')).length;
      log(`  Contains ${vars} environment variables`, 'info');
    } else {
      log(`${check.name} not found`, 'error');
      issueCount++;
    }
  });
}

function checkMigrationScript() {
  logSection('Checking Database Migration Script');
  
  const migrationPath = 'backend/scripts/migrate.js';
  if (fs.existsSync(migrationPath)) {
    log('Database migration script exists', 'success');
    
    const content = fs.readFileSync(migrationPath, 'utf-8');
    if (content.includes('quotation_counters')) {
      log('Quotation counters table included in migration', 'success');
    } else {
      log('Warning: quotation_counters table not found in migration', 'warning');
      warningCount++;
    }
  } else {
    log('Database migration script not found', 'error');
    issueCount++;
  }
}

function checkDockerFiles() {
  logSection('Checking Docker Configuration');
  
  const dockerfiles = [
    { path: 'backend/Dockerfile', name: 'Backend Dockerfile' },
    { path: 'frontend/Dockerfile', name: 'Frontend Dockerfile' },
    { path: 'Dockerfile', name: 'Root Dockerfile' }
  ];

  dockerfiles.forEach(df => {
    if (fs.existsSync(df.path)) {
      log(`${df.name} exists`, 'success');
    } else {
      log(`${df.name} not found`, 'warning');
      warningCount++;
    }
  });
}

function checkRailwayConfig() {
  logSection('Checking Railway Configuration');
  
  if (fs.existsSync('railway.json')) {
    log('railway.json configuration exists', 'success');
  } else {
    log('railway.json not found', 'warning');
    warningCount++;
  }
}

function checkReadmeFiles() {
  logSection('Checking Documentation');
  
  const docs = [
    { path: 'README.md', name: 'README' },
    { path: 'RAILWAY_COMPLETE_SETUP.md', name: 'Railway Setup Guide' },
    { path: 'DEPLOYMENT.md', name: 'Deployment Guide' }
  ];

  docs.forEach(doc => {
    if (fs.existsSync(doc.path)) {
      log(`${doc.name} exists`, 'success');
    } else {
      log(`${doc.name} not found`, 'warning');
      warningCount++;
    }
  });
}

function checkDependencies() {
  logSection('Checking Package Dependencies');
  
  const packageFiles = [
    { path: 'backend/package.json', name: 'Backend' },
    { path: 'frontend/package.json', name: 'Frontend' }
  ];

  packageFiles.forEach(pkg => {
    if (fs.existsSync(pkg.path)) {
      const content = JSON.parse(fs.readFileSync(pkg.path, 'utf-8'));
      const deps = Object.keys(content.dependencies || {}).length;
      const devDeps = Object.keys(content.devDependencies || {}).length;
      log(`${pkg.name} has ${deps} dependencies and ${devDeps} dev dependencies`, 'success');
      
      // Check for required scripts
      const scripts = content.scripts || {};
      if (scripts.build && scripts.start) {
        log(`  - Has required build and start scripts`, 'success');
      } else {
        log(`  - Missing required build or start scripts!`, 'error');
        issueCount++;
      }
    }
  });
}

function printSummary() {
  logSection('Deployment Validation Summary');
  
  console.log(`\nResults:`);
  console.log(`  Errors: ${issueCount}`);
  console.log(`  Warnings: ${warningCount}`);
  
  if (issueCount === 0) {
    console.log(`\n✓ Your project is ready for Railway deployment!\n`);
    console.log('Next steps:');
    console.log('  1. Push your code: git push origin main');
    console.log('  2. Go to https://railway.app');
    console.log('  3. Follow RAILWAY_COMPLETE_SETUP.md for deployment');
    return 0;
  } else {
    console.log(`\n✗ Fix the ${issueCount} error(s) above before deploying\n`);
    return 1;
  }
}

// Run all checks
console.log(`\n🚀 Railway Deployment Validator\n`);

try {
  checkGitStatus();
  checkBackendBuild();
  checkFrontendBuild();
  checkEnvFiles();
  checkMigrationScript();
  checkDockerFiles();
  checkRailwayConfig();
  checkReadmeFiles();
  checkDependencies();
  
  const exitCode = printSummary();
  process.exit(exitCode);
} catch (error) {
  console.error(`\nValidation script error: ${error.message}`);
  process.exit(1);
}
