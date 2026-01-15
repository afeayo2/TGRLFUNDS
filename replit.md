# PaceSave

## Overview
PaceSave is a Node.js/Express backend API for managing loans, clients, staff, and payments. It uses MongoDB for data storage and integrates with Cloudinary for file uploads and Paystack for payment processing.

## Project Architecture
- **Framework**: Express.js 5
- **Database**: MongoDB (via Mongoose)
- **Session Management**: express-session with MongoDB store
- **File Uploads**: Multer with Cloudinary storage
- **Authentication**: JWT-based

## Directory Structure
```
├── config/          # Configuration files (Cloudinary)
├── middleware/      # Auth and upload middleware
├── models/          # Mongoose models (Admin, Client, Staff, Loan, Payment)
├── routes/          # API route handlers
├── server.js        # Main entry point
└── package.json     # Dependencies
```

## API Routes
- `/client` - Client management
- `/staff` - Staff management
- `/admin` - Admin operations
- `/withdrawal` - Withdrawal handling
- `/loan` - Loan operations
- `/adminloan` - Admin loan management
- `/adminAnalis` - Staff analytics

## Environment Variables Required
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `SESSION_SECRET` - Secret for session management
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `DOJAH_API_KEY` - Dojah API key
- `DOJAH_APP_ID` - Dojah app ID
- `BASE_URL` - Base URL for callbacks
- `FRONTEND_URL` - Frontend URL for redirects

## Running the Project
Development: `npm run dev`
Production: `npm start`

## Recent Changes
- January 2026: Configured for Replit environment
  - Updated CORS to allow all origins for Replit proxy
  - Server binds to 0.0.0.0:5000
  - Made MongoDB connection optional for development
