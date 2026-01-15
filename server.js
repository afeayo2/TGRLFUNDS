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
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB error:', err));
} else {
  console.log('Warning: MONGO_URI not set. Database features will not work.');
}


app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  })
);






// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());



const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'yourSecretKey',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
};

if (process.env.MONGO_URI) {
  sessionConfig.store = MongoStore.create({ mongoUrl: process.env.MONGO_URI });
}

app.use(session(sessionConfig));



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
const adminStaffAnalytics= require('./routes/adminStaffAnalytics')




//app.use('/', authRoutes);
app.use('/client', clientRoutes);
app.use('/staff', staffRoutes);
app.use('/admin', adminRoutes);
app.use('/withdrawal',adminWithdrawals );
app.use('/loan',Loan );
app.use('/adminloan',adminLoans );
app.use('/adminAnalis',adminStaffAnalytics );




// 404 Page
app.use((req, res) => {
  res.status(404).send('404 - Page Not Found');
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PaceSave server running on http://0.0.0.0:${PORT}`);
});
