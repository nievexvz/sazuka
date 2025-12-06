const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

// Import controller
const {
    uploadFile,
    uploadAny,
    getIndex,
    getUploadPage,
    getEnvironment
} = require('../controllers/uploadController');

// Homepage
router.get('/', getIndex);

// Environment info
router.get('/env', getEnvironment);

// List semua provider (HAPUS odzree, hanya ini 15 provider)
const providers = [
    'deline', 'nekohime', 'yupra', 'quax', 'uguu', 'lanny',
    'gyazo', 'imgbb', 'imgkit', 'cloudinary', 'tmpfiles',
    'nauval', 'zenxx', 'shinai', 'catbox', 'zenitsu', 'hamzzz', '0x0' // 'lunara', 'zynaaa'
];

// Buat route untuk setiap provider
providers.forEach(provider => {
    // Route GET untuk halaman upload
    router.get(`/${provider}`, (req, res) => {
        req.params = { provider: provider };
        return getUploadPage(req, res);
    });
    
    // Route POST untuk upload file
    router.post(`/${provider}`, upload.single('file'), (req, res) => {
        req.params = { provider: provider };
        return uploadFile(req, res);
    });
});

// Route untuk upload ke semua provider
router.post('/upload', upload.single('file'), uploadAny);
router.post('/upload/all', upload.single('file'), uploadAny);

module.exports = router;
