const express = require('express');
const router = express.Router();
const { store, nccList, nsxList, atcList } = require('../../dataStore');

router.get('/', (req, res) => {
  const items = store.medicines.filter(m => m.category === 'vtyt');
  res.render('vtyt/index', {
    title: 'Vật tư & Thiết bị Y tế',
    category: 'vtyt',
    icon: '🧪',
    description: 'Vật tư y tế tiêu hao • Bông băng gạc • Kim tiêm • Dụng cụ & Thiết bị y khoa',
    items,
    nhaCungCapList: nccList,
    nhaSanXuatList: nsxList,
    atcList: atcList
  });
});

module.exports = router;
