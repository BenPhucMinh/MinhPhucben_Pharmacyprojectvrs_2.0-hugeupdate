const express = require('express');
const router = express.Router();
const { store, nccList, nsxList, atcList } = require('../../dataStore');

router.get('/', (req, res) => {
  const items = store.medicines.filter(m => m.category === 'hangdactri');
  res.render('hangdactri/index', {
    title: 'Hàng Đặc Trị',
    category: 'hangdactri',
    icon: '🏥',
    description: 'Thuốc kiểm soát đặc biệt • Ung thư • Thuốc gây nghiện & hướng thần • Theo toa',
    items,
    nhaCungCapList: nccList,
    nhaSanXuatList: nsxList,
    atcList: atcList
  });
});

module.exports = router;
