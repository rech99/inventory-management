import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  ArrowLeftRight, 
  Plus, 
  Search, 
  AlertTriangle, 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Warehouse as WhIcon, 
  DollarSign, 
  TrendingUp, 
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  FileText,
  Truck
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

interface Category {
  id: number;
  name: string;
  description: string;
  product_count: number;
}

interface Supplier {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
}

interface Warehouse {
  id: number;
  name: string;
  location: string;
  capacity: number;
  current_total_stock: number;
}

interface ProductStock {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  warehouse: number;
  warehouse_name: string;
  quantity: number;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: number;
  category_name: string;
  min_stock_level: number;
  stocks: ProductStock[];
  total_quantity: number;
}

interface PurchaseOrderItem {
  id?: number;
  product: number;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrder {
  id: number;
  order_number: string;
  supplier: number;
  supplier_name: string;
  status: 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
  total_amount: number;
  items: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  warehouse: number;
  warehouse_name: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
  quantity: number;
  reference_id: string;
  user_name: string;
  created_at: string;
}

interface WSNotification {
  id: number;
  type: string;
  message: string;
  timestamp: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Dashboard & Navigation state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'transfers'>('dashboard');
  const [analytics, setAnalytics] = useState<any>(null);
  
  // Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Filters & Searches
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodLowStockOnly, setProdLowStockOnly] = useState(false);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  
  // Form values
  const [newProduct, setNewProduct] = useState({ sku: '', name: '', description: '', price: '', category: '', min_stock: '10' });
  const [newTransfer, setNewTransfer] = useState({ product: '', from_wh: '', to_wh: '', qty: '' });
  const [newPO, setNewPO] = useState<{ supplier: string; order_number: string; items: { product: string; qty: string; price: string }[] }>({
    supplier: '',
    order_number: 'PO-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000)),
    items: [{ product: '', qty: '', price: '' }]
  });
  const [newAdjust, setNewAdjust] = useState({ product: '', warehouse: '', type: 'IN', qty: '', ref: '' });

  // Notifications (Real-time updates)
  const [notifications, setNotifications] = useState<WSNotification[]>([]);
  const [isFlashUpdated, setIsFlashUpdated] = useState(false);

  // Axios Authorization helper
  const api = axios.create({
    baseURL: API_BASE,
  });

  api.interceptors.request.use((config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }, (error) => Promise.reject(error));

  // WebSocket connections
  useEffect(() => {
    if (!token) return;

    const socket = new WebSocket('ws://localhost:8000/ws/inventory/updates/');

    socket.onopen = () => {
      console.log('WS Connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WS Event:', data);
        const { type, payload } = data;

        let message = '';
        if (type === 'STOCK_UPDATED') {
          message = `Stock of ${payload.name} updated: ${payload.quantity} units at ${payload.warehouse_name}`;
        } else if (type === 'LOW_STOCK_ALERT') {
          message = `⚠️ Warning: ${payload.name} is running low! Current stock is ${payload.quantity}.`;
        } else if (type === 'PO_STATUS_CHANGED') {
          message = `Purchase Order ${payload.order_number} marked as ${payload.status}`;
        }

        setNotifications((prev) => [
          { id: Date.now(), type, message, timestamp: new Date().toLocaleTimeString() },
          ...prev
        ].slice(0, 5));

        // Refetch state
        fetchDashboardData();
        fetchProducts();
        fetchOrders();
        fetchTransactions();

        // Trigger brief visual glow in dashboard metrics
        setIsFlashUpdated(true);
        setTimeout(() => setIsFlashUpdated(false), 1500);

      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.log('WS Disconnected, retrying in 5 seconds...');
      setTimeout(() => {
        // Simple reconnect
      }, 5000);
    };

    return () => socket.close();
  }, [token]);

