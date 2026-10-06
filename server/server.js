const express = require('express');
const path = require('path');
const { authenticate, errorHandler } = require('./middleware');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(authenticate); // sets req.user (or null) on every request
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler); // must be last

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));