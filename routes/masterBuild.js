// backend/routes/masterBuild.js
const express = require('express');
const router = express.Router();
const MasterOrchestrator = require('../agents/masterOrchestrator');
const { authenticateToken } = require('./auth');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

// Middleware
const checkTier = (req, res, next) => {
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// In-memory storage for build progress (use Redis in production)
const buildProgress = new Map();
const buildResults = new Map();

// ==========================================
// POST /api/master/build - START MASTER BUILD
// ==========================================
router.post('/build', checkTier, authenticateToken, async (req, res) => {
  try {
    const {
      projectName,
      description,
      targetCountry,
      features,
      targetPlatform,
      framework,
      database
    } = req.body;

    // Validation
    if (!projectName || !description) {
      return res.status(400).json({
        error: 'Project name and description required'
      });
    }

    if (description.length < 20) {
      return res.status(400).json({
        error: 'Please provide a detailed description (minimum 20 characters)'
      });
    }

    // Check credits
    const user = req.user;
    if (user.credits <= 0) {
      return res.status(403).json({
        error: 'No credits remaining',
        upgrade_url: '/pricing'
      });
    }

    // Generate build ID
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize progress tracking
    buildProgress.set(buildId, {
      status: 'started',
      phase: 'research',
      progress: 0,
      started_at: new Date().toISOString(),
      user_id: user.id
    });

    // Prepare project data
    const projectData = {
      projectName,
      description,
      targetCountry: targetCountry || 'Global',
      features: features || [],
      targetPlatform: targetPlatform || 'web',
      framework: framework || 'react',
      database: database || 'postgresql',
      buildId,
      userId: user.id,
      tier: req.userTier
    };

    // Start build async (don't wait)
    runMasterBuild(buildId, projectData, req.userTier)
      .catch(error => {
        console.error(`Build ${buildId} failed:`, error);
        buildProgress.set(buildId, {
          status: 'failed',
          error: error.message,
          phase: 'error',
          progress: 0
        });
      });

    // Return immediately with build ID
    res.json({
      success: true,
      build_id: buildId,
      message: 'Build started! Poll /api/master/build/:id for progress',
      estimated_time: '3-5 minutes',
      progress_url: `/api/master/build/${buildId}`,
      tier: req.userTier
    });

  } catch (error) {
    console.error('❌ Master build start error:', error);
    res.status(500).json({
      error: 'Failed to start build',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/build/:id - GET BUILD PROGRESS
// ==========================================
router.get('/build/:id', (req, res) => {
  const { id } = req.params;
  
  const progress = buildProgress.get(id);
  
  if (!progress) {
    return res.status(404).json({
      error: 'Build not found',
      message: 'Invalid build ID or build expired'
    });
  }

  // Check if build is complete
  if (progress.status === 'completed') {
    const results = buildResults.get(id);
    
    return res.json({
      status: 'completed',
      progress: 100,
      results: results,
      download_url: `/api/master/download/${id}`
    });
  }

  // Return current progress
  res.json({
    status: progress.status,
    phase: progress.phase,
    progress: progress.progress,
    current_task: progress.current_task,
    logs: progress.logs || []
  });
});

// ==========================================
// GET /api/master/download/:id - DOWNLOAD BUILD
// ==========================================
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const results = buildResults.get(id);
    
    if (!results) {
      return res.status(404).json({
        error: 'Build not found or expired'
      });
    }

    // Check ownership
    const progress = buildProgress.get(id);
    if (progress.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    // Create ZIP file
    const zipPath = await createDownloadPackage(id, results);

    // Send file
    res.download(zipPath, `${results.phases.strategy.project_name}.zip`, async (err) => {
      if (err) {
        console.error('Download error:', err);
      }

      // Delete file after download
      try {
        await fs.unlink(zipPath);
      } catch (error) {
        console.error('Failed to delete temp file:', error);
      }
    });

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      error: 'Download failed',
      message: error.message
    });
  }
});

// ==========================================
// HELPER: RUN MASTER BUILD (ASYNC)
// ==========================================
async function runMasterBuild(buildId, projectData, tier) {
  const updateProgress = (phase, progress, task, logs = []) => {
    buildProgress.set(buildId, {
      status: 'building',
      phase,
      progress,
      current_task: task,
      logs,
      started_at: buildProgress.get(buildId).started_at,
      user_id: projectData.userId
    });
  };

  const logs = [];
  const addLog = (message) => {
    logs.push({
      message,
      timestamp: new Date().toISOString()
    });
    console.log(`[${buildId}] ${message}`);
  };

  try {
    // Initialize orchestrator
    const orchestrator = new MasterOrchestrator(tier);

    // PHASE 1: RESEARCH (0-30%)
    addLog('🔍 Starting comprehensive market research...');
    updateProgress('research', 5, 'Analyzing market', logs);

    const phase1 = await orchestrator.executePhase1Research(projectData);
    
    addLog(`✅ Found ${phase1.competitors?.individual_analyses?.length || 0} competitors`);
    addLog(`✅ Analyzed ${phase1.reviews?.total_reviews || 0} user reviews`);
    if (phase1.researchPapers) {
      addLog(`✅ Analyzed ${phase1.researchPapers.papers_analyzed} research papers`);
    }
    addLog(`✅ Starving market score: ${phase1.starvingMarket?.score || 0}/100`);
    addLog(`✅ Uniqueness score: ${phase1.uniqueness?.uniqueness_score || 0}/100`);
    
    updateProgress('research', 30, 'Research complete', logs);

    // PHASE 2: STRATEGY (30-50%)
    addLog('🎯 Creating strategic plan with research insights...');
    updateProgress('strategy', 35, 'Applying psychology principles', logs);

    const phase2 = await orchestrator.executePhase2Planning(phase1);
    
    addLog(`✅ Identified ${phase2.competitive_advantages.length} competitive advantages`);
    addLog(`✅ Applied ${phase2.ux_strategy.principles.length} psychology principles`);
    addLog(`✅ Prioritized ${phase2.features_prioritized.length} features`);
    
    updateProgress('strategy', 50, 'Strategy complete', logs);

    // PHASE 3: CODE GENERATION (50-80%)
    addLog('💻 Generating production-ready code...');
    updateProgress('code', 55, 'Designing database schema', logs);

    const phase3 = await orchestrator.executePhase3CodeGeneration(phase2);
    
    addLog(`✅ Created ${phase3.database.stats.total_tables} database tables`);
    
    updateProgress('code', 65, 'Generating backend API', logs);
    addLog(`✅ Generated ${phase3.backend.stats.total_files} backend files`);
    
    updateProgress('code', 75, 'Generating frontend UI', logs);
    addLog(`✅ Generated ${phase3.frontend.stats.total_files} frontend files`);
    addLog(`✅ Applied ${phase3.research_applied.features_from_gaps} research-backed features`);
    
    updateProgress('code', 80, 'Code generation complete', logs);

    // PHASE 4: QUALITY (80-100%)
    addLog('🧪 Running quality assurance tests...');
    updateProgress('testing', 85, 'Testing code quality', logs);

    const phase4 = await orchestrator.executePhase4Quality(phase3);
    
    addLog(`✅ QA Score: ${phase4.qa_results.overall_score}/100`);
    addLog(`✅ Research Implementation Score: ${phase4.research_verification.score}/100`);
    
    updateProgress('testing', 95, 'Packaging application', logs);

    // FINAL: Package results
    const finalResults = {
      success: true,
      build_id: buildId,
      project_name: projectData.projectName,
      phases: {
        research: phase1,
        strategy: phase2,
        code: phase3,
        quality: phase4
      },
      summary: {
        files_generated: phase3.frontend.stats.total_files + phase3.backend.stats.total_files,
        lines_of_code: phase3.frontend.stats.total_lines + phase3.backend.stats.total_lines,
        qa_score: phase4.qa_results.overall_score,
        research_score: phase4.research_verification.score,
        deployment_ready: phase4.deployment_ready,
        competitive_advantages: phase2.competitive_advantages.length,
        time_taken: Math.round((Date.now() - new Date(buildProgress.get(buildId).started_at).getTime()) / 1000)
      },
      tier,
      timestamp: new Date().toISOString()
    };

    // Store results
    buildResults.set(buildId, finalResults);

    // Update progress to completed
    buildProgress.set(buildId, {
      status: 'completed',
      phase: 'done',
      progress: 100,
      current_task: 'Build complete!',
      logs,
      started_at: buildProgress.get(buildId).started_at,
      user_id: projectData.userId,
      completed_at: new Date().toISOString()
    });

    addLog('🎉 Build complete! App is ready to download.');

  } catch (error) {
    console.error(`Build ${buildId} failed:`, error);
    buildProgress.set(buildId, {
      status: 'failed',
      phase: 'error',
      progress: 0,
      error: error.message,
      logs,
      user_id: projectData.userId
    });
  }
}

// ==========================================
// HELPER: CREATE DOWNLOAD PACKAGE
// ==========================================
async function createDownloadPackage(buildId, results) {
  const tempDir = path.join(__dirname, '../temp');
  const zipPath = path.join(tempDir, `${buildId}.zip`);

  // Create temp directory
  await fs.mkdir(tempDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ Created ZIP: ${archive.pointer()} bytes`);
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add files from results
    const { code } = results.phases;

    // Frontend files
    if (code.frontend?.files) {
      Object.entries(code.frontend.files).forEach(([filepath, content]) => {
        archive.append(content, { name: `frontend/${filepath}` });
      });
    }

    // Backend files
    if (code.backend?.files) {
      Object.entries(code.backend.files).forEach(([filepath, content]) => {
        archive.append(content, { name: `backend/${filepath}` });
      });
    }

    // Database files
    if (code.database?.migrations) {
      code.database.migrations.forEach((migration, i) => {
        archive.append(migration.sql, { 
          name: `database/migrations/${String(i + 1).padStart(3, '0')}_${migration.name}.sql` 
        });
      });
    }

    if (code.database?.prismaSchema) {
      archive.append(code.database.prismaSchema, { 
        name: 'backend/prisma/schema.prisma' 
      });
    }

    // Add comprehensive README
    const readme = generateComprehensiveReadme(results);
    archive.append(readme, { name: 'README.md' });

    // Add research report
    const researchReport = generateResearchReport(results.phases.research);
    archive.append(researchReport, { name: 'RESEARCH_REPORT.md' });

    // Add strategic plan
    const strategicPlan = generateStrategicPlan(results.phases.strategy);
    archive.append(strategicPlan, { name: 'STRATEGIC_PLAN.md' });

    // Add deployment guide
    const deployGuide = generateDeploymentGuide(results);
    archive.append(deployGuide, { name: 'DEPLOYMENT_GUIDE.md' });

    archive.finalize();
  });
}

// ==========================================
// HELPER: GENERATE COMPREHENSIVE README
// ==========================================
function generateComprehensiveReadme(results) {
  const { research, strategy, code, quality } = results.phases;
  const { summary } = results;

  return `# ${results.project_name}

**Built with Launch AI** 🚀  
Generated: ${results.timestamp}  
Build ID: ${results.build_id}

---

## 📊 Build Summary

- **Files Generated**: ${summary.files_generated}
- **Lines of Code**: ${summary.lines_of_code.toLocaleString()}
- **QA Score**: ${summary.qa_score}/100
- **Research Score**: ${summary.research_score}/100
- **Deployment Ready**: ${summary.deployment_ready ? '✅ YES' : '⚠️ Needs fixes'}
- **Competitive Advantages**: ${summary.competitive_advantages}
- **Build Time**: ${summary.time_taken}s

---

## 🎯 Competitive Advantages

This app was built with REAL market research and has these unique advantages:

${strategy.competitive_advantages.map((adv, i) => `
### ${i + 1}. ${adv.feature}
- **Source**: ${adv.source}
- **Priority**: ${adv.priority.toUpperCase()}
- **Implementation**: ${adv.implementation}
`).join('\n')}

---

## 🧠 Research-Backed Features

### Market Insights Applied:
- **Starving Market Score**: ${research.starvingMarket?.score || 'N/A'}/100
- **Uniqueness Score**: ${research.uniqueness?.uniqueness_score || 'N/A'}/100
- **Competitors Analyzed**: ${research.competitors?.individual_analyses?.length || 0}
- **User Reviews Analyzed**: ${research.reviews?.total_reviews || 0}

### Pain Points Solved:
${research.reviews?.insights?.top_complaints?.slice(0, 5).map((complaint, i) => `
${i + 1}. **${complaint.complaint}** (${complaint.severity})
   - Solution implemented in the app
`).join('\n') || 'Premium tier: User pain points analyzed'}

---

## 🎨 UX Psychology Applied

${strategy.ux_strategy?.principles?.slice(0, 5).map((principle, i) => `
### ${principle.principle}
- **Where**: ${principle.where}
- **Implementation**: ${principle.implementation}
- **Copy**: "${principle.copy_example}"
`).join('\n') || 'Psychology principles applied throughout the app'}

---

## 💰 Pricing Strategy

${strategy.pricing_strategy?.recommended_tiers?.map(tier => `
### ${tier.name}
- **Price**: ${tier.price_monthly}
- **Target**: ${tier.target}
- **Margin**: ${tier.margin}
`).join('\n')}

**Strategy**: ${strategy.pricing_strategy?.strategy}

---

## 🚀 Quick Start

### Frontend
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

### Backend
\`\`\`bash
cd backend
npm install

# Setup database
createdb ${results.project_name.toLowerCase().replace(/\s+/g, '_')}
# Run migrations in database/migrations/

cp .env.example .env
# Edit .env with your config

npm run dev
\`\`\`

---

## 📁 Project Structure

\`\`\`
${results.project_name}/
├── frontend/         (${code.frontend?.stats?.total_files || 0} files)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── public/
├── backend/          (${code.backend?.stats?.total_files || 0} files)
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── middleware/
└── database/
    └── migrations/   (${code.database?.migrations?.length || 0} migrations)
\`\`\`

---

## 🧪 Quality Assurance

### QA Results: ${quality.qa_results?.overall_score}/100

- **Code Quality**: ${quality.qa_results?.code_quality?.score || 0}/100
- **Functionality**: ${quality.qa_results?.functionality?.score || 0}/100
- **Security**: ${quality.qa_results?.security?.score || 0}/100
- **Performance**: ${quality.qa_results?.performance?.score || 0}/100

### Research Implementation: ${quality.research_verification?.score || 0}/100

**Features Implemented from Research**: ${quality.research_verification?.implemented || 0}/${quality.research_verification?.total || 0}

---

## 📚 Additional Documentation

- **RESEARCH_REPORT.md** - Comprehensive market analysis
- **STRATEGIC_PLAN.md** - Business strategy and roadmap
- **DEPLOYMENT_GUIDE.md** - Step-by-step deployment instructions

---

## 🆘 Support

Questions? Issues?
- Email: support@launch-ai.com
- Discord: [Join Community](https://discord.gg/launch-ai)
- Docs: [docs.launch-ai.com](https://docs.launch-ai.com)

---

**Built with ❤️ by Launch AI**  
*From idea to deployed app in minutes*
`;
}

function generateResearchReport(research) {
  return `# 📊 Market Research Report

Generated: ${new Date().toISOString()}

---

## Executive Summary

${research.starvingMarket ? `
### Starving Market Analysis
- **Is Starving Market**: ${research.starvingMarket.is_starving_market ? '✅ YES' : '❌ NO'}
- **Score**: ${research.starvingMarket.score}/100
- **Demand Level**: ${research.starvingMarket.demand_level}
- **Satisfaction with Existing Solutions**: ${research.starvingMarket.satisfaction_with_existing}
- **Trend Direction**: ${research.starvingMarket.trend_direction}

**Reasoning**: ${research.starvingMarket.reasoning}

**Opportunity Rating**: ${research.starvingMarket.opportunity_rating}
` : ''}

${research.uniqueness ? `
### Uniqueness Analysis
- **Uniqueness Score**: ${research.uniqueness.uniqueness_score}/100

**Truly Unique Aspects**:
${research.uniqueness.truly_unique_aspects?.map(aspect => `- ${aspect}`).join('\n')}

**Similar to Competitors**:
${research.uniqueness.similar_to_competitors?.map(aspect => `- ${aspect}`).join('\n')}

**Differentiation Strategy**: ${research.uniqueness.differentiation_strategy}
` : ''}

---

## Market Overview

### Market Size
${research.market?.market_overview ? `
- **TAM**: ${research.market.market_overview.tam || 'N/A'}
- **Growth Rate**: ${research.market.market_overview.growth_rate || 'N/A'}
- **Maturity**: ${research.market.market_overview.maturity || 'N/A'}
` : 'Market data unavailable'}

### Competition Level
**${research.market?.competition_level || 'N/A'}**

---

## Competitor Analysis

${research.competitors?.individual_analyses?.map((comp, i) => `
### ${i + 1}. ${comp.name}

**Market Position**: ${comp.estimated_market_position || 'Unknown'}

**Strengths**:
${comp.strengths?.map(s => `- ${s}`).join('\n') || 'N/A'}

**Weaknesses (Our Opportunities)**:
${comp.weaknesses?.map(w => `- ${w}`).join('\n') || 'N/A'}

**Unique Selling Points**:
${comp.unique_selling_points?.map(usp => `- ${usp}`).join('\n') || 'N/A'}

**Business Model**: ${comp.business_model || 'Unknown'}
**Pricing Strategy**: ${comp.pricing_strategy || 'Unknown'}

---
`).join('\n') || 'No competitor data available'}

## User Review Analysis

${research.reviews ? `
### Overall Sentiment
- **Average Score**: ${research.reviews.sentiment?.average_score || 'N/A'}
- **Overall Sentiment**: ${research.reviews.sentiment?.overall_sentiment || 'N/A'}

**Distribution**:
- Positive: ${research.reviews.sentiment?.distribution?.positive || '0%'}
- Neutral: ${research.reviews.sentiment?.distribution?.neutral || '0%'}
- Negative: ${research.reviews.sentiment?.distribution?.negative || '0%'}

### Top User Complaints

${research.reviews.insights?.top_complaints?.map((complaint, i) => `
${i + 1}. **${complaint.complaint}** (${complaint.severity})
   - Frequency: ${complaint.frequency}
   - Example: "${complaint.example_quote}"
`).join('\n')}

### Most Requested Features

${research.reviews.insights?.feature_requests?.map((request, i) => `
${i + 1}. **${request.feature}** (Demand: ${request.demand})
   - Example: "${request.example_quote}"
`).join('\n')}
` : 'Review analysis available in Starter tier and above'}

---

## Research Papers Analysis

${research.researchPapers ? `
**Papers Analyzed**: ${research.researchPapers.papers_analyzed}

### Key Innovations

${research.researchPapers.innovations?.map((innovation, i) => `
${i + 1}. **${innovation.innovation}**
   - From: ${innovation.from_paper}
   - Technical Approach: ${innovation.technical_approach}
   - User Benefit: ${innovation.user_benefit}
   - Complexity: ${innovation.implementation_complexity}
   - Competitive Advantage: ${innovation.competitive_advantage}
`).join('\n')}
` : 'Research paper analysis available in Premium tier'}

---

## Financial Analysis

${research.margins ? `
### Cost Structure
- **Initial Development**: ${research.margins.estimated_costs?.initial_development}
- **Monthly Hosting**: ${research.margins.estimated_costs?.monthly_hosting}
- **Monthly Marketing**: ${research.margins.estimated_costs?.monthly_marketing}
- **Support per User**: ${research.margins.estimated_costs?.support_per_user}

### Revenue Potential
- **Monthly per User**: ${research.margins.revenue_per_user?.monthly}
- **Annual per User**: ${research.margins.revenue_per_user?.annual}
- **Lifetime Value**: ${research.margins.revenue_per_user?.lifetime_value}

### Margins
- **Gross Margin**: ${research.margins.margins?.gross_margin_percent}%
- **Net Margin**: ${research.margins.margins?.net_margin_percent}%

### Break-Even Analysis
- **Users Needed**: ${research.margins.break_even?.users_needed}
- **Months to Break-Even**: ${research.margins.break_even?.months_to_break_even}

### Scaling Economics
- At 100 users: ${research.margins.scaling?.margin_at_100_users} margin
- At 1,000 users: ${research.margins.scaling?.margin_at_1000_users} margin
- At 10,000 users: ${research.margins.scaling?.margin_at_10000_users} margin
` : 'Financial analysis not available'}

---

## Recommendations

${research.market?.recommended_strategy || 'Strategic recommendations based on comprehensive analysis'}

**Time to Market**: ${research.market?.estimated_time_to_market || 'TBD'}
**Capital Required**: ${research.market?.capital_required || 'TBD'}

---

*This report was generated using real web scraping, competitor analysis, and AI-powered insights.*
`;
}

function generateStrategicPlan(strategy) {
  return `# 🎯 Strategic Business Plan

Generated: ${new Date().toISOString()}

---

## Competitive Advantages

We've identified **${strategy.competitive_advantages?.length || 0}** competitive advantages based on comprehensive research:

${strategy.competitive_advantages?.map((adv, i) => `
### ${i + 1}. ${adv.feature}

**Type**: ${adv.type}  
**Source**: ${adv.source}  
**Priority**: ${adv.priority.toUpperCase()}  

**Implementation Plan**: ${adv.implementation}

---
`).join('\n')}

## UX Strategy (Psychology-Driven)

${strategy.ux_strategy?.principles?.map((principle, i) => `
### ${i + 1}. ${principle.principle}

**Where to Apply**: ${principle.where}  
**Implementation**: ${principle.implementation}  
**Suggested Copy**: "${principle.copy_example}"

---
`).join('\n')}

### Color Psychology

${strategy.ux_strategy?.color_psychology ? `
- **Primary Color**: ${strategy.ux_strategy.color_psychology.primary}
- **CTA Color**: ${strategy.ux_strategy.color_psychology.cta}
` : ''}

### User Flow Design

${strategy.ux_strategy?.flow_design || 'User journey optimized for conversions'}

---

## Feature Prioritization

Features ranked by impact and research backing:

${strategy.features_prioritized?.map((feature, i) => `
### ${i + 1}. ${feature.feature} (Score: ${feature.score})

- **Priority**: ${feature.priority}
- **Type**: ${feature.type}
- **Source**: ${feature.source}
- **Implementation**: ${feature.implementation}
`).join('\n')}

---

## Pricing Strategy

${strategy.pricing_strategy?.recommended_tiers?.map((tier, i) => `
### ${tier.name}

**Price**: ${tier.price_monthly}  
**Target Market**: ${tier.target}  
**Expected Margin**: ${tier.margin}

---
`).join('\n')}

**Overall Strategy**: ${strategy.pricing_strategy?.strategy}  
**Market Positioning**: ${strategy.pricing_strategy?.positioning}

---

## Implementation Roadmap

### Phase 1: MVP (Months 1-2)
**Critical Features**:
${strategy.implementation_plan?.phase_1_mvp?.map(f => `- ${f.feature}`).join('\n') || 'Core features'}

### Phase 2: Growth (Months 3-6)
**High Priority Features**:
${strategy.implementation_plan?.phase_2_growth?.map(f => `- ${f.feature}`).join('\n') || 'Growth features'}

### Phase 3: Scale (Months 7-12)
**Medium Priority Features**:
${strategy.implementation_plan?.phase_3_scale?.map(f => `- ${f.feature}`).join('\n') || 'Scaling features'}

---

## Go-to-Market Strategy

1. **Launch Strategy**: Target early adopters with pain points we solve
2. **Marketing Channels**: Focus on channels where competitors are weak
3. **Growth Tactics**: Leverage our competitive advantages in messaging
4. **Retention**: Solve the top complaints users have about competitors

---

*This strategic plan is based on real market data, competitor weaknesses, and user pain points.*
`;
}

function generateDeploymentGuide(results) {
  return `# 🚀 Deployment Guide

Quick guide to deploying your ${results.project_name}

---

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Vercel account (frontend)
- Railway account (backend)

---

## Option 1: Quick Deploy (Recommended)

### Step 1: Deploy Backend to Railway

\`\`\`bash
cd backend
npm install -g @railway/cli
railway login
railway init
railway up
railway add --database postgres
\`\`\`

**Environment Variables to Set in Railway**:
\`\`\`
NODE_ENV=production
JWT_SECRET=[generate with: openssl rand -hex 32]
ANTHROPIC_API_KEY=your_key_here
RAZORPAY_KEY_ID=your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
CORS_ORIGIN=https://your-frontend-domain.vercel.app
\`\`\`

### Step 2: Run Database Migrations

\`\`\`bash
# Connect to Railway database
railway run bash

# Run migrations
psql $DATABASE_URL < database/migrations/001_*.sql
psql $DATABASE_URL < database/migrations/002_*.sql
# ... etc
\`\`\`

### Step 3: Deploy Frontend to Vercel

\`\`\`bash
cd frontend
npm install -g vercel
vercel login
vercel --prod
\`\`\`

**Environment Variables to Set in Vercel**:
\`\`\`
REACT_APP_API_URL=https://your-backend.up.railway.app
REACT_APP_ENV=production
REACT_APP_RAZORPAY_KEY=your_razorpay_key
\`\`\`

### Step 4: Test Your App

1. Visit your Vercel URL
2. Try creating an account
3. Test the main features
4. Check Railway logs for errors

---

## Option 2: Deploy to Render (Full-Stack)

### Single Command Deployment

\`\`\`bash
# Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git push origin main

# Then on render.com:
# 1. New → Web Service
# 2. Connect GitHub repo
# 3. Build: npm install && npm run build
# 4. Start: npm start
# 5. Add PostgreSQL database
\`\`\`

---

## Post-Deployment Checklist

- [ ] Frontend loads correctly
- [ ] Backend health check works (GET /health)
- [ ] Database connection successful
- [ ] User registration works
- [ ] Payment flow works (test mode)
- [ ] All API endpoints return correctly
- [ ] CORS configured properly
- [ ] SSL/HTTPS enabled
- [ ] Environment variables set
- [ ] Error logging configured

---

## Monitoring

### Backend Logs (Railway)
\`\`\`bash
railway logs
\`\`\`

### Frontend Logs (Vercel)
Visit: https://vercel.com/dashboard → Your Project → Logs

---

## Troubleshooting

### CORS Errors
- Check CORS_ORIGIN in backend matches your frontend URL
- Ensure URL includes https://

### Database Connection Failed
- Verify DATABASE_URL is set correctly
- Check migrations ran successfully

### API Calls Failing
- Verify REACT_APP_API_URL points to Railway backend
- Check Railway logs for errors

---

## Scaling

### Free Tier Limits:
- Vercel: Unlimited bandwidth, 100GB/month
- Railway: $5/month after free trial

### Recommended Upgrades:
- Month 1-3: Stick with free/cheap tiers
- Month 3-6: Upgrade as users grow
- Month 6+: Consider dedicated infrastructure

---

## Support

Need help deploying?
- Discord: [Join Community](https://discord.gg/launch-ai)
- Email: support@launch-ai.com
- Docs: https://docs.launch-ai.com/deployment

---

**Estimated Deployment Time**: 30 minutes  
**Monthly Cost**: $5-10 to start

Good luck! 🚀
`;
}

// ==========================================
// Clean up old builds (run periodically)
// ==========================================
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  buildProgress.forEach((progress, buildId) => {
    const startTime = new Date(progress.started_at).getTime();
    if (now - startTime > maxAge) {
      buildProgress.delete(buildId);
      buildResults.delete(buildId);
      console.log(`Cleaned up old build: ${buildId}`);
    }
  });
}, 60 * 60 * 1000); // Run every hour

module.exports = router;