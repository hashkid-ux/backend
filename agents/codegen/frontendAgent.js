const Anthropic = require('@anthropic-ai/sdk');
const CodeFormatter = require('./utils/codeFormatter');
const FileGenerator = require('./utils/fileGenerator');

class FrontendAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new Anthropic({
      apiKey: tier === 'premium' 
        ? process.env.ANTHROPIC_API_KEY 
        : process.env.ANTHROPIC_API_KEY_FREE
    });
    this.model = 'claude-sonnet-4-5-20250929'; // Best for code generation
  }

  async generateApp(projectData) {
    console.log('⚛️  Frontend Agent starting code generation...');

    const {
      projectName,
      description,
      features,
      designSystem,
      targetPlatform, // 'web', 'mobile', 'both'
      framework, // 'react', 'nextjs', 'react-native'
    } = projectData;

    try {
      const fileGen = new FileGenerator(projectName);

      // Step 1: Generate component architecture
      const architecture = await this.designArchitecture(projectData);

      // Step 2: Generate main components
      const components = await this.generateComponents(architecture, designSystem);

      // Step 3: Generate pages/screens
      const pages = await this.generatePages(architecture, components);

      // Step 4: Generate services (API calls)
      const services = await this.generateServices(features);

      // Step 5: Generate utils
      const utils = await this.generateUtils();

      // Step 6: Assemble all files
      const allFiles = {
        ...this.generateBoilerplate(projectName, framework),
        ...components,
        ...pages,
        ...services,
        ...utils,
      };

      // Format all code
      const formattedFiles = await CodeFormatter.formatMultipleFiles(allFiles);

      // Add to file generator
      Object.entries(formattedFiles).forEach(([path, content]) => {
        fileGen.addFile(path, content, 'frontend');
      });

      return {
        files: formattedFiles,
        architecture,
        stats: fileGen.getStats(),
        download_url: `/download/${projectName}`,
      };

    } catch (error) {
      console.error('❌ Frontend generation error:', error);
      throw error;
    }
  }

  async designArchitecture(projectData) {
    console.log('🏗️  Designing app architecture...');

    const prompt = `Design a React application architecture for this project:

PROJECT: ${projectData.projectName}
DESCRIPTION: ${projectData.description}
FEATURES: ${JSON.stringify(projectData.features, null, 2)}
PLATFORM: ${projectData.targetPlatform}

Create an architecture in JSON format:
{
  "components": [
    {
      "name": "ComponentName",
      "purpose": "What it does",
      "props": ["prop1", "prop2"],
      "state": ["state1", "state2"],
      "api_calls": ["GET /api/users"]
    }
  ],
  "pages": [
    {
      "name": "HomePage",
      "route": "/",
      "components_used": ["Header", "Hero", "Footer"],
      "features": ["feature1"]
    }
  ],
  "routing": [
    {"path": "/", "component": "HomePage"},
    {"path": "/dashboard", "component": "DashboardPage"}
  ],
  "state_management": "context/redux/zustand",
  "api_endpoints": [
    {"method": "GET", "path": "/api/users", "purpose": "Fetch users"}
  ]
}

Be specific and production-ready.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse architecture');

    } catch (error) {
      console.error('❌ Architecture error:', error);
      throw error;
    }
  }

  async generateComponents(architecture, designSystem) {
    console.log('🎨 Generating React components...');

    const components = {};

    // Generate each component
    for (const comp of architecture.components.slice(0, this.tier === 'free' ? 5 : 15)) {
      const code = await this.generateSingleComponent(comp, designSystem);
      components[`src/components/${comp.name}.jsx`] = code;
    }

    return components;
  }

  async generateSingleComponent(compSpec, designSystem) {
    const prompt = `Generate a production-ready React component:

COMPONENT SPEC:
${JSON.stringify(compSpec, null, 2)}

DESIGN SYSTEM:
${JSON.stringify(designSystem, null, 2)}

Requirements:
- Use functional components with hooks
- Include PropTypes
- Add error handling
- Use Tailwind CSS classes
- Include loading states
- Add comments
- Make it accessible (ARIA labels)
- Handle edge cases

Generate ONLY the component code, no explanations.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      let code = response.content[0].text;
      
      // Extract code from markdown if present
      const codeMatch = code.match(/```(?:jsx?|javascript|typescript)?\n([\s\S]*?)```/);
      if (codeMatch) {
        code = codeMatch[1];
      }

      return code.trim();

    } catch (error) {
      console.error(`❌ Component generation error for ${compSpec.name}:`, error);
      return this.generateFallbackComponent(compSpec.name);
    }
  }

  async generatePages(architecture, components) {
    console.log('📄 Generating pages...');

    const pages = {};

    for (const page of architecture.pages.slice(0, this.tier === 'free' ? 3 : 10)) {
      const code = await this.generateSinglePage(page, architecture, components);
      pages[`src/pages/${page.name}.jsx`] = code;
    }

    return pages;
  }

  async generateSinglePage(pageSpec, architecture, components) {
    const prompt = `Generate a React page component:

PAGE SPEC:
${JSON.stringify(pageSpec, null, 2)}

AVAILABLE COMPONENTS:
${Object.keys(components).join(', ')}

Requirements:
- Import and use the specified components
- Add routing if needed (react-router-dom)
- Include SEO meta tags
- Add page-specific logic
- Handle authentication if needed
- Add error boundaries
- Make responsive

Generate ONLY the code, no explanations.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      let code = response.content[0].text;
      const codeMatch = code.match(/```(?:jsx?|javascript|typescript)?\n([\s\S]*?)```/);
      if (codeMatch) {
        code = codeMatch[1];
      }

      return code.trim();

    } catch (error) {
      console.error(`❌ Page generation error for ${pageSpec.name}:`, error);
      return this.generateFallbackPage(pageSpec.name);
    }
  }

  async generateServices(features) {
    console.log('🔌 Generating API services...');

    const services = {};

    const apiService = `import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = \`Bearer \${token}\`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;`;

    services['src/services/api.js'] = apiService;

    return services;
  }

  async generateUtils() {
    const utils = {};

    utils['src/utils/helpers.js'] = `export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};`;

    return utils;
  }

  generateBoilerplate(projectName, framework) {
    const fileGen = new FileGenerator(projectName);
    
    if (framework === 'react') {
      return {
        'public/index.html': fileGen.generateIndexHtml(),
        'src/index.js': fileGen.generateReactIndex(),
        'src/index.css': fileGen.generateBasicCss(),
        'package.json': fileGen.generateReactPackageJson(),
        '.gitignore': fileGen.generateGitignore(),
        'README.md': fileGen.generateReadme(),
      };
    } else if (framework === 'nextjs') {
      return {
        'pages/_app.js': fileGen.generateNextAppJs(),
        'pages/_document.js': fileGen.generateNextDocumentJs(),
        'styles/globals.css': fileGen.generateBasicCss(),
        'package.json': fileGen.generateNextPackageJson(),
        'next.config.js': fileGen.generateNextConfig(),
        '.gitignore': fileGen.generateGitignore(),
      };
    }

    return {};
  }

  generateFallbackComponent(name) {
    return `import React from 'react';

const ${name} = () => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">${name}</h2>
      <p>Component implementation coming soon...</p>
    </div>
  );
};

export default ${name};`;
  }

  generateFallbackPage(name) {
    return `import React from 'react';

const ${name} = () => {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">${name}</h1>
      <p>Page implementation coming soon...</p>
    </div>
  );
};

export default ${name};`;
  }
}

module.exports = FrontendAgent;