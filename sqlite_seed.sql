-- ==========================================
-- SQLITE TEST DATABASE SEED SCRIPT
-- For generic SQLite test applications
-- ==========================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- 1. DROP TABLES IF THEY EXIST (For clean resets)
DROP TABLE IF EXISTS stock_transactions;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS product_stocks;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- 2. CREATE SCHEMAS

-- Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, -- Plain text or hash depending on your app config
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT CHECK(role IN ('admin', 'manager', 'staff')) DEFAULT 'staff',
    is_active INTEGER DEFAULT 1
);

-- Categories Table
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Suppliers Table
CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT
);

-- Warehouses Table
CREATE TABLE warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    location TEXT,
    capacity INTEGER NOT NULL CHECK(capacity > 0)
);

-- Products Table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL CHECK(price >= 0),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    min_stock_level INTEGER DEFAULT 10 CHECK(min_stock_level >= 0)
);

-- Product Stocks Table (Current stock levels per warehouse)
CREATE TABLE product_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0 CHECK(quantity >= 0),
    UNIQUE(product_id, warehouse_id)
);

-- Purchase Orders Table
CREATE TABLE purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE PROTECT,
    status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED')) DEFAULT 'PENDING',
    total_amount REAL DEFAULT 0.00 CHECK(total_amount >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Order Items Table
CREATE TABLE purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE PROTECT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0)
);

-- Stock Transactions Table (Historical movement log)
CREATE TABLE stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    type TEXT CHECK(type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')) NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    reference_id TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. INSERT TEST SEED DATA

-- Test Users
INSERT INTO users (id, username, password, email, first_name, last_name, role) VALUES 
(1, 'admin', 'adminpass', 'admin@inventory.com', 'System', 'Administrator', 'admin'),
(2, 'manager', 'managerpass', 'manager@inventory.com', 'Warehouse', 'Manager', 'manager'),
(3, 'staff', 'staffpass', 'staff@inventory.com', 'Inventory', 'Auditor', 'staff'),
(4, 'system', 'systempass', 'system@inventory.com', 'System', 'Automator', 'staff');

-- Categories
INSERT INTO categories (id, name, description) VALUES
(1, 'Electronics', 'Smartphones, keyboards, monitors, and chips'),
(2, 'Furniture', 'Ergonomic desks, chairs, cabinets, and warehouse shelves'),
(3, 'Office Supplies', 'A4 papers, gel pens, binders, and calculators'),
(4, 'Packaging Material', 'Cardboard boxes, shipping tape, and bubble wrap');

-- Suppliers
INSERT INTO suppliers (id, name, contact_name, email, phone, address) VALUES
(1, 'Global Tech Imports', 'Alice Johnson', 'orders@globaltech.com', '+1-555-987-6543', '120 Silicon Way, San Jose, CA'),
(2, 'Apex Furniture Solutions', 'Marcus Aurelius', 'sales@apexfurniture.com', '+1-555-123-4567', '456 Industrial Parkway, Grand Rapids, MI'),
(3, 'Office Distribution Co', 'Charlie Davis', 'charlie@officedist.com', '+1-555-789-0123', '789 Logistics Blvd, Atlanta, GA');

-- Warehouses
INSERT INTO warehouses (id, name, location, capacity) VALUES
(1, 'Main Central Warehouse', 'Logistics Hub Bay A, Chicago, IL', 15000),
(2, 'East Coast Depot', 'Port Terminal Building 4, Newark, NJ', 5000);

-- Products
INSERT INTO products (id, sku, name, description, price, category_id, min_stock_level) VALUES
(1, 'ELEC-001', 'Wireless Optical Mouse', 'High precision 2.4Ghz wireless mouse', 24.50, 1, 20),
(2, 'ELEC-002', 'Mechanical Keyboard Pro', 'RGB backlit clicky switch typing keyboard', 85.00, 1, 12),
(3, 'ELEC-003', 'IPS Monitor 27"', 'IPS panel 1440p refresh rate monitor', 220.00, 1, 6),
(4, 'ELEC-004', 'Type-C Multi-Hub Adapter', '8-in-1 USB-C docking station', 45.00, 1, 15),
(5, 'FURN-001', 'Ergonomic Mesh Chair', 'High-back office chair with lumbar support', 179.99, 2, 8),
(6, 'FURN-002', 'Adjustable Standing Desk', 'Electric dual-motor standing desk frame', 349.00, 2, 5),
(7, 'FURN-003', 'Steel Storage Cabinet', '3-shelf heavy duty lockable steel locker', 125.00, 2, 4),
(8, 'OFFC-001', 'White Print Paper Box', 'Box containing 5 reams of standard A4 print paper', 19.99, 3, 25),
(9, 'OFFC-002', 'Premium Gel Pens (12-pack)', 'Black gel ink smooth-write pens', 8.50, 3, 15),
(10, 'PACK-001', 'Medium Shipping Boxes (25-pack)', '12x12x12 double wall cardboard shipping boxes', 35.00, 4, 10);

-- Product Stocks
INSERT INTO product_stocks (product_id, warehouse_id, quantity) VALUES
(1, 1, 138), -- ELEC-001: 150 In - 12 Out
(1, 2, 25),  -- ELEC-001: 30 In - 5 Out
(2, 1, 52),  -- ELEC-002: 60 In - 8 Out
(3, 1, 18),
(4, 1, 65),  -- ELEC-004: 80 In - 15 Out
(4, 2, 15),
(5, 1, 14),
(5, 2, 3),
(6, 1, 6),   -- FURN-002: 8 In - 2 Out
(7, 1, 5),
(8, 1, 80),  -- OFFC-001: 100 In - 20 Out
(8, 2, 20),
(9, 1, 12),  -- Low stock level alert triggered (min is 15)
(10, 1, 40);

-- Purchase Orders
INSERT INTO purchase_orders (id, order_number, supplier_id, status, total_amount) VALUES
(1, 'PO-2026-0001', 1, 'RECEIVED', 2300.00),
(2, 'PO-2026-0002', 2, 'APPROVED', 3099.90),
(3, 'PO-2026-0003', 3, 'PENDING', 1154.70),
(4, 'PO-2026-0004', 1, 'CANCELLED', 900.00);

-- Purchase Order Items
INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_price) VALUES
-- PO 1
(1, 1, 1, 50, 20.00),
(2, 1, 2, 20, 65.00),
-- PO 2
(3, 2, 5, 10, 135.00),
(4, 2, 6, 5, 260.00),
-- PO 3
(5, 3, 8, 50, 15.00),
(6, 3, 9, 30, 6.00),
-- PO 4
(7, 4, 3, 5, 180.00);