  // Load backend data
  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/analytics/dashboard/');
      setAnalytics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      let url = '/products/';
      const params: any = {};
      if (prodSearch) params.search = prodSearch;
      if (prodCategory) params.category = prodCategory;
      if (prodLowStockOnly) params.low_stock = 'true';
      
      const res = await api.get(url, { params });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/warehouses/');
      setWarehouses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers/');
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get('/purchase-orders/');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/transactions/');
      setTransactions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
      fetchProducts();
      fetchCategories();
      fetchWarehouses();
      fetchSuppliers();
      fetchOrders();
      fetchTransactions();
    }
  }, [token]);

  // Refresh lists when search/filter changes
  useEffect(() => {
    if (token) {
      fetchProducts();
    }
  }, [prodSearch, prodCategory, prodLowStockOnly]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/login/`, {
        username,
        password
      });
      const access = res.data.access;
      localStorage.setItem('access_token', access);
      setToken(access);
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || 'Invalid username or password.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setNotifications([]);
  };

  // Create Product handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/products/', {
        sku: newProduct.sku,
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        category: parseInt(newProduct.category),
        min_stock_level: parseInt(newProduct.min_stock)
      });
      fetchProducts();
      fetchDashboardData();
      setShowProductModal(false);
      setNewProduct({ sku: '', name: '', description: '', price: '', category: '', min_stock: '10' });
    } catch (err: any) {
      alert('Error creating product: ' + JSON.stringify(err.response?.data || err.message));
    }
  };

  // Handle stock transfers
  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/stock/transfer/', {
        product: parseInt(newTransfer.product),
        from_warehouse: parseInt(newTransfer.from_wh),
        to_warehouse: parseInt(newTransfer.to_wh),
        quantity: parseInt(newTransfer.qty)
      });
      fetchProducts();
      fetchDashboardData();
      fetchTransactions();
      setShowTransferModal(false);
      setNewTransfer({ product: '', from_wh: '', to_wh: '', qty: '' });
    } catch (err: any) {
      alert('Error transferring stock: ' + JSON.stringify(err.response?.data || err.message));
    }
  };

  // Handle PO status update (Approve or Receive)
  const handlePOStatusUpdate = async (id: number, status: string) => {
    try {
      const original = orders.find(o => o.id === id);
      if (!original) return;
      await api.put(`/purchase-orders/${id}/`, {
        order_number: original.order_number,
        supplier: original.supplier,
        status: status,
        items: original.items
      });
      fetchOrders();
      fetchProducts();
      fetchDashboardData();
      fetchTransactions();
    } catch (err: any) {
      alert('Error updating PO: ' + JSON.stringify(err.response?.data || err.message));
    }
  };

  // Handle create Purchase Order
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const items = newPO.items.map(item => ({
        product: parseInt(item.product),
        quantity: parseInt(item.qty),
        unit_price: parseFloat(item.price)
      }));
      await api.post('/purchase-orders/', {
        order_number: newPO.order_number,
        supplier: parseInt(newPO.supplier),
        status: 'PENDING',
        items
      });
      fetchOrders();
      setShowPOModal(false);
      setNewPO({
        supplier: '',
        order_number: 'PO-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000)),
        items: [{ product: '', qty: '', price: '' }]
      });
    } catch (err: any) {
      alert('Error creating Purchase Order: ' + JSON.stringify(err.response?.data || err.message));
    }
  };

  // Add Item row in PO creation
  const addPOItemRow = () => {
    setNewPO(prev => ({
      ...prev,
      items: [...prev.items, { product: '', qty: '', price: '' }]
    }));
  };

  // Update Item row in PO creation
  const updatePOItemRow = (index: number, field: string, value: string) => {
    const updated = [...newPO.items];
    updated[index] = { ...updated[index], [field]: value };
    // Auto populate unit price if product is selected
    if (field === 'product') {
      const selectedProd = products.find(p => p.id === parseInt(value));
      if (selectedProd) {
        updated[index].price = String(selectedProd.price);
      }
    }
    setNewPO(prev => ({ ...prev, items: updated }));
  };

  // Handle inventory stock adjustments (direct IN/OUT)
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/transactions/', {
        product: parseInt(newAdjust.product),
        warehouse: parseInt(newAdjust.warehouse),
        type: newAdjust.type,
        quantity: parseInt(newAdjust.qty),
        reference_id: newAdjust.ref
      });
      fetchProducts();
      fetchDashboardData();
      fetchTransactions();
      setShowAdjustModal(false);
      setNewAdjust({ product: '', warehouse: '', type: 'IN', qty: '', ref: '' });
    } catch (err: any) {
      alert('Error adjusting stock: ' + JSON.stringify(err.response?.data || err.message));
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">IV</div>
            <h2>Inventory System</h2>
            <div className="auth-subtitle">Log in to manage warehouses & track stock</div>
          </div>
          
          {loginError && <div className="auth-error">{loginError}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter 'admin'"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Enter 'adminpass'"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Side Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">IV</div>
          <span className="sidebar-title">G-Inventory</span>
        </div>
        
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Package size={20} />
            <span>Products</span>
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ShoppingCart size={20} />
            <span>Purchase Orders</span>
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'transfers' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfers')}
          >
            <ArrowLeftRight size={20} />
            <span>Stock Transfers</span>
          </li>
        </ul>

        {/* Live WebSocket Toast Feed */}
        {notifications.length > 0 && (
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bell size={10} className="pulse-dot" /> Live System Feed
            </div>
            {notifications.map(n => (
              <div key={n.id} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: n.type.includes('ALERT') ? 'var(--danger)' : 'var(--text-primary)' }}>
                {n.message}
              </div>
            ))}
          </div>
        )}
        
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">A</div>
            <div className="user-info">
              <span className="username">Admin User</span>
              <span className="user-role">Warehouse Admin</span>
            </div>
          </div>
          <button onClick={handleLogout} className="modal-close" title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        
        {/* HEADER */}
        <header className="page-header">
          <div className="page-title-group">
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p className="page-subtitle">Real-time inventory orchestration panel</p>
          </div>
          <div className="header-actions">
            <div className="realtime-badge">
              <div className="pulse-dot"></div>
              <span>Live Updates Active</span>
            </div>
            {activeTab === 'products' && (
              <>
                <button className="btn btn-secondary" onClick={() => setShowAdjustModal(true)}>
                  <Layers size={16} /> Adjust Stock
                </button>
                <button className="btn btn-primary" onClick={() => setShowProductModal(true)}>
                  <Plus size={16} /> New Product
                </button>
              </>
            )}
            {activeTab === 'orders' && (
              <button className="btn btn-primary" onClick={() => setShowPOModal(true)}>
                <Plus size={16} /> Create PO
              </button>
            )}
            {activeTab === 'transfers' && (
              <button className="btn btn-primary" onClick={() => setShowTransferModal(true)}>
                <ArrowLeftRight size={16} /> Initiate Transfer
              </button>
            )}
          </div>
        </header>

        {/* METRIC STATS */}
        {analytics && (
          <section className="metrics-grid">
            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Product Catalog</span>
                <div className="metric-icon"><Package size={18} /></div>
              </div>
              <div className="metric-value">{analytics.metrics.total_products}</div>
              <div className="metric-footer">Active SKU types registered</div>
            </div>

            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Stock Valuation</span>
                <div className="metric-icon"><DollarSign size={18} /></div>
              </div>
              <div className="metric-value">${analytics.metrics.total_stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="metric-footer">Net inventory asset value</div>
            </div>

            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Total Units</span>
                <div className="metric-icon"><TrendingUp size={18} /></div>
              </div>
              <div className="metric-value">{analytics.metrics.total_units}</div>
              <div className="metric-footer">Units across all warehouses</div>
            </div>

            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Low Stock Alert</span>
                <div className="metric-icon" style={{ color: analytics.metrics.low_stock_count > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: analytics.metrics.low_stock_count > 0 ? 'var(--danger)' : 'inherit' }}>
                {analytics.metrics.low_stock_count}
              </div>
              <div className="metric-footer">Items below minimum safety stock</div>
            </div>
          </section>
        )}

        {/* ACTIVE VIEW CONTENT */}
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && analytics && (
          <div className="dashboard-grid">
            {/* Custom Category Chart Card */}
            <div className="card">
              <div className="card-title">
                <span>Stock Distribution by Category</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Product counts</span>
              </div>
              
              <div className="chart-container">
                {analytics.category_distribution.map((item: any, idx: number) => {
                  const maxCount = Math.max(...analytics.category_distribution.map((c: any) => c.item_count), 1);
                  const heightPercent = Math.max((item.item_count / maxCount) * 80, 8); // Minimum height to show bar
                  return (
                    <div key={idx} className="chart-bar-wrapper">
                      <div className="chart-bar" style={{ height: `${heightPercent}%` }}>
                        <div className="chart-tooltip">{item.item_count} items</div>
                      </div>
                      <span className="chart-label">{item.name}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase' }}>Warehouse Overviews</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {warehouses.map(w => {
                    const pct = Math.min((w.current_total_stock / w.capacity) * 100, 100);
                    return (
                      <div key={w.id} style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600' }}>{w.name}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{w.current_total_stock} / {w.capacity} units</span>
                        </div>
                        <div className="progress-track" style={{ height: '4px' }}>
                          <div className="progress-bar normal" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Activities Feed */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-title">Recent Stock Activity</div>
              <div className="log-list" style={{ flexGrow: 1, overflowY: 'auto' }}>
                {analytics.recent_transactions.map((tx: any) => (
                  <div key={tx.id} className="log-item">
                    <div className="log-details">
                      <span className="log-title">{tx.product_name}</span>
                      <span className="log-meta">
                        {tx.warehouse_name} • {new Date(tx.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${
                        tx.type === 'IN' ? 'badge-in' : 
                        tx.type === 'OUT' ? 'badge-out' : 
                        tx.type === 'TRANSFER' ? 'badge-transfer' : 'badge-adjustment'
                      }`}>
                        {tx.type}
                      </span>
                      <div className="log-qty" style={{ 
                        color: tx.type === 'IN' ? 'var(--success)' : 
                               tx.type === 'OUT' ? 'var(--danger)' : 'inherit',
                        marginTop: '4px'
                      }}>
                        {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}
                      </div>
                    </div>
                  </div>
                ))}
                {analytics.recent_transactions.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px 0' }}>
                    No stock transaction records found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="card">
            {/* Filter Section */}
            <div className="list-filters">
              <div style={{ flexGrow: 1, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search products by SKU, name, description..." 
                  style={{ paddingLeft: '38px' }}
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                />
              </div>

              <select 
                className="form-input" 
                style={{ width: '180px' }}
                value={prodCategory}
                onChange={e => setProdCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <button 
                className={`btn ${prodLowStockOnly ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setProdLowStockOnly(!prodLowStockOnly)}
              >
                <AlertTriangle size={16} /> Low Stock Only
              </button>
            </div>

            {/* Products Table */}
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Warehouse Stocks</th>
                    <th>Total Available</th>
                    <th>Stock Alert Level</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const isLow = p.total_quantity <= p.min_stock_level;
                    const pct = Math.min((p.total_quantity / (p.min_stock_level * 3)) * 100, 100);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{p.sku}</td>
                        <td>
                          <div>
                            <div style={{ fontWeight: '500' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description || 'No description'}</div>
                          </div>
                        </td>
                        <td><span className="badge badge-approved">{p.category_name}</span></td>
                        <td style={{ fontWeight: '600' }}>${parseFloat(p.price as any).toFixed(2)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {p.stocks.map(s => (
                              <span key={s.id} style={{ fontSize: '0.75rem' }}>
                                🏢 {s.warehouse_name}: <strong>{s.quantity}</strong>
                              </span>
                            ))}
                            {p.stocks.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No warehouse stock</span>}
                          </div>
                        </td>
                        <td>
                          <div className="progress-container">
                            <span style={{ minWidth: '32px', fontWeight: 'bold', color: isLow ? 'var(--danger)' : 'var(--success)' }}>
                              {p.total_quantity}
                            </span>
                            <div className="progress-track" style={{ width: '80px' }}>
                              <div className={`progress-bar ${isLow ? 'low' : 'normal'}`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: isLow ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {p.min_stock_level} units
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        No products match the active filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PURCHASE ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="card">
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Created Date</th>
                    <th>Items Count</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{o.order_number}</td>
                      <td>{o.supplier_name}</td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>{o.items.length} unique items</td>
                      <td style={{ fontWeight: '600' }}>${parseFloat(o.total_amount as any).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${
                          o.status === 'PENDING' ? 'badge-pending' :
                          o.status === 'APPROVED' ? 'badge-approved' :
                          o.status === 'RECEIVED' ? 'badge-received' : 'badge-cancelled'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {o.status === 'PENDING' && (
                            <>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => handlePOStatusUpdate(o.id, 'APPROVED')}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none' }}
                                onClick={() => handlePOStatusUpdate(o.id, 'CANCELLED')}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {o.status === 'APPROVED' && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none' }}
                              onClick={() => handlePOStatusUpdate(o.id, 'RECEIVED')}
                            >
                              <Truck size={12} /> Receive Stock
                            </button>
                          )}
                          {o.status === 'RECEIVED' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Processed in Stock</span>
                          )}
                          {o.status === 'CANCELLED' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Voided</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        No Purchase Orders created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STOCK TRANSFERS TAB */}
        {activeTab === 'transfers' && (
          <div className="card">
            <div className="card-title">Active Warehouse Stocks</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {warehouses.map(w => (
                <div key={w.id} style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '6px' }}>
                    🏢 {w.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{w.location || 'No location set'}</p>
                  
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>Stored SKUs</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {products.filter(p => p.stocks.some(s => s.warehouse === w.id)).map(p => {
                        const qty = p.stocks.find(s => s.warehouse === w.id)?.quantity || 0;
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <span>{p.name} ({p.sku})</span>
                            <strong style={{ color: 'var(--primary)' }}>{qty} units</strong>
                          </div>
                        );
                      })}
                      {products.filter(p => p.stocks.some(s => s.warehouse === w.id)).length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>Empty Warehouse</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card-title">Transfer History Logs</div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log Time</th>
                    <th>Product</th>
                    <th>Movement</th>
                    <th>Quantity</th>
                    <th>Reference</th>
                    <th>Initiated By</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => t.type === 'TRANSFER' || t.reference_id?.includes('TRANSFER')).map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.created_at).toLocaleString()}</td>
                      <td style={{ fontWeight: '500' }}>{t.product_name}</td>
                      <td>
                        <span className="badge badge-transfer">
                          {t.reference_id?.startsWith('TRANSFER_TO') ? `TRANSFER OUT ➔ WH ${t.reference_id.split('_').pop()}` : `TRANSFER IN ➔ ${t.warehouse_name}`}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600' }}>{t.quantity} units</td>
                      <td>{t.reference_id}</td>
                      <td>{t.user_name}</td>
                    </tr>
                  ))}
                  {transactions.filter(t => t.type === 'TRANSFER' || t.reference_id?.includes('TRANSFER')).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        No stock transfers performed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* MODALS */}

      {/* NEW PRODUCT MODAL */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add New Product SKU</h2>
              <button className="modal-close" onClick={() => setShowProductModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">SKU Code</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. ELEC-005"
                    value={newProduct.sku}
                    onChange={e => setNewProduct({...newProduct, sku: e.target.value.toUpperCase()})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Bluetooth Headphones"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Brief details..."
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Unit Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Stock level</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={newProduct.min_stock}
                      onChange={e => setNewProduct({...newProduct, min_stock: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="form-input" 
                    value={newProduct.category} 
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create SKU</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT (IN/OUT) MODAL */}
      {showAdjustModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Record Stock Adjustment</h2>
              <button className="modal-close" onClick={() => setShowAdjustModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStockAdjustment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select SKU</label>
                  <select 
                    className="form-input" 
                    value={newAdjust.product}
                    onChange={e => setNewAdjust({...newAdjust, product: e.target.value})}
                    required
                  >
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Warehouse</label>
                  <select 
                    className="form-input" 
                    value={newAdjust.warehouse}
                    onChange={e => setNewAdjust({...newAdjust, warehouse: e.target.value})}
                    required
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Adjustment Type</label>
                    <select 
                      className="form-input" 
                      value={newAdjust.type}
                      onChange={e => setNewAdjust({...newAdjust, type: e.target.value})}
                      required
                    >
                      <option value="IN">IN (Restock / Found)</option>
                      <option value="OUT">OUT (Sales / Consumed)</option>
                      <option value="ADJUSTMENT">ADJUSTMENT (Audit Correction)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input 
                      type="number" 
                      min="1" 
                      className="form-input" 
                      value={newAdjust.qty}
                      onChange={e => setNewAdjust({...newAdjust, qty: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reference ID / Comments</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. INVOICE-456, AUDIT-JUNE"
                    value={newAdjust.ref}
                    onChange={e => setNewAdjust({...newAdjust, ref: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Process Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Initiate Warehouse Stock Transfer</h2>
              <button className="modal-close" onClick={() => setShowTransferModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStockTransfer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select SKU</label>
                  <select 
                    className="form-input" 
                    value={newTransfer.product}
                    onChange={e => setNewTransfer({...newTransfer, product: e.target.value})}
                    required
                  >
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">From Warehouse</label>
                    <select 
                      className="form-input" 
                      value={newTransfer.from_wh}
                      onChange={e => setNewTransfer({...newTransfer, from_wh: e.target.value})}
                      required
                    >
                      <option value="">Source</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">To Warehouse</label>
                    <select 
                      className="form-input" 
                      value={newTransfer.to_wh}
                      onChange={e => setNewTransfer({...newTransfer, to_wh: e.target.value})}
                      required
                    >
                      <option value="">Destination</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Transfer Quantity</label>
                  <input 
                    type="number" 
                    min="1" 
                    className="form-input" 
                    value={newTransfer.qty}
                    onChange={e => setNewTransfer({...newTransfer, qty: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Process Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {showPOModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>Draft Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowPOModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">PO Number</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newPO.order_number}
                      onChange={e => setNewPO({...newPO, order_number: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier</label>
                    <select 
                      className="form-input" 
                      value={newPO.supplier}
                      onChange={e => setNewPO({...newPO, supplier: e.target.value})}
                      required
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Items List</span>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={addPOItemRow}>
                      <Plus size={12} /> Add Row
                    </button>
                  </div>

                  {newPO.items.map((row, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <select 
                        className="form-input" 
                        value={row.product}
                        onChange={e => updatePOItemRow(idx, 'product', e.target.value)}
                        required
                      >
                        <option value="">Product SKU</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                      </select>
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        className="form-input" 
                        value={row.qty}
                        onChange={e => updatePOItemRow(idx, 'qty', e.target.value)}
                        required 
                      />
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="Cost price" 
                        className="form-input" 
                        value={row.price}
                        onChange={e => updatePOItemRow(idx, 'price', e.target.value)}
                        required 
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPOModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
