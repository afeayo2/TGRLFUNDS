// server.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const flash = require('connect-flash');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));




app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: false, 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));



// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());



app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    sameSite: 'none' // or 'none' if using HTTPS and cross-origin
  }
}));


// Flash Messages
app.use(flash());

// Global Flash Variables
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// Set EJS
//app.set('view engine', 'ejs');
//app.set('views', path.join(__dirname, 'views'));

// Public Assets
app.use(express.static(path.join(__dirname, 'public')));

// Routes
//const authRoutes = require('./routes/auth');
const adminWithdrawals = require('./routes/adminWithdrawals');
const clientRoutes = require('./routes/client');
const staffRoutes = require('./routes/staffRoutes')
const adminRoutes = require('./routes/adminRoutes')
const Loan = require('./routes/Loan')
const adminLoans = require('./routes/adminLoans')




//app.use('/', authRoutes);
app.use('/', clientRoutes);
app.use('/staff', staffRoutes);
app.use('/admin', adminRoutes);
app.use('/withdrawal',adminWithdrawals );
app.use('/loan',Loan );
app.use('/adminloan',adminLoans );




// 404 Page
app.use((req, res) => {
  res.status(404).send('404 - Page Not Found');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PaceSave server running on http://localhost:${PORT}`);
});
