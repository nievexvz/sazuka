const multer = require('multer');

// Memory storage untuk handle semua file types
const storage = multer.memoryStorage();

// File filter yang menerima SEMUA jenis file
const fileFilter = (req, file, cb) => {
  // Terima semua jenis file
  cb(null, true);
  
  // Optional: Log file info untuk debugging
  console.log(`📁 File received: ${file.originalname}, MIME: ${file.mimetype}, Size: ${file.size} bytes`);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Hanya 1 file per request
  }
});

module.exports = upload;