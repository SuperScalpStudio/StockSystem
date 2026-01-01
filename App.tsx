
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  PackagePlus, 
  ShoppingCart, 
  Package, 
  History,
  Trash2,
  Search,
  Camera,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Product, Transaction, TransactionType, InventoryState } from './types';

// --- 配置區 ---
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzd8oBB0EGx2BnMaI402HQc9Njkeeg01-0PC6I58sGWXCzyDkPt_X5OTcMlx5U5FoCZ/exec'; 

// --- 核心樣式 ---
const topBarClass = "bg-white border-b border-slate-100 sticky top-0 z-40 shrink-0 safe-top";
const inputClass = "w-full bg-white border border-slate-200/50 rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm";

// --- 共用組件 ---

const LoadingOverlay = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500 pointer-events-auto">
      <div className="relative mb-6">
        <Loader2 className="text-indigo-400 animate-spin" size={48} strokeWidth={2.5} />
        <div className="absolute inset-0 blur-3xl bg-indigo-500/30 rounded-full animate-pulse"></div>
      </div>
      <p className="text-white/80 font-black text-[12px] tracking-[0.4em] uppercase ml-2 animate-pulse">
        同步雲端資料中
      </p>
    </div>
  );
};

const Header = ({ children }: { children?: React.ReactNode }) => (
  <div className={topBarClass}>
    <div className="h-14 flex items-center">
      {children}
    </div>
  </div>
);

