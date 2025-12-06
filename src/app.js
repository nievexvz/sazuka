require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables untuk view
app.use((req, res, next) => {
  res.locals.environment = NODE_ENV;
  res.locals.appBaseUrl = APP_BASE_URL;
  res.locals.isProduction = NODE_ENV === 'production';
  next();
});

// Routes utama
app.use('/', uploadRoutes);

// ===== ROUTE UNTUK FILE YANG DIUPLOAD =====
// Route untuk mengakses file yang diupload melalui proxy

// Route khusus untuk 0x0 proxy
app.get('/0x0/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Decode filename
    let decodedFilename = filename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch (e) {}
    
    // 0x0.st URLs: https://0x0.st/filename
    const originalUrl = `https://0x0.st/${decodedFilename}`;
    
    console.log(`📥 Proxying 0x0.st: ${originalUrl}`);
    
    const response = await axios.get(originalUrl, {
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });
    
    // Set headers
    res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    res.set('Cache-Control', 'public, max-age=31536000');
    
    // Stream file
    response.data.pipe(res);
    
  } catch (error) {
    console.error('❌ 0x0.st proxy error:', error.message);
    
    // Fallback: redirect ke URL asli
    res.redirect(`https://0x0.st/${req.params.filename}`);
  }
});

// Route untuk file access
app.get('/:provider/:filename', async (req, res) => {
  try {
    let { provider, filename } = req.params;
    
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {
      // Keep original
    }
    
    // Mapping provider ke URL asli
    const proxyUrls = {
      'gyazo': `https://i.gyazo.com/${filename}`,
      'imgbb': `https://i.ibb.co/${filename}`,
      'uguu': `https://uguu.se/${filename}`,
      'tmpfiles': `https://tmpfiles.org/${filename}`,
      'lanny': `https://lannytourl.vestia.icu/${filename}`,
      'zenxx': `https://zenzxzuploader.koyeb.app/${filename}`,
      'imgkit': `https://ik.imagekit.io/2ndnvlabsimgkit/${filename}`,
      'nekohime': `https://cdn.nekohime.site/${filename}`,
      'yupra': `https://cdn.yupra.my.id/${filename}`,
      'nauval': `https://nauval.cloud/${filename}`,
      'quax': `https://qu.ax/${filename}`,
      'deline': `https://api.deline.web.id/${filename}`,
      'shinai': `https://shinai.my.id/${filename}`,
      'cloudinary': `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${filename}`,
      'zenitsu': `https://api.zenitsu.web.id/get/${filename}`,
      'hamzzz': `https://cloud-api.hamzzz.my.id/file/${filename}`,
      '0x0': `https://0x0.st/${filename}`,
      'catbox': `https://files.catbox.moe/${filename}`,
      'lunara': `https://lunara.drizznesiasite.biz.id/f/${filename}`,
      'zynaaa': `https://zynnaa-uploader.hf.space/${filename}`
    };

    if (!proxyUrls[provider]) {
      return res.status(404).json({
        success: false,
        error: `Provider ${provider} not supported`
      });
    }

    const originalUrl = proxyUrls[provider];
    console.log(`📥 Proxying: ${originalUrl}`);

    const response = await axios.get(originalUrl, {
      responseType: 'stream',
      timeout: 10000
    });

    // Forward headers
    res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    res.set('Cache-Control', 'public, max-age=31536000');

    response.data.pipe(res);

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Fallback redirect
    const { provider, filename } = req.params;
    const fallbackUrls = {
      'catbox': `https://files.catbox.moe/${filename}`,
      'gyazo': `https://i.gyazo.com/${filename}`,
      'imgbb': `https://i.ibb.co/${filename}`,
      'uguu': `https://uguu.se/${filename}`,
      'tmpfiles': `https://tmpfiles.org/${filename}`,
      'lanny': `https://lannytourl.vestia.icu/${filename}`,
      'zenxx': `https://zenzxzuploader.koyeb.app/${filename}`,
      'imgkit': `https://ik.imagekit.io/2ndnvlabsimgkit/${filename}`,
      'zenitsu': `https://api.zenitsu.web.id/get/${filename}`,
      '0x0': `https://0x0.st/${filename}`,
      'hamzzz': `https://cloud-api.hamzzz.my.id/file/${filename}`,
      'lunara': `https://lunara.drizznesiasite.biz.id/f/${filename}`,
      'zynaaa': `https://zynnaa-uploader.hf.space/${filename}`
    };

    if (fallbackUrls[provider]) {
      return res.redirect(fallbackUrls[provider]);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch file'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: NODE_ENV,
    baseUrl: APP_BASE_URL,
    timestamp: new Date().toISOString(),
    supportedProviders: [
      'deline', 'nekohime', 'yupra', 'quax', 'uguu', 'lanny',
      'gyazo', 'imgbb', 'imgkit', 'cloudinary', 'tmpfiles',
      'nauval', 'zenxx', 'shinai', 'catbox', 'zenitsu', 'hamzzz', '0x0' // 'lunara', 'zynaaa'
    ]
  });
});

// 404 handler untuk API
app.use((req, res, next) => {
  if (req.accepts('html')) {
    // Jika request HTML, tampilkan halaman error
    const providers = [
      'deline', 'nekohime', 'yupra', 'quax', 'uguu', 'lanny',
      'gyazo', 'imgbb', 'imgkit', 'cloudinary', 'tmpfiles',
      'nauval', 'zenxx', 'shinai', 'catbox', 'zenitsu', 'hamzzz', '0x0' // 'lunara', 'zynaaa'
    ];
    
    return res.status(404).render('error', {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist.',
      providers: providers
    });
  }
  
  // Jika request JSON, kirim response JSON
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    environment: NODE_ENV,
    baseUrl: APP_BASE_URL,
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    environment: NODE_ENV,
    message: NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔗 Base URL: ${APP_BASE_URL}`);
  console.log(`📁 Homepage: ${APP_BASE_URL}`);
  console.log(`🏥 Health check: ${APP_BASE_URL}/health`);
  console.log(`📤 Upload endpoints (POST):`);
  console.log(`   ${APP_BASE_URL}/deline`);
  console.log(`   ${APP_BASE_URL}/nekohime`);
  console.log(`   ${APP_BASE_URL}/yupra`);
  console.log(`   ... and 12 more providers!`);
  console.log(`📥 File access (GET): ${APP_BASE_URL}/:provider/:filename`);
  console.log(`📦 Supports: Images, Videos, PDFs, Documents, Archives, and all file types!`);
});
