import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Plus, Trash2, Package, History, Sparkles, Image as ImageIcon, MessageSquare, Send, ArrowUpDown } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('inventory'); 
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 新增：排序状态 'newest' | 'oldest' | 'count_asc' | 'count_desc'
  const [sortType, setSortType] = useState('newest'); 

  // 库存表单
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#ffb7b2');
  const [newCount, setNewCount] = useState(1000);
  const [newThreshold, setNewThreshold] = useState(200);

  // 作品墙
  const [posts, setPosts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef(null);

  // 评论
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({}); 

  const greetings = ["今天你拼豆了吗？✨", "每一个豆豆都是艺术品！🎨", "库存充足，创意无限！🚀", "晒晒你的作品吧！📸"];
  const [greeting, setGreeting] = useState(greetings[0]);

  useEffect(() => {
    fetchData();
    fetchGallery();
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  // --- 数据获取 ---
  async function fetchData() {
    setLoading(true);
    // 默认先按 ID 倒序拿回来
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
      commentsData?.forEach(c => {
        if (!map[c.post_id]) map[c.post_id] = [];
        map[c.post_id].push(c);
      });
      setCommentsMap(map);
    }
  }

  // --- 核心逻辑：获取排序后的列表 ---
  const getSortedItems = () => {
    // 复制一份数据以免影响原始数据
    const sorted = [...items];
    switch (sortType) {
      case 'count_asc': // 数量从少到多
        return sorted.sort((a, b) => a.count - b.count);
      case 'count_desc': // 数量从多到少
        return sorted.sort((a, b) => b.count - a.count);
      case 'oldest': // 入库时间（旧到新）- ID小的在前面
        return sorted.sort((a, b) => a.id - b.id);
      case 'newest': // 入库时间（新到旧）- 默认
      default:
        return sorted.sort((a, b) => b.id - a.id);
    }
  };

  // --- 库存逻辑 ---
  async function addLog(itemName, action, amount) {
    const { data } = await supabase.from('logs').insert([{ item_name: itemName, action, amount: parseInt(amount) }]).select();
    if (data) setLogs([data[0], ...logs]);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newName) return;
    const { data, error } = await supabase.from('inventory').insert([{ name: newName, color: newColor, count: parseInt(newCount), threshold: parseInt(newThreshold) }]).select();
    if (!error) {
      setItems([data[0], ...items]);
      addLog(newName, '新购入库', newCount);
      setNewName(''); setNewCount(1000); setNewThreshold(200);
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
    if (!error) {
      setItems(items.map(item => item.id === id ? { ...item, count: newAmount } : item));
      addLog(name, '消耗使用', changeAmount);
    }
  }

  // --- 作品墙逻辑 ---
  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('beads').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('beads').getPublicUrl(fileName);
      const { data, error: dbError } = await supabase.from('gallery').insert([{ url: publicUrl, description: description || '分享了一个作品' }]).select();
      if (dbError) throw dbError;
      setPosts([data[0], ...posts]);
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function deletePost(id, url) {
    if (!confirm('确定要删除这张作品吗？')) return;
    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (!error) {
      setPosts(posts.filter(p => p.id !== id));
      try {
        const fileName = url.split('/').pop(); 
        await supabase.storage.from('beads').remove([fileName]);
      } catch (err) {}
    }
  }

  async function sendComment(postId) {
    const content = commentInputs[postId];
    if (!content) return;
    const { data, error } = await supabase.from('comments').insert([{ post_id: postId, content }]).select();
    if (!error) {
      const newMap = { ...commentsMap };
      if (!newMap[postId]) newMap[postId] = [];
      newMap[postId].push(data[0]);
      setCommentsMap(newMap);
      setCommentInputs({ ...commentInputs, [postId]: '' }); 
    }
  }

  const totalTypes = items.length;
  const totalBeads = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50 font-sans pb-20">
      <div className="max-w-7xl mx-auto mb-6 bg-indigo-600 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Package className="w-8 h-8" /> 拼豆库存记录</h1>
          <p className="opacity-90 mt-2 text-indigo-100 flex items-center gap-2 text-sm"><Sparkles size={16} /> {greeting}</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-4">
           <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-xl font-bold transition ${activeTab === 'inventory' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-500'}`}>📦 库存管理</button>
           <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 rounded-xl font-bold transition ${activeTab === 'gallery' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-500'}`}>📸 作品墙</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-600" /> 新品入库</h2>
                <form onSubmit={addItem} className="space-y-4">
                  <input type="text" placeholder="名称 (如: 纯黑)" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" value={newName} onChange={e => setNewName(e.target.value)} />
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-1.5 bg-gray-50 flex-1">
                      <input type="color" className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none" value={newColor} onChange={e => setNewColor(e.target.value)} />
                      <span className="text-xs text-gray-500">{newColor}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="数量" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" value={newCount} onChange={e => setNewCount(e.target.value)} />
                    <input type="number" placeholder="预警" className="w-full p-2.5 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl outline-none" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">确认入库</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 gap-2">
                 <h2 className="font-bold text-gray-800">库存列表 ({totalTypes}种)</h2>
                 
                 {/* 新增：排序下拉框 */}
                 <div className="flex items-center gap-2 bg-white p-1 pl-3 rounded-lg border border-gray-200 shadow-sm">
                   <ArrowUpDown size={14} className="text-gray-400" />
                   <select 
                      className="text-sm bg-transparent outline-none text-gray-600 font-medium py-1 pr-2 cursor-pointer"
                      value={sortType}
                      onChange={(e) => setSortType(e.target.value)}
                   >
                     <option value="newest">最新入库 (默认)</option>
                     <option value="oldest">最早入库</option>
                     <option value="count_asc">数量: 从少到多</option>
                     <option value="count_desc">数量: 从多到少</option>
                   </select>
                 </div>
              </div>

              {loading ? <div className="text-center text-gray-400">加载中...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 注意：这里使用 getSortedItems() 获取排序后的数据进行渲染 */}
                  {getSortedItems().map(item => <ItemCard key={item.id} item={item} onDelete={deleteItem} onUpdate={updateStock} />)}
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
                 <div className="p-4 border-b border-gray-100 bg-gray-50"><h2 className="font-bold text-gray-800 flex items-center gap-2"><History className="w-4 h-4" /> 近期动态</h2></div>
                 <div className="max-h-[600px] overflow-y-auto">
                   {logs.map(log => (
                     <div key={log.id} className="p-3 border-b border-gray-50 hover:bg-gray-50 text-sm">
                       <div className="flex justify-between"><span className="font-bold text-gray-700">{log.item_name}</span><span className="text-gray-400 text-xs">{new Date(log.created_at).getMonth()+1}/{new Date(log.created_at).getDate()}</span></div>
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
              <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ImageIcon className="text-indigo-600" /> 分享新作品</h2>
              <div className="flex flex-col gap-4">
                <textarea placeholder="说点什么吧..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" rows="2" value={description} onChange={e => setDescription(e.target.value)}></textarea>
                <div className="flex items-center justify-between">
                  <input type="file" accept="image/*" ref={fileInputRef} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onChange={handleUpload} disabled={uploading} />
                  {uploading && <span className="text-indigo-600 text-sm animate-pulse">上传中...</span>}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {posts.map(post => (
                <div key={post.id} className="relative bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
                  <button 
                    onClick={() => deletePost(post.id, post.url)}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="删除作品"
                  >
                    <Trash2 size={18} />
                  </button>
                  <img src={post.url} alt="作品" className="w-full h-auto object-cover max-h-[500px]" />
                  <div className="p-5">
                    <p className="text-gray-800 text-lg mb-4">{post.description}</p>
                    <div className="text-xs text-gray-400 mb-4 flex items-center gap-1">发布于 {new Date(post.created_at).toLocaleString()}</div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-1"><MessageSquare size={14} /> 评论</h3>
                      <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                        {(commentsMap[post.id] || []).map(c => (
                          <div key={c.id} className="text-sm"><span className="text-gray-800">{c.content}</span></div>
                        ))}
                        {(!commentsMap[post.id] || commentsMap[post.id].length === 0) && <div className="text-gray-400 text-xs">还没有评论，快来抢沙发~</div>}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="夸夸ta..." className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" value={commentInputs[post.id] || ''} onChange={e => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && sendComment(post.id)} />
                        <button onClick={() => sendComment(post.id)} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"><Send size={16} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, onDelete, onUpdate }) {
  const [consumeAmount, setConsumeAmount] = useState('');
  const limit = item.threshold || 200; 
  const isLowStock = item.count < limit;
  const handleUse = (e) => { e.preventDefault(); if (!consumeAmount) return; onUpdate(item.id, item.name, item.count, parseInt(consumeAmount)); setConsumeAmount(''); };
  return (
    <div className={`relative bg-white p-5 rounded-2xl shadow-sm border transition-all hover:shadow-lg ${isLowStock ? 'border-red-200 bg-red-50/50' : 'border-gray-100'}`}>
      <button onClick={() => onDelete(item.id, item.name)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl shadow-sm border ring-4 ring-gray-50" style={{ backgroundColor: item.color }}></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-lg truncate">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-mono font-bold ${isLowStock ? 'text-red-500' : 'text-gray-700'}`}>{item.count}</span>
            {isLowStock ? <span className="text-[10px] bg-red-100 text-red-600 px-2 rounded-full border border-red-200">低于 {limit}</span> : <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 rounded">安全线 {limit}</span>}
          </div>
        </div>
      </div>
      <form onSubmit={handleUse} className="relative flex gap-2">
        <input type="number" placeholder="用量" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" value={consumeAmount} onChange={e => setConsumeAmount(e.target.value)} />
        <button type="submit" disabled={!consumeAmount} className="bg-gray-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50">登记</button>
      </form>
    </div>
  );
}

export default App;