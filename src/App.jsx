import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabase';
import { mardColors } from './beadData';
import { Plus, Trash2, Package, History, Sparkles, Image as ImageIcon, MessageSquare, Send, ArrowUpDown, Layers, AlertTriangle, Lock, KeyRound, Database, Loader, Search } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const SECRET_CODE = '250806'; 

  useEffect(() => {
    const hasLogin = localStorage.getItem('pindou_auth');
    if (hasLogin === 'true') setIsAuthenticated(true);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === SECRET_CODE) {
      setIsAuthenticated(true);
      localStorage.setItem('pindou_auth', 'true');
    } else {
      alert('暗号错误！');
    }
  };

  const [activeTab, setActiveTab] = useState('inventory'); 
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 默认排序：从少到多
  const [sortType, setSortType] = useState('count_asc'); 

  // 搜索和分类
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');

  const [importing, setImporting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#ffb7b2');
  const [newCount, setNewCount] = useState(1000);
  const [newThreshold, setNewThreshold] = useState(200);
  const [existingItem, setExistingItem] = useState(null);

  const [posts, setPosts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef(null);

  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({}); 

  const greetings = ["今天你拼豆了吗？✨", "每一个豆豆都是艺术品！🎨", "库存充足，创意无限！🚀", "晒晒你的作品吧！📸"];
  const [greeting, setGreeting] = useState(greetings[0]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchGallery();
      setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!newName.trim()) { setExistingItem(null); return; }
    const found = items.find(item => item.name.toLowerCase() === newName.trim().toLowerCase());
    if (found) { setExistingItem(found); setNewColor(found.color); setNewThreshold(found.threshold || 200); } else { setExistingItem(null); }
  }, [newName, items]);

  async function fetchData() {
    setLoading(true);
    const { data: inventoryData } = await supabase.from('inventory').select('*').order('id', { ascending: false });
    const { data: logsData } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(20);
    if (inventoryData) setItems(inventoryData);
    if (logsData) setLogs(logsData);
    setLoading(false);
  }

  async function fetchGallery() {
    const { data: postsData } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (postsData) {
      setPosts(postsData);
      const { data: commentsData } = await supabase.from('comments').select('*').order('created_at', { ascending: true });
      const map = {};
      commentsData?.forEach(c => { if (!map[c.post_id]) map[c.post_id] = []; map[c.post_id].push(c); });
      setCommentsMap(map);
    }
  }

  // === 核心逻辑：智能分类与过滤 ===
  const categories = ['全部', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'P', 'R', 'T', 'Y', 'ZG', 'Q', '其他'];

  const getCategory = (name) => {
    const n = name.toUpperCase();
    if (n.startsWith('ZG')) return 'ZG';
    if (/^[A-Z]/.test(n)) return n.charAt(0);
    return '其他';
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(lowerTerm));
    }
    if (selectedCategory !== '全部') {
      result = result.filter(item => getCategory(item.name) === selectedCategory);
    }
    switch (sortType) {
      case 'count_asc': result.sort((a, b) => a.count - b.count); break;
      case 'count_desc': result.sort((a, b) => b.count - a.count); break;
      case 'oldest': result.sort((a, b) => a.id - b.id); break;
      case 'newest': default: result.sort((a, b) => b.id - a.id); break;
    }
    return result;
  }, [items, searchTerm, selectedCategory, sortType]);


  async function addLog(itemName, action, amount) {
    const { data } = await supabase.from('logs').insert([{ item_name: itemName, action, amount: parseInt(amount) }]).select();
    if (data) setLogs([data[0], ...logs]);
  }

  async function handleBatchImport() {
    if (!confirm(`准备导入 ${mardColors.length} 种 MARD 色卡数据？`)) return;
    setImporting(true);
    try {
      const { data: currentItems } = await supabase.from('inventory').select('name');
      const currentNames = new Set(currentItems?.map(i => i.name.toUpperCase()));
      const toInsert = mardColors.filter(item => !currentNames.has(item.name.toUpperCase()));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('inventory').insert(toInsert);
        if (error) throw error;
        await addLog('系统操作', `批量导入色卡`, toInsert.length);
        await fetchData();
      }
      alert(`导入完成！新增: ${toInsert.length} 个`);
    } catch (err) { alert('导入出错'); } finally { setImporting(false); }
  }

  async function handleEntry(e) {
    e.preventDefault();
    if (!newName) return;
    const countToAdd = parseInt(newCount);
    if (existingItem) {
      const newTotal = existingItem.count + countToAdd;
      const { error } = await supabase.from('inventory').update({ count: newTotal }).eq('id', existingItem.id);
      if (!error) { setItems(items.map(item => item.id === existingItem.id ? { ...item, count: newTotal } : item)); addLog(existingItem.name, '补货入豆', countToAdd); setNewName(''); setNewCount(1000); setExistingItem(null); }
    } else {
      const { data, error } = await supabase.from('inventory').insert([{ name: newName, color: newColor, count: countToAdd, threshold: parseInt(newThreshold) }]).select();
      if (!error) { setItems([data[0], ...items]); addLog(newName, '新购入库', countToAdd); setNewName(''); setNewCount(1000); setNewThreshold(200); }
    }
  }

  async function deleteItem(id, name) {
    if (!confirm(`确定要删除【${name}】吗？`)) return;
    await supabase.from('inventory').delete().eq('id', id);
    setItems(items.filter(item => item.id !== id));
    addLog(name, '删除销毁', 0);
  }

  async function updateStock(id, name, currentCount, changeAmount) {
    const newAmount = currentCount - changeAmount;
    const { error } = await supabase.from('inventory').update({ count: newAmount }).eq('id', id);
    if (!error) { setItems(items.map(item => item.id === id ? { ...item, count: newAmount } : item)); addLog(name, '消耗使用', changeAmount); }
  }

  async function updateColor(id, newColor) {
    setItems(items.map(item => item.id === id ? { ...item, color: newColor } : item));
    await supabase.from('inventory').update({ color: newColor }).eq('id', id);
  }

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return; setUploading(true);
    try {
      const fileExt = file.name.split('.').pop(); const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('beads').upload(fileName, file); if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('beads').getPublicUrl(fileName);
      const { data, error: dbError } = await supabase.from('gallery').insert([{ url: publicUrl, description: description || '分享了一个作品' }]).select(); if (dbError) throw dbError;
      setPosts([data[0], ...posts]); setDescription(''); if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) { alert('上传失败'); } finally { setUploading(false); }
  }

  async function deletePost(id, url) {
    if (!confirm('确定要删除这张作品吗？')) return;
    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (!error) { setPosts(posts.filter(p => p.id !== id)); try { const fileName = url.split('/').pop(); await supabase.storage.from('beads').remove([fileName]); } catch (err) {} }
  }

  async function sendComment(postId) {
    const content = commentInputs[postId]; if (!content) return;
    const { data, error } = await supabase.from('comments').insert([{ post_id: postId, content }]).select();
    if (!error) { const newMap = { ...commentsMap }; if (!newMap[postId]) newMap[postId] = []; newMap[postId].push(data[0]); setCommentsMap(newMap); setCommentInputs({ ...commentInputs, [postId]: '' }); }
  }

  const totalTypes = items.length;
  const lowStockCount = items.filter(i => i.count < (i.threshold || 200)).length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-10 h-10 text-indigo-600" /></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">拼豆基地</h1>
          <form onSubmit={handleLogin} className="space-y-4 mt-8">
            <div className="relative"><KeyRound className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="password" placeholder="请输入访问暗号" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} autoFocus /></div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">解锁进入</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 md:p-6 bg-gray-50 font-sans pb-20">
      <div className="max-w-7xl mx-auto mb-6 bg-indigo-600 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between">
        <div><h1 className="text-3xl font-bold flex items-center gap-3"><Package className="w-8 h-8" /> 豆豆军火库</h1><p className="opacity-90 mt-2 text-indigo-100 flex items-center gap-2 text-sm"><Sparkles size={16} /> {greeting}</p></div>
        <div className="mt-4 md:mt-0 flex gap-4">
           <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-xl font-bold transition ${activeTab === 'inventory' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-500'}`}>📦 豆豆管理</button>
           <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 rounded-xl font-bold transition ${activeTab === 'gallery' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-500'}`}>📸 豆墙</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-6">
              {/* === 恢复：原来大间距的入库卡片 === */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
                <h2 className="font-bold text-gray-800 mb-5 flex items-center gap-2 text-lg"><Plus className="w-5 h-5 text-indigo-600" /> 入豆操作</h2>
                <form onSubmit={handleEntry} className="space-y-4">
                  <div className="relative">
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">名称</label>
                    <input type="text" placeholder="例如: A1 (自动识别)" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" value={newName} onChange={e => setNewName(e.target.value)} />
                    {existingItem && <div className="absolute right-2 top-8 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 animate-pulse"><Layers size={10} /> 已存在</div>}
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">颜色</label>
                      <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-1.5 bg-gray-50">
                        <input type="color" disabled={!!existingItem} className={`w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none ${existingItem ? 'opacity-50' : ''}`} value={newColor} onChange={e => setNewColor(e.target.value)} />
                        <span className="text-xs text-gray-500 font-mono">{newColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">入豆数量</label>
                      <input type="number" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" value={newCount} onChange={e => setNewCount(e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5 text-orange-400">预警线</label>
                      <input type="number" disabled={!!existingItem} className={`w-full p-2.5 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl outline-none ${existingItem ? 'opacity-50' : ''}`} value={newThreshold} onChange={e => setNewThreshold(e.target.value)} />
                    </div>
                  </div>

                  <button type="submit" className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg ${existingItem ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>{existingItem ? `⚡ 确认补豆 (+${newCount})` : '✨ 确认入豆'}</button>
                </form>
                
                <div className="mt-6 pt-4 border-t border-gray-100">
                   <button onClick={handleBatchImport} disabled={importing} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition">
                     {importing ? <Loader className="animate-spin w-4 h-4" /> : <Database className="w-4 h-4" />} {importing ? '...' : '导入全套 MARD 色卡'}
                   </button>
                   <p className="text-[10px] text-center text-gray-400 mt-2">包含 A-H, M, P, R, T, Y, ZG, Q 等全系列</p>
                </div>
              </div>
              
              {lowStockCount > 0 && (
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm animate-pulse">
                   <div className="flex items-center gap-2 text-red-600 font-bold mb-2"><AlertTriangle size={20} /> 缺货提醒</div>
                   <p className="text-sm text-red-500 leading-relaxed">有 <span className="font-bold text-lg mx-1">{lowStockCount}</span> 种豆豆库存不足</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-6">
              <div className="flex flex-col gap-4 mb-4">
                 {/* 工具栏 */}
                 <div className="flex items-center gap-2">
                   <div className="flex-1 relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                     <input type="text" placeholder="搜索名称..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
                   <div className="flex items-center bg-white rounded-xl border border-gray-200 px-3 py-2 gap-2">
                     <ArrowUpDown size={14} className="text-gray-400" />
                     <select className="text-sm bg-transparent outline-none text-gray-600 cursor-pointer" value={sortType} onChange={(e) => setSortType(e.target.value)}>
                       <option value="count_asc">最少 (默认)</option>
                       <option value="count_desc">最多</option>
                       <option value="newest">最新</option>
                     </select>
                   </div>
                 </div>

                 {/* 分类条 */}
                 <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setSelectedCategory(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${selectedCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{cat}系</button>
                    ))}
                 </div>
                 
                 <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                    <span>当前显示: {filteredAndSortedItems.length} 种</span>
                    <span>总库存: {totalTypes} 种</span>
                 </div>
              </div>

              {loading ? <div className="text-center text-gray-400">加载中...</div> : (
                // === 恢复：Grid 布局，两列 ===
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAndSortedItems.map(item => <ItemCard key={item.id} item={item} onDelete={deleteItem} onUpdate={updateStock} onUpdateColor={updateColor} />)}
                  {filteredAndSortedItems.length === 0 && <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">没有找到 "{searchTerm}" 或该分类下无数据</div>}
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
                 <div className="p-4 border-b border-gray-100 bg-gray-50"><h2 className="font-bold text-gray-800 flex items-center gap-2"><History className="w-4 h-4" /> 动态</h2></div>
                 <div className="max-h-[500px] overflow-y-auto">
                   {logs.map(log => (
                     <div key={log.id} className="p-3 border-b border-gray-50 hover:bg-gray-50 text-xs">
                       <div className="flex justify-between"><span className="font-bold text-gray-700">{log.item_name}</span><span className="text-gray-400">{new Date(log.created_at).getMonth()+1}/{new Date(log.created_at).getDate()}</span></div>
                       <div className="flex justify-between mt-1"><span className="text-gray-500">{log.action}</span><span className={log.action.includes('入库') ? 'text-green-600 font-bold' : 'text-orange-600 font-bold'}>{log.action.includes('入库') ? '+' : '-'}{log.amount}</span></div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
           <div className="max-w-3xl mx-auto">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8"><h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ImageIcon className="text-indigo-600" /> 分享新作品</h2><div className="flex flex-col gap-4"><textarea placeholder="说点什么吧..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" rows="2" value={description} onChange={e => setDescription(e.target.value)}></textarea><div className="flex items-center justify-between"><input type="file" accept="image/*" ref={fileInputRef} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onChange={handleUpload} disabled={uploading} />{uploading && <span className="text-indigo-600 text-sm animate-pulse">上传中...</span>}</div></div></div><div className="space-y-8">{posts.map(post => (<div key={post.id} className="relative bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group"><button onClick={() => deletePost(post.id, post.url)} className="absolute top-4 right-4 bg-black/50 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10"><Trash2 size={18} /></button><img src={post.url} alt="作品" className="w-full h-auto object-cover max-h-[500px]" /><div className="p-5"><p className="text-gray-800 text-lg mb-4">{post.description}</p><div className="text-xs text-gray-400 mb-4 flex items-center gap-1">发布于 {new Date(post.created_at).toLocaleString()}</div><div className="bg-gray-50 rounded-xl p-4"><h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-1"><MessageSquare size={14} /> 评论</h3><div className="space-y-3 mb-4 max-h-40 overflow-y-auto">{(commentsMap[post.id] || []).map(c => <div key={c.id} className="text-sm"><span className="text-gray-800">{c.content}</span></div>)}</div><div className="flex gap-2"><input type="text" placeholder="夸夸ta..." className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" value={commentInputs[post.id] || ''} onChange={e => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && sendComment(post.id)} /><button onClick={() => sendComment(post.id)} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"><Send size={16} /></button></div></div></div></div>))}</div>
           </div>
        )}
      </div>
    </div>
  );
}

// === 恢复：原来的大卡片样式 ===
function ItemCard({ item, onDelete, onUpdate, onUpdateColor }) {
  const [consumeAmount, setConsumeAmount] = useState('');
  const limit = item.threshold || 200; 
  const isLowStock = item.count < limit;
  
  const handleUse = (e) => { 
    e.preventDefault(); 
    if (!consumeAmount) return; 
    onUpdate(item.id, item.name, item.count, parseInt(consumeAmount)); 
    setConsumeAmount(''); 
  };

  return (
    <div className={`group relative bg-white p-5 rounded-2xl shadow-sm border-2 transition-all hover:shadow-lg ${isLowStock ? 'border-red-500 bg-red-100 shadow-red-200' : 'border-gray-100 border'}`}>
      
      {/* 删除按钮 */}
      <button 
        onClick={() => onDelete(item.id, item.name)}
        className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100 z-10"
        title="删除"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex items-start gap-4 mb-4">
        {/* 大色块 + 点击改色 */}
        <div className="relative w-14 h-14 rounded-2xl shadow-sm border border-black/5 ring-4 ring-gray-50 flex-shrink-0 overflow-hidden cursor-pointer">
          <div className="absolute inset-0" style={{ backgroundColor: item.color }}></div>
          <input 
            type="color" 
            value={item.color} 
            onChange={(e) => onUpdateColor(item.id, e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="点击修改颜色"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-lg truncate pr-6">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-mono font-bold tracking-tight ${isLowStock ? 'text-red-500' : 'text-gray-700'}`}>
              {item.count}
            </span>
            {isLowStock ? (
               <div className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-200">
                 低于 {limit}
               </div>
            ) : (
               <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 rounded">
                 安全线 {limit}
               </span>
            )}
          </div>
        </div>
      </div>

      {/* 恢复：原来的消耗表单（有输入框 + 登记按钮） */}
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