# Real-Time Inventory Management System

A full-stack, real-time inventory management solution comprising a **Django REST API backend** with **Django Channels (WebSockets)**, a **React Web Dashboard**, and a **React Native Mobile App** (built with Expo).

## 📂 Project Structure

* **`backend/`** - Django REST framework + Channels. Handles authentication (SimpleJWT), stock models, warehouse routing, purchase order management, and WebSocket broadcasts.
* **`frontend-web/`** - React + Vite + TypeScript. Custom dark-theme web dashboard with responsive grids, category analytics charts, live update streams, PO management, and stock adjustments.
* **`mobile/`** - Expo React Native + TypeScript. Pocket client featuring server host selection, simulated barcode scanner, stock level lookups, and purchase order fulfillment.

---

## 🔐 Credentials (Seeded Data)

Running the data seeding script creates the default admin user:
* **Username**: `admin`
* **Password**: `adminpass`

---

## 🚀 Execution Guide

Follow these steps to run all three applications locally:

### 1. Django API Backend
Open a terminal in the project root folder:
```powershell
# Navigate to backend directory
cd backend

# (Optional - already done) Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run the Django migrations & seed initial database values (if not already done)
python manage.py migrate
python manage.py seed_data

# Start the Daphne ASGI development server
python manage.py runserver 0.0.0.0:8000
```
The server will boot at `http://localhost:8000/`. Real-time WebSockets will listen at `ws://localhost:8000/ws/inventory/updates/`.

---

### 2. React Web Frontend
Open a new terminal in the project root:
```powershell
# Navigate to web dashboard
cd frontend-web

# Install dependencies (if not done)
npm install

# Start Vite dev server
npm run dev
```
Open your browser to the URL printed in the terminal (usually `http://localhost:5173/`).

---

### 3. Expo Mobile App
Open a new terminal in the project root:
```powershell
# Navigate to mobile app
cd mobile

# Start the Expo developer tool
npm run start
```
* Press **`w`** to run the app in the browser (web mode).
* Scan the QR code with the **Expo Go** app on your physical iOS/Android device to run it directly on your phone.
* Press **`a`** to run on an Android Emulator (configure server host input in the login card to `10.0.2.2:8000`).
* Press **`i`** to run on an iOS Simulator (configure server host input in the login card to `localhost:8000`).

---

## ⚡ Core Workflows

1. **Dashboard Overview**: Access the React web dashboard. The custom SVG chart shows product counts per category, while warehouse indicators display physical fill levels.
2. **Restocking via PO**:
   * Create a new Purchase Order in the Web Dashboard (PO will start as `PENDING`).
   * Change the status to `APPROVED` in the orders table.
   * On the mobile app (or web dashboard), select the PO and click **Receive Stock**.
   * The backend automatically records transaction logs (`IN`), updates the product stock records, and sends a WebSocket event.
   * The web dashboard immediately updates the stock counters, total valuation, and logs list with a green highlight glow.
3. **Warehouse Stock Transfers**:
   * Click **Initiate Transfer** on the web dashboard (or use the simulated scan tool on mobile).
   * Transfer units of a product from "Main Warehouse" to "Secondary Depot".
   * The system logs a `TRANSFER` transaction and decreases/increases stock levels atomically.
4. **Safety Alerts**:
   * If stock falls below a product's defined `min_stock_level` (due to a sale/usage `OUT` transaction), the backend broadcasts a `LOW_STOCK_ALERT` via WebSockets.
   * A warning banner/feed entry lights up red on both the web and mobile screens instantly.
