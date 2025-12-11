import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, Trash2, AlertTriangle, Package, History, Sparkles, Settings } from 'lucide-react';

function App() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 表单状态
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#ffb7b2');
  const [newCount, setNewCount] = useState(1000);
  const [newThreshold, setNewThreshold] = useState(200); // 新增：预警阈值状态

  // 欢迎语
  const greetings = [
    "今天你拼豆了吗？✨",
    "每一个豆豆都是艺术品！🎨",
    "库存充足，创意无限！🚀",
    "记得拼豆✨"
  ];
  const [greeting, setGreeting] = useState(greetings[0]);

  useEffect(() => {
    fetchData();
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: inventoryData } = await supabase.from('inventory').select('*').order('id', { ascending: false });
    const { data: logsData } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(20);
    
    if (inventoryData) setItems(inventoryData);
    if (logsData) setLogs(logsData);
    setLoading(false);
  }

  async function addLog(itemName, action, amount) {
    const { data, error } = await supabase
      .from('logs')
      .insert([{ item_name: itemName, action: action, amount: parseInt(amount) }])
      .select();
    
    if (!error && data) {
      setLogs([data[0], ...logs]);
    }
  }

  // 入库 (已升级：支持自定义预警线)
  async function addItem(e) {
    e.preventDefault();
    if (!newName) return;
    const { data, error } = await supabase
      .from('inventory')
      .insert([{ 
        name: newName, 
        color: newColor, 
        count: parseInt(newCount),
        threshold: parseInt(newThreshold) // 把这个自定义的数存进去
      }])
      .select();

    if (!error) {
      setItems([data[0], ...items]);
      addLog(newName, '新购入库', newCount);
      setNewName('');
      setNewCount(1000);
      setNewThreshold(200); // 重置为默认值
    }
  }

  async function deleteItem(id, name) {
    if (!confirm(`确定要删除【${name}】吗？删除后无法恢复哦！`)) return;
    await supabase.from('inventory').delete().eq('id', id);
    setItems(items.filter(item => item.id !== id));
    addLog(name, '删除销毁', 0);
  }

  async function updateStock(id, name, currentCount, changeAmount) {
    const newAmount = currentCount - changeAmount;
    const { error } = await supabase
      .from('inventory')
      .update({ count: newAmount })
      .eq('id', id);

    if (!error) {
      setItems(items.map(item => item.id === id ? { ...item, count: newAmount } : item));
      addLog(name, '消耗使用', changeAmount);
    }
  }

  // 统计数据 (已升级：根据每个物品自己的阈值判断)
  const totalTypes = items.length;
  const totalBeads = items.reduce((sum, item) => sum + item.count, 0);
  const lowStockCount = items.filter(i => i.count < (i.threshold || 200)).length;

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50 font-sans">
      {/* 顶部欢迎栏 */}
      <div className="max-w-7xl mx-auto mb-8 bg-indigo-600 text-white p-6 rounded-3xl shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-center justify-between transition-all hover:shadow-2xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="w-8 h-8" /> 拼豆军火库
          </h1>
          <p className="opacity-90 mt-2 text-indigo-100 flex items-center gap-2 text-sm font-medium">
            <Sparkles size={16} /> {greeting}
          </p>
        </div>
        <div className="mt-6 md:mt-0 flex gap-8 text-center bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
          <div>
            <div className="text-3xl font-bold">{totalTypes}</div>
            <div className="text-xs opacity-80 uppercase tracking-wider mt-1">颜色种类</div>
          </div>
          <div className="w-px bg-indigo-400/50 h-10 self-center"></div>
          <div>
            <div className="text-3xl font-bold">{totalBeads.toLocaleString()}</div>
            <div className="text-xs opacity-80 uppercase tracking-wider mt-1">库存总数</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧栏：操作台 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
            <h2 className="font-bold text-gray-800 mb-5 flex items-center gap-2 text-lg">
              <Plus className="w-5 h-5 text-indigo-600" /> 新品入库
            </h2>
            <form onSubmit={addItem} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">名称</label>
                <input
                  type="text"
                  placeholder="例如: 纯黑"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">颜色</label>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-1.5 bg-gray-50">
                     <input
                      type="color"
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                    />
                    <span className="text-xs text-gray-500 font-mono">{newColor}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">初始数量</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-all"
                    value={newCount}
                    onChange={e => setNewCount(e.target.value)}
                  />
                </div>
                {/* 新增：预警数量输入框 */}
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5 text-orange-400">预警线</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-orange-50 border border-orange-100 rounded-xl outline-none focus:border-orange-500 text-orange-600 font-medium transition-all"
                    value={newThreshold}
                    onChange={e => setNewThreshold(e.target.value)}
                    title="当库存低于这个数时会变红报警"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transform hover:-translate-y-0.5 transition-all">
                确认入库
              </button>
            </form>
          </div>
          
          {/* 预警概览 */}
          {lowStockCount > 0 && (
             <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm animate-pulse">
                <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                  <AlertTriangle size={20} /> 缺货提醒
                </div>
                <p className="text-sm text-red-500 leading-relaxed">
                  当前有 <span className="font-bold text-lg mx-1">{lowStockCount}</span> 种豆豆库存不足。
                  <br/>请查看红色标记的物品。
                </p>
             </div>
          )}
        </div>

        {/* 中间栏：库存列表 */}
        <div className="lg:col-span-6">
          <div className="flex justify-between items-end mb-6 px-1">
            <h2 className="text-xl font-bold text-gray-800">库存列表</h2>
            <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100">按入库时间排序</span>
          </div>
          
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-gray-400">
               <Package className="w-12 h-12 mb-4 text-gray-200 animate-bounce" />
               <p>正在搬运豆豆...</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {items.map(item => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  onDelete={deleteItem} 
                  onUpdate={updateStock} 
                />
              ))}
            </div>
          )}
        </div>

        {/* 右侧栏：历史记录 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" /> 近期动态
              </h2>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">暂无记录</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition group">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-gray-700 text-sm">{log.item_name}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                         {new Date(log.created_at).getMonth()+1}/{new Date(log.created_at).getDate()} {new Date(log.created_at).getHours()}:{new Date(log.created_at).getMinutes().toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{log.action}</span>
                      <span className={`text-sm font-bold font-mono ${log.action.includes('入库') ? 'text-green-500' : 'text-orange-500'}`}>
                        {log.action.includes('入库') ? '+' : '-'}{log.amount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// 单个卡片组件
function ItemCard({ item, onDelete, onUpdate }) {
  const [consumeAmount, setConsumeAmount] = useState('');
  // 核心修改：使用该物品自己的阈值，如果数据库里是null则默认200
  const limit = item.threshold || 200; 
  const isLowStock = item.count < limit;

  const handleUse = (e) => {
    e.preventDefault();
    if (!consumeAmount) return;
    onUpdate(item.id, item.name, item.count, parseInt(consumeAmount));
    setConsumeAmount('');
  };

  return (
    <div className={`group relative bg-white p-5 rounded-2xl shadow-sm border transition-all hover:shadow-lg hover:-translate-y-1 ${isLowStock ? 'border-red-200 bg-red-50/50 shadow-red-100' : 'border-gray-100'}`}>
      
      <button 
        onClick={() => onDelete(item.id, item.name)}
        className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100 z-10"
        title="删除"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex items-start gap-4 mb-4">
        <div 
          className="w-14 h-14 rounded-2xl shadow-sm border border-black/5 ring-4 ring-gray-50"
          style={{ backgroundColor: item.color }}
        ></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-lg truncate pr-6">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-mono font-bold tracking-tight ${isLowStock ? 'text-red-500' : 'text-gray-700'}`}>
              {item.count}
            </span>
            {isLowStock ? (
               <div className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-200">
                 <AlertTriangle size={10} /> 低于 {limit}
               </div>
            ) : (
               <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 rounded">
                 安全线 {limit}
               </span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleUse} className="relative">
        <input 
          type="number" 
          placeholder="使用了多少?" 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition pr-16"
          value={consumeAmount}
          onChange={e => setConsumeAmount(e.target.value)}
        />
        <button 
          type="submit"
          disabled={!consumeAmount}
          className="absolute right-1 top-1 bottom-1 bg-gray-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          登记
        </button>
      </form>
    </div>
  );
}

export default App;