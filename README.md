# BillBuddy

BillBuddy is a Splitwise clone that helps users split and track shared expenses in a fair and transparent way. It supports group expense management and debt simplification.

## Features

- User Authentication (Signup/Login)
- Group Creation and Management
- Expense Splitting
- Debt Simplification
- Expense History and Dashboard
- Settlement and Email Summary

## Tech Stack

- MongoDB - Database
- Express.js - Backend Framework
- React - Frontend Library
- Node.js - Runtime Environment
- JWT - Authentication
- Nodemailer - Email Service

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Setup Instructions

1. Clone the repository:
```bash
git clone https://github.com/yourusername/billbuddy.git
cd billbuddy
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/billbuddy
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

4. Start the development server:
```bash
npm run dev
```

5. In a new terminal, start the React development server:
```bash
cd client
npm install
npm start
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/me - Get current user

### Groups
- POST /api/groups - Create a new group
- GET /api/groups - Get all groups for current user
- GET /api/groups/:id - Get single group
- PUT /api/groups/:id - Update group
- DELETE /api/groups/:id - Delete group

### Expenses
- POST /api/expenses - Create a new expense
- GET /api/expenses/group/:groupId - Get all expenses for a group
- GET /api/expenses/:id - Get single expense
- PUT /api/expenses/:id - Update expense
- DELETE /api/expenses/:id - Delete expense
- POST /api/expenses/settle/:groupId - Settle up group expenses

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 