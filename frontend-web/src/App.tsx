import React, { useState, useEffect } from 'react';
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
  DollarSign, 
  TrendingUp, 
  Layers,
  X,
  Truck
} from 'lucide-react';
import { translations } from './translations';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

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
  
  // Language configuration (default 'es')
  const [lang, setLang] = useState<'es' | 'en'>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'en' || saved === 'es') ? saved : 'es';
  });
  
  const t = translations[lang];
  
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transaction | null>(null);
  
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

  // Interceptor de respuesta para manejar errores 401 Unauthorized globalmente
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('access_token');
        setToken(null);
      }
      return Promise.reject(error);
    }
  );

  // WebSocket connections
  useEffect(() => {
    if (!token) return;

    // Derivar URL de WS dinámicamente desde API_BASE
    const wsBaseUrl = API_BASE.replace(/\/api$/, '').replace(/\/$/, '');
    const wsProto = wsBaseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${wsBaseUrl.replace(/^https?/, wsProto)}/ws/inventory/updates/`;

    const socket = new WebSocket(wsUrl);

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

  // Quick reorder handler from low stock dashboard widget
  const handleQuickReorder = (product: Product) => {
    setNewPO({
      supplier: suppliers.length > 0 ? String(suppliers[0].id) : '',
      order_number: 'PO-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000)),
      items: [{ product: String(product.id), qty: String(product.min_stock_level * 2), price: String(product.price) }]
    });
    setShowPOModal(true);
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
            <h2>{t.loginTitle}</h2>
            <div className="auth-subtitle">{t.loginSubtitle}</div>
          </div>
          
          {loginError && <div className="auth-error">{t.invalidCredentials}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">{t.username}</label>
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
              <label className="form-label">{t.password}</label>
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
              {t.signIn}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', gap: '16px' }}>
            <button 
              onClick={() => setLang('es')} 
              className={`tab-btn ${lang === 'es' ? 'active' : ''}`}
              style={{ padding: '4px 8px', fontSize: '0.7rem', letterSpacing: '1px', borderBottomWidth: lang === 'es' ? '2px' : '0' }}
            >
              ESPAÑOL
            </button>
            <button 
              onClick={() => setLang('en')} 
              className={`tab-btn ${lang === 'en' ? 'active' : ''}`}
              style={{ padding: '4px 8px', fontSize: '0.7rem', letterSpacing: '1px', borderBottomWidth: lang === 'en' ? '2px' : '0' }}
            >
              ENGLISH
            </button>
          </div>
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
            <span>{t.dashboard}</span>
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Package size={20} />
            <span>{t.products}</span>
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ShoppingCart size={20} />
            <span>{t.orders}</span>
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'transfers' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfers')}
          >
            <ArrowLeftRight size={20} />
            <span>{t.transfers}</span>
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
              <span className="user-role">{t.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="modal-close" title={t.logout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        
        {/* HEADER */}
        <header className="page-header">
          <div className="page-title-group">
            <h1>{t[activeTab as 'dashboard' | 'products' | 'orders' | 'transfers']}</h1>
            <p className="page-subtitle">{t.title}</p>
          </div>
          <div className="header-actions">
            <div className="realtime-badge">
              <div className="pulse-dot"></div>
              <span>{lang === 'es' ? 'Actualizaciones en Vivo' : 'Live Updates Active'}</span>
            </div>
            <div className="lang-selector-group" style={{ display: 'flex', gap: '0px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              <button 
                onClick={() => { setLang('es'); localStorage.setItem('app_lang', 'es'); }}
                style={{
                  background: lang === 'es' ? 'var(--primary)' : 'transparent',
                  color: lang === 'es' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: 0,
                  transition: 'var(--transition-fast)'
                }}
              >
                ES
              </button>
              <button 
                onClick={() => { setLang('en'); localStorage.setItem('app_lang', 'en'); }}
                style={{
                  background: lang === 'en' ? 'var(--primary)' : 'transparent',
                  color: lang === 'en' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: 0,
                  transition: 'var(--transition-fast)'
                }}
              >
                EN
              </button>
            </div>
            {activeTab === 'products' && (
              <>
                <button className="btn btn-secondary" onClick={() => setShowAdjustModal(true)}>
                  <Layers size={16} /> {t.btnAdjustStock}
                </button>
                <button className="btn btn-primary" onClick={() => setShowProductModal(true)}>
                  <Plus size={16} /> {t.btnNewProduct}
                </button>
              </>
            )}
            {activeTab === 'orders' && (
              <button className="btn btn-primary" onClick={() => setShowPOModal(true)}>
                <Plus size={16} /> {t.btnNewPO}
              </button>
            )}
            {activeTab === 'transfers' && (
              <button className="btn btn-primary" onClick={() => setShowTransferModal(true)}>
                <ArrowLeftRight size={16} /> {t.btnNewTransfer}
              </button>
            )}
          </div>
        </header>

        {/* METRIC STATS */}
        {analytics && (
          <section className="metrics-grid">
            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">{t.totalProducts}</span>
                <div className="metric-icon"><Package size={18} /></div>
              </div>
              <div className="metric-value">{analytics.metrics.total_products}</div>
              <div className="metric-footer">{lang === 'es' ? 'SKUs únicos registrados' : 'Active SKU types registered'}</div>
            </div>

            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">{t.valuation}</span>
                <div className="metric-icon"><DollarSign size={18} /></div>
              </div>
              <div className="metric-value">${analytics.metrics.total_stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="metric-footer">{lang === 'es' ? 'Valor neto de activos' : 'Net inventory asset value'}</div>
            </div>

            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">{lang === 'es' ? 'Unidades Totales' : 'Total Units'}</span>
                <div className="metric-icon"><TrendingUp size={18} /></div>
              </div>
              <div className="metric-value">{analytics.metrics.total_units}</div>
              <div className="metric-footer">{lang === 'es' ? 'Stock disponible en almacenes' : 'Units across all warehouses'}</div>
            </div>

            <div className={`metric-card ${isFlashUpdated ? 'flash-updated' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">{t.activeAlerts}</span>
                <div className="metric-icon" style={{ color: analytics.metrics.low_stock_count > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: analytics.metrics.low_stock_count > 0 ? 'var(--danger)' : 'inherit' }}>
                {analytics.metrics.low_stock_count}
              </div>
              <div className="metric-footer">{lang === 'es' ? 'Productos bajo el mínimo de seguridad' : 'Items below minimum safety stock'}</div>
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
                <span>{lang === 'es' ? 'Distribución de Stock por Categoría' : 'Stock Distribution by Category'}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lang === 'es' ? 'Cantidad de productos' : 'Product counts'}</span>
              </div>
              
              <div className="chart-container">
                {analytics.category_distribution.map((item: any, idx: number) => {
                  const maxCount = Math.max(...analytics.category_distribution.map((c: any) => c.item_count), 1);
                  const heightPercent = Math.max((item.item_count / maxCount) * 80, 8); // Minimum height to show bar
                  return (
                    <div key={idx} className="chart-bar-wrapper">
                      <div className="chart-bar" style={{ height: `${heightPercent}%` }}>
                        <div className="chart-tooltip">{item.item_count} {lang === 'es' ? 'productos' : 'items'}</div>
                      </div>
                      <span className="chart-label">{item.name}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase' }}>{lang === 'es' ? 'Resumen de Almacenes' : 'Warehouse Overviews'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {warehouses.map(w => {
                    const pct = Math.min((w.current_total_stock / w.capacity) * 100, 100);
                    return (
                      <div key={w.id} style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600' }}>{w.name}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{w.current_total_stock} / {w.capacity} {lang === 'es' ? 'unidades' : 'units'}</span>
                        </div>
                        <div className="progress-track" style={{ height: '4px' }}>
                          <div className="progress-bar normal" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                        {/* Right Column: Recent Activities + Critical Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {/* Recent Activities Feed */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: '320px' }}>
                <div className="card-title">{t.recentMovementsTitle}</div>
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
                          {tx.type === 'IN' ? t.badgeIn : 
                           tx.type === 'OUT' ? t.badgeOut : 
                           tx.type === 'TRANSFER' ? t.badgeTransfer : t.badgeAdjustment}
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
                      {t.noMovements}
                    </div>
                  )}
                </div>
              </div>

              {/* Critical Stock Alerts Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
                <div className="card-title" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠️ {lang === 'es' ? 'Alertas de Stock Crítico' : 'Critical Stock Alerts'}
                  </span>
                  <span className="badge badge-cancelled">
                    {products.filter(p => p.total_quantity <= p.min_stock_level).length}
                  </span>
                </div>
                <div className="log-list" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '280px' }}>
                  {products.filter(p => p.total_quantity <= p.min_stock_level).map(p => (
                    <div key={p.id} className="log-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <div className="log-details">
                        <span className="log-title" style={{ color: 'var(--danger)', fontWeight: '600' }}>{p.name}</span>
                        <span className="log-meta">
                          SKU: {p.sku} • {lang === 'es' ? `Stock: ${p.total_quantity} / Mín: ${p.min_stock_level}` : `Stock: ${p.total_quantity} / Min: ${p.min_stock_level}`}
                        </span>
                      </div>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.7rem', backgroundColor: 'var(--danger)', color: '#000', border: '1px solid var(--danger)', fontWeight: 'bold' }}
                        onClick={() => handleQuickReorder(p)}
                      >
                        {lang === 'es' ? 'Reordenar' : 'Reorder'}
                      </button>
                    </div>
                  ))}
                  {products.filter(p => p.total_quantity <= p.min_stock_level).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                      {lang === 'es' ? '✅ Todo el stock está en niveles seguros.' : '✅ All stock levels are safe.'}
                    </div>
                  )}
                </div>
              </div>
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
                  placeholder={t.searchPlaceholder} 
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
                <option value="">{t.allCategories}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <button 
                className={`btn ${prodLowStockOnly ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setProdLowStockOnly(!prodLowStockOnly)}
              >
                <AlertTriangle size={16} /> {t.lowStockFilter}
              </button>
            </div>

            {/* Products Table */}
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{t.sku}</th>
                    <th>{t.name}</th>
                    <th>{t.category}</th>
                    <th>{t.price}</th>
                    <th>{t.whStocks}</th>
                    <th>{t.totalAvail}</th>
                    <th>{t.alertLevel}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const isLow = p.total_quantity <= p.min_stock_level;
                    const pct = Math.min((p.total_quantity / (p.min_stock_level * 3)) * 100, 100);
                    return (
                      <tr 
                        key={p.id} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => setSelectedProduct(p)}
                        title={lang === 'es' ? 'Ver detalles de este producto' : 'Click to view product details'}
                      >
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
                            {p.stocks.length === 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {lang === 'es' ? 'Sin stock en depósito' : 'No warehouse stock'}
                              </span>
                            )}
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
                            {p.min_stock_level} {lang === 'es' ? 'unidades' : 'units'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        {t.emptyProducts}
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
                    <th>{lang === 'es' ? 'Nro PO' : 'PO Number'}</th>
                    <th>{t.supplier}</th>
                    <th>{t.date}</th>
                    <th>{t.items}</th>
                    <th>{t.totalAmount}</th>
                    <th>{t.status}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr 
                      key={o.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedOrder(o)}
                      title={lang === 'es' ? 'Ver detalles de esta orden' : 'Click to view order details'}
                    >
                      <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{o.order_number}</td>
                      <td>{o.supplier_name}</td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>{o.items.length} {lang === 'es' ? 'ítems únicos' : 'unique items'}</td>
                      <td style={{ fontWeight: '600' }}>${parseFloat(o.total_amount as any).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${
                          o.status === 'PENDING' ? 'badge-pending' :
                          o.status === 'APPROVED' ? 'badge-approved' :
                          o.status === 'RECEIVED' ? 'badge-received' : 'badge-cancelled'
                        }`}>
                          {o.status === 'PENDING' ? t.badgePending :
                           o.status === 'APPROVED' ? t.badgeApproved :
                           o.status === 'RECEIVED' ? t.badgeReceived : t.badgeCancelled}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {o.status === 'PENDING' && (
                            <>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={(e) => { e.stopPropagation(); handlePOStatusUpdate(o.id, 'APPROVED'); }}
                              >
                                {t.btnApprove}
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none' }}
                                onClick={(e) => { e.stopPropagation(); handlePOStatusUpdate(o.id, 'CANCELLED'); }}
                              >
                                {t.btnCancel}
                              </button>
                            </>
                          )}
                          {o.status === 'APPROVED' && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none' }}
                              onClick={(e) => { e.stopPropagation(); handlePOStatusUpdate(o.id, 'RECEIVED'); }}
                            >
                              <Truck size={12} /> {t.btnReceive}
                            </button>
                          )}
                          {o.status === 'RECEIVED' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lang === 'es' ? 'Procesado en Stock' : 'Processed in Stock'}</span>
                          )}
                          {o.status === 'CANCELLED' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lang === 'es' ? 'Anulada' : 'Voided'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        {t.emptyOrders}
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
            <div className="card-title">{lang === 'es' ? 'Existencias Activas en Almacenes' : 'Active Warehouse Stocks'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {warehouses.map(w => (
                <div key={w.id} style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '6px' }}>
                    🏢 {w.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{w.location || (lang === 'es' ? 'Sin ubicación registrada' : 'No location set')}</p>
                  
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>{lang === 'es' ? 'SKUs Almacenados' : 'Stored SKUs'}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {products.filter(p => p.stocks.some(s => s.warehouse === w.id)).map(p => {
                        const qty = p.stocks.find(s => s.warehouse === w.id)?.quantity || 0;
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <span>{p.name} ({p.sku})</span>
                            <strong style={{ color: 'var(--primary)' }}>{qty} {lang === 'es' ? 'unidades' : 'units'}</strong>
                          </div>
                        );
                      })}
                      {products.filter(p => p.stocks.some(s => s.warehouse === w.id)).length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>{lang === 'es' ? 'Almacén Vacío' : 'Empty Warehouse'}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card-title">{lang === 'es' ? 'Historial de Transferencias' : 'Transfer History Logs'}</div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{lang === 'es' ? 'Fecha y Hora' : 'Log Time'}</th>
                    <th>{lang === 'es' ? 'Producto' : 'Product'}</th>
                    <th>{lang === 'es' ? 'Movimiento' : 'Movement'}</th>
                    <th>{t.qty}</th>
                    <th>{t.refId}</th>
                    <th>{lang === 'es' ? 'Iniciado por' : 'Initiated By'}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => t.type === 'TRANSFER' || t.reference_id?.includes('TRANSFER')).map(tx => (
                    <tr 
                      key={tx.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTransfer(tx)}
                      title={lang === 'es' ? 'Ver detalles de esta transferencia' : 'Click to view transfer details'}
                    >
                      <td>{new Date(tx.created_at).toLocaleString()}</td>
                      <td style={{ fontWeight: '500' }}>{tx.product_name}</td>
                      <td>
                        <span className="badge badge-transfer">
                          {tx.reference_id?.startsWith('TRANSFER_TO') ? 
                            (lang === 'es' ? `ENVÍO ➔ WH ${tx.reference_id.split('_').pop()}` : `TRANSFER OUT ➔ WH ${tx.reference_id.split('_').pop()}`) : 
                            (lang === 'es' ? `RECEPCIÓN ➔ ${tx.warehouse_name}` : `TRANSFER IN ➔ ${tx.warehouse_name}`)}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600' }}>{tx.quantity} {lang === 'es' ? 'unidades' : 'units'}</td>
                      <td>{tx.reference_id}</td>
                      <td>{tx.user_name}</td>
                    </tr>
                  ))}
                  {transactions.filter(t => t.type === 'TRANSFER' || t.reference_id?.includes('TRANSFER')).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        {lang === 'es' ? 'No se han realizado transferencias de stock.' : 'No stock transfers performed yet.'}
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
              <h2>{t.modalNewProduct}</h2>
              <button className="modal-close" onClick={() => setShowProductModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t.sku}</label>
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
                  <label className="form-label">{t.name}</label>
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
                  <label className="form-label">{t.labelDescription}</label>
                  <textarea 
                    className="form-input" 
                    placeholder={t.phDescription}
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{lang === 'es' ? 'Precio Unitario ($)' : 'Unit Price ($)'}</label>
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
                    <label className="form-label">{t.labelMinStock}</label>
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
                  <label className="form-label">{t.category}</label>
                  <select 
                    className="form-input" 
                    value={newProduct.category} 
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    required
                  >
                    <option value="">{lang === 'es' ? 'Seleccionar Categoría' : 'Select Category'}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>{t.btnCancel}</button>
                <button type="submit" className="btn btn-primary">{t.btnNewProduct}</button>
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
              <h2>{t.modalAdjustStock}</h2>
              <button className="modal-close" onClick={() => setShowAdjustModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStockAdjustment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{lang === 'es' ? 'Seleccionar SKU' : 'Select SKU'}</label>
                  <select 
                    className="form-input" 
                    value={newAdjust.product}
                    onChange={e => setNewAdjust({...newAdjust, product: e.target.value})}
                    required
                  >
                    <option value="">{t.phSelectProd}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.labelWarehouse}</label>
                  <select 
                    className="form-input" 
                    value={newAdjust.warehouse}
                    onChange={e => setNewAdjust({...newAdjust, warehouse: e.target.value})}
                    required
                  >
                    <option value="">{t.phSelectWh}</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{t.labelType}</label>
                    <select 
                      className="form-input" 
                      value={newAdjust.type}
                      onChange={e => setNewAdjust({...newAdjust, type: e.target.value})}
                      required
                    >
                      <option value="IN">{lang === 'es' ? 'IN (Reabastecimiento / Hallazgo)' : 'IN (Restock / Found)'}</option>
                      <option value="OUT">{lang === 'es' ? 'OUT (Venta / Consumido)' : 'OUT (Sales / Consumed)'}</option>
                      <option value="ADJUSTMENT">{lang === 'es' ? 'ADJUSTMENT (Corrección de Auditoría)' : 'ADJUSTMENT (Audit Correction)'}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.qty}</label>
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
                  <label className="form-label">{lang === 'es' ? 'ID Referencia / Comentarios' : 'Reference ID / Comments'}</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>{t.btnCancel}</button>
                <button type="submit" className="btn btn-primary">{lang === 'es' ? 'Procesar Ajuste' : 'Process Adjustment'}</button>
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
              <h2>{t.modalNewTransfer}</h2>
              <button className="modal-close" onClick={() => setShowTransferModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStockTransfer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{lang === 'es' ? 'Seleccionar SKU' : 'Select SKU'}</label>
                  <select 
                    className="form-input" 
                    value={newTransfer.product}
                    onChange={e => setNewTransfer({...newTransfer, product: e.target.value})}
                    required
                  >
                    <option value="">{t.phSelectProd}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{t.labelFromWh}</label>
                    <select 
                      className="form-input" 
                      value={newTransfer.from_wh}
                      onChange={e => setNewTransfer({...newTransfer, from_wh: e.target.value})}
                      required
                    >
                      <option value="">{lang === 'es' ? 'Origen' : 'Source'}</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.labelToWh}</label>
                    <select 
                      className="form-input" 
                      value={newTransfer.to_wh}
                      onChange={e => setNewTransfer({...newTransfer, to_wh: e.target.value})}
                      required
                    >
                      <option value="">{lang === 'es' ? 'Destino' : 'Destination'}</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'es' ? 'Cantidad a Transferir' : 'Transfer Quantity'}</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>{t.btnCancel}</button>
                <button type="submit" className="btn btn-primary">{lang === 'es' ? 'Procesar Transferencia' : 'Process Transfer'}</button>
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
              <h2>{t.modalNewPO}</h2>
              <button className="modal-close" onClick={() => setShowPOModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{lang === 'es' ? 'Nro PO' : 'PO Number'}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newPO.order_number}
                      onChange={e => setNewPO({...newPO, order_number: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.supplier}</label>
                    <select 
                      className="form-input" 
                      value={newPO.supplier}
                      onChange={e => setNewPO({...newPO, supplier: e.target.value})}
                      required
                    >
                      <option value="">{t.phSelectSupplier}</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{lang === 'es' ? 'Lista de Ítems' : 'Items List'}</span>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={addPOItemRow}>
                      <Plus size={12} /> {lang === 'es' ? 'Añadir Fila' : 'Add Row'}
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
                        <option value="">{lang === 'es' ? 'SKU del Producto' : 'Product SKU'}</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                      </select>
                      <input 
                        type="number" 
                        placeholder={lang === 'es' ? 'Cant' : 'Qty'} 
                        className="form-input" 
                        value={row.qty}
                        onChange={e => updatePOItemRow(idx, 'qty', e.target.value)}
                        required 
                      />
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder={lang === 'es' ? 'Precio Costo' : 'Cost price'} 
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowPOModal(false)}>{t.btnCancel}</button>
                <button type="submit" className="btn btn-primary">{lang === 'es' ? 'Guardar Borrador' : 'Save Draft'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', width: '95%' }}>
            <div className="modal-header" style={{ borderBottom: 'var(--border-hairline-active)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-approved" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>{selectedProduct.sku}</span>
                <h2>{selectedProduct.name}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedProduct(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', backgroundColor: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                <div style={{ backgroundColor: 'var(--bg-darker)', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Precio Unitario' : 'Unit Price'}</div>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>${parseFloat(selectedProduct.price as any).toFixed(2)}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-darker)', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Stock Mínimo' : 'Min Stock'}</div>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--warning)' }}>{selectedProduct.min_stock_level}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-darker)', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Stock Total' : 'Total Stock'}</div>
                  <strong style={{ fontSize: '1.1rem', color: selectedProduct.total_quantity <= selectedProduct.min_stock_level ? 'var(--danger)' : 'var(--success)' }}>
                    {selectedProduct.total_quantity}
                  </strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-darker)', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Categoría' : 'Category'}</div>
                  <strong style={{ fontSize: '0.85rem' }}>{selectedProduct.category_name}</strong>
                </div>
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(6, 182, 212, 0.2)', padding: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>{lang === 'es' ? 'Descripción: ' : 'Description: '}</strong>{selectedProduct.description}
                </div>
              )}

              {/* Warehouse Stock Grid */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  🏢 {lang === 'es' ? 'Distribución por Almacén' : 'Warehouse Distribution'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {warehouses.map(w => {
                    const stock = selectedProduct.stocks.find(s => s.warehouse === w.id);
                    const qty = stock ? stock.quantity : 0;
                    const pct = Math.min((qty / w.capacity) * 100, 100);
                    return (
                      <div key={w.id} style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600' }}>{w.name}</span>
                          <span style={{ fontWeight: 'bold', color: qty > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                            {qty} {lang === 'es' ? 'unidades' : 'units'}
                          </span>
                        </div>
                        <div className="progress-track" style={{ height: '4px' }}>
                          <div className="progress-bar normal" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions History Logs for this product */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  🔄 {lang === 'es' ? 'Historial de Movimientos de este Producto' : 'Stock Movements for this Product'}
                </h3>
                <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px' }}>{lang === 'es' ? 'Fecha' : 'Date'}</th>
                        <th style={{ padding: '8px' }}>{lang === 'es' ? 'Almacén' : 'Warehouse'}</th>
                        <th style={{ padding: '8px' }}>{lang === 'es' ? 'Tipo' : 'Type'}</th>
                        <th style={{ padding: '8px' }}>{t.qty}</th>
                        <th style={{ padding: '8px' }}>{t.refId}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.filter(t => t.product === selectedProduct.id).map(tx => (
                        <tr key={tx.id}>
                          <td style={{ padding: '8px' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '8px' }}>{tx.warehouse_name}</td>
                          <td style={{ padding: '8px' }}>
                            <span className={`badge ${
                              tx.type === 'IN' ? 'badge-in' : 
                              tx.type === 'OUT' ? 'badge-out' : 
                              tx.type === 'TRANSFER' ? 'badge-transfer' : 'badge-adjustment'
                            }`} style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                              {tx.type === 'IN' ? t.badgeIn : 
                               tx.type === 'OUT' ? t.badgeOut : 
                               tx.type === 'TRANSFER' ? t.badgeTransfer : t.badgeAdjustment}
                            </span>
                          </td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: tx.type === 'IN' ? 'var(--success)' : tx.type === 'OUT' ? 'var(--danger)' : 'inherit' }}>
                            {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}
                          </td>
                          <td style={{ padding: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.reference_id}</td>
                        </tr>
                      ))}
                      {transactions.filter(t => t.product === selectedProduct.id).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                            {lang === 'es' ? 'Sin movimientos registrados' : 'No movements registered'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ marginRight: 'auto' }}
                onClick={() => {
                  setNewAdjust(prev => ({ ...prev, product: String(selectedProduct.id), type: 'IN' }));
                  setSelectedProduct(null);
                  setShowAdjustModal(true);
                }}
              >
                🛠️ {lang === 'es' ? 'Ajustar Stock' : 'Adjust Stock'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setSelectedProduct(null)}>{lang === 'es' ? 'Cerrar' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PURCHASE ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '95%' }}>
            <div className="modal-header" style={{ borderBottom: 'var(--border-hairline-active)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-approved" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>{selectedOrder.order_number}</span>
                <h2>{lang === 'es' ? 'Detalle de Orden de Compra' : 'Purchase Order Details'}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* PO Info Card */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{t.supplier}</div>
                  <strong style={{ fontSize: '0.95rem' }}>{selectedOrder.supplier_name}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{t.date}</div>
                  <strong>{new Date(selectedOrder.created_at).toLocaleDateString()}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{t.status}</div>
                  <span className={`badge ${
                    selectedOrder.status === 'PENDING' ? 'badge-pending' :
                    selectedOrder.status === 'APPROVED' ? 'badge-approved' :
                    selectedOrder.status === 'RECEIVED' ? 'badge-received' : 'badge-cancelled'
                  }`}>
                    {selectedOrder.status === 'PENDING' ? t.badgePending :
                     selectedOrder.status === 'APPROVED' ? t.badgeApproved :
                     selectedOrder.status === 'RECEIVED' ? t.badgeReceived : t.badgeCancelled}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{t.totalAmount}</div>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>${parseFloat(selectedOrder.total_amount as any).toFixed(2)}</strong>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                  📦 {lang === 'es' ? 'Productos Ordenados' : 'Ordered Products'}
                </h3>
                <div className="table-container" style={{ border: '1px solid var(--border-color)' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px' }}>{t.sku}</th>
                        <th style={{ padding: '8px' }}>{t.name}</th>
                        <th style={{ padding: '8px' }}>{t.qty}</th>
                        <th style={{ padding: '8px' }}>{lang === 'es' ? 'P. Unitario' : 'U. Price'}</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--primary)' }}>{item.product_sku || 'N/A'}</td>
                          <td style={{ padding: '8px' }}>{item.product_name || 'Product'}</td>
                          <td style={{ padding: '8px' }}>{item.quantity}</td>
                          <td style={{ padding: '8px' }}>${parseFloat(item.unit_price as any).toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              {/* Action shortcuts in modal */}
              {selectedOrder.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    onClick={() => {
                      handlePOStatusUpdate(selectedOrder.id, 'APPROVED');
                      setSelectedOrder(null);
                    }}
                  >
                    {t.btnApprove}
                  </button>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    onClick={() => {
                      handlePOStatusUpdate(selectedOrder.id, 'CANCELLED');
                      setSelectedOrder(null);
                    }}
                  >
                    {t.btnCancel}
                  </button>
                </div>
              )}
              {selectedOrder.status === 'APPROVED' && (
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', marginRight: 'auto' }}
                  onClick={() => {
                    handlePOStatusUpdate(selectedOrder.id, 'RECEIVED');
                    setSelectedOrder(null);
                  }}
                >
                  <Truck size={12} /> {t.btnReceive}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setSelectedOrder(null)}>{lang === 'es' ? 'Cerrar' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER DETAIL MODAL */}
      {selectedTransfer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px', width: '95%' }}>
            <div className="modal-header" style={{ borderBottom: 'var(--border-hairline-active)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-transfer" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                  {lang === 'es' ? 'Transferencia' : 'Transfer Log'}
                </span>
                <h2>{selectedTransfer.reference_id}</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedTransfer(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Product and General Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Producto' : 'Product'}</div>
                  <strong style={{ color: 'var(--primary)' }}>{selectedTransfer.product_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {selectedTransfer.product_sku}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Cantidad' : 'Quantity'}</div>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{selectedTransfer.quantity} {lang === 'es' ? 'unidades' : 'units'}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Operador' : 'Operator'}</div>
                  <strong>{selectedTransfer.user_name}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '4px' }}>{lang === 'es' ? 'Fecha y Hora' : 'Date / Time'}</div>
                  <span style={{ fontSize: '0.85rem' }}>{new Date(selectedTransfer.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Visual Flow Diagram */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {lang === 'es' ? 'Flujo de Transferencia' : 'Transfer Logistics Flow'}
                </h3>
                
                {(() => {
                  const isTo = selectedTransfer.reference_id?.startsWith('TRANSFER_TO');
                  const otherWhId = selectedTransfer.reference_id?.split('_').pop();
                  const otherWh = warehouses.find(w => w.id === parseInt(otherWhId || ''));
                  const otherWhName = otherWh ? otherWh.name : `Warehouse ${otherWhId}`;
                  
                  const fromWhName = isTo ? selectedTransfer.warehouse_name : otherWhName;
                  const toWhName = isTo ? otherWhName : selectedTransfer.warehouse_name;
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: 'rgba(6, 182, 212, 0.02)', border: '1px dashed rgba(6, 182, 212, 0.2)' }}>
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        
                        {/* Source Warehouse Box */}
                        <div style={{ flex: 1, border: '1px solid var(--border-color)', padding: '10px', textAlign: 'center', fontSize: '0.8rem', backgroundColor: 'var(--bg-darker)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-gray)', marginBottom: '4px' }}>{lang === 'es' ? 'ORIGEN' : 'SOURCE'}</div>
                          <strong style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{fromWhName}</strong>
                        </div>

                        {/* Arrow with Qty */}
                        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'var(--bg-darker)', padding: '2px 6px', border: '1px solid rgba(6,182,212,0.3)', zIndex: 1, marginBottom: '-8px' }}>
                            {selectedTransfer.quantity} {lang === 'es' ? 'uds' : 'units'}
                          </span>
                          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--primary)', position: 'relative', margin: '12px 0' }}>
                            <div style={{ position: 'absolute', right: '0', top: '-3px', width: '7px', height: '7px', borderTop: '1px solid var(--primary)', borderRight: '1px solid var(--primary)', transform: 'rotate(45deg)' }}></div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {lang === 'es' ? 'En Tránsito' : 'In Transit'}
                          </span>
                        </div>

                        {/* Target Warehouse Box */}
                        <div style={{ flex: 1, border: '1px solid var(--primary)', padding: '10px', textAlign: 'center', fontSize: '0.8rem', backgroundColor: 'var(--bg-darker)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginBottom: '4px' }}>{lang === 'es' ? 'DESTINO' : 'DESTINATION'}</div>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '0.75rem' }}>{toWhName}</strong>
                        </div>

                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setSelectedTransfer(null)}>{lang === 'es' ? 'Cerrar' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
