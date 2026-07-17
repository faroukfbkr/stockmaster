import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  QrCode, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  LogOut, 
  Menu, 
  X, 
  Camera, 
  Upload, 
  ShoppingBag, 
  RefreshCw, 
  Cloud, 
  Database,
  BarChart3,
  Undo2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  getAuth, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { 
  Product, 
  StockMovement, 
  getProducts, 
  getProductByBarcode, 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  getStockMovements, 
  addStockMovement,
  uploadProductPhoto
} from './db';
import { compressImage } from './imageCompressor';

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [mockUser, setMockUser] = useState<{ email: string; displayName: string; uid: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Core Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Active view: 'dashboard' | 'inventory' | 'reports'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'reports'>('dashboard');

  // Scanner Modal & Mode
  const [isScanning, setIsScanning] = useState(false);
  const [scanningMode, setScanningMode] = useState<'general' | 'sell'>('general');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  // Manual/Demo Barcode Simulators
  const [manualBarcode, setManualBarcode] = useState('');

  // Modals & Forms State
  const [activeModal, setActiveModal] = useState<'add_product' | 'product_details' | 'sell_product' | 'restock_product' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form inputs - Add Product
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('piece');
  const [formPhoto, setFormPhoto] = useState<string>(''); // base64 representation
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  // Form inputs - Sell / Restock
  const [flowQuantity, setFlowQuantity] = useState<number>(1);
  const [flowPrice, setFlowPrice] = useState<number>(0);

  // Search and Filter on Inventory
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Low stock alert threshold
  const LOW_STOCK_THRESHOLD = 5;

  // Active user ID selector (mock vs real)
  const activeUserId = user?.uid || mockUser?.uid || '';
  const activeUserEmail = user?.email || mockUser?.email || '';
  const activeUserName = user?.displayName || mockUser?.displayName || 'Owner';

  // Listen to Auth State
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      });
      return unsubscribe;
    } else {
      // Simulate slow loading for realistic UX
      setTimeout(() => {
        setAuthLoading(false);
      }, 500);
    }
  }, []);

  // Fetch products and movements when user logs in or data changes
  const refreshData = async () => {
    if (!activeUserId) return;
    setDataLoading(true);
    try {
      const [allProducts, allMovements] = await Promise.all([
        getProducts(activeUserId),
        getStockMovements(activeUserId)
      ]);
      setProducts(allProducts);
      setMovements(allMovements);
    } catch (e) {
      console.error("Error fetching inventory data:", e);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (activeUserId) {
      refreshData();
    }
  }, [activeUserId]);

  // Real Google Sign-In
  const handleGoogleSignIn = async () => {
    if (isFirebaseConfigured && auth && googleProvider) {
      try {
        setAuthLoading(true);
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        console.error("Google login failed:", err);
        alert("Google Authentication failed. Please check your config.");
      } finally {
        setAuthLoading(false);
      }
    } else {
      // Prompt user with friendly Sandbox Mode credentials
      setMockUser({
        uid: 'sandbox_owner_farouk',
        email: 'faroukinfluance@gmail.com',
        displayName: 'Farouk (Sandbox)'
      });
    }
  };

  const handleSignOut = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    } else {
      setMockUser(null);
    }
    // Clean up local states
    setProducts([]);
    setMovements([]);
    setActiveModal(null);
  };

  // Barcode Scanning Camera Lifecycle
  useEffect(() => {
    if (!isScanning) return;

    let html5QrCode: Html5Qrcode | null = null;
    let isActive = true;

    // Start scanning
    const initScanner = async () => {
      try {
        setScanError(null);
        html5QrCode = new Html5Qrcode('reader');
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (width, height) => {
              const min = Math.min(width, height);
              const size = Math.floor(min * 0.7);
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            if (isActive) {
              handleBarcodeSuccess(decodedText);
            }
          },
          () => {
            // Quiet frame failures to reduce console pollution
          }
        );
      } catch (err) {
        console.warn("Scanner failed to start (likely missing camera/permissions):", err);
        setScanError("Unable to access camera. Please make sure camera permissions are enabled, or use the simulator options below.");
      }
    };

    // Delay initialization slightly to let the modal render
    const timer = setTimeout(() => {
      initScanner();
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(e => console.error("Error stopping scanner:", e));
        }
      }
    };
  }, [isScanning]);

  // Handle scanned/entered barcode
  const handleBarcodeSuccess = async (barcode: string) => {
    setIsScanning(false);
    setScannedBarcode(barcode);

    // Look up product
    setDataLoading(true);
    try {
      const found = await getProductByBarcode(activeUserId, barcode);
      if (found) {
        setSelectedProduct(found);
        setFlowPrice(found.sellingPrice);
        setFlowQuantity(1);
        if (scanningMode === 'sell') {
          setActiveModal('sell_product');
        } else {
          setActiveModal('product_details');
        }
      } else {
        // Prepare pre-filled add form
        setFormBarcode(barcode);
        setFormName('');
        setFormCategory('');
        setFormCostPrice(0);
        setFormSellingPrice(0);
        setFormQuantity(1);
        setFormUnit('piece');
        setFormPhoto('');
        setActiveModal('add_product');
      }
    } catch (e) {
      console.error("Error checking scanned barcode:", e);
    } finally {
      setDataLoading(false);
    }
  };

  // Simulate scanning a barcode (for preview mode / user convenience)
  const handleSimulateScan = (barcode: string) => {
    handleBarcodeSuccess(barcode);
  };

  // Image Upload / Capture compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, 800, 0.7);
      setFormPhoto(compressed);
    } catch (err) {
      console.error("Image compression failed:", err);
      alert("Failed to process image. Please try another one.");
    } finally {
      setCompressingPhoto(false);
    }
  };

  // Save new product
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBarcode || !formName || formCostPrice < 0 || formSellingPrice < 0 || formQuantity < 0) {
      alert("Please fill in all fields with valid positive numbers.");
      return;
    }

    setDataLoading(true);
    try {
      // 1. Upload photo to Storage (or return data_url base64 fallback)
      let photoUrl = formPhoto;
      if (formPhoto && formPhoto.startsWith('data:image')) {
        photoUrl = await uploadProductPhoto(activeUserId, formBarcode, formPhoto);
      }

      // 2. Add product record
      const addedProduct = await createProduct(activeUserId, {
        barcode: formBarcode,
        name: formName,
        photoUrl: photoUrl || 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=120&q=80',
        category: formCategory || 'General',
        costPrice: Number(formCostPrice),
        sellingPrice: Number(formSellingPrice),
        quantity: Number(formQuantity),
        unit: formUnit
      });

      // 3. Log initial restock stockMovement
      if (formQuantity > 0) {
        await addStockMovement(activeUserId, {
          productId: addedProduct.id || '',
          type: 'restock',
          quantityChange: Number(formQuantity),
          priceAtTime: Number(formCostPrice)
        });
      }

      await refreshData();
      setActiveModal(null);
    } catch (e) {
      console.error("Error creating product:", e);
      alert("Failed to save product. Ensure your rules permit this action.");
    } finally {
      setDataLoading(false);
    }
  };

  // Save edit changes (Product details screen update)
  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedProduct.id) return;

    setDataLoading(true);
    try {
      let photoUrl = selectedProduct.photoUrl;
      if (formPhoto && formPhoto.startsWith('data:image') && formPhoto !== selectedProduct.photoUrl) {
        photoUrl = await uploadProductPhoto(activeUserId, selectedProduct.barcode, formPhoto);
      }

      await updateProduct(activeUserId, selectedProduct.id, {
        name: formName,
        category: formCategory || 'General',
        costPrice: Number(formCostPrice),
        sellingPrice: Number(formSellingPrice),
        unit: formUnit,
        photoUrl: photoUrl
      });

      await refreshData();
      setActiveModal(null);
    } catch (e) {
      console.error("Error updating product:", e);
      alert("Failed to save changes.");
    } finally {
      setDataLoading(false);
    }
  };

  // Sell Flow Submission
  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedProduct.id) return;
    if (flowQuantity <= 0) {
      alert("Sold quantity must be greater than zero.");
      return;
    }
    if (selectedProduct.quantity < flowQuantity) {
      alert(`Insufficient stock! Only ${selectedProduct.quantity} ${selectedProduct.unit}(s) available.`);
      return;
    }

    setDataLoading(true);
    try {
      const newQty = selectedProduct.quantity - flowQuantity;
      
      // Update inventory count
      await updateProduct(activeUserId, selectedProduct.id, {
        quantity: newQty
      });

      // Log sale movement
      await addStockMovement(activeUserId, {
        productId: selectedProduct.id,
        type: 'sale',
        quantityChange: -Number(flowQuantity),
        priceAtTime: Number(flowPrice)
      });

      await refreshData();
      setActiveModal(null);
    } catch (e) {
      console.error("Error processing sale:", e);
      alert("Failed to complete sale.");
    } finally {
      setDataLoading(false);
    }
  };

  // Restock Flow Submission
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedProduct.id) return;
    if (flowQuantity <= 0) {
      alert("Restock quantity must be greater than zero.");
      return;
    }

    setDataLoading(true);
    try {
      const newQty = selectedProduct.quantity + flowQuantity;

      // Update inventory count and cost price if updated
      await updateProduct(activeUserId, selectedProduct.id, {
        quantity: newQty,
        costPrice: Number(flowPrice)
      });

      // Log restock movement
      await addStockMovement(activeUserId, {
        productId: selectedProduct.id,
        type: 'restock',
        quantityChange: Number(flowQuantity),
        priceAtTime: Number(flowPrice)
      });

      await refreshData();
      setActiveModal(null);
    } catch (e) {
      console.error("Error processing restock:", e);
      alert("Failed to complete restock.");
    } finally {
      setDataLoading(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product: Product) => {
    if (!product.id) return;
    if (!window.confirm(`Are you sure you want to completely delete "${product.name}"? This will delete all its product details.`)) {
      return;
    }

    setDataLoading(true);
    try {
      await deleteProduct(activeUserId, product.id);
      await refreshData();
      setActiveModal(null);
    } catch (e) {
      console.error("Error deleting product:", e);
      alert("Failed to delete product.");
    } finally {
      setDataLoading(false);
    }
  };

  // Helper: Open Edit details form for an existing product
  const openEditForm = (prod: Product) => {
    setSelectedProduct(prod);
    setFormBarcode(prod.barcode);
    setFormName(prod.name);
    setFormCategory(prod.category || 'General');
    setFormCostPrice(prod.costPrice);
    setFormSellingPrice(prod.sellingPrice);
    setFormQuantity(prod.quantity);
    setFormUnit(prod.unit);
    setFormPhoto(prod.photoUrl);
    setActiveModal('product_details'); // This view contains both details & editable inputs
  };

  // Calculated Stats
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.quantity <= LOW_STOCK_THRESHOLD);
  const lowStockCount = lowStockProducts.length;

  // Filter products for lists
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Unique categories list
  const categoriesList = ['All', ...Array.from(new Set(products.map(p => p.category || 'General').filter(Boolean)))];

  // Reports calculations
  const calculateReports = () => {
    // Filter movements for today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Filter movements for this week (last 7 days)
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);

    let todaySales = 0;
    let weekSales = 0;
    const itemSalesCount: { [prodId: string]: { name: string; qty: number; photo: string } } = {};

    movements.forEach(m => {
      const timestampMs = new Date(m.timestamp).getTime();
      const productObj = products.find(p => p.id === m.productId);
      const name = productObj?.name || 'Unknown Product';
      const photo = productObj?.photoUrl || '';

      if (m.type === 'sale') {
        const value = Math.abs(m.quantityChange) * m.priceAtTime;
        if (timestampMs >= startOfToday) {
          todaySales += value;
        }
        if (timestampMs >= sevenDaysAgo) {
          weekSales += value;
        }

        // Track aggregate quantities sold
        if (!itemSalesCount[m.productId]) {
          itemSalesCount[m.productId] = { name, qty: 0, photo };
        }
        itemSalesCount[m.productId].qty += Math.abs(m.quantityChange);
      }
    });

    const topSelling = Object.entries(itemSalesCount)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      todaySales,
      weekSales,
      topSelling
    };
  };

  const reports = calculateReports();

  // Loading state overlay
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center text-slate-900 font-sans p-6">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
            <Package className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">StockMaster</h1>
          <p className="text-slate-500 text-sm">Authenticating with Firebase...</p>
          <div className="w-12 h-1 bg-blue-600 rounded-full overflow-hidden relative mt-2">
            <div className="absolute inset-y-0 w-1/3 bg-blue-400 rounded-full animate-[shimmer_1.5s_infinite_linear]"></div>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!activeUserId) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center text-slate-900 font-sans p-4">
        <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight">StockMaster</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold mb-2">Shop Owner Login</h2>
            <p className="text-slate-500 text-sm">
              Manage inventory, update prices, and scan barcodes. All your stock data is saved securely in the cloud and synced instantly across devices.
            </p>
          </div>

          {/* Login Button */}
          <button 
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            className="w-full bg-slate-900 text-white rounded-2xl py-4 px-6 font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-slate-200 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 5.48 1 0 6.48 0 13s5.48 12 12.24 12c7.06 0 11.75-4.97 11.75-11.95 0-.805-.085-1.42-.195-1.765H12.24z"/>
            </svg>
            <span>Sign In with Google</span>
          </button>

          {/* Sync Status Sandbox Notice */}
          {!isFirebaseConfigured && (
            <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex gap-3 text-xs text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold">Local Sandbox Mode Enabled</p>
                <p className="mt-1 opacity-90">
                  Firebase keys are not configured in your Secrets menu. Click "Sign In with Google" to explore using local storage state!
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            Secure Real-Time Cloud Inventory System
          </div>
        </div>
      </div>
    );
  }

  // MAIN LAYOUT
  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar Navigation - Hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col p-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-100">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">StockMaster</span>
        </div>

        <nav className="space-y-1.5 flex-grow">
          <button 
            id="nav-dashboard"
            onClick={() => { setActiveTab('dashboard'); setActiveModal(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <TrendingUp className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            id="nav-inventory"
            onClick={() => { setActiveTab('inventory'); setActiveModal(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Package className="w-5 h-5" />
            Inventory
          </button>
          <button 
            id="nav-reports"
            onClick={() => { setActiveTab('reports'); setActiveModal(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <BarChart3 className="w-5 h-5" />
            Reports
          </button>
        </nav>

        {/* User Card */}
        <div className="mt-auto p-4 bg-slate-50 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0 border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-700 text-sm">
              {activeUserName.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate leading-tight text-slate-900">{activeUserName}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">Owner</p>
            </div>
          </div>
          <button 
            id="signout-btn"
            onClick={handleSignOut}
            title="Log Out"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 hover:bg-white rounded-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">StockMaster</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSignOut} 
            className="text-xs text-slate-500 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 flex flex-col gap-6 md:gap-8 overflow-hidden">
        
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
              {activeTab === 'dashboard' ? 'Overview' : activeTab === 'inventory' ? 'Inventory Catalog' : 'Performance Reports'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === 'dashboard' 
                ? 'Check high-level performance indicators, scan incoming tags, or log instant shop floor sales.' 
                : activeTab === 'inventory' 
                ? 'Browse, search, and update prices or details of your entire barcode database.' 
                : 'Review total revenue aggregates and analyze top-selling product stock movements.'}
            </p>
          </div>

          {/* Quick Connection Badge */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {isFirebaseConfigured ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl border border-green-200 text-xs font-semibold">
                <Cloud className="w-4 h-4 animate-pulse" />
                <span>Cloud Connected (Firestore)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-xs font-semibold">
                <Database className="w-4 h-4" />
                <span>Sandbox Sandbox Mode (LocalStorage)</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Loading Indicator */}
        {dataLoading && (
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2 font-medium border border-blue-100 self-start animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing database with cloud...</span>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 flex-grow">
            {/* Stats Panel */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between">
                <p className="text-slate-500 text-sm font-medium mb-1">Catalog Products</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold">{totalProducts}</h3>
                  <span className="text-xs text-slate-400">active barcodes</span>
                </div>
              </div>

              <div className={`p-6 rounded-[24px] shadow-sm border flex flex-col justify-between relative overflow-hidden ${lowStockCount > 0 ? 'bg-red-50/50 border-red-100' : 'bg-white border-slate-100'}`}>
                {lowStockCount > 0 && (
                  <div className="absolute top-0 right-0 p-3">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                )}
                <p className="text-slate-500 text-sm font-medium mb-1">Low Stock Items</p>
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{lowStockCount}</h3>
                  <span className="text-xs text-slate-400">under {LOW_STOCK_THRESHOLD} units</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between">
                <p className="text-slate-500 text-sm font-medium mb-1">Today's Sales Revenue</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold">${reports.todaySales.toFixed(2)}</h3>
                  <span className="text-xs text-slate-400">logged sales today</span>
                </div>
              </div>
            </section>

            {/* Core Interaction Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-grow">
              
              {/* Scan Barcode Center Stage */}
              <div className="lg:col-span-3 bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <QrCode className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Scan Barcode</h2>
                <p className="text-slate-500 max-w-sm mb-8 text-sm leading-relaxed">
                  Hold a product's barcode up to your camera to instantly update stock level, adjust pricing, or record a customer sale.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center">
                  <button 
                    id="scan-general-btn"
                    onClick={() => { setScanningMode('general'); setIsScanning(true); }}
                    className="bg-slate-900 text-white px-6 py-4 rounded-xl text-md font-bold hover:bg-slate-800 flex items-center justify-center gap-2 shadow-md shadow-slate-100 transition-all cursor-pointer flex-1"
                  >
                    <Camera className="w-5 h-5" />
                    <span>General Check / Add</span>
                  </button>

                  <button 
                    id="scan-sell-btn"
                    onClick={() => { setScanningMode('sell'); setIsScanning(true); }}
                    className="bg-blue-600 text-white px-6 py-4 rounded-xl text-md font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md shadow-blue-100 transition-all cursor-pointer flex-1"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>Quick Sell Scan</span>
                  </button>
                </div>

                {/* Simulated Barcode Keypad for quick testing in developer console */}
                <div className="mt-8 pt-6 border-t border-slate-100 w-full max-w-md">
                  <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider block mb-3">
                    Barcode Simulator (No Camera / Barcode Needed!)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleSimulateScan('8801007123456')}
                      className="text-xs bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg p-2 font-mono text-slate-700 text-left transition-colors cursor-pointer"
                    >
                      🥛 Milk (880100)
                    </button>
                    <button 
                      onClick={() => handleSimulateScan('4901301012345')}
                      className="text-xs bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg p-2 font-mono text-slate-700 text-left transition-colors cursor-pointer"
                    >
                      ☕ Coffee (490130)
                    </button>
                    <button 
                      onClick={() => handleSimulateScan('9780201379624')}
                      className="text-xs bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg p-2 font-mono text-slate-700 text-left transition-colors cursor-pointer"
                    >
                      📚 Book (978020)
                    </button>
                  </div>

                  {/* Manual entry bar */}
                  <div className="flex gap-2 mt-4">
                    <input 
                      type="text" 
                      placeholder="Or type raw barcode manually..."
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <button 
                      onClick={() => { if (manualBarcode) { handleSimulateScan(manualBarcode); setManualBarcode(''); } }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                    >
                      Simulate
                    </button>
                  </div>
                </div>

              </div>

              {/* Side Alerts monitoring panel */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 flex-grow flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-900">Low Stock Alerts</h4>
                    <button 
                      onClick={() => setActiveTab('inventory')}
                      className="text-xs text-blue-600 font-semibold uppercase tracking-wider hover:underline"
                    >
                      See All
                    </button>
                  </div>
                  
                  {lowStockCount === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <Check className="w-10 h-10 text-green-500 mb-2 bg-green-50 p-2 rounded-full" />
                      <p className="text-sm font-medium">All items perfectly stocked!</p>
                      <p className="text-xs opacity-85 mt-1">No products are currently under the warning threshold ({LOW_STOCK_THRESHOLD}).</p>
                    </div>
                  ) : (
                    <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
                      {lowStockProducts.map((p) => (
                        <div 
                          key={p.id} 
                          onClick={() => openEditForm(p)}
                          className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-xl transition-colors cursor-pointer"
                        >
                          <img 
                            src={p.photoUrl} 
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover shadow-sm bg-white"
                          />
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">BC: {p.barcode}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-red-500">{p.quantity} left</p>
                            <p className="text-[10px] text-slate-400">Unit: {p.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit trail preview list */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-3">Recent Stock Movements</h4>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {movements.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No recent inventory changes recorded.</p>
                    ) : (
                      movements.slice(0, 4).map((m) => {
                        const relatedProduct = products.find(p => p.id === m.productId);
                        return (
                          <div key={m.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">
                                {relatedProduct ? relatedProduct.name : 'Deleted Product'}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                m.type === 'restock' ? 'bg-green-100 text-green-700' : m.type === 'sale' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {m.type === 'restock' ? `+${m.quantityChange}` : `${m.quantityChange}`}
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5">${m.priceAtTime.toFixed(2)}/u</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </section>
          </div>
        )}

        {/* VIEW: INVENTORY LIST */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 flex flex-col flex-grow">
            
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Search products by barcode or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === cat 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Add barcode manually helper */}
              <button
                id="add-custom-product-btn"
                onClick={() => {
                  setFormBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString());
                  setFormName('');
                  setFormCategory('');
                  setFormCostPrice(0);
                  setFormSellingPrice(0);
                  setFormQuantity(1);
                  setFormUnit('piece');
                  setFormPhoto('');
                  setActiveModal('add_product');
                }}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>

            </div>

            {/* Inventory List Table / Grid */}
            {filteredProducts.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-12 text-slate-400">
                <Package className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-md font-semibold">No products found</p>
                <p className="text-sm opacity-80 mt-1">Try relaxing your search terms or add a new product using the button above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Photo</th>
                      <th className="py-3 px-4">Product Name / Barcode</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Cost Price</th>
                      <th className="py-3 px-4">Selling Price</th>
                      <th className="py-3 px-4">Stock Qty</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {filteredProducts.map((p) => {
                      const isLow = p.quantity <= LOW_STOCK_THRESHOLD;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <img 
                              src={p.photoUrl} 
                              alt={p.name} 
                              className="w-12 h-12 rounded-xl object-cover bg-slate-50 shadow-sm"
                            />
                          </td>
                          <td className="py-3 px-4 min-w-[200px]">
                            <p className="font-bold text-slate-900 leading-tight">{p.name}</p>
                            <span className="text-xs font-mono text-slate-500 block mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded w-max">
                              {p.barcode}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium">
                              {p.category || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-600">
                            ${p.costPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            ${p.sellingPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${isLow ? 'text-red-500' : 'text-slate-900'}`}>
                                {p.quantity}
                              </span>
                              <span className="text-xs text-slate-400">
                                {p.unit}
                              </span>
                              {isLow && (
                                <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                  Low
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setFlowQuantity(1);
                                  setFlowPrice(p.sellingPrice);
                                  setActiveModal('sell_product');
                                }}
                                title="Log Sale"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <ShoppingBag className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setFlowQuantity(1);
                                  setFlowPrice(p.costPrice);
                                  setActiveModal('restock_product');
                                }}
                                title="Restock Stock"
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditForm(p)}
                                title="Edit Product Details"
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                title="Delete Product"
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* VIEW: REPORTS */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-grow">
            
            {/* Sales performance details */}
            <div className="lg:col-span-3 bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col gap-6">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span>Sales Revenue aggregates</span>
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Today's Sales Value</span>
                  <p className="text-3xl font-bold text-slate-900 mt-1">${reports.todaySales.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Resets at midnight UTC</span>
                  </p>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">7-Day Sales Value</span>
                  <p className="text-3xl font-bold text-blue-600 mt-1">${reports.weekSales.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Past 7 rolling days</span>
                  </p>
                </div>
              </div>

              {/* Static visualizer placeholder */}
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex-grow flex flex-col justify-center items-center text-center">
                <BarChart3 className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-600">StockMaster Analytics Active</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Sales logs are backed up directly in Firestore. This live transaction view updates instantly as checkout barcodes are scanned.
                </p>
              </div>
            </div>

            {/* Top Products section */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col">
              <h4 className="font-bold text-slate-900 mb-4">Top 5 Best Selling Products</h4>

              {reports.topSelling.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">No sales logged yet</p>
                  <p className="text-xs opacity-85 mt-1">Checkout scanned items to populate top-selling products here.</p>
                </div>
              ) : (
                <div className="space-y-4 flex-grow">
                  {reports.topSelling.map((p, index) => (
                    <div key={p.id} className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl">
                      <div className="font-bold text-md text-slate-400 w-5 text-center">
                        #{index + 1}
                      </div>
                      <img 
                        src={p.photo} 
                        alt={p.name}
                        className="w-10 h-10 rounded-xl object-cover bg-white shadow-sm"
                      />
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">ID: {p.id?.slice(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">{p.qty} sold</p>
                        <span className="text-[10px] text-slate-400 font-medium">units</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Dynamic Responsive Footer */}
        <footer className="mt-auto flex flex-col sm:flex-row justify-between items-center bg-white px-6 py-4 rounded-2xl border border-slate-200 text-slate-400 text-xs font-medium gap-2">
          <div className="flex gap-4 flex-wrap justify-center">
            <span>Operator: <strong className="text-slate-600">{activeUserEmail}</strong></span>
            <span>Auth: <strong className="text-slate-600">{isFirebaseConfigured ? 'Real Firebase' : 'Sandbox Simulated'}</strong></span>
          </div>
          <div className="flex items-center gap-1">
            <span>v1.0.0-stable</span>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        </footer>

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center z-40 px-2 shadow-lg">
        <button 
          onClick={() => { setActiveTab('dashboard'); setActiveModal(null); }}
          className={`flex flex-col items-center justify-center w-20 h-full transition-all cursor-pointer ${activeTab === 'dashboard' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Dashboard</span>
        </button>
        <button 
          onClick={() => { setActiveTab('inventory'); setActiveModal(null); }}
          className={`flex flex-col items-center justify-center w-20 h-full transition-all cursor-pointer ${activeTab === 'inventory' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Inventory</span>
        </button>
        <button 
          onClick={() => { setActiveTab('reports'); setActiveModal(null); }}
          className={`flex flex-col items-center justify-center w-20 h-full transition-all cursor-pointer ${activeTab === 'reports' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Reports</span>
        </button>
      </nav>

      {/* MODAL 1: CAMERA SCANNER OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between p-4 md:p-8 text-white">
          
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-md tracking-tight uppercase">
                {scanningMode === 'sell' ? 'Checkout Mode (Sell)' : 'Barcode Reader'}
              </span>
            </div>
            <button 
              onClick={() => setIsScanning(false)}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-full cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera Scan Window Frame */}
          <div className="flex-grow flex flex-col justify-center items-center">
            <div className="relative w-full max-w-sm aspect-square bg-slate-900 border-2 border-dashed border-blue-500 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
              
              {/* html5-qrcode target anchor */}
              <div id="reader" className="w-full h-full object-cover"></div>

              {/* Absolute Corner Target Borders */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl"></div>
              <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr"></div>
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl"></div>
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br"></div>

              {/* Scanning red line animation */}
              <div className="absolute inset-x-8 h-0.5 bg-red-500 shadow-lg shadow-red-500/50 animate-[scan_2s_infinite_ease-in-out]"></div>

              {scanError && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-amber-500 mb-2" />
                  <p className="text-sm font-semibold text-white">Camera Access Error</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{scanError}</p>
                </div>
              )}
            </div>
            
            <p className="text-sm text-slate-400 text-center italic mt-6 max-w-xs leading-relaxed">
              Align the product barcode within the central region to trigger automatic identification.
            </p>
          </div>

          {/* Footer controls for camera mode */}
          <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">
                Simulate Scans / Manual inputs:
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                <button 
                  onClick={() => handleSimulateScan('8801007123456')}
                  className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-mono"
                >
                  🥛 Milk
                </button>
                <button 
                  onClick={() => handleSimulateScan('4901301012345')}
                  className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-mono"
                >
                  ☕ Coffee
                </button>
                <button 
                  onClick={() => handleSimulateScan('9780201379624')}
                  className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-mono"
                >
                  📚 Book
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setIsScanning(false)}
              className="bg-white text-slate-900 py-3.5 rounded-xl font-bold hover:bg-slate-100 transition-colors w-full cursor-pointer"
            >
              Cancel Scan
            </button>
          </div>

        </div>
      )}

      {/* MODAL 2: ADD PRODUCT FORM */}
      {activeModal === 'add_product' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[28px] shadow-2xl border border-slate-100 p-6 flex flex-col max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Add New Product</h3>
                  <p className="text-xs text-slate-500 font-mono">Scanned Barcode: {formBarcode}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-4">
              
              {/* Row 1: Barcode (Readonly) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Barcode Value</label>
                <input 
                  type="text" 
                  value={formBarcode} 
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-500 font-mono"
                />
              </div>

              {/* Row 2: Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Product Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Organic Almond Milk 1L"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Row 3: Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dairy, Beverage, Bakery"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Unit of Measurement</label>
                  <select 
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="piece">Piece (pc)</option>
                    <option value="box">Box</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="bottle">Bottle</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Cost Price ($) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={formCostPrice || ''}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Selling Price ($) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice || ''}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              {/* Row 5: Initial stock quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Initial stock level *</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={formQuantity || ''}
                  onChange={(e) => setFormQuantity(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Row 6: Image capture / upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Product Photo</label>
                
                <div className="mt-1 flex items-center gap-4">
                  {formPhoto ? (
                    <div className="relative w-20 h-20 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex-shrink-0">
                      <img src={formPhoto} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setFormPhoto('')}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full cursor-pointer shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 flex-shrink-0">
                      <Camera className="w-6 h-6 opacity-75" />
                      <span className="text-[9px] font-semibold uppercase mt-1">Empty</span>
                    </div>
                  )}

                  <div className="flex-grow">
                    <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-slate-200 max-w-xs transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>{compressingPhoto ? 'Processing...' : 'Take or upload photo'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden" 
                        disabled={compressingPhoto}
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                      System automatically compresses uploaded images under 100KB to reduce cloud storage.
                    </p>
                  </div>
                </div>

              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-slate-50 text-slate-600 hover:bg-slate-100 py-3 rounded-xl font-bold flex-1 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex-1 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Save Product</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRODUCT DETAILS (WITH EDIT CAPABILITIES) */}
      {activeModal === 'product_details' && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[28px] shadow-2xl border border-slate-100 p-6 flex flex-col max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Product Details & Adjustments</h3>
                  <p className="text-xs text-slate-500 font-mono">Barcode: {selectedProduct.barcode}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions at top */}
            <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <button
                onClick={() => {
                  setFlowPrice(selectedProduct.sellingPrice);
                  setFlowQuantity(1);
                  setActiveModal('sell_product');
                }}
                className="bg-slate-900 text-white rounded-xl py-3 px-4 text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Log Sale Checkout</span>
              </button>
              <button
                onClick={() => {
                  setFlowPrice(selectedProduct.costPrice);
                  setFlowQuantity(1);
                  setActiveModal('restock_product');
                }}
                className="bg-blue-600 text-white rounded-xl py-3 px-4 text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Restock Inventory</span>
              </button>
            </div>

            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              
              {/* Product Info Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Product Name</label>
                <input 
                  type="text" 
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Category</label>
                  <input 
                    type="text" 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Unit</label>
                  <select 
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="piece">Piece (pc)</option>
                    <option value="box">Box</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="bottle">Bottle</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Cost Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Selling Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              {/* Photo representation */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Product Photo</label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="relative w-20 h-20 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex-shrink-0">
                    <img src={formPhoto || selectedProduct.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-grow">
                    <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-slate-200 max-w-xs transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Replace Photo</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Stock read-only badge inside details */}
              <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between text-xs text-blue-800">
                <span className="font-semibold">Current Physical Stock Count:</span>
                <span className="text-sm font-bold bg-white text-blue-900 px-3 py-1 rounded-lg">
                  {selectedProduct.quantity} {selectedProduct.unit}(s)
                </span>
              </div>

              {/* Submit, Delete, and Cancel Row */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(selectedProduct)}
                  className="bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-bold flex-1 transition-colors border border-red-200 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                  <span>Delete Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-slate-50 text-slate-600 hover:bg-slate-100 py-3 rounded-xl font-bold flex-1 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold flex-1 shadow-lg shadow-slate-100 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Save Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SELL QUANTITY FORM */}
      {activeModal === 'sell_product' && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[28px] shadow-2xl border border-slate-100 p-6 flex flex-col">
            
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-md text-slate-900">Record Customer Sale</h3>
                  <p className="text-xs text-slate-500 font-mono">BC: {selectedProduct.barcode}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
              <img src={selectedProduct.photoUrl} alt={selectedProduct.name} className="w-14 h-14 rounded-xl object-cover shadow-sm bg-white" />
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 truncate">{selectedProduct.name}</h4>
                <p className="text-xs text-slate-500">Price: ${selectedProduct.sellingPrice.toFixed(2)} per {selectedProduct.unit}</p>
                <span className={`inline-block text-[10px] font-bold mt-1.5 ${selectedProduct.quantity <= LOW_STOCK_THRESHOLD ? 'text-red-500' : 'text-slate-600'}`}>
                  Stock: {selectedProduct.quantity} {selectedProduct.unit}(s) available
                </span>
              </div>
            </div>

            <form onSubmit={handleSellSubmit} className="space-y-4">
              
              {/* Checkout quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Quantity Sold *</label>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    disabled={flowQuantity <= 1}
                    onClick={() => setFlowQuantity(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-lg disabled:opacity-50 cursor-pointer"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    required
                    min="1"
                    max={selectedProduct.quantity}
                    value={flowQuantity || ''}
                    onChange={(e) => setFlowQuantity(Math.min(selectedProduct.quantity, Math.max(1, Number(e.target.value))))}
                    className="flex-1 text-center font-bold border border-slate-200 h-10 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    type="button"
                    disabled={flowQuantity >= selectedProduct.quantity}
                    onClick={() => setFlowQuantity(prev => Math.min(selectedProduct.quantity, prev + 1))}
                    className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-lg disabled:opacity-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price at time of sale */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Sale price ($ each) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  min="0"
                  value={flowPrice || ''}
                  onChange={(e) => setFlowPrice(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                />
              </div>

              {/* Aggregate total */}
              <div className="p-4 bg-blue-50 text-blue-900 rounded-xl flex justify-between items-center text-xs">
                <span className="font-semibold uppercase tracking-wider opacity-80">Total Transaction Amount:</span>
                <span className="text-lg font-bold">${(flowQuantity * flowPrice).toFixed(2)}</span>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Go back to details view
                    openEditForm(selectedProduct);
                  }}
                  className="bg-slate-50 text-slate-600 hover:bg-slate-100 py-3 rounded-xl font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer text-xs"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold flex-grow shadow-lg shadow-slate-100 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Complete Checkout Sale</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RESTOCK QUANTITY FORM */}
      {activeModal === 'restock_product' && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[28px] shadow-2xl border border-slate-100 p-6 flex flex-col">
            
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-md text-slate-900">Restock Product Inventory</h3>
                  <p className="text-xs text-slate-500 font-mono">BC: {selectedProduct.barcode}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
              <img src={selectedProduct.photoUrl} alt={selectedProduct.name} className="w-14 h-14 rounded-xl object-cover shadow-sm bg-white" />
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 truncate">{selectedProduct.name}</h4>
                <p className="text-xs text-slate-500">Current Stock: {selectedProduct.quantity} {selectedProduct.unit}(s)</p>
                <p className="text-[10px] text-slate-400 mt-1">Previous Cost Price: ${selectedProduct.costPrice.toFixed(2)} each</p>
              </div>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              
              {/* Quantity restocked */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Incoming Restock Quantity *</label>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    disabled={flowQuantity <= 1}
                    onClick={() => setFlowQuantity(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-lg disabled:opacity-50 cursor-pointer"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={flowQuantity || ''}
                    onChange={(e) => setFlowQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 text-center font-bold border border-slate-200 h-10 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    type="button"
                    onClick={() => setFlowQuantity(prev => prev + 1)}
                    className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-lg cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price at time of restock */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Supplier Unit Cost Price ($ each) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  min="0"
                  value={flowPrice || ''}
                  onChange={(e) => setFlowPrice(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Aggregate total restock cost */}
              <div className="p-4 bg-green-50 text-green-900 rounded-xl flex justify-between items-center text-xs border border-green-100">
                <span className="font-semibold uppercase tracking-wider opacity-80">Total Restock Invoice Value:</span>
                <span className="text-lg font-bold">${(flowQuantity * flowPrice).toFixed(2)}</span>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Go back to details view
                    openEditForm(selectedProduct);
                  }}
                  className="bg-slate-50 text-slate-600 hover:bg-slate-100 py-3 rounded-xl font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer text-xs"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex-grow shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Complete Restock Input</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
