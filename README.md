# Fawmond Galaxy Backend (Render Deployment)

Backend API service for Fawmond Galaxy Car Listing Platform built with Express.js, MongoDB (Mongoose), and JWT authentication.

## 🚀 Deployment on Render (Web Service)

1. Create a **New Web Service** on [Render](https://render.com).
2. Connect your GitHub repository containing this backend code.
3. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add **Environment Variables** in Render dashboard:
   - `MONGODB_URI`: Your MongoDB Atlas connection string (`mongodb+srv://...`)
   - `JWT_SECRET`: A secure random string for JWT token generation
   - `ADMIN_EMAIL`: Initial admin login email
   - `ADMIN_PASSWORD`: Initial admin login password
   - `CLIENT_URL`: URL of your deployed frontend (e.g. `https://your-frontend.vercel.app`)

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Run development server with auto-reload
npm run dev

# Run production server
npm start
```

## 📡 API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/cars` - List all vehicles
- `GET /api/cars/:id` - Vehicle details
- `POST /api/cars` - Add vehicle (Admin auth required)
- `PUT /api/cars/:id` - Update vehicle (Admin auth required)
- `DELETE /api/cars/:id` - Delete vehicle (Admin auth required)
- `POST /api/enquiries` - Submit customer enquiry
- `POST /api/admin/login` - Admin authentication
