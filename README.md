# 🌱 FeedForward — Food Waste Redistribution Platform

A full-stack MERN application connecting food donors, NGO admins, and delivery agents to reduce food waste and feed communities.

---

## 📁 Project Structure

```
feedforward/
├── client/          → React.js frontend
├── server/          → Node.js + Express backend
├── package.json     → Root (runs both with concurrently)
└── README.md
```

---

## 🚀 VS Code Setup — Step by Step

### STEP 1 — Open the project in VS Code

1. Launch **VS Code**
2. Click **File → Open Folder**
3. Navigate to and select the `feedforward` folder
4. Click **Select Folder**

---

### STEP 2 — Install Node.js (if not already installed)

1. Go to https://nodejs.org and download **LTS version**
2. Run the installer and follow the steps
3. Verify: Open VS Code Terminal (`Ctrl + `` ` ``) and run:
   ```
   node -v
   npm -v
   ```
   Both should print version numbers.

---

### STEP 3 — Set up MongoDB Atlas (Free Cloud Database)

1. Go to https://mongodb.com/atlas and create a free account
2. Create a **Free Cluster** (M0)
3. Under **Database Access**, click **Add New Database User**
   - Username: `feedforward`
   - Password: (auto-generate, copy it)
   - Role: **Read and write to any database**
4. Under **Network Access**, click **Add IP Address → Allow Access From Anywhere** (0.0.0.0/0)
5. Go to **Clusters → Connect → Connect your application**
6. Copy the connection string — it looks like:
   ```
   mongodb+srv://feedforward:<password>@cluster0.xxxxx.mongodb.net/
   ```
7. Replace `<password>` with your actual password

---

### STEP 4 — Set up Cloudinary (Free Image Hosting)

1. Go to https://cloudinary.com and sign up for free
2. From your **Dashboard**, copy:
   - Cloud Name
   - API Key
   - API Secret

---

### STEP 5 — Set up Gmail App Password (for email notifications)

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** if not already done
3. Go to **Security → App passwords**
4. Select app: **Mail**, device: **Other** → type "FeedForward"
5. Copy the 16-character app password

---

### STEP 6 — Configure Environment Variables

In VS Code, open `server/.env` and fill in your values:

```env
PORT=5000
MONGO_URI=mongodb+srv://feedforward:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/feedforward
JWT_SECRET=feedforward_super_secret_2024_xyz
CLOUDINARY_NAME=your_cloud_name
CLOUDINARY_KEY=your_api_key
CLOUDINARY_SECRET=your_api_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16char_app_password
CLIENT_URL=http://localhost:3000
```

---

### STEP 7 — Install all dependencies

In VS Code Terminal (`Ctrl + `` ` ``), run each command:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Go back to root, install client dependencies
cd ..
cd client
npm install

# Go back to root
cd ..
```

---

### STEP 8 — Run the application

**Option A — Run both at once from root (recommended):**
```bash
npm run dev
```

**Option B — Run separately in two terminals:**

Terminal 1 (server):
```bash
cd server
npm run dev
```

Terminal 2 (client):
```bash
cd client
npm start
```

---

### STEP 9 — Open the app

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/health

---

### STEP 10 — Create your first accounts

1. Open http://localhost:3000
2. Click **Register** tab
3. Create accounts for each role:
   - Register as **NGO Admin** first (you'll need an admin to accept food posts)
   - Register as **Donor**
   - Register as **Delivery Agent**
4. Login with each role to explore the dashboards

---

## 🎯 Features by Role

### 🤲 Donor
- Post food donations with photo + live GPS location
- 6-step Flipkart-style order tracking
- Real-time agent location on map
- Reward points system with tier badges

### 🏢 NGO Admin
- View all incoming food requests
- Accept/reject with agent assignment
- Live map of all active agents
- User management + assign points to donors
- Kanban/List delivery overview

### 🚴 Delivery Agent
- Accept/reject assignments
- 4-step delivery tracker
- Live navigation map with route to donor
- Share live GPS location (Socket.IO)
- Mark pickup & delivery complete

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT + bcryptjs |
| Real-time | Socket.IO |
| Maps | Leaflet.js + OpenStreetMap |
| Email | Nodemailer (Gmail) |
| Images | Multer + Cloudinary |

---

## 🐛 Common Issues & Fixes

**❌ `Module not found` errors**
→ Run `npm install` inside the specific folder (client or server)

**❌ MongoDB connection failed**
→ Check MONGO_URI in server/.env — make sure password has no special chars that need URL encoding

**❌ Email not sending**
→ Make sure you used a Gmail **App Password**, not your regular Gmail password

**❌ Cloudinary upload failing**
→ Double-check CLOUDINARY_NAME, CLOUDINARY_KEY, CLOUDINARY_SECRET in .env

**❌ Map not loading**
→ Leaflet CSS is loaded from CDN in public/index.html — check internet connection

**❌ Port 3000 or 5000 already in use**
→ Change PORT in server/.env, or kill the process:
- Windows: `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F`

---

## 📧 Support

Built with ❤️ for reducing food waste and feeding communities.
