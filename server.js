const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ip = require('ip');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3010;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// تأكد من وجود مجلد التحميلات
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// إعداد multer لرفع الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// تخزين معلومات المستخدمين المتصلين
const connectedClients = new Map();
// تخزين معلومات الملفات المرفوعة
const sharedFiles = [];

// استخدام المجلدات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// طريقة رفع الملفات
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('لم يتم تحميل أي ملف');
  }

  const fileInfo = {
    id: Date.now().toString(),
    name: req.file.originalname,
    path: req.file.filename,
    size: req.file.size,
    type: req.file.mimetype,
    uploadTime: new Date()
  };

  sharedFiles.push(fileInfo);
  
  // إرسال معلومات الملف الجديد لجميع المستخدمين
  io.emit('new-file', fileInfo);
  
  res.status(200).json(fileInfo);
});

// الحصول على قائمة الملفات
app.get('/files', (req, res) => {
  res.json(sharedFiles);
});

// إعداد Socket.io
io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);
  
  // طلب معلومات المستخدم
  socket.emit('request-user-info');
  
  // استقبال معلومات المستخدم
  socket.on('user-info', (userInfo) => {
    const clientInfo = {
      id: socket.id,
      name: userInfo.name || 'مستخدم بدون اسم',
      ip: socket.handshake.address
    };
    
    connectedClients.set(socket.id, clientInfo);
    
    // إرسال قائمة المستخدمين المحدثة لجميع المتصلين
    io.emit('clients-list', Array.from(connectedClients.values()));
    
    // إرسال قائمة الملفات الحالية للمستخدم الجديد
    socket.emit('files-list', sharedFiles);
  });
  
  // عند قطع الاتصال
  socket.on('disconnect', () => {
    console.log('انقطع اتصال المستخدم:', socket.id);
    connectedClients.delete(socket.id);
    io.emit('clients-list', Array.from(connectedClients.values()));
  });
});

server.listen(PORT, () => {
  const localIp = ip.address();
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
  console.log(`يمكنك الوصول للتطبيق عبر: http://${localIp}:${PORT}`);
});