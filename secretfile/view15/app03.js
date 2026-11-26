// Existing routes
const nccRoutes = require('./routes/nhacungcap');
const nsxRoutes = require('./routes/nhasanxuat');
const atcRoutes = require('./routes/nhomatc');
const thuocRoutes = require('./routes/thuoc');

// ✨ New routes
const hangdactriRoutes = require('./routes/hangdactri');
const vtytRoutes = require('./routes/vtyt');
const tpcnRoutes = require('./routes/tpcn');
const dmpRoutes = require('./routes/dmp');

// Use them
app.use('/nhacungcap', nccRoutes);
app.use('/nhasanxuat', nsxRoutes);
app.use('/nhomatc', atcRoutes);
app.use('/thuoc', thuocRoutes);

// ✨ New routes active
app.use('/hangdactri', hangdactriRoutes);
app.use('/vtyt', vtytRoutes);
app.use('/tpcn', tpcnRoutes);
app.use('/dmp', dmpRoutes);

// After login → go to Dashboard!
app.get('/dashboard', (req, res) => {
  if (req.session.user) res.render('dashboard');
  else res.redirect('/login');
});
