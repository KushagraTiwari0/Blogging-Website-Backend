# Modern Blogging Platform - Backend

This is the Node.js and Express backend for the modern blogging platform. It serves as a RESTful API managing users, articles, tags, and comments.

## 🚀 Key Features

- **Secure Authentication**: JWT-based sign-up, sign-in, and protected routes.
- **Article & Content Management**: Full CRUD operations for articles, comments, and tags.
- **SEO Friendly**: Automatic slug generation for article URLs.
- **Database Integration**: MongoDB with Mongoose for efficient data modeling.

## 💻 Tech Stack

- **Environment**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB & Mongoose
- **Security**: JWT (JSON Web Tokens), bcryptjs
- **Utilities**: Cors, Slugify

## 🛠️ Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Environment setup:
   Create a `.env` file in the root directory:
   \`\`\`env
   PORT=4000
   MONGODB_URI=<your_mongodb_connection_string>
   JWT_SECRET=<your_jwt_secret>
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`
   The server will run on http://localhost:4000.

## 🔗 Related Repository

- **Frontend Repository**: [Blogging-website-Frontend-main](../Blogging-website-Frontend-main/README.md)
