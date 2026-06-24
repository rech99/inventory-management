import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  FlatList, 
  Modal, 
  Alert, 
  Dimensions, 
  Animated, 
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [apiHost, setApiHost] = useState('localhost:8000'); // Default to localhost
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('adminpass');
  const [loading, setLoading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'scan' | 'orders'>('dashboard');

  // Backend data
  const [dashboard, setDashboard] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Scanner Simulator States
  const [scanSku, setScanSku] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState('5');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Custom Axios instance creator
  const getApiUrl = () => `http://${apiHost}/api`;

  const apiCall = async (method: 'get' | 'post' | 'put', endpoint: string, data?: any) => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const url = `${getApiUrl()}${endpoint}`;
      
      let res;
      if (method === 'get') {
        res = await axios.get(url, config);
      } else if (method === 'post') {
        res = await axios.post(url, data, config);
      } else {
        res = await axios.put(url, data, config);
      }
      return res.data;
    } catch (err: any) {
      console.log('API Error on', endpoint, err.message);
      throw err;
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in credentials');
      return;
    }
    setLoading(true);
    try {
      const url = `http://${apiHost}/api/auth/login/`;
      const res = await axios.post(url, { username, password });
      setToken(res.data.access);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Could not connect. Verify server host URL.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setDashboard(null);
    setProducts([]);
    setOrders([]);
    setActiveTab('dashboard');
  };

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const dash = await apiCall('get', '/analytics/dashboard/');
      const prod = await apiCall('get', '/products/');
      const ords = await apiCall('get', '/purchase-orders/');
      const whs = await apiCall('get', '/warehouses/');
      
      setDashboard(dash);
      setProducts(prod);
      setOrders(ords);
      setWarehouses(whs);
      
      if (whs.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(String(whs[0].id));
      }
    } catch (err: any) {
      Alert.alert('Connection Error', 'Could not sync records with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Start scanning line animation
  useEffect(() => {
    if (isScanning) {
      scanLineAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [isScanning]);

  const simulateScan = () => {
    if (!scanSku) {
      Alert.alert('Input Error', 'Please select or type a SKU code first.');
      return;
    }
    setIsScanning(true);
    setScanResult(null);
    
    // Simulate reading barcode over 1.5s
    setTimeout(() => {
      setIsScanning(false);
      const found = products.find(p => p.sku.toLowerCase() === scanSku.trim().toLowerCase());
      if (found) {
        setScanResult(found);
      } else {
        Alert.alert('Not Found', `SKU ${scanSku} does not exist in inventory catalog.`);
      }
    }, 1600);
  };

  const handleAdjustStock = async (type: 'IN' | 'OUT') => {
    if (!scanResult || !selectedWarehouse) return;
    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid positive quantity.');
      return;
    }

    setLoading(true);
    try {
      await apiCall('post', '/transactions/', {
        product: scanResult.id,
        warehouse: parseInt(selectedWarehouse),
        type: type,
        quantity: qty,
        reference_id: 'MOBILE_SCANNER'
      });
      Alert.alert('Success', `Adjusted stock of ${scanResult.name} by ${type === 'IN' ? '+' : '-'}${qty} units.`);
      // Reload and update scan item state
      await loadData();
      const updated = products.find(p => p.sku === scanResult.sku);
      if (updated) setScanResult(updated);
    } catch (err: any) {
      Alert.alert('Adjustment Failed', err.response?.data?.non_field_errors?.[0] || 'Insufficient stock or invalid input.');
    } finally {
      setLoading(false);
    }
  };

  const receivePurchaseOrder = async (orderId: number) => {
    Alert.alert(
      'Receive Order',
      'Confirm that all items in this Purchase Order have arrived and are ready for registration?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            setLoading(true);
            try {
              const po = orders.find(o => o.id === orderId);
              if (!po) return;
              await apiCall('put', `/purchase-orders/${orderId}/`, {
                order_number: po.order_number,
                supplier: po.supplier,
                status: 'RECEIVED',
                items: po.items
              });
              Alert.alert('Received', 'Stocks updated successfully.');
              loadData();
            } catch (err) {
              Alert.alert('Error', 'Could not receive purchase order.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // LOGIN SCREEN
  if (!token) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <View style={styles.loginHeader}>
            <View style={styles.logoBadge}><Text style={styles.logoText}>IV</Text></View>
            <Text style={styles.loginTitle}>Inventory Mobile</Text>
            <Text style={styles.loginSubtitle}>Real-time stock audits & tracking</Text>
          </View>

          {/* Connection API configuration */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Django Server Address</Text>
            <TextInput 
              style={styles.input}
              value={apiHost}
              onChangeText={setApiHost}
              placeholder="e.g. 10.0.2.2:8000 (Android) or 192.168.1.X:8000"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />
            <View style={styles.hostSuggestions}>
              <TouchableOpacity onPress={() => setApiHost('localhost:8000')} style={styles.hostBtn}>
                <Text style={styles.hostBtnText}>localhost (iOS)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setApiHost('10.0.2.2:8000')} style={styles.hostBtn}>
                <Text style={styles.hostBtnText}>10.0.2.2 (Android)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput 
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput 
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#555"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* MOBILE HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>G-Inventory</Text>
          <Text style={styles.headerSubtitle}>Connected: {apiHost}</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn} onPress={loadData}>
          <Text style={styles.syncText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {/* ACTIVE SCREEN CONTENT */}
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentPad}>
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <View>
            <Text style={styles.sectionTitle}>Dashboard Summary</Text>
            
            {dashboard ? (
              <View>
                {/* Stats row */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Products</Text>
                    <Text style={styles.statValue}>{dashboard.metrics.total_products}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Total Units</Text>
                    <Text style={styles.statValue}>{dashboard.metrics.total_units}</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, dashboard.metrics.low_stock_count > 0 ? styles.statCardAlert : {}]}>
                    <Text style={[styles.statLabel, dashboard.metrics.low_stock_count > 0 ? styles.alertText : {}]}>Low Stock SKUs</Text>
                    <Text style={[styles.statValue, dashboard.metrics.low_stock_count > 0 ? styles.alertText : {}]}>
                      {dashboard.metrics.low_stock_count}
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Pending POs</Text>
                    <Text style={styles.statValue}>{dashboard.metrics.pending_purchase_orders}</Text>
                  </View>
                </View>

                {/* Low Stock Alerts */}
                {dashboard.metrics.low_stock_count > 0 && (
                  <View style={styles.alertPanel}>
                    <Text style={styles.alertPanelTitle}>⚠️ Low Stock Warnings</Text>
                    {dashboard.low_stock_items.map((item: any) => (
                      <View key={item.id} style={styles.alertItem}>
                        <Text style={styles.alertItemName}>{item.name}</Text>
                        <Text style={styles.alertItemQty}>{item.total_quantity} / {item.min_stock_level} units</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Recent transaction feed */}
                <Text style={styles.subSectionTitle}>Recent Movements</Text>
                {dashboard.recent_transactions.slice(0, 5).map((tx: any) => (
                  <View key={tx.id} style={styles.txCard}>
                    <View>
                      <Text style={styles.txProduct}>{tx.product_name}</Text>
                      <Text style={styles.txMeta}>{tx.warehouse_name} • {tx.type}</Text>
                    </View>
                    <Text style={[styles.txQty, tx.type === 'IN' ? styles.txQtyIn : styles.txQtyOut]}>
                      {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
            )}
          </View>
        )}

        {/* PRODUCTS LIST TAB */}
        {activeTab === 'products' && (
          <View>
            <Text style={styles.sectionTitle}>Product Catalog</Text>
            
            {/* Search Input */}
            <TextInput 
              style={styles.searchBar}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by SKU or Product Name..."
              placeholderTextColor="#666"
            />

            {filteredProducts.map((p: any) => (
              <View key={p.id} style={styles.productCard}>
                <View style={styles.productCardHeader}>
                  <Text style={styles.productSku}>{p.sku}</Text>
                  <Text style={styles.productPrice}>${parseFloat(p.price).toFixed(2)}</Text>
                </View>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.productDesc}>{p.description || 'No description'}</Text>
                
                {/* Stock per Warehouse */}
                <View style={styles.stockBreakdown}>
                  <Text style={styles.stockBreakdownTitle}>Stocks Breakdown:</Text>
                  {p.stocks.map((st: any) => (
                    <View key={st.id} style={styles.stockRow}>
                      <Text style={styles.stockWarehouse}>📍 {st.warehouse_name}</Text>
                      <Text style={styles.stockQty}>{st.quantity} units</Text>
                    </View>
                  ))}
                  {p.stocks.length === 0 && (
                    <Text style={styles.noStockText}>No stock logs recorded.</Text>
                  )}
                  
                  {/* Total indicator */}
                  <View style={styles.stockTotalRow}>
                    <Text style={styles.stockTotalLabel}>Total Available:</Text>
                    <Text style={[
                      styles.stockTotalVal, 
                      p.total_quantity <= p.min_stock_level ? styles.alertText : styles.normalStockText
                    ]}>
                      {p.total_quantity} units
                    </Text>
                  </View>
                </View>

                {/* Audit Action Button */}
                <TouchableOpacity 
                  style={styles.adjustShortcutBtn} 
                  onPress={() => {
                    setScanSku(p.sku);
                    setScanResult(p);
                    setActiveTab('scan');
                  }}
                >
                  <Text style={styles.adjustShortcutText}>Audit Stock (Simulate Scan)</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* SCAN SKU TAB */}
        {activeTab === 'scan' && (
          <View>
            <Text style={styles.sectionTitle}>Simulated Barcode Scan</Text>
            <Text style={styles.scanInstruction}>
              Select a product SKU or type it in to simulate scanning a barcode label on the warehouse floor.
            </Text>

            {/* SKU selection */}
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Choose product to scan:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.skuScroll}>
                {products.map(p => (
                  <TouchableOpacity 
                    key={p.id} 
                    style={[styles.skuSelectBtn, scanSku === p.sku ? styles.skuSelectBtnActive : {}]}
                    onPress={() => setScanSku(p.sku)}
                  >
                    <Text style={[styles.skuSelectText, scanSku === p.sku ? styles.skuSelectTextActive : {}]}>{p.sku}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextInput 
              style={styles.searchBar}
              value={scanSku}
              onChangeText={setScanSku}
              placeholder="Or type SKU manually (e.g. ELEC-001)"
              placeholderTextColor="#666"
              autoCapitalize="characters"
            />

            {/* SCAN BUTTON */}
            <TouchableOpacity style={styles.scanActionBtn} onPress={simulateScan} disabled={isScanning}>
              <Text style={styles.scanActionText}>{isScanning ? 'Reading Label...' : 'Simulate Scanning'}</Text>
            </TouchableOpacity>

            {/* MOCK SCANNER SCREEN */}
            {isScanning && (
              <View style={styles.cameraBox}>
                <Text style={styles.cameraText}>CAMERA FEED SIMULATOR ACTIVE</Text>
                <Animated.View 
                  style={[
                    styles.scanBeam, 
                    {
                      transform: [{
                        translateY: scanLineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 140]
                        })
                      }]
                    }
                  ]} 
                />
              </View>
            )}

            {/* SCAN RESULTS & ADJUSTMENTS */}
            {scanResult && !isScanning && (
              <View style={styles.scanResultsCard}>
                <Text style={styles.scanResultHeading}>✓ Product Found</Text>
                <Text style={styles.scanResultName}>{scanResult.name}</Text>
                <Text style={styles.scanResultDetails}>SKU: {scanResult.sku}  |  Price: ${scanResult.price}</Text>
                
                <View style={styles.divider} />

                {/* Warehouse Selector */}
                <Text style={styles.label}>Select Warehouse</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {warehouses.map(w => (
                    <TouchableOpacity 
                      key={w.id} 
                      style={[styles.whOptionBtn, selectedWarehouse === String(w.id) ? styles.whOptionBtnActive : {}]}
                      onPress={() => setSelectedWarehouse(String(w.id))}
                    >
                      <Text style={[styles.whOptionText, selectedWarehouse === String(w.id) ? styles.whOptionTextActive : {}]}>
                        {w.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Quantity */}
                <Text style={styles.label}>Adjustment Quantity</Text>
                <TextInput 
                  style={styles.searchBar}
                  keyboardType="numeric"
                  value={adjustQty}
                  onChangeText={setAdjustQty}
                  placeholder="Quantity"
                  placeholderTextColor="#666"
                />

                {/* IN/OUT buttons */}
                <View style={styles.adjustActionsRow}>
                  <TouchableOpacity style={[styles.adjustBtn, styles.adjustBtnIn]} onPress={() => handleAdjustStock('IN')}>
                    <Text style={styles.adjustBtnText}>Stock IN (+)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.adjustBtn, styles.adjustBtnOut]} onPress={() => handleAdjustStock('OUT')}>
                    <Text style={styles.adjustBtnText}>Stock OUT (-)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* PURCHASE ORDERS TAB */}
        {activeTab === 'orders' && (
          <View>
            <Text style={styles.sectionTitle}>Purchase Orders</Text>
            <Text style={styles.scanInstruction}>
              Receive stock orders directly on the dock. Select an approved PO to receive the items.
            </Text>

            {orders.map((o: any) => (
              <View key={o.id} style={styles.poCard}>
                <View style={styles.poCardHeader}>
                  <Text style={styles.poNumber}>{o.order_number}</Text>
                  <Text style={[
                    styles.poStatusText,
                    o.status === 'RECEIVED' ? styles.successText : styles.warningText
                  ]}>
                    {o.status}
                  </Text>
                </View>
                <Text style={styles.poSupplier}>Supplier: {o.supplier_name}</Text>
                <Text style={styles.poPrice}>Total amount: ${parseFloat(o.total_amount).toFixed(2)}</Text>
                
                <View style={styles.poItemsBox}>
                  <Text style={styles.poItemsTitle}>Items Ordered:</Text>
                  {o.items.map((item: any, index: number) => (
                    <Text key={index} style={styles.poItemRow}>
                      • {item.product_name} - Qty: {item.quantity} (Cost: ${item.unit_price})
                    </Text>
                  ))}
                </View>

                {o.status === 'APPROVED' && (
                  <TouchableOpacity style={styles.poReceiveBtn} onPress={() => receivePurchaseOrder(o.id)}>
                    <Text style={styles.poReceiveBtnText}>Receive Stock in Warehouse</Text>
                  </TouchableOpacity>
                )}
                {o.status === 'PENDING' && (
                  <Text style={styles.poNoticeText}>PO awaiting Web Admin approval...</Text>
                )}
                {o.status === 'RECEIVED' && (
                  <Text style={styles.poProcessedText}>Processed & added to Stock</Text>
                )}
                {o.status === 'CANCELLED' && (
                  <Text style={styles.poCancelledText}>Voided Purchase Order</Text>
                )}
              </View>
            ))}
            {orders.length === 0 && (
              <Text style={styles.noStockText}>No Purchase Orders registered.</Text>
            )}
          </View>
        )}

      </ScrollView>

      {/* MOBILE BOTTOM NAVIGATION TABS */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' ? styles.tabLabelActive : {}]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('products')}>
          <Text style={[styles.tabLabel, activeTab === 'products' ? styles.tabLabelActive : {}]}>Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('scan')}>
          <Text style={[styles.tabLabel, activeTab === 'scan' ? styles.tabLabelActive : {}]}>Scan SKU</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('orders')}>
          <Text style={[styles.tabLabel, activeTab === 'orders' ? styles.tabLabelActive : {}]}>PO Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtnLogout} onPress={handleLogout}>
          <Text style={styles.tabLabelLogout}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Auth screen styles
  loginContainer: {
    flex: 1,
    backgroundColor: '#000000', /* True OLED Black */
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCard: {
    width: width * 0.88,
    backgroundColor: '#040814', /* Deep Midnight Blue/Black */
    borderRadius: 0, /* Hard square */
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.35)', /* Teal active hairline */
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 0, /* Sharp Edge */
    borderWidth: 1,
    borderColor: '#14b8a6', /* Teal Accent */
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#14b8a6',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#f0fdfa',
    letterSpacing: 1,
  },
  loginSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    fontWeight: '300',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 6,
    fontWeight: '600',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    color: '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hostSuggestions: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
  },
  hostBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
  },
  hostBtnText: {
    color: '#9ca3af',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnPrimary: {
    backgroundColor: '#14b8a6', /* Primary action is Teal */
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: {
    color: '#000000',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 13,
  },

  // Logged-in shell styles
  mainContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#f0fdfa',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
    fontWeight: '300',
  },
  syncBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#14b8a6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
  },
  syncText: {
    color: '#14b8a6',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contentScroll: {
    flex: 1,
  },
  contentPad: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#f0fdfa',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#f3f4f6',
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  // Dashboard Stats card
  statsGrid: {
    flexDirection: 'row',
    gap: 0,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    marginBottom: 0,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 0,
    padding: 16,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
  },
  statCardAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: 1,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#f0fdfa',
    marginTop: 6,
  },

  // Alert Panel
  alertPanel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 0,
    padding: 14,
    marginTop: 16,
  },
  alertPanelTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  alertItemName: {
    color: '#f3f4f6',
    fontSize: 12,
  },
  alertItemQty: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Recent Movements Cards
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.12)',
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  txProduct: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  txMeta: {
    fontSize: 9,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  txQty: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  txQtyIn: {
    color: '#10b981',
  },
  txQtyOut: {
    color: '#ef4444',
  },

  // Product screen list cards
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productSku: {
    color: '#14b8a6',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  productPrice: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#fff',
    marginTop: 4,
  },
  productDesc: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    fontWeight: '300',
  },
  stockBreakdown: {
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.08)',
    paddingTop: 10,
  },
  stockBreakdownTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  stockWarehouse: {
    fontSize: 11,
    color: '#d1d5db',
  },
  stockQty: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  noStockText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 6,
  },
  stockTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.08)',
    paddingTop: 8,
    marginTop: 6,
  },
  stockTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d1d5db',
  },
  stockTotalVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  normalStockText: {
    color: '#10b981',
  },
  adjustShortcutBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.3)',
    borderRadius: 0,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  adjustShortcutText: {
    color: '#14b8a6',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },

  // Scanner Simulator Screen Styles
  scanInstruction: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
    fontWeight: '300',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  skuScroll: {
    flexDirection: 'row',
  },
  skuSelectBtn: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  skuSelectBtnActive: {
    borderColor: '#14b8a6',
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
  },
  skuSelectText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  skuSelectTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scanActionBtn: {
    backgroundColor: '#14b8a6',
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanActionText: {
    color: '#000',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 13,
  },
  cameraBox: {
    height: 160,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#14b8a6',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
  },
  cameraText: {
    color: 'rgba(20, 184, 166, 0.4)',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  scanBeam: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#ff3366',
  },
  scanResultsCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    padding: 16,
  },
  scanResultHeading: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scanResultName: {
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 16,
    marginTop: 6,
  },
  scanResultDetails: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    marginVertical: 14,
  },
  whOptionBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  whOptionBtnActive: {
    borderColor: '#14b8a6',
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
  },
  whOptionText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  whOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  adjustActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  adjustBtn: {
    flex: 1,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  adjustBtnIn: {
    backgroundColor: '#10b981',
  },
  adjustBtnOut: {
    backgroundColor: '#ef4444',
  },
  adjustBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },

  // PO card styles
  poCard: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  poCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#14b8a6',
  },
  poStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  poSupplier: {
    color: '#fff',
    fontSize: 12,
  },
  poPrice: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '300',
  },
  poItemsBox: {
    marginTop: 12,
    backgroundColor: '#000000',
    borderRadius: 0,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.08)',
  },
  poItemsTitle: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  poItemRow: {
    fontSize: 11,
    color: '#d1d5db',
    lineHeight: 16,
  },
  poReceiveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 0,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  poReceiveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  poNoticeText: {
    color: '#f59e0b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  poProcessedText: {
    color: '#10b981',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  poCancelledText: {
    color: '#ef4444',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },

  successText: { color: '#10b981' },
  warningText: { color: '#f59e0b' },
  alertText: { color: '#ef4444' },

  // Bottom Tabs navigation styling
  bottomTabs: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#14b8a6',
    fontWeight: 'bold',
  },
  tabBtnLogout: {
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.18)',
    justifyContent: 'center',
  },
  tabLabelLogout: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
