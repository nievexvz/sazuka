const axios = require('axios');
const FormData = require('form-data');

class ProviderManager {
  constructor() {
    this.appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    this.nodeEnv = process.env.NODE_ENV || 'development';
  }

  extractFileName(url, originalname) {
    if (!url) return originalname || `${Date.now()}.bin`;

    try {
      const cleanUrl = url.split('?')[0];
      const parts = cleanUrl.split('/');
      let fileName = parts[parts.length - 1];

      try {
        fileName = decodeURIComponent(fileName);
      } catch (e) { }

      if (!fileName || fileName === '' || fileName === 'undefined' || fileName === 'null') {
        fileName = originalname || `${Date.now()}.bin`;
      }

      return fileName;
    } catch (error) {
      return originalname || `${Date.now()}.bin`;
    }
  }

  getCustomUrl(provider, fileName) {
    const encodedFileName = encodeURIComponent(fileName);
    return `${this.appBaseUrl}/${provider}/${encodedFileName}`;
  }

  // DELINE - Gunakan endpoint asli dan debug response
  async uploadToDeline(fileBuffer, originalname) {
    try {
      const formData = new FormData();

      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to Deline: ${originalname}`);

      const response = await axios.post('https://api.deline.web.id/uploader', formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 20000,
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024
      });

      console.log('Deline response status:', response.status);
      console.log('Deline response data:', response.data);

      const data = response.data;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      if (data.status === false || !data.status) {
        const errorMsg = data.message || data.error || 'Upload failed';
        throw new Error(errorMsg);
      }

      let fileUrl = null;

      if (data.url) {
        fileUrl = data.url;
      } else if (data.result && data.result.url) {
        fileUrl = data.result.url;
      } else if (data.files && data.files[0] && data.files[0].url) {
        fileUrl = data.files[0].url;
      } else if (data.link) {
        fileUrl = data.link;
      } else if (data.path) {
        fileUrl = `https://api.deline.web.id${data.path}`;
      }

      if (!fileUrl) {
        const findUrlInObject = (obj) => {
          if (!obj) return null;

          if (typeof obj === 'string' && obj.startsWith('http')) {
            return obj;
          }

          if (typeof obj === 'object') {
            for (const key in obj) {
              if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
                if (typeof obj[key] === 'string' && obj[key].startsWith('http')) {
                  return obj[key];
                }
              }

              if (typeof obj[key] === 'object') {
                const found = findUrlInObject(obj[key]);
                if (found) return found;
              }
            }
          }

          return null;
        };

        fileUrl = findUrlInObject(data);
      }

      if (!fileUrl) {
        console.error('Deline response structure:', JSON.stringify(data, null, 2));
        throw new Error('Could not find URL in response');
      }

