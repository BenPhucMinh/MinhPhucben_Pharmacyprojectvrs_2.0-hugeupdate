const express = require('express');
const router = express.Router();
const { store, nccList, nsxList, atcList } = require('../../dataStore');

router.get('/', (req, res) => {
  const items = store.medicines.filter(m => m.category === 'dmp');
  res.render('dmp/index', {
    title: 'Dược Mỹ Phẩm',
    category: 'dmp',
    icon: '✨',
    description: 'Dung dịch sát khuẩn • Kem điều trị da liễu • Dược mỹ phẩm y khoa an toàn',
    items,
    nhaCungCapList: nccList,
    nhaSanXuatList: nsxList,
    atcList: atcList
  });
});

module.exports = router;
