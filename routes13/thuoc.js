const express = require('express');
const router = express.Router();
const { store, nccList, nsxList, atcList } = require('../dataStore');

// Page Render — sends Thuốc data to EJS view
router.get('/', (req, res) => {
  try {
    const medicines = store.medicines.filter(m => m.category === 'thuoc');
    res.render('thuoc/index', {
      title: 'Danh mục Thuốc',
      category: 'thuoc',
      icon: '💊',
      description: 'Thuốc BHYT • Thuốc kê đơn • Thuốc không kê đơn',
      medicines,
      nhaCungCapList: nccList,
      nhaSanXuatList: nsxList,
      atcList: atcList
    });
  } catch (err) {
    res.render('thuoc/index', {
      title: 'Danh mục Thuốc',
      category: 'thuoc',
      icon: '💊',
      medicines: [],
      error: err.message
    });
  }
});

// API Search — for AJAX search
router.get('/search/:name', (req, res) => {
  const query = (req.params.name || '').toLowerCase();
  const results = store.medicines.filter(m => 
    m.category === 'thuoc' && (
      m.tenThuoc.toLowerCase().includes(query) ||
      m.tenHoatChat.toLowerCase().includes(query) ||
      m.maThuoc.toLowerCase().includes(query)
    )
  );
  res.json(results);
});

module.exports = router;