      const fileName = this.extractFileName(fileUrl, originalname);
      console.log(`✅ Deline success: ${fileName}`);
      return this.getCustomUrl('deline', fileName);

    } catch (error) {
      console.error('❌ Deline error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      let errorMessage = 'Upload failed';

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 413) {
          errorMessage = 'File too large';
        } else if (status === 415) {
          errorMessage = 'Unsupported file type';
        } else if (status === 500) {
          errorMessage = 'Server error';
        } else if (data && data.message) {
          errorMessage = data.message;
        } else if (data && data.error) {
          errorMessage = data.error;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      }

      throw new Error(`Deline: ${errorMessage}`);
    }
  }

  // NEKOHIME - Debug response lengkap
  async uploadToNekohime(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to Nekohime: ${originalname}`);

      const response = await axios.post('https://cdn.nekohime.site/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 20000
      });

      console.log('Nekohime response status:', response.status);
      console.log('Nekohime response type:', typeof response.data);

      // Tampilkan response mentah
      console.log('Nekohime raw response:', response.data);

      let fileUrl = null;
      const data = response.data;

      // Jika response adalah object
      if (data && typeof data === 'object') {
        // Debug: tampilkan semua keys
        console.log('Nekohime response keys:', Object.keys(data));

        // Cek setiap kemungkinan field
        const possibleFields = ['url', 'fileUrl', 'link', 'file', 'path', 'image'];
        for (const field of possibleFields) {
          if (data[field]) {
            console.log(`Found ${field}:`, data[field]);
            if (typeof data[field] === 'string' && data[field].startsWith('http')) {
              fileUrl = data[field];
              break;
            } else if (typeof data[field] === 'object' && data[field].url) {
              fileUrl = data[field].url;
              break;
            }
          }
        }

        // Cek nested structures
        if (!fileUrl && data.data && data.data.url) {
          fileUrl = data.data.url;
        }
        if (!fileUrl && data.files && data.files[0] && data.files[0].url) {
          fileUrl = data.files[0].url;
        }
        if (!fileUrl && data.result && data.result.url) {
          fileUrl = data.result.url;
        }
      }
      // Jika response adalah string
      else if (typeof data === 'string') {
        console.log('Response is string, searching for URL...');
        const urlMatch = data.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          fileUrl = urlMatch[0];
          console.log('Found URL in string:', fileUrl);
        }
      }

      if (!fileUrl) {
        // Coba parsing sebagai JSON string
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            console.log('Parsed as JSON:', parsed);
            if (parsed.url) fileUrl = parsed.url;
          } catch (e) {
            // Bukan JSON
          }
        }
      }

      if (!fileUrl) {
        // Last resort: cari URL dalam stringified response
        const responseStr = JSON.stringify(data);
        const urlMatch = responseStr.match(/(https?:\/\/[^\s"']+)/);
        if (urlMatch) {
          fileUrl = urlMatch[0];
        }
      }

      if (!fileUrl) {
        console.error('❌ Nekohime - No URL found');
        console.error('Full response:', data);
        throw new Error('Response does not contain a URL');
      }

      const fileName = this.extractFileName(fileUrl, originalname);
      console.log(`✅ Nekohime success: ${fileName}`);
      return this.getCustomUrl('nekohime', fileName);

    } catch (error) {
      console.error('❌ Nekohime error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Nekohime: ${error.response?.data?.message || 'Invalid response format'}`);
    }
  }

  // QUAX - Debug lengkap
  async uploadToQuax(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to Quax: ${originalname}`);

      const response = await axios.post('https://qu.ax/upload.php', formData, {
        headers: formData.getHeaders(),
        timeout: 20000,
        responseType: 'text'
      });

      console.log('Quax response status:', response.status);
      console.log('Quax response headers:', response.headers);
      console.log('Quax raw response (first 500 chars):',
        typeof response.data === 'string' ? response.data.substring(0, 500) : response.data);

      let fileUrl = null;
      const data = response.data;


      if (typeof data === 'string') {
        // Coba parse sebagai JSON
        try {
          const parsed = JSON.parse(data);
          console.log('Quax parsed as JSON:', parsed);

          if (parsed.files?.[0]?.url) {
            fileUrl = parsed.files[0].url;
          } else if (parsed.url) {
            fileUrl = parsed.url;
          } else if (parsed.link) {
            fileUrl = parsed.link;
          }
        } catch (jsonError) {
          // Bukan JSON, cari URL dalam string
          console.log('Not JSON, searching for URL in string...');
          const urlMatch = data.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            fileUrl = urlMatch[0];
            console.log('Found URL:', fileUrl);
          }
        }
      } else if (typeof data === 'object') {
        console.log('Quax response is object:', data);
        if (data.url) fileUrl = data.url;
        else if (data.link) fileUrl = data.link;
      }

      // Fallback: cari URL di stringified response
      if (!fileUrl) {
        const responseStr = JSON.stringify(data);
        const urlMatch = responseStr.match(/(https?:\/\/[^\s"']+)/);
        if (urlMatch) {
          fileUrl = urlMatch[0];
          console.log('Found URL via fallback:', fileUrl);
        }
      }

      if (!fileUrl) {
        console.error('❌ Quax - No URL found');
        console.error('Full response:', data);
        throw new Error('Could not find URL in response');
      }

      const fileName = this.extractFileName(fileUrl, originalname);
      console.log(`✅ Quax success: ${fileName}`);
      return this.getCustomUrl('quax', fileName);

    } catch (error) {
      console.error('❌ Quax error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Quax: ${error.response?.data || error.message}`);
    }
  }

  // NAUVAL - Debug lengkap
  async uploadToNauval(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to Nauval: ${originalname}`);

      const response = await axios.post('https://nauval.cloud/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 20000
      });

      console.log('Nauval response status:', response.status);
      console.log('Nauval response type:', typeof response.data);
      console.log('Nauval raw response:', response.data);

      let fileUrl = null;
      const data = response.data;

      // Debug struktur response
      if (data && typeof data === 'object') {
        console.log('Nauval response keys:', Object.keys(data));

        // Cek berbagai kemungkinan field
        const checkForUrl = (obj, path = '') => {
          if (!obj) return null;

          if (typeof obj === 'string' && obj.startsWith('http')) {
            console.log(`Found URL at ${path}:`, obj);
            return obj;
          }

          if (typeof obj === 'object') {
            // Cek field umum
            const urlFields = ['url', 'link', 'file', 'path', 'src', 'image'];
            for (const field of urlFields) {
              if (obj[field] && typeof obj[field] === 'string' && obj[field].startsWith('http')) {
                console.log(`Found URL at ${path}.${field}:`, obj[field]);
                return obj[field];
              }
            }

            // Cek nested
            for (const key in obj) {
              const found = checkForUrl(obj[key], `${path}.${key}`);
              if (found) return found;
            }
          }

          return null;
        };

        fileUrl = checkForUrl(data, 'data');
      }

      // Jika tidak ditemukan, cari dengan regex
      if (!fileUrl) {
        const responseStr = JSON.stringify(data);
        console.log('Searching for URL in stringified response...');
        const urlMatch = responseStr.match(/(https?:\/\/[^\s"']+)/);
        if (urlMatch) {
          fileUrl = urlMatch[0];
          console.log('Found URL via regex:', fileUrl);
        }
      }

      if (!fileUrl) {
        console.error('❌ Nauval - No URL found');
        console.error('Response structure:', data);
        throw new Error('Response does not contain a URL');
      }

      const fileName = this.extractFileName(fileUrl, originalname);
      console.log(`✅ Nauval success: ${fileName}`);
      return this.getCustomUrl('nauval', fileName);

    } catch (error) {
      console.error('❌ Nauval error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Nauval: ${error.response?.data?.message || error.message}`);
    }
  }

  // ZENITSU - Menggunakan getCustomUrl untuk konsistensi
  async uploadToZenitsu(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to Zenitsu: ${originalname}`);

      const response = await axios.post('https://cdn.zenitsu.web.id/cdn/zenitsu', formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      console.log('Zenitsu response:', response.data);

      const data = response.data;

      // Validasi response format
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      // Cek status code
      if (data.statusCode !== 200) {
        const errorMsg = data.message || data.error || 'Upload failed';
        throw new Error(errorMsg);
      }

      // Ambil URL dari data.results.url
      if (!data.results || !data.results.url || typeof data.results.url !== 'string') {
        console.error('Zenitsu invalid response:', data);
        throw new Error('No URL in response');
      }

      const fileUrl = data.results.url;

      // Ekstrak filename dari URL Zenitsu
      // Contoh: https://api.zenitsu.web.id/get/ebKey.png → ebKey.png
      const urlParts = fileUrl.split('/');
      let fileName = urlParts[urlParts.length - 1];

      // Jika filename kosong, gunakan ID atau timestamp
      if (!fileName || fileName === '' || fileName.includes('get')) {
        // Gunakan ID dari response atau buat sendiri
        const fileId = data.results.id || Date.now().toString(36);
        const ext = originalname.split('.').pop() || 'png';
        fileName = `${fileId}.${ext}`;
      }

      console.log(`✅ Zenitsu success: ${fileName}`);

      // Gunakan getCustomUrl untuk konsistensi dengan provider lain
      return this.getCustomUrl('zenitsu', fileName);

    } catch (error) {
      console.error('❌ Zenitsu error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      let errorMessage = 'Upload failed';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      }

      throw new Error(`Zenitsu: ${errorMessage}`);
    }
  }

  // 0X0.ST - The Null Pointer (dengan user agent yang benar)
  async uploadTo0x0(fileBuffer, originalname) {
    try {
      const formData = new FormData();

      // Field name: 'file'
      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to 0x0.st: ${originalname}`);

      // 0x0.st HANYA menerima user agent tertentu!
      // Berdasarkan dokumentasi mereka, mereka terima:
      // - curl/*
      // - wget/*
      // - python-requests/*
      // - fetch API dari browser
      const headers = {
        ...formData.getHeaders(),
        'User-Agent': 'curl/7.68.0', // User agent yang pasti diterima
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      };

      console.log('Using headers:', headers);

      const response = await axios.post('https://0x0.st', formData, {
        headers: headers,
        timeout: 30000,
        maxBodyLength: 100 * 1024 * 1024,
        maxContentLength: 100 * 1024 * 1024,
        responseType: 'text'
      });

      console.log('0x0.st response status:', response.status);

      const responseText = response.data.trim();
      console.log('0x0.st response:', responseText);

      // Validasi response
      if (!responseText) {
        throw new Error('Empty response');
      }

      // Cek jika response error
      if (responseText.toLowerCase().includes('error') ||
        responseText.toLowerCase().includes('not allowed') ||
        responseText.toLowerCase().includes('reject')) {
        throw new Error(responseText);
      }

      // Harusnya dapat URL seperti: https://0x0.st/abc123.png
      if (!responseText.startsWith('http')) {
        throw new Error('Invalid response: ' + responseText);
      }

      const fileUrl = responseText;

      // Ekstrak filename
      const urlParts = fileUrl.split('/');
      let fileName = urlParts[urlParts.length - 1];

      // Validasi filename
      if (!fileName || fileName === '' || fileName === '0x0.st') {
        const ext = originalname.split('.').pop() || 'bin';
        fileName = `${Date.now().toString(36)}.${ext}`;
      }

      console.log(`✅ 0x0.st success: ${fileName}`);
      return this.getCustomUrl('0x0', fileName);

    } catch (error) {
      console.error('❌ 0x0.st error:', error.message);

      // Coba dengan user agent alternatif
      const userAgents = [
        'curl/7.68.0',
        'curl/7.64.0',
        'curl/7.58.0',
        'Wget/1.20.3 (linux-gnu)',
        'python-requests/2.25.1',
        'fetch/1.0'
      ];

      for (const userAgent of userAgents) {
        try {
          console.log(`🔄 Trying with User-Agent: ${userAgent}`);

          const formData = new FormData();
          formData.append('file', fileBuffer, originalname);

          const response = await axios.post('https://0x0.st', formData, {
            headers: {
              ...formData.getHeaders(),
              'User-Agent': userAgent,
              'Accept': '*/*'
            },
            timeout: 15000,
            responseType: 'text'
          });

          const responseText = response.data.trim();

          if (responseText.startsWith('http')) {
            const urlParts = responseText.split('/');
            const fileName = urlParts[urlParts.length - 1];
            console.log(`✅ 0x0.st success with ${userAgent}: ${fileName}`);
            return this.getCustomUrl('0x0', fileName);
          }
        } catch (uaError) {
          console.log(`❌ ${userAgent} failed:`, uaError.message);
          continue;
        }
      }

      throw new Error(`0x0: ${error.response?.data || error.message}`);
    }
  }

  // HAMZZZ - Provider baru (cloud-api.hamzzz.my.id)
  async uploadToHamzzz(fileBuffer, originalname) {
    try {
      const formData = new FormData();

      // Field name spesifik: 'hamzxyz' (bukan 'file')
      formData.append('hamzxyz', fileBuffer, originalname);

      console.log(`📤 Uploading to Hamzzz: ${originalname}`);

      const response = await axios.post('https://cloud-api.hamzzz.my.id/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      console.log('Hamzzz response:', response.data);

      const data = response.data;

      // Validasi response format
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      // Cek status
      if (data.status !== true) {
        const errorMsg = data.message || 'Upload failed';
        throw new Error(errorMsg);
      }

      // Ambil file info dari data.file
      if (!data.file || !data.file.id) {
        throw new Error('No file ID in response');
      }

      // Build URL dari file.id
      // Format: VKaPMFpOhB.png → https://cloud-api.hamzzz.my.id/file/VKaPMFpOhB.png
      const fileId = data.file.id;
      const fileUrl = `https://cloud-api.hamzzz.my.id/file/${fileId}`;

      // Gunakan file.id sebagai filename
      const fileName = fileId;

      console.log(`✅ Hamzzz success: ${fileName}`);

      // Gunakan getCustomUrl untuk konsistensi
      return this.getCustomUrl('hamzzz', fileName);

    } catch (error) {
      console.error('❌ Hamzzz error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      let errorMessage = 'Upload failed';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      }

      throw new Error(`Hamzzz: ${errorMessage}`);
    }
  }

  // Provider lainnya (yang sudah bekerja) - versi simple
  async uploadToYupra(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('files', fileBuffer, originalname);

      const response = await axios.post('https://cdn.yupra.my.id/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 15000
      });

      const fileUrl = response.data?.url || response.data?.files?.[0]?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('yupra', fileName);
    } catch (error) {
      throw new Error(`Yupra: ${error.message}`);
    }
  }

  async uploadToUguu(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('files[]', fileBuffer, originalname);

      const response = await axios.post('https://uguu.se/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 15000
      });

      const fileUrl = response.data?.files?.[0]?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('uguu', fileName);
    } catch (error) {
      throw new Error(`Uguu: ${error.message}`);
    }
  }

  async uploadToLanny(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      const response = await axios.post('https://lannytourl.vestia.icu/api/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 15000
      });

      const fileUrl = response.data?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('lanny', fileName);
    } catch (error) {
      throw new Error(`Lanny: ${error.message}`);
    }
  }

  async uploadToGyazo(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('imagedata', fileBuffer, originalname);
      formData.append('access_token', process.env.GYAZO_ACCESS_TOKEN);

      const response = await axios.post('https://upload.gyazo.com/api/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 15000
      });

      const fileUrl = response.data?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('gyazo', fileName);
    } catch (error) {
      throw new Error(`Gyazo: ${error.message}`);
    }
  }

  async uploadToImgBB(fileBuffer, originalname) {
    try {
      const base64Image = fileBuffer.toString('base64');
      const formData = new FormData();
      formData.append('image', base64Image);
      formData.append('key', process.env.IMGBB_KEY);

      const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 20000
      });

      const fileUrl = response.data?.data?.url || response.data?.data?.display_url;
      if (!fileUrl) throw new Error('Invalid response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('imgbb', fileName);
    } catch (error) {
      throw new Error(`ImgBB: ${error.response?.data?.error?.message || 'Upload failed'}`);
    }
  }

  async uploadToImgKit(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);
      formData.append('fileName', originalname);

      const response = await axios.post('https://upload.imagekit.io/api/v1/files/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Basic ${Buffer.from(`${process.env.IMGKIT_PRIVATE}:`).toString('base64')}`
        },
        timeout: 15000
      });

      const fileUrl = response.data?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('imgkit', fileName);
    } catch (error) {
      throw new Error(`ImgKit: ${error.message}`);
    }
  }

  async uploadToCloudinary(fileBuffer, originalname) {
    try {
      const base64File = fileBuffer.toString('base64');
      const mimeType = this.getMimeType(originalname);
      const formData = new FormData();

      formData.append('file', `data:${mimeType};base64,${base64File}`);
      formData.append('upload_preset', process.env.CLOUDINARY_PRESET);
      formData.append('api_key', process.env.CLOUDINARY_KEY);

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 20000
        }
      );

      const fileUrl = response.data?.secure_url || response.data?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('cloudinary', fileName);
    } catch (error) {
      throw new Error(`Cloudinary: ${error.response?.data?.error?.message || 'Upload failed'}`);
    }
  }

  async uploadToTmpfiles(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      const response = await axios.post('https://tmpfiles.org/api/v1/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 15000
      });

      const fileUrl = response.data?.data?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('tmpfiles', fileName);
    } catch (error) {
      throw new Error(`Tmpfiles: ${error.message}`);
    }
  }

  async uploadToZenxx(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      const response = await axios.post('https://zenzxzuploader.koyeb.app/api/upload', formData, {
        headers: formData.getHeaders(),
        timeout: 15000
      });

      const fileUrl = response.data?.url;
      if (!fileUrl) throw new Error('No URL in response');

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('zenxx', fileName);
    } catch (error) {
      throw new Error(`Zenxx: ${error.message}`);
    }
  }

  async uploadToShinai(fileBuffer, originalname) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      console.log(`📤 Uploading to Shinai v4: ${originalname}`);
      console.log(`📏 File size: ${fileBuffer.length} bytes`);
      console.log(`🔑 Using API Key: ${process.env.SHINAI_KEY ? '✓ Set' : '✗ Missing'}`);

      const headers = {
        ...formData.getHeaders(),
        'x-api-key': process.env.SHINAI_KEY || 'sazukaxcmv',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      console.log('📋 Shinai request headers:', headers);

      const response = await axios.post('https://shinai.onrender.com/api/4/cdn', formData, {
        headers: headers,
        timeout: 20000,
        maxBodyLength: 50 * 1024 * 1024,
        maxContentLength: 50 * 1024 * 1024
      });

      console.log('✅ Shinai response status:', response.status);
      console.log('📦 Shinai response headers:', response.headers);
      console.log('📄 Shinai response data:', response.data);

      // Debug response structure
      console.log('🔍 Shinai response keys:', Object.keys(response.data || {}));

      let fileUrl = null;
      const data = response.data;

      if (data) {
        // Format 1: data.data.url (berdasarkan contoh sebelumnya)
        if (data.data && data.data.url) {
          fileUrl = data.data.url;
          console.log('📍 Found URL in data.data.url:', fileUrl);
        }
        // Format 2: data.url langsung
        else if (data.url) {
          fileUrl = data.url;
          console.log('📍 Found URL in data.url:', fileUrl);
        }
        // Format 3: data.access_url
        else if (data.access_url) {
          fileUrl = data.access_url;
          console.log('📍 Found URL in data.access_url:', fileUrl);
        }
        // Format 4: data.results?.url
        else if (data.results && data.results.url) {
          fileUrl = data.results.url;
          console.log('📍 Found URL in data.results.url:', fileUrl);
        }
      }

      if (!fileUrl) {
        console.error('❌ Shinai - No URL found in response');
        console.error('📋 Full response structure:', JSON.stringify(data, null, 2));

        // Cari URL secara manual dalam response string
        const responseStr = JSON.stringify(data);
        const urlMatch = responseStr.match(/(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|gif|webp|bmp|svg|pdf|mp4))/i);
        if (urlMatch) {
          fileUrl = urlMatch[0];
          console.log('🔍 Found URL via regex:', fileUrl);
        } else {
          throw new Error('Could not extract URL from response');
        }
      }

      const fileName = this.extractFileName(fileUrl, originalname);
      console.log(`🎉 Shinai success: ${fileName}`);
      return this.getCustomUrl('shinai', fileName);

    } catch (error) {
      console.error('❌ Shinai error details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });

      let errorMessage = 'Upload failed';

      // Parse error dari response Shinai
      if (error.response?.data) {
        const errorData = error.response.data;

        if (typeof errorData === 'object') {
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid API Key';
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large';
      } else if (error.response?.status === 415) {
        errorMessage = 'Unsupported file type';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      }

      // Coba endpoint alternatif atau method berbeda
      if (error.message.includes('API Key') || error.response?.status === 401) {
        console.log('🔄 Trying Shinai with different approach...');

        try {
          // Coba tanpa x-api-key header (mungkin butuh di query param)
          const formData2 = new FormData();
          formData2.append('file', fileBuffer, originalname);

          const response2 = await axios.post(
            `https://shinai.onrender.com/api/4/cdn?key=${process.env.SHINAI_KEY || 'sazukaxcmv'}`,
            formData2,
            {
              headers: formData2.getHeaders(),
              timeout: 15000
            }
          );

          if (response2.data && (response2.data.url || response2.data.data?.url)) {
            const fileUrl = response2.data.url || response2.data.data.url;
            const fileName = this.extractFileName(fileUrl, originalname);
            console.log(`🎉 Shinai success (alternative): ${fileName}`);
            return this.getCustomUrl('shinai', fileName);
          }
        } catch (secondError) {
          console.error('Alternative approach failed:', secondError.message);
        }
      }

      throw new Error(`Shinai: ${errorMessage}`);
    }
  }
  
  /* 
  // ==================== LUNARA ====================
  async uploadToLunara(fileBuffer, originalname) {
    try {
      console.log(`📤 [${this.nodeEnv.toUpperCase()}] Uploading to Lunara: ${originalname} (${fileBuffer.length} bytes)`);

      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);
      formData.append('filename', originalname);
      formData.append('expire_value', '24');
      formData.append('expire_unit', 'hours');

      // Debug: cek formData
      const formHeaders = formData.getHeaders();
      console.log('📋 FormData headers:', formHeaders);

      const response = await axios.post(
        'https://lunara.drizznesiasite.biz.id/upload',
        formData,
        {
          headers: {
            ...formHeaders,
            'Accept': 'application/json'
          },
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      console.log('✅ Lunara response status:', response.status);
      console.log('✅ Lunara response data:', response.data);

      const data = response.data;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      if (!data.file_url) {
        throw new Error('No file_url in response: ' + JSON.stringify(data));
      }

      const fileName = this.extractFileName(data.file_url, originalname);
      console.log(`✅ Lunara success: ${fileName}`);
      return this.getCustomUrl('lunara', fileName);

    } catch (error) {
      console.error('❌ Lunara error details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });

      let errorMessage = 'Upload failed';

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Cannot resolve host: lunara.drizznesiasite.biz.id';
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large';
      } else if (error.response?.status === 415) {
        errorMessage = 'Unsupported media type';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 502 || error.response?.status === 503) {
        errorMessage = 'Lunara server is down or under maintenance';
      }

      throw new Error(`Lunara: ${errorMessage}`);
    }
  }

  // ==================== ZYNAAA ====================
  async uploadToZynaaa(fileBuffer, originalname) {
    try {
      console.log(`📤 [${this.nodeEnv.toUpperCase()}] Uploading to Zynaaa: ${originalname}`);

      const formData = new FormData();
      formData.append('file', fileBuffer, originalname);

      const response = await axios.post(
        'https://zynnaa-uploader.hf.space/upload',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          },
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      console.log('✅ Zynaaa response:', response.data);

      const data = response.data;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      // Cek berbagai kemungkinan field untuk URL
      const fileUrl = data.url || data.file_url || data.download_url || data.link;
      if (!fileUrl) {
        throw new Error('No URL in response: ' + JSON.stringify(data));
      }

      const fileName = this.extractFileName(fileUrl, originalname);
      return this.getCustomUrl('zynaaa', fileName);

    } catch (error) {
      console.error('❌ Zynaaa error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });

      let errorMessage = 'Upload failed';

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Cannot resolve host';
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      throw new Error(`Zynaaa: ${errorMessage}`);
    }
  }
  */

  getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'zip': 'application/zip',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async uploadToProvider(provider, fileBuffer, originalname) {
    // Debug: cek semua method yang ada
    const availableMethods = Object.getOwnPropertyNames(ProviderManager.prototype);
    console.log('📋 Available methods:', availableMethods);

    const providerMap = {
      'deline': this.uploadToDeline?.bind(this),
      'nekohime': this.uploadToNekohime?.bind(this),
      'yupra': this.uploadToYupra?.bind(this),
      'quax': this.uploadToQuax?.bind(this),
      'uguu': this.uploadToUguu?.bind(this),
      'lanny': this.uploadToLanny?.bind(this),
      'gyazo': this.uploadToGyazo?.bind(this),
      'imgbb': this.uploadToImgBB?.bind(this),
      'imgkit': this.uploadToImgKit?.bind(this),
      'cloudinary': this.uploadToCloudinary?.bind(this),
      'tmpfiles': this.uploadToTmpfiles?.bind(this),
      'nauval': this.uploadToNauval?.bind(this),
      'zenxx': this.uploadToZenxx?.bind(this),
      'shinai': this.uploadToShinai?.bind(this),
      'catbox': this.uploadToCatbox?.bind(this),
      'zenitsu': this.uploadToZenitsu?.bind(this),
      'hamzzz': this.uploadToHamzzz?.bind(this),
      '0x0': this.uploadTo0x0?.bind(this)
    // 'lunara': this.uploadToLunara?.bind(this),
    // 'zynaaa': this.uploadToZynaaa?.bind(this)
    };

    console.log(`🔍 Checking provider "${provider}":`, providerMap[provider] ? 'EXISTS' : 'UNDEFINED');

    if (!providerMap[provider]) {
      throw new Error(`Provider ${provider} not found or method not implemented`);
    }

    const maxSize = 50 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`File too large (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB). Max: 50MB`);
    }

    return await providerMap[provider](fileBuffer, originalname);
  }

  getBaseUrl() {
    return this.appBaseUrl;
  }

  getEnvironment() {
    return this.nodeEnv;
  }
}

module.exports = new ProviderManager();

