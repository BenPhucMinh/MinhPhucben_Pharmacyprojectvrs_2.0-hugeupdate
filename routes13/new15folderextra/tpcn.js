const express = require('express');
const router = express.Router();
const { store, nccList, nsxList, atcList } = require('../../dataStore');

router.get('/', (req, res) => {
  const items = store.medicines.filter(m => m.category === 'tpcn');
  res.render('tpcn/index', {
    title: 'Thực Phẩm Chức Năng',
    category: 'tpcn',
    icon: '🍃',
    description: 'Thực phẩm bảo vệ sức khỏe • Vitamin & Khoáng chất • Sản phẩm hỗ trợ điều trị',
    items,
    nhaCungCapList: nccList,
    nhaSanXuatList: nsxList,
    atcList: atcList
  });
});

module.exports = router;
