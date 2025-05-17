document.addEventListener('DOMContentLoaded', () => {
  // إعداد اتصال Socket.io
  const socket = io();
  
  // عناصر DOM
  const usernameInput = document.getElementById('username');
  const saveNameBtn = document.getElementById('save-name');
  const deviceNameSpan = document.getElementById('device-name');
  const deviceIpSpan = document.getElementById('device-ip');
  const clientsList = document.getElementById('clients-list');
  const filesList = document.getElementById('files-list');
  const uploadForm = document.getElementById('upload-form');
  const fileInput = document.getElementById('file');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress');
  
  // استرجاع اسم المستخدم من التخزين المحلي
  const savedUsername = localStorage.getItem('username') || '';
  if (savedUsername) {
    usernameInput.value = savedUsername;
  }
  
  // حفظ اسم المستخدم
  saveNameBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
      localStorage.setItem('username', username);
      sendUserInfo();
      alert('تم حفظ الاسم بنجاح!');
    } else {
      alert('الرجاء إدخال اسم صحيح');
    }
  });
  
  // إرسال معلومات المستخدم للخادم
  function sendUserInfo() {
    const username = usernameInput.value.trim() || 'مستخدم بدون اسم';
    socket.emit('user-info', { name: username });
  }
  
  // استقبال طلب معلومات المستخدم
  socket.on('request-user-info', sendUserInfo);
  
  // تحديث معلومات المستخدم
  socket.on('connect', () => {
    deviceNameSpan.textContent = 'متصل';
    sendUserInfo();
  });
  
  // تحديث قائمة المستخدمين المتصلين
  socket.on('clients-list', (clients) => {
    deviceIpSpan.textContent = socket.id;
    
    if (clients.length === 0) {
      clientsList.innerHTML = '<li class="list-group-item text-center">لا توجد أجهزة متصلة</li>';
      return;
    }
    
    clientsList.innerHTML = '';
    clients.forEach(client => {
      const isCurrentUser = client.id === socket.id;
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      
      if (isCurrentUser) {
        li.classList.add('bg-light');
      }
      
      li.innerHTML = `
        <div class="client-item">
          <i class="bi bi-pc-display client-icon"></i>
          <div>
            <strong>${client.name}</strong>
            ${isCurrentUser ? ' (أنت)' : ''}
            <br>
            <small class="text-muted">${client.ip}</small>
          </div>
        </div>
      `;
      
      clientsList.appendChild(li);
    });
  });
  
  // تحديث قائمة الملفات
  function updateFilesList(files) {
    if (files.length === 0) {
      filesList.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد ملفات مشتركة حالياً</td></tr>';
      return;
    }
    
    filesList.innerHTML = '';
    files.forEach(file => {
      const tr = document.createElement('tr');
      
      // تحديد أيقونة الملف حسب نوعه
      let fileIcon = 'bi-file';
      let fileClass = 'file-default';
      
      if (file.type.includes('pdf')) {
        fileIcon = 'bi-file-pdf';
        fileClass = 'file-pdf';
      } else if (file.type.includes('image')) {
        fileIcon = 'bi-file-image';
        fileClass = 'file-image';
      } else if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('tar')) {
        fileIcon = 'bi-file-zip';
        fileClass = 'file-archive';
      } else if (file.type.includes('word') || file.type.includes('doc')) {
        fileIcon = 'bi-file-word';
        fileClass = 'file-doc';
      }
      
      // تنسيق حجم الملف
      const fileSize = formatFileSize(file.size);
      
      // تنسيق وقت الرفع
      const uploadTime = new Date(file.uploadTime).toLocaleString('ar-SA');
      
      tr.innerHTML = `
        <td>
          <i class="bi ${fileIcon} ${fileClass} me-2"></i>
          ${file.name}
        </td>
        <td>${file.type}</td>
        <td>${fileSize}</td>
        <td>${uploadTime}</td>
        <td>
          <a href="/uploads/${file.path}" class="btn btn-sm btn-success" download="${file.name}">
            <i class="bi bi-download"></i> تحميل
          </a>
        </td>
      `;
      
      filesList.appendChild(tr);
    });
  }
  
  // استقبال قائمة الملفات الحالية
  socket.on('files-list', updateFilesList);
  
  // استقبال ملف جديد
  socket.on('new-file', (fileInfo) => {
    fetch('/files')
      .then(response => response.json())
      .then(files => updateFilesList(files))
      .catch(error => console.error('خطأ في جلب قائمة الملفات:', error));
  });
  
  // رفع ملف جديد
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!fileInput.files[0]) {
      alert('الرجاء اختيار ملف للرفع');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    // إظهار شريط التقدم
    progressContainer.classList.remove('d-none');
    progressBar.style.width = '0%';
    
    // إرسال الملف باستخدام XMLHttpRequest لتتبع التقدم
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressBar.style.width = percentComplete + '%';
        progressBar.textContent = Math.round(percentComplete) + '%';
      }
    };
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        // نجاح الرفع
        fileInput.value = '';
        progressContainer.classList.add('d-none');
        alert('تم رفع الملف بنجاح!');
      } else {
        alert('حدث خطأ أثناء رفع الملف');
        progressContainer.classList.add('d-none');
      }
    };
    
    xhr.onerror = function() {
      alert('حدث خطأ في الاتصال');
      progressContainer.classList.add('d-none');
    };
    
    xhr.send(formData);
  });
  
  // تنسيق حجم الملف
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 بايت';
    
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // جلب قائمة الملفات عند بدء التشغيل
  fetch('/files')
    .then(response => response.json())
    .then(files => updateFilesList(files))
    .catch(error => console.error('خطأ في جلب قائمة الملفات:', error));
});