const Navigation = () => {
  const { pathname } = useLocation();
  const navItems = [
    { path: '/', icon: <Package size={20} />, label: '庫存' },
    { path: '/purchase', icon: <PackagePlus size={20} />, label: '進貨' },
    { path: '/sale', icon: <ShoppingCart size={20} />, label: '銷貨' },
    { path: '/history', icon: <History size={20} />, label: '貨流' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 px-2 lg:h-screen lg:w-20 lg:flex-col lg:left-0 lg:top-0 lg:border-r lg:border-t-0 safe-bottom">
      <div className="h-16 flex justify-around items-center lg:h-full lg:flex-col lg:justify-center lg:gap-8">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
              {item.icon}
              <span className="text-[10px] font-bold mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const ScannerModal = ({ onScan, onClose }: { onScan: (data: string) => void, onClose: () => void }) => {
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    
    // 全螢幕秒讀模式：不傳入 qrbox 與 aspectRatio
    html5QrCode.start(
      { facingMode: "environment" }, 
      { 
        fps: 30,
      }, 
      (text) => {
        if (navigator.vibrate) navigator.vibrate(60);
        onScan(text);
        html5QrCode.stop().then(() => onClose()).catch(() => onClose());
      }, 
      undefined
    ).catch((err) => { 
      console.error("Camera Start Error:", err);
      onClose(); 
    });

    return () => { 
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {}); 
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* 全螢幕相機視圖 */}
      <div id="reader" className="absolute inset-0 w-full h-full"></div>
      
      {/* 底部極簡關閉鈕 - 純淨全螢幕無多餘裝飾 */}
      <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center">
        <button 
          onClick={onClose} 
          className="bg-white/10 backdrop-blur-3xl border border-white/20 text-white p-5 rounded-full active:scale-90 transition-all shadow-2xl pointer-events-auto"
        >
          <X size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

const InventoryView = ({ state, onUpdate }: { state: InventoryState, onUpdate: (p: Product) => void }) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);

  const stats = useMemo(() => {
    const cost = Object.values(state.products).reduce((acc, p) => acc + ((p.quantity || 0) * (p.weightedAverageCost || 0)), 0);
    const profit = state.transactions.filter(t => t.type === TransactionType.SALE).reduce((acc, t) => acc + (t.totalProfit || 0), 0);
    return { cost, profit, count: Object.keys(state.products).length };
  }, [state]);

  const filtered = Object.values(state.products)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.toLowerCase().includes(search.toLowerCase()))
    // 嚴格依品名排序 (中文排序)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <Header>
        <div className="grid grid-cols-3 w-full divide-x divide-slate-100">
          <div className="flex flex-col items-center justify-center">
            <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-tighter">庫存資產</p>
            <p className="text-[12px] font-black text-slate-900">${Math.round(stats.cost).toLocaleString()}</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-[8px] font-extrabold text-indigo-400 uppercase tracking-tighter">累計獲利</p>
            <p className="text-[12px] font-black text-indigo-600">${Math.round(stats.profit).toLocaleString()}</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-tighter">品項總數</p>
            <p className="text-[12px] font-black text-slate-600">{stats.count}</p>
          </div>
        </div>
      </Header>
      
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 pb-32">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="依品名搜尋庫存..."
            className="w-full bg-white border border-slate-200/50 rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="grid gap-1.5">
          {filtered.map(p => (
            <div 
              key={p.barcode} 
              onClick={() => setEditing(p)}
              className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm active:scale-[0.98] active:bg-slate-50 cursor-pointer transition-all duration-150 hover:border-indigo-100"
            >
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="font-bold text-[13px] text-slate-800 truncate leading-tight mb-1">{p.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1 rounded uppercase tracking-tighter border border-slate-100">#{p.barcode}</span>
                  <span className="text-[9px] text-slate-400 font-bold">成本: ${Math.round(p.weightedAverageCost || 0)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <div className={`px-2.5 py-1.5 rounded-lg text-center min-w-[40px] ${p.quantity <= 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`}>
                  <p className="text-[11px] font-black leading-none">{p.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-sm text-slate-800">編輯商品資訊</h3>
              <span className="text-[10px] font-mono text-slate-400 tracking-tighter">#{editing.barcode}</span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">品名</p>
                <input type="text" className={inputClass} value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 text-sm font-bold text-slate-400 active:scale-95 transition-transform">取消</button>
              <button onClick={() => { onUpdate(editing); setEditing(null); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-transform">儲存更新</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TransactionView = ({ type, inventory, onSubmit }: { type: TransactionType, inventory: Record<string, Product>, onSubmit: (items: any[], type: TransactionType, remarks: string, actualTotal?: number) => void, key?: React.Key }) => {
  const [currency, setCurrency] = useState<'TWD' | 'EUR'>(type === TransactionType.PURCHASE ? 'EUR' : 'TWD');
  const [items, setItems] = useState<any[]>([]);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [scanner, setScanner] = useState(false);
  const [totalBill, setTotalBill] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showError, setShowError] = useState(false);

  const bgColor = type === TransactionType.PURCHASE ? 'bg-purple-50' : 'bg-emerald-50';

  const lookup = (code: string) => {
    setBarcode(code);
    if (inventory[code]) setName(inventory[code].name);
    else if (type === TransactionType.SALE) setName('');
  };

  const addItem = () => {
    if (!barcode || !name || !qty) return;
    const nQty = Number(qty) || 0;
    const nPrice = price === "" ? 0 : Number(price);
    setItems([{ barcode, name, quantity: nQty, price: nPrice, cost: inventory[barcode]?.weightedAverageCost || 0 }, ...items]);
    setBarcode(''); setName(''); setQty(''); setPrice('');
  };

  const handleFinalSubmit = () => {
    const isEurPurchase = type === TransactionType.PURCHASE && currency === 'EUR';
    if (isEurPurchase && !totalBill) {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }
    let processedItems = [...items];
    let finalTotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    if (isEurPurchase && totalBill) {
      finalTotal = Number(totalBill);
      const totalEur = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      const rate = totalEur !== 0 ? finalTotal / totalEur : 1;
      processedItems = items.map(i => ({ ...i, price: i.price * rate }));
    } else if (type === TransactionType.SALE) {
      processedItems = items.map(i => ({ ...i, profit: i.price - i.cost }));
    }
    onSubmit(processedItems, type, remarks, finalTotal);
    setItems([]); setTotalBill(''); setRemarks(''); setBarcode(''); setName(''); setQty(''); setPrice(''); setShowError(false);
  };

  const currentListTotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

  return (
    <div className={`flex flex-col h-full ${bgColor}`}>
      <Header>
        <div className="px-4 flex w-full justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${type === TransactionType.PURCHASE ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {type === TransactionType.PURCHASE ? <PackagePlus size={16} /> : <ShoppingCart size={16} />}
            </div>
            <span className="font-extrabold text-sm">{type === TransactionType.PURCHASE ? '進貨' : '銷貨'}</span>
          </div>
          {type === TransactionType.PURCHASE && (
            <div className="bg-slate-200/50 p-1 rounded-xl flex text-[10px] font-black">
              <button onClick={() => setCurrency('TWD')} className={`px-3 py-1.5 rounded-lg transition-all ${currency === 'TWD' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>TWD</button>
              <button onClick={() => setCurrency('EUR')} className={`px-3 py-1.5 rounded-lg transition-all ${currency === 'EUR' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>EUR</button>
            </div>
          )}
        </div>
      </Header>

      {scanner && <ScannerModal onScan={lookup} onClose={() => setScanner(false)} />}
      
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-32">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/50 shadow-sm space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="條碼" className={inputClass + " pl-10"} value={barcode} onChange={e => lookup(e.target.value)} />
            </div>
            <button onClick={() => setScanner(true)} className="bg-slate-900 text-white p-2.5 rounded-xl active:scale-90 transition-transform"><Camera size={20} /></button>
          </div>
          <input type="text" placeholder="商品名稱" className={inputClass} value={name} onChange={e => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" inputMode="decimal" placeholder="數量" className={inputClass} value={qty} onChange={e => setQty(e.target.value)} />
            <input type="number" inputMode="decimal" placeholder={currency} className={inputClass} value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <button onClick={addItem} className={`w-full py-3.5 ${type === TransactionType.PURCHASE ? 'bg-purple-600' : 'bg-emerald-600'} text-white rounded-xl font-black text-sm active:scale-95 transition-all shadow-md`}>加入清單</button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/50 flex justify-between items-center text-xs shadow-sm">
                <div><p className="font-bold">{item.name}</p><p className="text-[10px] text-slate-400">#{item.barcode}</p></div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><p className="font-black">${item.price}</p><p className="text-[10px] font-bold text-slate-400">x {item.quantity}</p></div>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-200 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="space-y-4">
              {type === TransactionType.PURCHASE && currency === 'EUR' ? (
                <input type="number" placeholder="刷卡台幣總額" className="w-full bg-slate-800 border-none rounded-xl py-3 px-4 text-white font-black" value={totalBill} onChange={e => setTotalBill(e.target.value)} />
              ) : (
                <p className="text-2xl font-black">${currentListTotal.toLocaleString()}</p>
              )}
              <input type="text" placeholder="備註" className="w-full bg-slate-800 border-none rounded-xl py-3 px-4 text-sm text-white" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
            <button onClick={handleFinalSubmit} className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-sm active:scale-95 transition-all">確認提交</button>
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryView = ({ transactions }: { transactions: Transaction[] }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    return [...transactions].reverse().filter(t => 
      t.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.barcode.toLowerCase().includes(search.toLowerCase()))
    );
  }, [transactions, search]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header>
        <div className="px-4 w-full"><input type="text" placeholder="搜尋貨流紀錄..." className="w-full bg-slate-100 border-none rounded-xl py-2 px-4 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </Header>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-32">
        {filtered.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${t.type === TransactionType.PURCHASE ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'}`}>{t.type === TransactionType.PURCHASE ? '進貨' : '銷貨'}</span>
              <span className="text-[10px] text-slate-400 font-mono">{new Date(t.date).toLocaleString()}</span>
            </div>
            {t.items.map((item, i) => (
              <div key={i} className="text-xs flex justify-between mb-1"><span>{item.name} x{item.quantity}</span><span className="font-bold">${item.price * item.quantity}</span></div>
            ))}
            {t.remarks && <p className="mt-2 text-[10px] text-slate-400 italic border-t pt-2">「{t.remarks}」</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<InventoryState>({ products: {}, transactions: [] });
  const [loading, setLoading] = useState(false);

  const sync = useCallback(async (action: 'GET' | 'POST', payload?: any) => {
    setLoading(true);
    try {
      const opts = action === 'GET' ? {} : { method: 'POST', body: JSON.stringify(payload) };
      const res = await fetch(SCRIPT_URL, opts);
      const data = await res.json();
      if (action === 'GET') setState(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { sync('GET'); }, []);

  const handleTransaction = (items: any[], type: TransactionType, remarks: string, actualTotal?: number) => {
    const nextState = JSON.parse(JSON.stringify(state));
    let finalAmount = actualTotal || items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    let totalProf = 0;

    items.forEach(item => {
      const p = nextState.products[item.barcode];
      if (type === TransactionType.PURCHASE) {
        if (p) {
          const oldQ = Number(p.quantity) || 0;
          const oldWAC = Number(p.weightedAverageCost) || 0;
          const newQ = oldQ + item.quantity;
          if (newQ !== 0) p.weightedAverageCost = (oldQ * oldWAC + item.quantity * item.price) / newQ;
          p.quantity = newQ;
        } else {
          nextState.products[item.barcode] = { barcode: item.barcode, name: item.name, quantity: item.quantity, weightedAverageCost: item.price, lastUpdated: new Date().toISOString() };
        }
      } else if (p) {
        totalProf += (item.price - (Number(p.weightedAverageCost) || 0)) * item.quantity;
        p.quantity = (Number(p.quantity) || 0) - item.quantity;
      }
    });

    const tx: Transaction = { id: (type[0]) + Date.now(), date: new Date().toISOString(), type, items, totalAmount: finalAmount, totalProfit: type === TransactionType.SALE ? totalProf : undefined, remarks };
    nextState.transactions.push(tx);
    setState(nextState);
    sync('POST', { products: nextState.products, transaction: tx });
  };

  return (
    <Router>
      <div className="app-container flex flex-col lg:flex-row bg-slate-50 overflow-hidden relative">
        <LoadingOverlay visible={loading} />
        <Navigation />
        <main className="flex-1 lg:pl-20 overflow-hidden h-full">
          <Routes>
            <Route path="/" element={<InventoryView state={state} onUpdate={(p) => { 
              const ns = {...state, products: {...state.products, [p.barcode]: p}}; setState(ns); sync('POST', { products: ns.products }); 
            }} />} />
            <Route path="/purchase" element={<TransactionView key="PURCHASE" type={TransactionType.PURCHASE} inventory={state.products} onSubmit={handleTransaction} />} />
            <Route path="/sale" element={<TransactionView key="SALE" type={TransactionType.SALE} inventory={state.products} onSubmit={handleTransaction} />} />
            <Route path="/history" element={<HistoryView transactions={state.transactions} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