-- Stock Transactions (History Log)
INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reference_id, user_id) VALUES
-- Initial IN
(1, 1, 'IN', 150, 'INIT_IN', 2),
(2, 1, 'IN', 60, 'INIT_IN', 2),
(3, 1, 'IN', 18, 'INIT_IN', 2),
(4, 1, 'IN', 80, 'INIT_IN', 2),
(5, 1, 'IN', 14, 'INIT_IN', 2),
(6, 1, 'IN', 8, 'INIT_IN', 2),
(7, 1, 'IN', 5, 'INIT_IN', 2),
(8, 1, 'IN', 100, 'INIT_IN', 2),
(9, 1, 'IN', 12, 'INIT_IN', 2),
(10, 1, 'IN', 40, 'INIT_IN', 2),
(1, 2, 'IN', 30, 'INIT_IN', 2),
(4, 2, 'IN', 15, 'INIT_IN', 2),
(5, 2, 'IN', 3, 'INIT_IN', 2),
(8, 2, 'IN', 20, 'INIT_IN', 2),
-- Sales / OUT
(1, 1, 'OUT', 12, 'INV-2026-901', 3),
(2, 1, 'OUT', 8, 'INV-2026-902', 3),
(4, 1, 'OUT', 15, 'INV-2026-903', 3),
(6, 1, 'OUT', 2, 'INV-2026-904', 3),
(8, 1, 'OUT', 20, 'INV-2026-905', 3),
(1, 2, 'OUT', 5, 'INV-2026-906', 3);
