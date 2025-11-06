// backend/routes/livePreviewAPI.js
// 🎬 LIVE PREVIEW SYSTEM - Real-time file serving as code is generated

const express = require('express');
const router = express.Router();
const path = require('path');

// Import caches from masterBuild
let buildFilesCache, activeBuilds;
try {
  const masterBuild = require('./masterBuild');
  buildFilesCache = masterBuild.buildFilesCache;
  activeBuilds = masterBuild.activeBuilds;
} catch (error) {
  console.warn('⚠️ Could not import from masterBuild, using fallback caches');
  buildFilesCache = new Map();
  activeBuilds = new Map();
}

// ==========================================
// MIDDLEWARE: CORS for preview
// ==========================================
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// ==========================================
// GET /api/preview/health - Health Check
// ==========================================
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Live Preview API',
    cached_builds: buildFilesCache.size,
    active_builds: activeBuilds.size,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==========================================
// GET /api/preview/:buildId - Get Build Info
// ==========================================
router.get('/:buildId', (req, res) => {
  try {
    const { buildId } = req.params;
    
    const buildData = activeBuilds.get(buildId);
    const fileCache = buildFilesCache.get(buildId);
    
    if (!buildData && !fileCache) {
      return res.status(404).json({
        error: 'Build not found',
        buildId,
        message: 'Build ID does not exist or has expired'
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    const fileList = Object.keys(files);

    res.json({
      success: true,
      buildId,
      status: buildData?.status || 'unknown',
      phase: buildData?.phase || 'unknown',
      progress: buildData?.progress || 0,
      files_available: fileList.length > 0,
      file_count: fileList.length,
      last_updated: fileCache?.lastUpdated || buildData?.lastUpdated || null,
      metadata: buildData?.metadata || {}
    });

  } catch (error) {
    console.error('❌ Build info error:', error);
    res.status(500).json({
      error: 'Failed to get build info',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/:buildId/files - List All Files
// ==========================================
router.get('/:buildId/files', (req, res) => {
  try {
    const { buildId } = req.params;
    const { category } = req.query; // frontend, backend, database
    
    const fileCache = buildFilesCache.get(buildId);
    const buildData = activeBuilds.get(buildId);
    
    if (!fileCache && !buildData) {
      const project = ProjectService.findById(buildId);
  if (project?.generatedFiles) {
    return {
      files: project.generatedFiles,
      stats: project.fileStats,
      lastUpdated: project.lastFileUpdate
    };
  }
      return res.status(404).json({
        error: 'Build not found',
        buildId,
        available: false
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    let fileList = Object.keys(files);

    // Filter by category if specified
    if (category) {
      if (category === 'frontend') {
        fileList = fileList.filter(f => f.startsWith('src/') || f.startsWith('public/') || f.includes('App.') || f.includes('index.'));
      } else if (category === 'backend') {
        fileList = fileList.filter(f => f.startsWith('routes/') || f.startsWith('controllers/') || f.startsWith('middleware/') || f.includes('server.'));
      } else if (category === 'database') {
        fileList = fileList.filter(f => f.startsWith('prisma/') || f.includes('schema.'));
      }
    }

    // Organize files by directory
    const fileTree = {};
    fileList.forEach(filepath => {
      const parts = filepath.split('/');
      const fileName = parts.pop();
      const directory = parts.join('/') || 'root';
      
      if (!fileTree[directory]) {
        fileTree[directory] = [];
      }
      
      fileTree[directory].push({
        name: fileName,
        path: filepath,
        size: files[filepath]?.length || 0,
        type: getFileType(fileName)
      });
    });

    res.json({
      success: true,
      buildId,
      file_count: fileList.length,
      total_count: Object.keys(files).length,
      files: fileList,
      file_tree: fileTree,
      last_updated: fileCache?.lastUpdated || buildData?.lastUpdated,
      available: fileList.length > 0,
      stats: fileCache?.stats || buildData?.stats || {}
    });

  } catch (error) {
    console.error('❌ Files list error:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/:buildId/file/* - Get Specific File
// ==========================================
router.get('/:buildId/file/*', (req, res) => {
  try {
    const { buildId } = req.params;
    const filePath = req.params[0]; // Everything after /file/
    
    if (!filePath) {
      return res.status(400).json({
        error: 'File path required',
        message: 'Specify file path after /file/'
      });
    }

    const fileCache = buildFilesCache.get(buildId);
    const buildData = activeBuilds.get(buildId);
    
    if (!fileCache && !buildData) {
      return res.status(404).json({
        error: 'Build not found',
        buildId
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    const content = files[filePath];

    if (!content) {
      return res.status(404).json({
        error: 'File not found',
        buildId,
        filePath,
        available_files: Object.keys(files).slice(0, 20),
        total_files: Object.keys(files).length
      });
    }

    // Determine content type
    const contentType = getContentType(filePath);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-File-Path', filePath);
    res.setHeader('X-Build-ID', buildId);
    
    res.send(content);

  } catch (error) {
    console.error('❌ File fetch error:', error);
    res.status(500).json({
      error: 'Failed to get file',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/:buildId/bundle - Get All Files as JSON
// ==========================================
router.get('/:buildId/bundle', (req, res) => {
  try {
    const { buildId } = req.params;
    const { compress } = req.query; // ?compress=true for minified
    
    const fileCache = buildFilesCache.get(buildId);
    const buildData = activeBuilds.get(buildId);
    
    if (!fileCache && !buildData) {
      return res.status(404).json({
        error: 'Build not found',
        buildId
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    const stats = fileCache?.stats || buildData?.stats || {};

    const bundle = {
      success: true,
      buildId,
      file_count: Object.keys(files).length,
      files: files,
      stats: stats,
      last_updated: fileCache?.lastUpdated || buildData?.lastUpdated,
      metadata: buildData?.metadata || {},
      generated_at: new Date().toISOString()
    };

    if (compress === 'true') {
      // Send compressed (no pretty print)
      res.json(bundle);
    } else {
      // Send pretty printed
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(bundle, null, 2));
    }

  } catch (error) {
    console.error('❌ Bundle error:', error);
    res.status(500).json({
      error: 'Failed to get bundle',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/:buildId/download - Download Specific File
// ==========================================
router.get('/:buildId/download/*', (req, res) => {
  try {
    const { buildId } = req.params;
    const filePath = req.params[0];
    
    const fileCache = buildFilesCache.get(buildId);
    const buildData = activeBuilds.get(buildId);
    
    if (!fileCache && !buildData) {
      return res.status(404).json({
        error: 'Build not found',
        buildId
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    const content = files[filePath];

    if (!content) {
      return res.status(404).json({
        error: 'File not found',
        filePath
      });
    }

    const fileName = path.basename(filePath);
    const contentType = getContentType(filePath);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(content);

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      error: 'Failed to download file',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/:buildId/search - Search Files
// ==========================================
router.get('/:buildId/search', (req, res) => {
  try {
    const { buildId } = req.params;
    const { q, type, limit = 50 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Search query required',
        message: 'Provide query parameter ?q=searchterm'
      });
    }

    const fileCache = buildFilesCache.get(buildId);
    const buildData = activeBuilds.get(buildId);
    
    if (!fileCache && !buildData) {
      return res.status(404).json({
        error: 'Build not found',
        buildId
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    const query = q.toLowerCase();
    const results = [];

    Object.entries(files).forEach(([filepath, content]) => {
      // Filter by file type if specified
      if (type) {
        const fileType = getFileType(filepath);
        if (fileType !== type) return;
      }

      // Search in filename
      if (filepath.toLowerCase().includes(query)) {
        results.push({
          path: filepath,
          match_type: 'filename',
          preview: content.substring(0, 200)
        });
        return;
      }

      // Search in content
      const contentLower = content.toLowerCase();
      const index = contentLower.indexOf(query);
      
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + 150);
        const preview = content.substring(start, end);
        
        results.push({
          path: filepath,
          match_type: 'content',
          preview: preview,
          position: index
        });
      }
    });

    res.json({
      success: true,
      buildId,
      query: q,
      result_count: results.length,
      results: results.slice(0, parseInt(limit)),
      total_files_searched: Object.keys(files).length
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/:buildId/stats - Get Build Stats
// ==========================================
router.get('/:buildId/stats', (req, res) => {
  try {
    const { buildId } = req.params;
    
    const fileCache = buildFilesCache.get(buildId);
    const buildData = activeBuilds.get(buildId);
    
    if (!fileCache && !buildData) {
      return res.status(404).json({
        error: 'Build not found',
        buildId
      });
    }

    const files = fileCache?.files || buildData?.files || {};
    const stats = fileCache?.stats || buildData?.stats || {};

    // Calculate file stats
    const fileStats = {
      total_files: Object.keys(files).length,
      total_size: Object.values(files).reduce((sum, content) => sum + content.length, 0),
      by_type: {}
    };

    Object.keys(files).forEach(filepath => {
      const type = getFileType(filepath);
      if (!fileStats.by_type[type]) {
        fileStats.by_type[type] = { count: 0, size: 0 };
      }
      fileStats.by_type[type].count++;
      fileStats.by_type[type].size += files[filepath].length;
    });

    res.json({
      success: true,
      buildId,
      status: buildData?.status || 'unknown',
      progress: buildData?.progress || 0,
      phase: buildData?.phase || 'unknown',
      build_stats: stats,
      file_stats: fileStats,
      started_at: buildData?.started_at,
      last_updated: fileCache?.lastUpdated || buildData?.lastUpdated,
      elapsed_time: buildData?.started_at ? 
        Math.round((Date.now() - new Date(buildData.started_at).getTime()) / 1000) : 0
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

// ==========================================
// POST /api/preview/clear/:buildId - Clear Cache
// ==========================================
router.post('/clear/:buildId', (req, res) => {
  try {
    const { buildId } = req.params;
    
    const existed = buildFilesCache.has(buildId);
    buildFilesCache.delete(buildId);

    res.json({
      success: true,
      buildId,
      cleared: existed,
      message: existed ? 'Cache cleared successfully' : 'Build not found in cache'
    });

  } catch (error) {
    console.error('❌ Clear cache error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/preview/list - List All Cached Builds
// ==========================================
router.get('/list', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const builds = [];
    let index = 0;
    
    buildFilesCache.forEach((cache, buildId) => {
      if (index >= parseInt(offset) && builds.length < parseInt(limit)) {
        const buildData = activeBuilds.get(buildId);
        
        builds.push({
          build_id: buildId,
          file_count: Object.keys(cache.files || {}).length,
          last_updated: cache.lastUpdated,
          status: buildData?.status || 'unknown',
          project_name: buildData?.metadata?.projectName || 'Unknown',
          stats: cache.stats || {}
        });
      }
      index++;
    });

    res.json({
      success: true,
      builds,
      total: buildFilesCache.size,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('❌ List builds error:', error);
    res.status(500).json({
      error: 'Failed to list builds',
      message: error.message
    });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getContentType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  
  const contentTypes = {
    '.js': 'application/javascript',
    '.jsx': 'application/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.html': 'text/html',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip'
  };

  return contentTypes[ext] || 'text/plain';
}

function getFileType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  
  const typeMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.md': 'markdown',
    '.sql': 'sql',
    '.prisma': 'prisma',
    '.env': 'env',
    '.txt': 'text'
  };

  return typeMap[ext] || 'other';
}

// Export router and caches
module.exports = { router, buildFilesCache };
console.log('✅ Live Preview API initialized');