const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load base JSON files
const medicinesFile = path.join(__dirname, 'data', 'medicines_all.json');
const nccFile = path.join(__dirname, 'data', 'nha_cung_cap (3).json');
const nsxFile = path.join(__dirname, 'data', 'nha_san_xuat (3).json');
const atcFile = path.join(__dirname, 'data', 'nhom_atc (3).json');

let rawMedicines = [];
try {
  if (fs.existsSync(medicinesFile)) {
    rawMedicines = JSON.parse(fs.readFileSync(medicinesFile, 'utf8'));
  }
} catch (e) {
  console.warn('⚠️ Could not load medicines_all.json:', e.message);
}

let nccList = [];
try {
  if (fs.existsSync(nccFile)) {
    nccList = JSON.parse(fs.readFileSync(nccFile, 'utf8'));
  }
} catch (e) {}

let nsxList = [];
try {
  if (fs.existsSync(nsxFile)) {
    nsxList = JSON.parse(fs.readFileSync(nsxFile, 'utf8'));
  }
} catch (e) {}

let atcList = [];
try {
  if (fs.existsSync(atcFile)) {
    atcList = JSON.parse(fs.readFileSync(atcFile, 'utf8'));
  }
} catch (e) {}

// Categorization helper for the 5 categories
function classifyMedicine(item, idx) {
  const name = (item.TEN_THANH_PHAM || item.ten_thanh_pham || '').toLowerCase();
  const group = (item.TENNHOM || item.ten_nhom || '').toLowerCase();
  const dvt = (item.DVT || item.dvt || '').toLowerCase();
  const hoatChat = (item.TEN_HOAT_CHAT || item.ten_hoat_chat || '').toLowerCase();

  // 1. VTYT (Vật tư & Thiết bị Y tế)
  if (group.includes('vật tư') || dvt.includes('bộ') || dvt.includes('ống nghe') || dvt.includes('kim') || name.includes('bơm tiêm') || name.includes('băng gạc') || name.includes('dây truyền') || name.includes('găng tay') || name.includes('khẩu trang')) {
    return 'vtyt';
  }

  // 2. TPCN (Thực phẩm chức năng)
  if (group.includes('không phải là thuốc') || name.includes('vitamin') || name.includes('omega') || name.includes('canxi') || name.includes('bổ gan') || name.includes('collagen') || name.includes('sâm') || name.includes('probiotic') || name.includes('men vi sinh')) {
    return 'tpcn';
  }

  // 3. DMP (Dược mỹ phẩm)
  if (name.includes('kem') || name.includes('gel') || name.includes('sữa rửa') || name.includes('dầu gội') || name.includes('serum') || name.includes('sát trùng') || name.includes('povidone') || name.includes('cồn') || name.includes('nước muối sinh lý')) {
    return 'dmp';
  }

  // 4. Hàng đặc trị (Thuốc đặc trị / Kểm soát đặc biệt / Ung thư / Gây nghiện / Hướng thần)
  if (hoatChat.includes('morphin') || hoatChat.includes('fentanyl') || hoatChat.includes('diazepam') || hoatChat.includes('tramadol') || hoatChat.includes('doxorubicin') || hoatChat.includes('carboplatin') || hoatChat.includes('interferon') || hoatChat.includes('insulin') || (idx % 12 === 0)) {
    return 'hangdactri';
  }

  // 5. Thuốc (Mặc định: Thuốc BHYT, Kê đơn, Không kê đơn)
  return 'thuoc';
}

