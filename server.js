require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const XLSX = require('xlsx');

// ========== DATA STORE & MODELS ==========
const { store, nccList, nsxList, atcList, classifyMedicine } = require('./dataStore');
const User = require('./models/userlogin');
const Patient = require('./models/patients12');
const Medicine = require('./models/medicines12');
const Prescription = require('./models/prescription12');
const NhaSanXuat = require('./models/NhaSanXuat');
const NhaCungCap = require('./models/NhaCungCap');
const NhomATC = require('./models/NhomATC');
const Thuoc = require('./models/Thuoc');

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-super-secret-key-2026';
const app = express();
const PORT = process.env.PORT || 5000;

// Setup Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Setup EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public13')));
app.use(express.static(__dirname));

// ========== MONGODB WITH RESILIENT TIMEOUT ==========
let isDbConnected = false;
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://unknownphuc24_db_user:ZSRdAFTg9AGjDHkg@cluster0ben45.ijcyxhs.mongodb.net/pharmacyDB?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
})
  .then(() => {
    isDbConnected = true;
    console.log('✅ Connected to MongoDB Atlas — pharmacyDB');
  })
  .catch(err => {
    isDbConnected = false;
    console.warn('⚠️ Notice: Running in resilient Local/In-Memory Mode (Atlas unavailable:', err.message, ')');
  });

// Root API test
app.get('/api/', (req, res) => {
  res.json({ message: '✅ Pharmacy Apotheca Rx API is active!', isDbConnected });
});

