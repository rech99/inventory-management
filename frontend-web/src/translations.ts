export const translations = {
  es: {
    title: "G-Inventory - Sistema de Control en Tiempo Real",
    loginTitle: "Ingreso al Sistema G-Inventory",
    loginSubtitle: "Control de Inventario y Operaciones en Tiempo Real",
    username: "Nombre de Usuario",
    password: "Contraseña",
    signIn: "Iniciar Sesión",
    invalidCredentials: "Usuario o contraseña inválidos.",
    logout: "Cerrar Sesión",
    role: "Administrador",
    
    // Sidebar
    dashboard: "Dashboard",
    products: "Productos",
    orders: "Órdenes de Compra",
    transfers: "Transferencias",
    
    // Dashboard Stats
    totalProducts: "Total Productos",
    valuation: "Valor del Inventario",
    activeAlerts: "Alertas Activas",
    whCapacity: "Ocupación de Almacenes",
    alertSubtitle: "productos con bajo stock",
    totalCapacity: "capacidad total",
    
    // Dashboard widgets
    lowStockTitle: "Alertas de Inventario Crítico",
    recentMovementsTitle: "Registro de Movimientos Recientes",
    noAlerts: "No hay alertas de stock bajo actualmente. ¡Todo al día!",
    noMovements: "No se registran movimientos recientes de stock.",
    
    // Tables
    sku: "SKU",
    name: "Nombre del Producto",
    category: "Categoría",
    price: "Precio Unitario",
    whStocks: "Distribución en Almacenes",
    totalAvail: "Stock Disponible",
    alertLevel: "Stock Mínimo",
    actions: "Acciones",
    supplier: "Proveedor",
    date: "Fecha",
    items: "Ítems",
    totalAmount: "Monto Total",
    status: "Estado",
    type: "Tipo",
    qty: "Cantidad",
    refId: "ID de Referencia",
    user: "Usuario",
    
    // Status text & badges
    badgePending: "Pendiente",
    badgeApproved: "Aprobada",
    badgeReceived: "Recibida",
    badgeCancelled: "Cancelada",
    badgeIn: "Entrada",
    badgeOut: "Salida",
    badgeTransfer: "Transferencia",
    badgeAdjustment: "Ajuste",
    
    // Filters & Searches
    searchPlaceholder: "Buscar productos por SKU, nombre, descripción...",
    allCategories: "Todas las Categorías",
    lowStockFilter: "Stock Bajo",
    filterTitle: "Filtrar por Categoría",
    searchPo: "Buscar por número de orden o proveedor...",
    searchTx: "Buscar transacciones por SKU o referencia...",
    
    // Buttons
    btnNewProduct: "Crear Producto",
    btnAdjustStock: "Ajustar Stock",
    btnNewPO: "Nueva Orden",
    btnNewTransfer: "Transferir",
    btnCancel: "Cancelar",
    btnSave: "Guardar",
    btnAddItem: "Añadir Ítem",
    btnApprove: "Aprobar",
    btnReceive: "Recibir",
    btnReject: "Cancelar PO",
    btnFilters: "Filtrar",
    
    // Modals & Forms
    modalNewProduct: "Crear Nuevo Producto",
    modalAdjustStock: "Registrar Ajuste Manual de Stock",
    modalNewPO: "Crear Nueva Orden de Compra",
    modalNewTransfer: "Transferencia de Stock entre Almacenes",
    
    labelDescription: "Descripción",
    labelMinStock: "Nivel de Alerta Mínimo",
    labelWarehouse: "Almacén",
    labelProduct: "Producto",
    labelType: "Tipo de Ajuste",
    labelFromWh: "Almacén de Origen",
    labelToWh: "Almacén de Destino",
    labelSupplier: "Proveedor",
    labelOrderNum: "Número de Orden",
    
    phDescription: "Opcional...",
    phPrice: "0.00",
    phQty: "0",
    phSelectWh: "Selecciona un almacén...",
    phSelectProd: "Selecciona un producto...",
    phSelectSupplier: "Selecciona un proveedor...",
    
    // Table Empty Messages
    emptyProducts: "No hay productos que coincidan con los filtros activos.",
    emptyOrders: "No se registran órdenes de compra en el sistema.",
    emptyTransactions: "No hay transacciones registradas.",
    
    // Notifications list
    liveFeed: "Transmisiones en Vivo",
    noNotifications: "Esperando eventos del servidor..."
  },
  en: {
    title: "G-Inventory - Real-Time Control System",
    loginTitle: "G-Inventory System Login",
    loginSubtitle: "Real-time stock audits & logistics tracking",
    username: "Username",
    password: "Password",
    signIn: "Sign In",
    invalidCredentials: "Invalid username or password.",
    logout: "Logout",
    role: "Administrator",
    
    // Sidebar
    dashboard: "Dashboard",
    products: "Products",
    orders: "Purchase Orders",
    transfers: "Transfers",
    
    // Dashboard Stats
    totalProducts: "Total Products",
    valuation: "Inventory Valuation",
    activeAlerts: "Active Alerts",
    whCapacity: "Warehouse Capacities",
    alertSubtitle: "products with low stock",
    totalCapacity: "total capacity",
    
    // Dashboard widgets
    lowStockTitle: "Critical Inventory Alerts",
    recentMovementsTitle: "Recent Stock Movements",
    noAlerts: "No low stock alerts currently. Everything up to date!",
    noMovements: "No recent stock movements registered.",
    
    // Tables
    sku: "SKU",
    name: "Product Name",
    category: "Category",
    price: "Unit Price",
    whStocks: "Warehouse Stocks",
    totalAvail: "Total Available",
    alertLevel: "Stock Alert Level",
    actions: "Actions",
    supplier: "Supplier",
    date: "Created Date",
    items: "Items",
    totalAmount: "Total Amount",
    status: "Status",
    type: "Type",
    qty: "Quantity",
    refId: "Reference ID",
    user: "User",
    
    // Status text & badges
    badgePending: "Pending",
    badgeApproved: "Approved",
    badgeReceived: "Received",
    badgeCancelled: "Cancelled",
    badgeIn: "In",
    badgeOut: "Out",
    badgeTransfer: "Transfer",
    badgeAdjustment: "Adjustment",
    
    // Filters & Searches
    searchPlaceholder: "Search products by SKU, name, description...",
    allCategories: "All Categories",
    lowStockFilter: "Low Stock Only",
    filterTitle: "Filter by Category",
    searchPo: "Search order number or supplier...",
    searchTx: "Search transactions by SKU or reference...",
    
    // Buttons
    btnNewProduct: "Create Product",
    btnAdjustStock: "Adjust Stock",
    btnNewPO: "New PO",
    btnNewTransfer: "Transfer",
    btnCancel: "Cancel",
    btnSave: "Save",
    btnAddItem: "Add Item",
    btnApprove: "Approve",
    btnReceive: "Receive",
    btnReject: "Cancel PO",
    btnFilters: "Filter",
    
    // Modals & Forms
    modalNewProduct: "Create New Product",
    modalAdjustStock: "Record Manual Stock Adjustment",
    modalNewPO: "Create New Purchase Order",
    modalNewTransfer: "Stock Transfer Between Warehouses",
    
    labelDescription: "Description",
    labelMinStock: "Stock Alert Level",
    labelWarehouse: "Warehouse",
    labelProduct: "Product",
    labelType: "Adjustment Type",
    labelFromWh: "From Warehouse",
    labelToWh: "To Warehouse",
    labelSupplier: "Supplier",
    labelOrderNum: "Order Number",
    
    phDescription: "Optional...",
    phPrice: "0.00",
    phQty: "0",
    phSelectWh: "Select a warehouse...",
    phSelectProd: "Select a product...",
    phSelectSupplier: "Select a supplier...",
    
    // Table Empty Messages
    emptyProducts: "No products match the active filter criteria.",
    emptyOrders: "No purchase orders registered.",
    emptyTransactions: "No transactions recorded.",
    
    // Notifications list
    liveFeed: "Live Stream Feed",
    noNotifications: "Waiting for server events..."
  }
};
