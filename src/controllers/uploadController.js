const providerManager = require('../providers');

// List semua provider untuk tampilan
const allProviders = [
    { name: 'deline', endpoint: '/deline', displayName: 'Deline' },
    { name: 'nekohime', endpoint: '/nekohime', displayName: 'Nekohime' },
    { name: 'yupra', endpoint: '/yupra', displayName: 'Yupra' },
    { name: 'quax', endpoint: '/quax', displayName: 'Quax' },
    { name: 'uguu', endpoint: '/uguu', displayName: 'Uguu' },
    { name: 'lanny', endpoint: '/lanny', displayName: 'Lanny' },
    { name: 'gyazo', endpoint: '/gyazo', displayName: 'Gyazo' },
    { name: 'imgbb', endpoint: '/imgbb', displayName: 'ImgBB' },
    { name: 'imgkit', endpoint: '/imgkit', displayName: 'ImageKit' },
    { name: 'cloudinary', endpoint: '/cloudinary', displayName: 'Cloudinary' },
    { name: 'tmpfiles', endpoint: '/tmpfiles', displayName: 'TmpFiles' },
    { name: 'nauval', endpoint: '/nauval', displayName: 'Nauval' },
    { name: 'zenxx', endpoint: '/zenxx', displayName: 'Zenxx' },
    { name: 'shinai', endpoint: '/shinai', displayName: 'Shinai' },
    { name: 'catbox', endpoint: '/catbox', displayName: 'CatBox' },
    { name: 'zenitsu', endpoint: '/zenitsu', displayName: 'Zenitsu' },
    { name: 'hamzzz', endpoint: '/hamzzz', displayName: 'Hamzzz' },
    { name: '0x0', endpoint: '/0x0', displayName: '0x0.st' }
  // { name: 'lunara', endpoint: '/lunara', displayName: 'Lunara' },
  // { name: 'zynaaa', endpoint: '/zynaaa', displayName: 'Zynaaa' }
];

const providerNames = allProviders.map(p => p.name);

// Fungsi untuk upload ke provider tertentu
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const provider = req.params.provider;
        if (!provider) {
            return res.status(400).json({
                success: false,
                error: 'Provider is required'
            });
        }

        if (!providerNames.includes(provider)) {
            return res.status(404).json({
                success: false,
                error: `Provider "${provider}" not found`
            });
        }

        const fileBuffer = req.file.buffer;
        const originalname = req.file.originalname;

        console.log(`📤 Uploading to ${provider}: ${originalname}`);

        const url = await providerManager.uploadToProvider(provider, fileBuffer, originalname);

        res.json({
            success: true,
            url: url,
            provider: provider,
            originalName: originalname,
            environment: providerManager.getEnvironment()
        });
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            environment: providerManager.getEnvironment()
        });
    }
};

// Fungsi untuk upload ke semua provider
const uploadAny = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const fileBuffer = req.file.buffer;
        const originalname = req.file.originalname;

        const results = {};
        const errors = {};

        // Upload ke semua provider secara paralel
        const uploadPromises = providerNames.map(async (provider) => {
            try {
                const url = await providerManager.uploadToProvider(provider, fileBuffer, originalname);
                results[provider] = {
                    success: true,
                    url: url
                };
            } catch (error) {
                errors[provider] = error.message;
                results[provider] = {
                    success: false,
                    error: error.message
                };
            }
        });

        await Promise.all(uploadPromises);

        // Cari provider yang berhasil
        const successfulProviders = Object.entries(results)
            .filter(([_, result]) => result.success)
            .map(([provider, result]) => ({
                provider,
                url: result.url
            }));

        res.json({
            success: successfulProviders.length > 0,
            results: results,
            errors: errors,
            successfulProviders: successfulProviders,
            recommendedUrl: successfulProviders.length > 0 ? successfulProviders[0].url : null,
            environment: providerManager.getEnvironment(),
            baseUrl: providerManager.getBaseUrl()
        });
    } catch (error) {
        console.error('❌ Upload any error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            environment: providerManager.getEnvironment()
        });
    }
};

// Fungsi untuk halaman utama
const getIndex = (req, res) => {
    const baseUrl = providerManager.getBaseUrl();
    const environment = providerManager.getEnvironment();
    
    res.render('index', {
        title: 'Multi-Provider CDN API',
        providers: allProviders,
        appBaseUrl: baseUrl,
        environment: environment,
        isProduction: environment === 'production'
    });
};

// Fungsi untuk halaman upload
const getUploadPage = (req, res) => {
    const provider = req.params.provider;
    
    if (!provider || !providerNames.includes(provider)) {
        return res.redirect('/');
    }

    const baseUrl = providerManager.getBaseUrl();
    const environment = providerManager.getEnvironment();
    
    res.render('upload', {
        title: `Upload to ${provider}`,
        provider: provider,
        endpoint: `/${provider}`,
        appBaseUrl: baseUrl,
        environment: environment,
        isProduction: environment === 'production'
    });
};

// Fungsi untuk info environment
const getEnvironment = (req, res) => {
    res.json({
        environment: providerManager.getEnvironment(),
        baseUrl: providerManager.getBaseUrl(),
        port: process.env.PORT || 3000,
        timestamp: new Date().toISOString(),
        providers: providerNames
    });
};

// Export semua fungsi
module.exports = {
    uploadFile,
    uploadAny,
    getIndex,
    getUploadPage,
    getEnvironment
};
