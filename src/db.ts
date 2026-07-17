import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from './firebase';

export interface Product {
  id?: string;
  barcode: string;
  name: string;
  photoUrl: string;
  category?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  unit: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id?: string;
  productId: string;
  type: 'restock' | 'sale' | 'adjustment';
  quantityChange: number;
  priceAtTime: number;
  userId: string;
  timestamp: string;
}

// LocalStorage helpers for sandbox mode fallback
const LOCAL_PRODUCTS_KEY = 'stockmaster_products';
const LOCAL_MOVEMENTS_KEY = 'stockmaster_movements';

function getLocalProducts(): Product[] {
  const data = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  return data ? JSON.parse(data) : [];
}

function setLocalProducts(products: Product[]) {
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
}

function getLocalMovements(): StockMovement[] {
  const data = localStorage.getItem(LOCAL_MOVEMENTS_KEY);
  return data ? JSON.parse(data) : [];
}

function setLocalMovements(movements: StockMovement[]) {
  localStorage.setItem(LOCAL_MOVEMENTS_KEY, JSON.stringify(movements));
}

// Initialize test connection to Firestore as per guidelines
export async function testConnection(): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration (client is offline).");
    }
    return false;
  }
}

// PRODUCT API

export async function getProducts(userId: string): Promise<Product[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'products'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          ...data
        } as Product);
      });
      return items;
    } catch (e) {
      console.error("Firebase getProducts error, falling back to local storage:", e);
    }
  }
  
  // Local fallback
  return getLocalProducts().filter(p => p.userId === userId);
}

export async function getProductByBarcode(userId: string, barcode: string): Promise<Product | null> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'products'),
        where('userId', '==', userId),
        where('barcode', '==', barcode),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Product;
      }
      return null;
    } catch (e) {
      console.error("Firebase getProductByBarcode error:", e);
    }
  }

  // Local fallback
  const items = getLocalProducts();
  const found = items.find(p => p.userId === userId && p.barcode === barcode);
  return found || null;
}

export async function createProduct(
  userId: string, 
  productData: Omit<Product, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Product> {
  const now = new Date().toISOString();
  const newProduct: Product = {
    ...productData,
    userId,
    createdAt: now,
    updatedAt: now
  };

  if (isFirebaseConfigured && db) {
    try {
      const docRef = await addDoc(collection(db, 'products'), newProduct);
      return {
        id: docRef.id,
        ...newProduct
      };
    } catch (e) {
      console.error("Firebase createProduct error:", e);
      throw e;
    }
  }

  // Local fallback
  const items = getLocalProducts();
  const localId = 'prod_' + Math.random().toString(36).substr(2, 9);
  const savedProduct = { ...newProduct, id: localId };
  items.push(savedProduct);
  setLocalProducts(items);
  return savedProduct;
}

export async function updateProduct(
  userId: string, 
  productId: string, 
  updates: Partial<Omit<Product, 'id' | 'userId' | 'barcode' | 'createdAt'>>
): Promise<void> {
  const now = new Date().toISOString();
  const fieldsToUpdate = {
    ...updates,
    updatedAt: now
  };

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'products', productId);
      await updateDoc(docRef, fieldsToUpdate);
      return;
    } catch (e) {
      console.error("Firebase updateProduct error:", e);
      throw e;
    }
  }

  // Local fallback
  const items = getLocalProducts();
  const idx = items.findIndex(p => p.id === productId && p.userId === userId);
  if (idx !== -1) {
    items[idx] = {
      ...items[idx],
      ...fieldsToUpdate
    };
    setLocalProducts(items);
  } else {
    throw new Error("Product not found");
  }
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'products', productId));
      return;
    } catch (e) {
      console.error("Firebase deleteProduct error:", e);
      throw e;
    }
  }

  // Local fallback
  const items = getLocalProducts();
  const filtered = items.filter(p => !(p.id === productId && p.userId === userId));
  setLocalProducts(filtered);

  // Also remove stock movements related to this product to clean up local storage
  const movements = getLocalMovements();
  const filteredMovements = movements.filter(m => !(m.productId === productId && m.userId === userId));
  setLocalMovements(filteredMovements);
}

// STOCK MOVEMENT API

export async function getStockMovements(userId: string): Promise<StockMovement[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'stockMovements'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const items: StockMovement[] = [];
      snapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as StockMovement);
      });
      return items;
    } catch (e) {
      console.error("Firebase getStockMovements error:", e);
    }
  }

  // Local fallback
  return getLocalMovements().filter(m => m.userId === userId);
}

export async function addStockMovement(
  userId: string, 
  movementData: Omit<StockMovement, 'userId' | 'timestamp'>
): Promise<void> {
  const timestamp = new Date().toISOString();
  const newMovement: StockMovement = {
    ...movementData,
    userId,
    timestamp
  };

  if (isFirebaseConfigured && db) {
    try {
      await addDoc(collection(db, 'stockMovements'), newMovement);
      return;
    } catch (e) {
      console.error("Firebase addStockMovement error:", e);
      throw e;
    }
  }

  // Local fallback
  const items = getLocalMovements();
  const localId = 'mov_' + Math.random().toString(36).substr(2, 9);
  items.push({ ...newMovement, id: localId });
  setLocalMovements(items);
}

export async function uploadProductPhoto(
  userId: string,
  barcode: string,
  compressedDataUrl: string
): Promise<string> {
  if (isFirebaseConfigured && storage) {
    try {
      const storageRef = ref(storage, `users/${userId}/products/${barcode}.jpg`);
      await uploadString(storageRef, compressedDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (e) {
      console.error("Firebase Storage upload failed, using local data URL instead:", e);
    }
  }
  return compressedDataUrl;
}