// =============================================
// ===== PHASE 1 — AUTH / PATIENTS / STAFF =====
// =============================================

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, role } = req.body;
    
    // Check in-memory store first
    const existingMemory = store.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (existingMemory) {
      return res.status(400).json({ message: 'Email đã được đăng ký trên hệ thống!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      _id: `usr_${Date.now()}`,
      email,
      passwordHash: hashedPassword,
      fullName: fullName || email.split('@')[0],
      phone: phone || '',
      role: role || 'nurse',
      baseSalary: role === 'admin' ? 25000000 : role === 'pharmacist' ? 18000000 : 12000000,
      createdAt: new Date()
    };
    store.users.push(newUser);

    // Also persist to MongoDB if connected
    if (isDbConnected) {
      try {
        const user = new User({ email, password: hashedPassword, fullName, phone, role });
        await user.save();
      } catch (dbErr) {
        console.warn('DB save skipped:', dbErr.message);
      }
    }

    res.status(201).json({ message: '✅ Tài khoản đã tạo thành công!' });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = null;

    // Check store first
    const memoryUser = store.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (memoryUser) {
      const isMatch = await bcrypt.compare(password, memoryUser.passwordHash);
      if (isMatch) {
        user = memoryUser;
      }
    }

    // If not found in memory and DB is available, check DB
    if (!user && isDbConnected) {
      const dbUser = await User.findOne({ email });
      if (dbUser) {
        const isMatch = await bcrypt.compare(password, dbUser.password);
        if (isMatch) {
          user = {
            _id: dbUser._id,
            email: dbUser.email,
            fullName: dbUser.fullName,
            role: dbUser.role
          };
        }
      }
    }

    if (!user) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

// Patients API
app.get('/api/patients/search', async (req, res) => {
  try {
    const { q = '', page = 1, limit = 10 } = req.query;
    if (isDbConnected) {
      const skip = (page - 1) * limit;
      const query = q ? {
        $or: [
          { fullName: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } }
        ]
      } : {};
      const patients = await Patient.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
      const total = await Patient.countDocuments(query);
      return res.json({ patients, total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
    }

    // Fallback store
    const list = [
      { _id: 'PT_01', fullName: 'Nguyễn Văn Minh', age: 45, phone: '0903111222', allergies: 'Penicillin', medicalHistory: 'Tăng huyết áp vô căn', createdAt: new Date() },
      { _id: 'PT_02', fullName: 'Trần Thị Mai', age: 32, phone: '0912333444', allergies: 'Không', medicalHistory: 'Viêm dạ dày Hp (+)', createdAt: new Date() },
      { _id: 'PT_03', fullName: 'Lê Hoàng Nam', age: 58, phone: '0934555666', allergies: 'Aspirin', medicalHistory: 'Đái tháo đường Type 2', createdAt: new Date() },
      { _id: 'PT_04', fullName: 'Phạm Thu Trang', age: 26, phone: '0978999000', allergies: 'Không', medicalHistory: 'Cảm cúm theo mùa', createdAt: new Date() }
    ].filter(p => !q || p.fullName.toLowerCase().includes(q.toLowerCase()) || p.phone.includes(q));

    res.json({ patients: list, total: list.length, totalPages: 1, currentPage: 1 });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { fullName, age, phone, allergies, medicalHistory, createdBy } = req.body;
    const newPatient = { _id: `PT_${Date.now()}`, fullName, age, phone, allergies, medicalHistory, createdBy, createdAt: new Date() };
    if (isDbConnected) {
      const p = new Patient(req.body);
      await p.save();
    }
    res.status(201).json({ message: '✅ Tạo hồ sơ thành công!', patient: newPatient });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

// Staff API
app.get('/api/staff', async (req, res) => {
  try {
    const staff = store.users.map(u => ({
      _id: u._id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      baseSalary: u.baseSalary,
      createdAt: u.createdAt
    }));
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

app.patch('/api/staff/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const user = store.users.find(u => u._id === req.params.id);
    if (user) {
      user.role = role;
    }
    res.json({ message: '✅ Cập nhật vai trò thành công!', staff: user });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

// =============================================
// ===== PHASE 2 — 5 MEDICINE CATEGORIES =======
// =============================================

// EJS Category Dashboard
app.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    totalMedicines: store.medicines.length,
    nsxCount: nsxList.length,
    nccCount: nccList.length
  });
});

// Web Routes for 5 categories
const thuocRoutes = require('./routes13/thuoc');
const hangdactriRoutes = require('./routes13/new15folderextra/hangdactri');
const vtytRoutes = require('./routes13/new15folderextra/vtyt');
const tpcnRoutes = require('./routes13/new15folderextra/tpcn');
const dmpRoutes = require('./routes13/new15folderextra/dmp');

app.use('/thuoc', thuocRoutes);
app.use('/hangdactri', hangdactriRoutes);
app.use('/vtyt', vtytRoutes);
app.use('/tpcn', tpcnRoutes);
app.use('/dmp', dmpRoutes);

// Category summary API
app.get('/api/categories/summary', (req, res) => {
  const counts = {
    thuoc: store.medicines.filter(m => m.category === 'thuoc').length,
    hangdactri: store.medicines.filter(m => m.category === 'hangdactri').length,
    vtyt: store.medicines.filter(m => m.category === 'vtyt').length,
    tpcn: store.medicines.filter(m => m.category === 'tpcn').length,
    dmp: store.medicines.filter(m => m.category === 'dmp').length,
    total: store.medicines.length
  };
  res.json(counts);
});

// Get medicines by category with search & filter
app.get('/api/categories/:cat', (req, res) => {
  const { cat } = req.params;
  const { q = '', nsx = '', ncc = '', stock = '', page = 1, limit = 20 } = req.query;

  let list = store.medicines;
  if (cat !== 'all') {
    list = list.filter(m => m.category === cat);
  }

  if (q) {
    const query = q.toLowerCase();
    list = list.filter(m =>
      m.tenThuoc.toLowerCase().includes(query) ||
      m.tenHoatChat.toLowerCase().includes(query) ||
      m.maThuoc.toLowerCase().includes(query)
    );
  }

  if (nsx) {
    list = list.filter(m => m.nhaSanXuat.toLowerCase().includes(nsx.toLowerCase()));
  }

  if (ncc) {
    list = list.filter(m => m.nhaCungCap.toLowerCase().includes(ncc.toLowerCase()));
  }

  if (stock === 'low') {
    list = list.filter(m => m.tonKho <= 10);
  } else if (stock === 'out') {
    list = list.filter(m => m.tonKho === 0);
  }

  const total = list.length;
  const startIndex = (page - 1) * limit;
  const paginated = list.slice(startIndex, startIndex + Number(limit));

  res.json({
    category: cat,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
    items: paginated
  });
});

// All medicines DB route
app.get('/api/medicines-db', (req, res) => {
  res.json(store.medicines);
});

// Search medicines across categories
app.get('/api/medicines-db/search/:name', (req, res) => {
  const query = (req.params.name || '').toLowerCase();
  const results = store.medicines.filter(m =>
    m.tenThuoc.toLowerCase().includes(query) ||
    m.tenHoatChat.toLowerCase().includes(query) ||
    m.maThuoc.toLowerCase().includes(query)
  );
  res.json(results);
});

// Helpers
app.get('/api/manufacturers', (req, res) => res.json(nsxList));
app.get('/api/suppliers', (req, res) => res.json(nccList));
app.get('/api/atc', (req, res) => res.json(atcList));

// =============================================
// ===== PHASE 3 — BULK IMPORT & EXPORT ========
// =============================================

// Download template (CSV or Excel)
app.get('/api/import/template', (req, res) => {
  const format = req.query.format || 'csv';
  const sampleHeaders = [
    {
      "Mã Thuốc": "TH00999",
      "Tên Biệt Dược": "Paracetamol Extra 500mg",
      "Tên Hoạt Chất": "Paracetamol + Caffeine",
      "Hàm Lượng": "500mg + 65mg",
      "Danh Mục": "thuoc",
      "Đơn Vị Tính": "Hộp",
      "Đơn Giá": 45000,
      "Tồn Kho": 100,
      "Số Lô": "LOT-2026-X1",
      "Hạn Dùng": "2027-12-31",
      "Nhà Sản Xuất": "Dược Hậu Giang (DHG)",
      "Nhà Cung Cấp": "Cty Cổ phần Dược phẩm TV.PHARM"
    }
  ];

  if (format === 'excel') {
    const ws = XLSX.utils.json_to_sheet(sampleHeaders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Lieu");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Mau_Nhap_Lieu_Duoc_Pham.xlsx');
    return res.send(buffer);
  }

  // CSV
  const csv = '\uFEFFMã Thuốc,Tên Biệt Dược,Tên Hoạt Chất,Hàm Lượng,Danh Mục,Đơn Vị Tính,Đơn Giá,Tồn Kho,Số Lô,Hạn Dùng,Nhà Sản Xuất,Nhà Cung Cấp\n' +
    'TH00999,"Paracetamol Extra 500mg","Paracetamol + Caffeine","500mg + 65mg",thuoc,Hộp,45000,100,LOT-2026-X1,2027-12-31,"Dược Hậu Giang (DHG)","Cty CP Dược phẩm TV.PHARM"\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=Mau_Nhap_Lieu_Duoc_Pham.csv');
  res.send(csv);
});

// Bulk Import Medicines (JSON, CSV or Excel data)
app.post('/api/import/medicines', (req, res) => {
  try {
    let { items, mode = 'append' } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: '❌ Dữ liệu không hợp lệ! Cần danh sách mặt hàng.' });
    }

    if (mode === 'overwrite') {
      store.medicines = [];
    }

    let inserted = 0;
    let updated = 0;

    items.forEach(raw => {
      const maThuoc = raw.maThuoc || raw['Mã Thuốc'] || raw['MA_PM'] || `MED_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const tenThuoc = raw.tenThuoc || raw['Tên Biệt Dược'] || raw['TEN_THANH_PHAM'] || raw.name || 'Thuốc mới';
      const catKey = raw.category || raw['Danh Mục'] || classifyMedicine(raw, store.medicines.length);

      const existingIndex = store.medicines.findIndex(m => m.maThuoc === maThuoc);
      const medicineObj = {
        _id: maThuoc,
        maThuoc: maThuoc,
        tenThuoc: tenThuoc,
        tenHoatChat: raw.tenHoatChat || raw['Tên Hoạt Chất'] || raw['TEN_HOAT_CHAT'] || '',
        hamLuong: raw.hamLuong || raw['Hàm Lượng'] || raw['HAMLUONG'] || '',
        donVi: raw.donVi || raw['Đơn Vị Tính'] || raw['DVT'] || 'Hộp',
        donGia: Number(raw.donGia || raw['Đơn Giá'] || raw['DONGIA'] || 0),
        costPrice: Math.round(Number(raw.donGia || raw['Đơn Giá'] || raw['DONGIA'] || 0) * 0.75),
        tonKho: Number(raw.tonKho || raw['Tồn Kho'] || raw['stock'] || 0),
        soLuongToiThieu: 10,
        category: catKey,
        categoryName: catKey === 'thuoc' ? 'Danh mục Thuốc' : catKey === 'hangdactri' ? 'Hàng Đặc trị' : catKey === 'vtyt' ? 'Vật tư & TBYT' : catKey === 'tpcn' ? 'Thực phẩm chức năng' : 'Dược mỹ phẩm',
        soDangKy: raw.soDangKy || raw['Số Đăng Ký'] || raw['SO_DANG_KY'] || '',
        duongDung: raw.duongDung || raw['Đường Dùng'] || raw['DUONGDUNG'] || 'Uống',
        nhaSanXuat: raw.nhaSanXuat || raw['Nhà Sản Xuất'] || raw['TEN_NHA_SAN_XUAT'] || 'Việt Nam',
        nhaCungCap: raw.nhaCungCap || raw['Nhà Cung Cấp'] || raw['TEN_NCC'] || 'Công ty Dược',
        maNhomATC: raw.maNhomATC || raw['Nhóm ATC'] || raw['TENNHOM'] || 'N/A',
        soLo: raw.soLo || raw['Số Lô'] || `LOT-${Date.now().toString().slice(-4)}`,
        hanSuDung: raw.hanSuDung || raw['Hạn Dùng'] || '2027-12-31',
        isLowStock: Number(raw.tonKho || 0) <= 10,
        isExpired: false,
        daysToExpiry: 365
      };

      if (existingIndex >= 0) {
        if (mode === 'update_stock') {
          store.medicines[existingIndex].tonKho += medicineObj.tonKho;
        } else {
          store.medicines[existingIndex] = { ...store.medicines[existingIndex], ...medicineObj };
        }
        updated++;
      } else {
        store.medicines.unshift(medicineObj);
        inserted++;
      }
    });

    // Record usage log
    store.usageLogs.unshift({
      id: `LOG_${Date.now()}`,
      timestamp: new Date().toLocaleString('vi-VN'),
      user: 'Dược Sĩ Quản Lý',
      role: 'pharmacist',
      action: 'Nhập dữ liệu hàng loạt',
      target: `Nhập ${items.length} mặt hàng (Thêm mới: ${inserted}, Cập nhật: ${updated})`,
      ref: 'Giao dịch Bulk Import'
    });

    res.json({
      message: `✅ Nhập dữ liệu thành công! Thêm mới: ${inserted}, Cập nhật: ${updated}`,
      totalNow: store.medicines.length
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi nhập dữ liệu: ' + err.message });
  }
});

// Bulk Export CSV
app.get('/api/medicines-db/export/:category', (req, res) => {
  try {
    const { category } = req.params;
    let list = store.medicines;
    if (category !== 'all') {
      list = list.filter(m => m.category === category);
    }

    let csv = 'STT,Mã Thuốc,Tên Biệt Dược,Tên Hoạt Chất,Hàm Lượng,Danh Mục,Đơn Vị,Đơn Giá,Tồn Kho,Số Lô,Hạn Dùng,Nhà Sản Xuất,Nhà Cung Cấp\n';
    list.forEach((m, idx) => {
      csv += `${idx + 1},"${m.maThuoc}","${m.tenThuoc.replace(/"/g, '""')}","${(m.tenHoatChat || '').replace(/"/g, '""')}","${m.hamLuong || ''}","${m.categoryName}","${m.donVi}",${m.donGia},${m.tonKho},"${m.soLo || ''}","${m.hanSuDung || ''}","${m.nhaSanXuat}","${m.nhaCungCap}"\n`;
    });

    const filename = category === 'all' ? 'Danh_Sach_Tat_Ca_Thuoc.csv' : `Danh_Sach_${category}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi xuất CSV: ' + err.message });
  }
});

// Bulk Export Excel (.xlsx)
app.get('/api/export/medicines/excel', (req, res) => {
  try {
    const { category = 'all' } = req.query;
    let list = store.medicines;
    if (category !== 'all') {
      list = list.filter(m => m.category === category);
    }

    const excelRows = list.map((m, idx) => ({
      "STT": idx + 1,
      "Mã Thuốc": m.maThuoc,
      "Tên Biệt Dược": m.tenThuoc,
      "Tên Hoạt Chất": m.tenHoatChat || '',
      "Hàm Lượng": m.hamLuong || '',
      "Nhóm Danh Mục": m.categoryName,
      "Đơn Vị Tính": m.donVi,
      "Đơn Giá (VNĐ)": m.donGia,
      "Tồn Kho": m.tonKho,
      "Số Lô": m.soLo || '',
      "Hạn Dùng": m.hanSuDung || '',
      "Nhà Sản Xuất": m.nhaSanXuat,
      "Nhà Cung Cấp": m.nhaCungCap,
      "Cảnh Báo": m.tonKho <= 10 ? 'Tồn thấp' : 'Bình thường'
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kho_Duoc_Pham");

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = category === 'all' ? 'Kho_Duoc_Pham_Toan_Bo.xlsx' : `Kho_Duoc_Pham_${category}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi xuất Excel: ' + err.message });
  }
});

// =============================================
// ===== PHASE 4 — REPORTS: PHARMACIST =========
// =============================================

app.get('/api/reports/pharmacist', (req, res) => {
  try {
    const totalMeds = store.medicines.length;
    let totalStockValue = 0;
    let lowStockItems = [];
    let outOfStockItems = [];
    let expiredItems = [];
    let expiring30Days = [];
    let expiring60Days = [];
    let expiring90Days = [];

    store.medicines.forEach(m => {
      totalStockValue += (m.tonKho * m.donGia);
      if (m.tonKho === 0) outOfStockItems.push(m);
      else if (m.tonKho <= 10) lowStockItems.push(m);

      if (m.daysToExpiry < 0) expiredItems.push(m);
      else if (m.daysToExpiry <= 30) expiring30Days.push(m);
      else if (m.daysToExpiry <= 60) expiring60Days.push(m);
      else if (m.daysToExpiry <= 90) expiring90Days.push(m);
    });

    const totalSalesToday = store.salesToday.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      summary: {
        totalRevenueToday: totalSalesToday,
        prescriptionsCountToday: store.salesToday.length,
        averageOrderValue: Math.round(totalSalesToday / (store.salesToday.length || 1)),
        totalMedicinesCount: totalMeds,
        totalStockValuation: totalStockValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        expiredCount: expiredItems.length,
        expiring30DaysCount: expiring30Days.length,
        expiring60DaysCount: expiring60Days.length,
        expiring90DaysCount: expiring90Days.length
      },
      salesToday: store.salesToday,
      topMedicinesDispensed: [
        { name: 'Paracetamol 250mg', category: 'Thuốc', count: 180, revenue: 58680 },
        { name: 'Amoxicillin 500mg', category: 'Thuốc', count: 95, revenue: 142500 },
        { name: 'Cefuroxime 500mg', category: 'Thuốc', count: 64, revenue: 384000 },
        { name: 'Vitamin C 500mg', category: 'TPCN', count: 50, revenue: 125000 },
        { name: 'Bơm tiêm 5ml Vinahankook', category: 'VTYT', count: 120, revenue: 180000 }
      ],
      lowStockList: lowStockItems.slice(0, 15),
      expiredList: expiredItems.slice(0, 15),
      expiringSoonList: expiring30Days.slice(0, 15)
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi báo cáo dược sĩ: ' + err.message });
  }
});

// Quarantine expired lot
app.post('/api/reports/pharmacist/quarantine', (req, res) => {
  const { maThuoc, soLo, reason } = req.body;
  const med = store.medicines.find(m => m.maThuoc === maThuoc);
  if (med) {
    med.isQuarantined = true;
    med.tonKho = 0; // Move out of active stock
  }
  store.usageLogs.unshift({
    id: `LOG_${Date.now()}`,
    timestamp: new Date().toLocaleString('vi-VN'),
    user: 'Dược Sĩ Minh Phúc',
    role: 'pharmacist',
    action: 'Cách ly / Thu hồi thuốc hết hạn',
    target: `${med ? med.tenThuoc : maThuoc} (Lô: ${soLo || 'N/A'})`,
    ref: reason || 'Hết hạn sử dụng theo kiểm tra định kỳ'
  });
  res.json({ message: '✅ Đã đưa lô thuốc vào khu vực cách ly/chờ tiêu hủy thành công!' });
});

// =============================================
// ===== PHASE 5 — REPORTS: WORKER =============
// =============================================

// Tasks API
app.get('/api/reports/worker/tasks', (req, res) => {
  res.json(store.tasks);
});

app.post('/api/reports/worker/tasks', (req, res) => {
  const { title, priority, assignedTo, deadline } = req.body;
  const newTask = {
    id: Date.now(),
    title: title || 'Nhiệm vụ mới',
    priority: priority || 'Thường',
    assignedTo: assignedTo || 'Nhân viên trực',
    deadline: deadline || 'Hôm nay',
    status: 'pending'
  };
  store.tasks.unshift(newTask);
  res.status(201).json({ message: '✅ Đã thêm nhiệm vụ mới!', task: newTask });
});

app.patch('/api/reports/worker/tasks/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const task = store.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ message: 'Không tìm thấy nhiệm vụ!' });

  task.status = task.status === 'completed' ? 'in_progress' : task.status === 'in_progress' ? 'pending' : 'completed';
  res.json({ message: '✅ Đã cập nhật trạng thái nhiệm vụ!', task });
});

// Stock Audits API
app.get('/api/reports/worker/stock-audits', (req, res) => {
  res.json(store.stockAudits);
});

app.post('/api/reports/worker/stock-audits/reconcile', (req, res) => {
  const { maThuoc, thucTe, ghiChu, auditor } = req.body;
  const item = store.stockAudits.find(a => a.maThuoc === maThuoc);
  const med = store.medicines.find(m => m.maThuoc === maThuoc);

  if (item && med) {
    const diff = Number(thucTe) - med.tonKho;
    item.thucTe = Number(thucTe);
    item.chenhLech = diff;
    item.ghiChu = ghiChu || 'Đã cân đối tồn kho theo thực tế kiểm kê';
    item.status = 'Đã cập nhật hệ thống';
    med.tonKho = Number(thucTe);

    store.usageLogs.unshift({
      id: `LOG_${Date.now()}`,
      timestamp: new Date().toLocaleString('vi-VN'),
      user: auditor || 'Nhân viên kiểm kho',
      role: 'nurse',
      action: 'Cân đối kiểm kê kho',
      target: `${med.tenThuoc} (Tồn mới: ${thucTe}, Chênh lệch: ${diff})`,
      ref: 'Phiếu kiểm kê thực tế'
    });
  }
  res.json({ message: '✅ Đã cập nhật cân đối tồn kho thành công!' });
});

// Usage Logs API
app.get('/api/reports/worker/usage-logs', (req, res) => {
  res.json(store.usageLogs);
});

// =============================================
// ===== PHASE 6 — REPORTS: BUDGET & SALARY ====
// =============================================

app.get('/api/reports/budget-salary', (req, res) => {
  try {
    const totalPayroll = store.payroll.reduce((sum, p) => sum + p.netSalary, 0);
    const updatedFinancials = {
      ...store.financials,
      totalPayroll,
      netProfit: store.financials.grossProfit - store.financials.operatingExpenses - totalPayroll
    };

    res.json({
      financials: updatedFinancials,
      payroll: store.payroll,
      monthlyBreakdown: [
        { month: 'Tháng 7/2026', revenue: 420000000, cogs: 294000000, profit: 126000000 },
        { month: 'Tháng 8/2026', revenue: 445000000, cogs: 311500000, profit: 133500000 },
        { month: 'Tháng 9/2026', revenue: 460000000, cogs: 322000000, profit: 138000000 },
        { month: 'Tháng 10/2026', revenue: 475000000, cogs: 332500000, profit: 142500000 },
        { month: 'Tháng 11/2026', revenue: 485200000, cogs: 339640000, profit: 145560000 }
      ]
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi báo cáo ngân sách & lương: ' + err.message });
  }
});

// Calculate or Update Staff Payroll
app.post('/api/reports/payroll/calculate', (req, res) => {
  try {
    const { id, workHours, overtimeHours, shiftAllowance, dispenseBonus } = req.body;
    const staffPay = store.payroll.find(p => p.id === id);
    if (!staffPay) return res.status(404).json({ message: 'Không tìm thấy hồ sơ nhân viên!' });

    const hours = Number(workHours) || staffPay.workHours;
    const ot = Number(overtimeHours) || staffPay.overtimeHours;
    const allowance = Number(shiftAllowance) || staffPay.shiftAllowance;
    const bonus = Number(dispenseBonus) || staffPay.dispenseBonus;

    // Rate based on 176 standard hours
    const hourlyBase = staffPay.baseSalary / 176;
    const overtimePay = ot * hourlyBase * 1.5;
    const grossSalary = staffPay.baseSalary + overtimePay + allowance + bonus;
    const deductions = Math.round(grossSalary * 0.105); // BHXH 8%, BHYT 1.5%, BHTN 1%
    const netSalary = grossSalary - deductions;

    staffPay.workHours = hours;
    staffPay.overtimeHours = ot;
    staffPay.shiftAllowance = allowance;
    staffPay.dispenseBonus = bonus;
    staffPay.deductions = deductions;
    staffPay.netSalary = netSalary;

    res.json({ message: '✅ Đã tính toán lại lương thành công!', payroll: staffPay });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi tính lương: ' + err.message });
  }
});

app.patch('/api/reports/payroll/:id/pay', (req, res) => {
  const staffPay = store.payroll.find(p => p.id === req.params.id);
  if (!staffPay) return res.status(404).json({ message: 'Không tìm thấy hồ sơ lương!' });

  staffPay.paymentStatus = 'Đã thanh toán qua ngân hàng';
  staffPay.paidAt = new Date().toLocaleString('vi-VN');

  store.usageLogs.unshift({
    id: `LOG_${Date.now()}`,
    timestamp: new Date().toLocaleString('vi-VN'),
    user: 'Kế Toán / Quản Trị Viên',
    role: 'admin',
    action: 'Duyệt chi trả lương',
    target: `${staffPay.staffName} (${staffPay.netSalary.toLocaleString('vi-VN')} đ)`,
    ref: `Kỳ lương Tháng 11/2026 - Mã: ${staffPay.id}`
  });

  res.json({ message: '✅ Đã xác nhận chi lương cho nhân viên!', payroll: staffPay });
});

// ========== PRESCRIPTIONS (Phase 1) ==========
app.get('/api/prescriptions', async (req, res) => {
  try {
    if (isDbConnected) {
      const list = await Prescription.find().populate('patient').sort({ createdAt: -1 });
      return res.json(list);
    }
    res.json([
      {
        _id: 'RX_001',
        patient: { fullName: 'Nguyễn Văn Minh', phone: '0903111222' },
        medicines: [{ medicine: { name: 'Paracetamol 250mg', stock: 248 }, quantity: 20 }],
        notes: 'Uống sau ăn khi sốt trên 38.5 độ',
        createdBy: { fullName: 'Y Tá Lan Anh', role: 'nurse' },
        status: 'approved',
        createdAt: new Date()
      },
      {
        _id: 'RX_002',
        patient: { fullName: 'Trần Thị Mai', phone: '0912333444' },
        medicines: [{ medicine: { name: 'Amoxicillin 500mg', stock: 120 }, quantity: 14 }],
        notes: 'Kháng sinh uống 7 ngày liên tục',
        createdBy: { fullName: 'Dược Sĩ Minh Phúc', role: 'pharmacist' },
        status: 'pending',
        createdAt: new Date()
      }
    ]);
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi: ' + err.message });
  }
});

// ========== START SERVER ==========
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Apotheca Rx Server running on http://localhost:${PORT}`));
}

module.exports = app;

