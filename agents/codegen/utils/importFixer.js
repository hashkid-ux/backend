// agents/codegen/utils/importFixer.js
// Auto-fix missing imports by analyzing code usage

class ImportFixer {
  static fix(code, filepath) {
    if (!filepath.endsWith('.js') && !filepath.endsWith('.jsx')) {
      return code;
    }

    let fixed = code;
    const existingImports = this.getExistingImports(code);

    // React hooks detection
    const hooksUsed = this.detectHooksUsed(code);
    if (hooksUsed.length > 0 && !existingImports.includes('react')) {
      const hooksImport = `import React, { ${hooksUsed.join(', ')} } from 'react';`;
      fixed = this.injectImport(fixed, hooksImport);
    }

    // React Router detection
    if (this.usesRouter(code) && !existingImports.includes('react-router-dom')) {
      const routerImports = this.getRouterImports(code);
      if (routerImports.length > 0) {
        fixed = this.injectImport(fixed, `import { ${routerImports.join(', ')} } from 'react-router-dom';`);
      }
    }

    // Lucide icons
    const iconsUsed = this.detectIcons(code);
    if (iconsUsed.length > 0 && !existingImports.includes('lucide-react')) {
      fixed = this.injectImport(fixed, `import { ${iconsUsed.join(', ')} } from 'lucide-react';`);
    }

    // Axios
    if (code.includes('axios.') && !existingImports.includes('axios')) {
      fixed = this.injectImport(fixed, `import axios from 'axios';`);
    }

    // PropTypes
    if (code.includes('PropTypes.') && !existingImports.includes('prop-types')) {
      fixed = this.injectImport(fixed, `import PropTypes from 'prop-types';`);
    }

    // Helmet
    if (code.includes('<Helmet') && !existingImports.includes('react-helmet')) {
      fixed = this.injectImport(fixed, `import { Helmet } from 'react-helmet';`);
    }

    return fixed;
  }

  static getExistingImports(code) {
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  static detectHooksUsed(code) {
    const hooks = [
      'useState', 'useEffect', 'useContext', 'useReducer',
      'useCallback', 'useMemo', 'useRef', 'useImperativeHandle',
      'useLayoutEffect', 'useDebugValue'
    ];
    
    return hooks.filter(hook => {
      const regex = new RegExp(`\\b${hook}\\s*\\(`, 'g');
      return regex.test(code);
    });
  }

  static usesRouter(code) {
    return /\b(BrowserRouter|Routes?|Route|Link|Navigate|useNavigate|useParams|useLocation)\b/.test(code);
  }

  static getRouterImports(code) {
    const routerElements = [
      'BrowserRouter', 'Routes', 'Route', 'Link', 'Navigate',
      'useNavigate', 'useParams', 'useLocation', 'useSearchParams',
      'Outlet', 'NavLink'
    ];
    
    return routerElements.filter(el => {
      const regex = new RegExp(`\\b${el}\\b`, 'g');
      return regex.test(code);
    });
  }

  static detectIcons(code) {
    // Match Lucide icon usage: <IconName /> or IconName
    const iconRegex = /\b([A-Z][a-zA-Z]+)(?=\s*\/?>|\s+className)/g;
    const matches = code.match(iconRegex) || [];
    
    // Common Lucide icon names
    const commonIcons = [
      'Menu', 'X', 'Home', 'User', 'Settings', 'LogOut', 'ChevronDown',
      'ChevronRight', 'Search', 'Bell', 'Mail', 'Phone', 'Calendar',
      'Check', 'Plus', 'Minus', 'Edit', 'Trash', 'Download', 'Upload',
      'Eye', 'EyeOff', 'Lock', 'Unlock', 'Star', 'Heart', 'Share2',
      'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'
    ];
    
    return [...new Set(matches)].filter(icon => commonIcons.includes(icon));
  }

  static injectImport(code, importStatement) {
    // Find first import or start of file
    const firstImportMatch = code.match(/^(import\s+.*?from\s+['"][^'"]+['"];?\s*\n)/m);
    
    if (firstImportMatch) {
      // Insert after first import
      const insertPos = firstImportMatch.index + firstImportMatch[0].length;
      return code.slice(0, insertPos) + importStatement + '\n' + code.slice(insertPos);
    }
    
    // No imports found - add at top (after any comments)
    const codeStart = code.search(/^[^/\s]/m);
    if (codeStart > 0) {
      return code.slice(0, codeStart) + importStatement + '\n\n' + code.slice(codeStart);
    }
    
    return importStatement + '\n\n' + code;
  }

  static validateImports(code) {
    const errors = [];
    
    // Check for common mistakes
    if (code.includes('useState') && !code.includes("from 'react'")) {
      errors.push('useState used but React not imported');
    }
    
    if (code.includes('axios.') && !code.includes("from 'axios'")) {
      errors.push('axios used but not imported');
    }
    
    if (code.includes('<Route') && !code.includes('react-router-dom')) {
      errors.push('Router components used but not imported');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ImportFixer;