// Format each medicine with standard properties
const now = new Date();
const store = {
  users: [
    {
      _id: 'usr_admin',
      fullName: 'Quản Trị Viên (Admin)',
      email: 'admin@pharmacy.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      phone: '0901234567',
      role: 'admin',
      baseSalary: 25000000,
      hourlyRate: 150000,
      createdAt: new Date('2026-01-01')
    },
    {
      _id: 'usr_pharmacist',
      fullName: 'Dược Sĩ Minh Phúc',
      email: 'pharmacist@pharmacy.com',
      passwordHash: bcrypt.hashSync('pharmacist123', 10),
      phone: '0907654321',
      role: 'pharmacist',
      baseSalary: 18000000,
      hourlyRate: 110000,
      createdAt: new Date('2026-01-15')
    },
    {
      _id: 'usr_nurse',
      fullName: 'Y Tá Lan Anh',
      email: 'nurse@pharmacy.com',
      passwordHash: bcrypt.hashSync('nurse123', 10),
      phone: '0918889999',
      role: 'nurse',
      baseSalary: 12000000,
      hourlyRate: 75000,
      createdAt: new Date('2026-02-01')
    }
  ],

  medicines: rawMedicines.map((item, idx) => {
    const categoryKey = classifyMedicine(item, idx);
    const categoryNames = {
      thuoc: 'Danh mục Thuốc',
      hangdactri: 'Hàng Đặc trị',
      vtyt: 'Vật tư & TBYT',
      tpcn: 'Thực phẩm chức năng',
      dmp: 'Dược mỹ phẩm'
    };

    // Calculate simulated expiry date for demonstration
    // Some expired, some expiring soon (15-60 days), most valid
    const daysOffset = (idx % 15 === 0) ? -10 : (idx % 11 === 0) ? 20 : (idx % 7 === 0) ? 55 : (idx % 5 === 0) ? 80 : 365 + (idx % 300);
    const expiryDate = new Date(now.getTime() + daysOffset * 86400000);
    const stockQty = (idx % 8 === 0) ? 3 : (idx % 13 === 0) ? 0 : 50 + (idx * 7) % 350;

    return {
      _id: item.MA_PM || `MED_${idx + 1}`,
      maThuoc: item.MA_PM || `MED_${idx + 1}`,
      tenThuoc: item.TEN_THANH_PHAM || item.ten_thanh_pham || 'Chưa đặt tên',
      tenHoatChat: item.TEN_HOAT_CHAT || item.ten_hoat_chat || '',
      hamLuong: item.HAMLUONG || item.ham_luong || '',
      donVi: item.DVT || item.dvt || 'Hộp',
      donGia: Number(item.DONGIA || item.don_gia || 10000),
      costPrice: Math.round(Number(item.DONGIA || item.don_gia || 10000) * 0.75), // 25% profit margin
      tonKho: stockQty,
      soLuongToiThieu: 10,
      category: categoryKey,
      categoryName: categoryNames[categoryKey],
      soDangKy: item.SO_DANG_KY || item.so_dang_ky || '',
      duongDung: item.DUONGDUNG || item.duong_dung || 'Uống',
      nhaSanXuat: item.TEN_NHA_SAN_XUAT || item.ten_nha_san_xuat || 'Việt Nam',
      nhaCungCap: item.TEN_NCC || item.ten_ncc || 'Công ty Dược',
      maNhomATC: item.TENNHOM || item.ten_nhom || 'N/A',
      soLo: `LOT-${2026}${(idx % 900 + 100)}`,
      hanSuDung: expiryDate.toISOString().split('T')[0],
      isLowStock: stockQty <= 10,
      isExpired: daysOffset < 0,
      daysToExpiry: daysOffset
    };
  }),

  // Phase 4: Simulated daily sales data
  salesToday: [
    { id: 'ORD_101', time: '08:15', customer: 'Nguyễn Văn Minh', phone: '0903111222', itemsCount: 3, totalAmount: 185000, paymentMethod: 'Tiền mặt', pharmacist: 'Dược Sĩ Minh Phúc' },
    { id: 'ORD_102', time: '09:30', customer: 'Trần Thị Mai', phone: '0912333444', itemsCount: 2, totalAmount: 320000, paymentMethod: 'Chuyển khoản', pharmacist: 'Dược Sĩ Minh Phúc' },
    { id: 'ORD_103', time: '10:45', customer: 'Lê Hoàng Nam', phone: '0934555666', itemsCount: 5, totalAmount: 640000, paymentMethod: 'BHYT + Ví điện tử', pharmacist: 'Quản Trị Viên (Admin)' },
    { id: 'ORD_104', time: '11:20', customer: 'Phạm Thu Trang', phone: '0978999000', itemsCount: 1, totalAmount: 75000, paymentMethod: 'Tiền mặt', pharmacist: 'Dược Sĩ Minh Phúc' },
    { id: 'ORD_105', time: '14:10', customer: 'Đỗ Quốc Bảo', phone: '0981222333', itemsCount: 4, totalAmount: 490000, paymentMethod: 'Chuyển khoản', pharmacist: 'Quản Trị Viên (Admin)' },
    { id: 'ORD_106', time: '16:00', customer: 'Vũ Hải Yến', phone: '0945666777', itemsCount: 2, totalAmount: 210000, paymentMethod: 'Tiền mặt', pharmacist: 'Dược Sĩ Minh Phúc' }
  ],

  // Phase 5: Worker task lists & stock check status
  tasks: [
    { id: 1, title: 'Kiểm tra nhiệt độ tủ lạnh bảo quản vắc-xin và sinh phẩm', priority: 'Cao', assignedTo: 'Y Tá Lan Anh', deadline: '08:00 Hàng ngày', status: 'completed' },
    { id: 2, title: 'Chuẩn bị đơn thuốc số #ORD_105 khu vực ngoại trú', priority: 'Trung bình', assignedTo: 'Y Tá Lan Anh', deadline: '14:30 Hôm nay', status: 'completed' },
    { id: 3, title: 'Kiểm kê định kỳ kệ A2: Thuốc kháng sinh & Hàng đặc trị', priority: 'Cao', assignedTo: 'Y Tá Lan Anh', deadline: '16:00 Hôm nay', status: 'in_progress' },
    { id: 4, title: 'Nhập kho lô hàng mới từ Cty CP Dược phẩm TV.PHARM', priority: 'Khẩn cấp', assignedTo: 'Dược Sĩ Minh Phúc', deadline: '17:30 Hôm nay', status: 'pending' },
    { id: 5, title: 'Vệ sinh và khử khuẩn khu vực quầy cấp phát thuốc', priority: 'Thường', assignedTo: 'Y Tá Lan Anh', deadline: '18:00 Hàng ngày', status: 'pending' }
  ],

  stockAudits: [
    { maThuoc: 'TBH00413', tenThuoc: 'Paracetamol 250mg', viTri: 'Kệ A-01', tonHeThong: 250, thucTe: 248, chenhLech: -2, ghiChu: '2 gói rách vỏ niêm phong', auditor: 'Y Tá Lan Anh', status: 'Cần duyệt cân đối' },
    { maThuoc: 'TBH00414', tenThuoc: 'Amoxicillin 500mg', viTri: 'Kệ B-04', tonHeThong: 120, thucTe: 120, chenhLech: 0, ghiChu: 'Đầy đủ, nguyên tem', auditor: 'Y Tá Lan Anh', status: 'Khớp 100%' },
    { maThuoc: 'TBH00418', tenThuoc: 'Cefuroxime 500mg', viTri: 'Kệ B-07', tonHeThong: 80, thucTe: 81, chenhLech: 1, ghiChu: 'Dư 1 vỉ trả lại từ khoa cấp cứu', auditor: 'Dược Sĩ Minh Phúc', status: 'Đã cập nhật hệ thống' },
    { maThuoc: 'TBH00425', tenThuoc: 'Omeprazole 20mg', viTri: 'Kệ C-02', tonHeThong: 300, thucTe: 295, chenhLech: -5, ghiChu: 'Đang xác minh phiếu xuất viện', auditor: 'Y Tá Lan Anh', status: 'Đang kiểm tra' }
  ],

  usageLogs: [
    { id: 'LOG_01', timestamp: new Date(Date.now() - 3600000).toLocaleString('vi-VN'), user: 'Dược Sĩ Minh Phúc', role: 'pharmacist', action: 'Xuất thuốc theo đơn', target: 'Paracetamol 250mg x 20 gói', ref: 'Đơn #ORD_106' },
    { id: 'LOG_02', timestamp: new Date(Date.now() - 7200000).toLocaleString('vi-VN'), user: 'Quản Trị Viên (Admin)', role: 'admin', action: 'Điều chỉnh tồn kho', target: 'Cefuroxime 500mg (+1)', ref: 'Phiếu kiểm kê B-07' },
    { id: 'LOG_03', timestamp: new Date(Date.now() - 14400000).toLocaleString('vi-VN'), user: 'Y Tá Lan Anh', role: 'nurse', action: 'Hoàn thành kiểm kê', target: 'Kệ A-01 Paracetamol', ref: 'Audit Kệ A-01' },
    { id: 'LOG_04', timestamp: new Date(Date.now() - 28800000).toLocaleString('vi-VN'), user: 'Dược Sĩ Minh Phúc', role: 'pharmacist', action: 'Duyệt đơn thuốc', target: 'Đơn bệnh nhân Lê Hoàng Nam', ref: 'Đơn #ORD_103' }
  ],

  // Phase 6: Budget & Salary records
  payroll: [
    {
      id: 'PAY_001',
      staffName: 'Quản Trị Viên (Admin)',
      role: 'admin',
      roleTitle: 'Giám Đốc Dược / Quản Trị Hệ Thống',
      baseSalary: 25000000,
      workHours: 176,
      overtimeHours: 12,
      shiftAllowance: 2000000,
      dispenseBonus: 3500000,
      deductions: 2625000, // BHXH, BHYT, Thuế TNCN
      netSalary: 29875000,
      paymentStatus: 'Đã duyệt chi'
    },
    {
      id: 'PAY_002',
      staffName: 'Dược Sĩ Minh Phúc',
      role: 'pharmacist',
      roleTitle: 'Dược Sĩ Chịu Trách Nhiệm Chuyên Môn',
      baseSalary: 18000000,
      workHours: 184,
      overtimeHours: 20,
      shiftAllowance: 1800000,
      dispenseBonus: 4200000,
      deductions: 1890000,
      netSalary: 24110000,
      paymentStatus: 'Đã duyệt chi'
    },
    {
      id: 'PAY_003',
      staffName: 'Y Tá Lan Anh',
      role: 'nurse',
      roleTitle: 'Nhân Viên Kho & Cấp Phát Dược Phẩm',
      baseSalary: 12000000,
      workHours: 176,
      overtimeHours: 10,
      shiftAllowance: 1200000,
      dispenseBonus: 1800000,
      deductions: 1260000,
      netSalary: 14740000,
      paymentStatus: 'Chờ thanh toán'
    }
  ],

  financials: {
    monthlyRevenue: 485200000,   // Doanh thu tháng này (VNĐ)
    monthlyCOGS: 339640000,      // Giá vốn hàng bán (70%)
    grossProfit: 145560000,      // Lợi nhuận gộp (30%)
    operatingExpenses: 68725000, // Chi phí vận hành & lương nhân viên
    netProfit: 76835000,         // Lợi nhuận ròng
    marginPercent: 30.0,
    supplierPayables: 52400000,  // Công nợ nhà cung cấp đến hạn
    cashOnHand: 189500000        // Quỹ tiền mặt & tài khoản
  }
};

module.exports = {
  store,
  nccList,
  nsxList,
  atcList,
  classifyMedicine
};
