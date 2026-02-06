import React, { useState, useEffect } from 'react';
import ServerDetail from './components/ServerDetail';
import AssetScrapManagement from './components/AssetScrapManagement';
import PartsManagement from './components/PartsManagement';
import PartReceiptManagement from './components/PartReceiptManagement';
import ServerReceiptManagement from './components/ServerReceiptManagement';
import LoginForm from './components/LoginForm';
import UserManagement from './components/UserManagement';
import RoleManagement from './components/RoleManagement';
import ADConfigManagement from './components/ADConfigManagement';
import { serverAPI, assetAPI } from './services/api';
import './App.css';

function App() {
  // 登录状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [servers, setServers] = useState([]);
  const [error, setError] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [activeMenu, setActiveMenu] = useState('server-receipt'); // 默认激活：服务器入库
  const [racks, setRacks] = useState([]); // 机柜列表
  const [selectedRack, setSelectedRack] = useState(null); // 选中的机柜
  // 左侧菜单展开状态（按您提供的结构）
  const [isAssetOpen, setIsAssetOpen] = useState(true);      // 资产管理
  const [isAssetInOpen, setIsAssetInOpen] = useState(true);  // 资产入库
  const [isAssetServerOpen, setIsAssetServerOpen] = useState(false); // 服务器资产
  const [isIdcOpen, setIsIdcOpen] = useState(false);         // 机房管理
  const [isScrapOpen, setIsScrapOpen] = useState(false);     // 资产报废
  const [isUserOpen, setIsUserOpen] = useState(false);      // 用户管理

  // 服务器搜索与筛选
  const [serverSearch, setServerSearch] = useState('');
  const [serverStatusFilter, setServerStatusFilter] = useState('');

  // 服务器历史记录
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [serverHistoryData, setServerHistoryData] = useState([]);
  const [historyServerAssetCode, setHistoryServerAssetCode] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 服务器关联配件弹窗
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [serverPartsData, setServerPartsData] = useState([]);
  const [partsServerInfo, setPartsServerInfo] = useState(null);
  const [partsLoading, setPartsLoading] = useState(false);

  // 服务器表单状态（与服务器模块字段一致；asset_code 仅编辑时显示，添加时自动生成）
  const [serverFormData, setServerFormData] = useState({
    asset_code: '',
    serial_number: '',
    hostname: '',
    ip_address: '',
    mac_address: '',
    brand: '',
    model: '',
    bmc_ip: '',
    bmc_username: '',
    bmc_password: '',
    user_person: '',
    system_username: '',
    system_password: '',
    u_position: '',
    u_height: '',
    status: 'offline',
    location: '',
    department: '',
    contract_number: '',
    purchase_date: '',
    warranty_expire: '',
    remark: '',
    cpu_model: '',
    cpu_cores: 4,
    memory_gb: 16,
    disk_info: ''
  });

  // 获取服务器列表
  const fetchServers = async () => {
    try {
      setLoading(true);
      // 使用真实API获取服务器列表
      const data = await serverAPI.getServers();
      setServers(data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching servers from API:', err);
      setError('无法连接到服务器，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 检查本地存储的登录状态
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    
    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setIsAuthenticated(true);
        setUser(userData);
      } catch (e) {
        console.error('解析用户信息失败:', e);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  // 监听登出事件
  useEffect(() => {
    const handleLogout = () => {
      handleLogoutClick();
    };
    
    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  // 处理登录成功（与项目介绍一致：登录后保存 token，再进入主界面）
  const handleLogin = (loginData) => {
    if (loginData.token) {
      localStorage.setItem('auth_token', loginData.token);
      localStorage.setItem('auth_user', JSON.stringify({ username: loginData.username }));
    }
    setIsAuthenticated(true);
    setUser({ username: loginData.username });
    setLoading(false);
  };

  // 处理登出
  const handleLogoutClick = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  // 获取机柜列表（模拟数据）
  const fetchRacks = () => {
    // 模拟机柜数据
    const rackList = [
      { id: 1, name: 'A机柜', totalU: 42 },
      { id: 2, name: 'B机柜', totalU: 42 },
      { id: 3, name: 'C机柜', totalU: 42 }
    ];
    setRacks(rackList);
  };

  // 选择机柜
  const selectRack = (rack) => {
    setSelectedRack(rack);
    setActiveMenu('rack-detail');
  };

  // 返回机柜列表（服务器U位）
  const backToRackList = () => {
    setSelectedRack(null);
    setActiveMenu('server-u');
  };

  // 切换资产管理展开
  const toggleAsset = () => {
    setIsAssetOpen(!isAssetOpen);
  };
  const toggleAssetIn = () => {
    setIsAssetInOpen(!isAssetInOpen);
  };
  const toggleAssetServer = () => {
    setIsAssetServerOpen(!isAssetServerOpen);
  };
  const toggleIdc = () => {
    setIsIdcOpen(!isIdcOpen);
  };
  const toggleScrap = () => {
    setIsScrapOpen(!isScrapOpen);
  };
  const toggleUser = () => {
    setIsUserOpen(!isUserOpen);
  };

  // 开机操作
  const powerOnServer = async (serverId) => {
    try {
      // 使用真实API执行开机操作
      const result = await serverAPI.powerOn(serverId);
      
      // 更新本地状态
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'online' } 
            : server
        )
      );
      
      alert(result.data.message || `服务器 ${serverId} 已开机`);
    } catch (err) {
      console.error('Error powering on server:', err);
      alert('开机操作失败: ' + (err.message || '未知错误'));
    }
  };

  // 关机操作
  const powerOffServer = async (serverId) => {
    try {
      // 使用真实API执行关机操作
      const result = await serverAPI.powerOff(serverId);
      
      // 更新本地状态
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'offline' } 
            : server
        )
      );
      
      alert(result.data.message || `服务器 ${serverId} 已关机`);
    } catch (err) {
      console.error('Error powering off server:', err);
      alert('关机操作失败: ' + (err.message || '未知错误'));
    }
  };

  // 重启操作
  const rebootServer = async (serverId) => {
    try {
      // 使用真实API执行重启操作
      const result = await serverAPI.reboot(serverId);
      
      // 更新本地状态
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'maintenance' } 
            : server
        )
      );
      
      alert(result.data.message || `服务器 ${serverId} 正在重启`);
    } catch (err) {
      console.error('Error rebooting server:', err);
      alert('重启操作失败: ' + (err.message || '未知错误'));
    }
  };

  // 查看服务器历史记录
  const viewServerHistory = async (serverId, assetCode) => {
    try {
      setHistoryLoading(true);
      setHistoryServerAssetCode(assetCode || '-');
      setShowHistoryModal(true);
      
      const result = await serverAPI.getServerHistory(serverId);
      setServerHistoryData(result.data || []);
    } catch (err) {
      console.error('Error fetching server history:', err);
      alert('获取历史记录失败: ' + (err.message || '未知错误'));
      setServerHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 关闭历史记录弹窗
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setServerHistoryData([]);
    setHistoryServerAssetCode(null);
  };

  // 查看服务器关联配件
  const viewServerParts = async (server) => {
    if (!server.serial_number) {
      alert('该服务器无序列号，无法查看关联配件');
      return;
    }
    try {
      setPartsLoading(true);
      setPartsServerInfo({ asset_code: server.asset_code, serial_number: server.serial_number });
      setShowPartsModal(true);
      
      const result = await assetAPI.getAssetsByServerSN(server.serial_number);
      setServerPartsData(result.data || []);
    } catch (err) {
      console.error('Error fetching server parts:', err);
      alert('获取关联配件失败: ' + (err.message || '未知错误'));
      setServerPartsData([]);
    } finally {
      setPartsLoading(false);
    }
  };

  // 关闭配件弹窗
  const closePartsModal = () => {
    setShowPartsModal(false);
    setServerPartsData([]);
    setPartsServerInfo(null);
  };

  // 配件状态文本
  const partStatusText = (s) => {
    const map = {
      in_storage: '在库',
      in_use: '使用中',
      idle: '空闲',
      pending_scrap: '待报废',
      scrapped: '已报废'
    };
    return map[s] || s;
  };

  // 报废服务器
  const scrapServer = async (serverId) => {
    if (!window.confirm('确定要将此服务器标记为报废吗？')) return;
    try {
      await serverAPI.scrapServer(serverId);
      alert('已标记为待报废');
      fetchServers();
    } catch (err) {
      console.error('报废操作失败:', err);
      alert('报废操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 查看服务器详情
  const viewServerDetail = (serverId) => {
    setSelectedServerId(serverId);
  };

  // 关闭服务器详情
  const closeServerDetail = () => {
    setSelectedServerId(null);
  };

  // 打开创建服务器表单
  const openCreateServerForm = () => {
    setEditingServer(null);
    setServerFormData({
      asset_code: '',
      serial_number: '',
      hostname: '',
      ip_address: '',
      mac_address: '',
      brand: '',
      model: '',
      bmc_ip: '',
      bmc_username: '',
      bmc_password: '',
      user_person: '',
      system_username: '',
      system_password: '',
      u_position: '',
      u_height: '',
      status: 'offline',
      location: '',
      department: '',
      contract_number: '',
      purchase_date: '',
      warranty_expire: '',
      remark: '',
      cpu_model: '',
      cpu_cores: 4,
      memory_gb: 16,
      disk_info: ''
    });
    setShowCreateForm(true);
  };

  // 打开编辑服务器表单
  const openEditServerForm = (server) => {
    setEditingServer(server);
    const fmtDate = (d) => (d ? (d.slice ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10)) : '');
    const displayAssetCode = server.asset_code && String(server.asset_code).startsWith('SY-SR-') ? server.asset_code : (server.id != null ? `SY-SR-${String(server.id).padStart(4, '0')}` : '');
    setServerFormData({
      asset_code: displayAssetCode,
      serial_number: server.serial_number || '',
      hostname: server.hostname || '',
      ip_address: server.ip_address || '',
      mac_address: server.mac_address || '',
      brand: server.brand || '',
      model: server.model || '',
      bmc_ip: server.bmc_ip || '',
      bmc_username: server.bmc_username || '',
      bmc_password: server.bmc_password || '',
      user_person: server.user_person || '',
      system_username: server.system_username || '',
      system_password: server.system_password || '',
      u_position: server.u_position || '',
      u_height: server.u_height ?? '',
      status: server.status || 'offline',
      location: server.location || '',
      department: server.department || '',
      contract_number: server.contract_number || '',
      purchase_date: fmtDate(server.purchase_date),
      warranty_expire: fmtDate(server.warranty_expire),
      remark: server.remark || '',
      cpu_model: server.cpu_model || '',
      cpu_cores: server.cpu_cores ?? 4,
      memory_gb: server.memory_gb ?? 16,
      disk_info: server.disk_info || ''
    });
    setShowCreateForm(true);
  };

  // 关闭服务器表单
  const closeServerForm = () => {
    setShowCreateForm(false);
    setEditingServer(null);
  };

  // 处理服务器表单输入变化
  const handleServerInputChange = (e) => {
    const { name, value } = e.target;
    const numFields = ['cpu_cores', 'memory_gb', 'u_height'];
    setServerFormData(prev => ({
      ...prev,
      [name]: numFields.includes(name) ? (value === '' ? '' : parseInt(value) || 0) : value
    }));
  };

  // 提交服务器表单（与后端 ServerCreate/ServerUpdate 字段一致，空字符串保留以便后端更新）
  const handleServerSubmit = async (e) => {
    e.preventDefault();
    const numKeys = ['cpu_cores', 'memory_gb', 'u_height'];
    const payload = { ...serverFormData };
    delete payload.asset_code; // 资产编码由后端自动生成或只读，不提交
    numKeys.forEach(k => {
      if (payload[k] === '' || payload[k] == null) payload[k] = null;
      else if (typeof payload[k] !== 'number') payload[k] = parseInt(payload[k], 10);
    });
    if (payload.purchase_date === '') payload.purchase_date = null;
    if (payload.warranty_expire === '') payload.warranty_expire = null;
    try {
      if (editingServer) {
        await serverAPI.updateServer(editingServer.id, payload);
        alert('服务器更新成功');
        closeServerForm();
        fetchServers();
      } else {
        const res = await serverAPI.createServer(payload);
        const created = res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data;
        if (created && created.id != null) {
          if (!created.asset_code || !String(created.asset_code).startsWith('SY-SR-')) {
            created.asset_code = `SY-SR-${String(created.id).padStart(4, '0')}`;
          }
          setServers(prev => [created, ...prev]);
        }
        alert('服务器创建成功');
        closeServerForm();
        fetchServers();
      }
    } catch (err) {
      console.error('Error saving server:', err);
      alert('保存失败: ' + (err.message || '未知错误'));
    }
  };

  // 删除服务器（移至回收站）
  const deleteServer = async (serverId) => {
    if (!window.confirm('确定要删除这台服务器吗？服务器将被移到回收站，可在资产报废模块中恢复。')) {
      return;
    }
    
    try {
      await serverAPI.deleteServerToRecycle(serverId);
      alert('服务器已移到回收站');
      fetchServers();
    } catch (err) {
      console.error('Error deleting server:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message || '未知错误'));
    }
  };

  // 页面加载时获取服务器列表和资产列表（仅在已登录时）
  useEffect(() => {
    if (isAuthenticated) {
      fetchServers();
      fetchRacks();
    }
  }, [isAuthenticated]);

  // 监听服务器数据变化事件（入库/删除入库单时触发）
  useEffect(() => {
    const handleServerDataChanged = () => {
      console.log('服务器数据已变化，自动刷新列表');
      fetchServers();
    };
    window.addEventListener('serverDataChanged', handleServerDataChanged);
    return () => {
      window.removeEventListener('serverDataChanged', handleServerDataChanged);
    };
  }, []);

  // 根据当前激活菜单自动展开对应父级
  useEffect(() => {
    if (['server-receipt', 'part-receipt'].includes(activeMenu)) {
      setIsAssetOpen(true);
      setIsAssetInOpen(true);
    }
    if (['servers', 'parts'].includes(activeMenu)) {
      setIsAssetOpen(true);
      setIsAssetServerOpen(true);
    }
    if (['server-u', 'server-power'].includes(activeMenu)) setIsIdcOpen(true);
    if (['scrap-pending', 'scrap-done', 'scrap-recycle'].includes(activeMenu)) setIsScrapOpen(true);
    if (['users', 'roles', 'ldap'].includes(activeMenu)) setIsUserOpen(true);
  }, [activeMenu]);

  // 与项目介绍一致：未登录时显示登录页，登录后显示主界面（含资产管理、入库单、用户管理等）
  if (!isAuthenticated) {
    return (
      <div className="App">
        {loading ? (
          <div className="login-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <p>加载中...</p>
          </div>
        ) : (
          <LoginForm onLogin={handleLogin} />
        )}
      </div>
    );
  }

  return (
    <div className="App" style={{ position: 'relative', zIndex: 1 }}>
      <header className="App-header">
        <h1>IDC资产管理系统</h1>
        <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span>欢迎, {user?.username || '用户'}</span>
          <button className="btn-logout" onClick={handleLogoutClick}>
            退出登录
          </button>
        </div>
      </header>
      
      <div className="App-layout">
        {/* 左侧菜单栏 - 按您提供的结构：资产管理 / 机房管理 / 资产报废 / 用户管理 */}
        <nav className="sidebar">
          <ul className="sidebar-menu">
            {/* 资产管理 */}
            <li className={`menu-group ${isAssetOpen ? 'open' : ''}`}>
              <div className="menu-item menu-parent" onClick={toggleAsset}>
                <span className="menu-label">资产管理</span>
                <span className="menu-arrow">{isAssetOpen ? '▼' : '▶'}</span>
              </div>
              {isAssetOpen && (
                <ul className="submenu">
                  {/* 资产入库 */}
                  <li className={`menu-group level2 ${isAssetInOpen ? 'open' : ''}`}>
                    <div className="menu-item menu-parent" onClick={(e) => { e.stopPropagation(); toggleAssetIn(); }}>
                      <span className="menu-label">资产入库</span>
                      <span className="menu-arrow">{isAssetInOpen ? '▼' : '▶'}</span>
                    </div>
                    {isAssetInOpen && (
                      <ul className="submenu submenu2">
                        <li className={activeMenu === 'server-receipt' ? 'active' : ''} onClick={() => setActiveMenu('server-receipt')}>
                          <span>服务器入库</span>
                        </li>
                        <li className={activeMenu === 'part-receipt' ? 'active' : ''} onClick={() => setActiveMenu('part-receipt')}>
                          <span>配件入库</span>
                        </li>
                      </ul>
                    )}
                  </li>
                  {/* 服务器资产 */}
                  <li className={`menu-group level2 ${isAssetServerOpen ? 'open' : ''}`}>
                    <div className="menu-item menu-parent" onClick={(e) => { e.stopPropagation(); toggleAssetServer(); }}>
                      <span className="menu-label">服务器资产</span>
                      <span className="menu-arrow">{isAssetServerOpen ? '▼' : '▶'}</span>
                    </div>
                    {isAssetServerOpen && (
                      <ul className="submenu submenu2">
                        <li className={activeMenu === 'servers' ? 'active' : ''} onClick={() => setActiveMenu('servers')}>
                          <span>服务器</span>
                        </li>
                        <li className={activeMenu === 'parts' ? 'active' : ''} onClick={() => setActiveMenu('parts')}>
                          <span>配件</span>
                        </li>
                      </ul>
                    )}
                  </li>
                </ul>
              )}
            </li>

            {/* 机房管理 */}
            <li className={`menu-group ${isIdcOpen ? 'open' : ''}`}>
              <div className="menu-item menu-parent" onClick={toggleIdc}>
                <span className="menu-label">机房管理</span>
                <span className="menu-arrow">{isIdcOpen ? '▼' : '▶'}</span>
              </div>
              {isIdcOpen && (
                <ul className="submenu">
                  <li className={activeMenu === 'server-u' ? 'active' : ''} onClick={() => setActiveMenu('server-u')}>
                    <span>服务器U位</span>
                  </li>
                  <li className={activeMenu === 'server-power' ? 'active' : ''} onClick={() => setActiveMenu('server-power')}>
                    <span>服务器功耗</span>
                  </li>
                </ul>
              )}
            </li>

            {/* 资产报废 */}
            <li className={`menu-group ${isScrapOpen ? 'open' : ''}`}>
              <div className="menu-item menu-parent" onClick={toggleScrap}>
                <span className="menu-label">资产报废</span>
                <span className="menu-arrow">{isScrapOpen ? '▼' : '▶'}</span>
              </div>
              {isScrapOpen && (
                <ul className="submenu">
                  <li className={activeMenu === 'scrap-pending' ? 'active' : ''} onClick={() => setActiveMenu('scrap-pending')}>
                    <span>资产待报废</span>
                  </li>
                  <li className={activeMenu === 'scrap-done' ? 'active' : ''} onClick={() => setActiveMenu('scrap-done')}>
                    <span>报废资产</span>
                  </li>
                  <li className={activeMenu === 'scrap-recycle' ? 'active' : ''} onClick={() => setActiveMenu('scrap-recycle')}>
                    <span>删除回收站</span>
                  </li>
                </ul>
              )}
            </li>

            {/* 用户管理 */}
            <li className={`menu-group ${isUserOpen ? 'open' : ''}`}>
              <div className="menu-item menu-parent" onClick={toggleUser}>
                <span className="menu-label">用户管理</span>
                <span className="menu-arrow">{isUserOpen ? '▼' : '▶'}</span>
              </div>
              {isUserOpen && (
                <ul className="submenu">
                  <li className={activeMenu === 'users' ? 'active' : ''} onClick={() => setActiveMenu('users')}>
                    <span>用户</span>
                  </li>
                  <li className={activeMenu === 'roles' ? 'active' : ''} onClick={() => setActiveMenu('roles')}>
                    <span>角色管理</span>
                  </li>
                  <li className={activeMenu === 'ldap' ? 'active' : ''} onClick={() => setActiveMenu('ldap')}>
                    <span>LDAP配置</span>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
        
        {/* 主内容区域 */}
        <main className="App-main">
          {/* 资产入库：服务器入库 / 配件入库 */}
          {activeMenu === 'server-receipt' && <ServerReceiptManagement />}
          {activeMenu === 'part-receipt' && <PartReceiptManagement />}

          {/* 服务器资产：服务器 / 配件 */}
          {activeMenu === 'servers' && (
            <section className="dashboard">
              <div className="section-header">
                <h2>服务器概览</h2>
                <div className="header-actions">
                  <button className="btn-refresh" onClick={fetchServers}>刷新</button>
                </div>
              </div>
              
              {/* 搜索与筛选 */}
              <div className="filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="搜索：资产编码/SN/IP/使用人/品牌/型号"
                  value={serverSearch}
                  onChange={(e) => setServerSearch(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', minWidth: '280px' }}
                />
                <select
                  value={serverStatusFilter}
                  onChange={(e) => setServerStatusFilter(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                >
                  <option value="">全部状态</option>
                  <option value="online">使用中</option>
                  <option value="offline">空闲</option>
                  <option value="maintenance">在库</option>
                </select>
              </div>

              {loading ? (
                <p>加载中...</p>
              ) : error ? (
                <div className="error-container">
                  <p className="error">错误: {error}</p>
                  <button className="btn-primary" onClick={fetchServers}>重试</button>
                </div>
              ) : (
                <div className="servers-list">
                  <table>
                    <thead>
                      <tr>
                        <th>资产编码</th>
                        <th>序列号(SN)</th>
                        <th>品牌</th>
                        <th>型号</th>
                        <th>系统IP</th>
                        <th>系统账号</th>
                        <th>系统密码</th>
                        <th>使用人</th>
                        <th>U位</th>
                        <th>状态</th>
                        <th>位置</th>
                        <th>部门</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servers
                        .filter(server => {
                          const q = serverSearch.toLowerCase();
                          if (q) {
                            const code = server.asset_code || '';
                            const sn = server.serial_number || '';
                            const ip = server.ip_address || '';
                            const user = server.user_person || '';
                            const brand = server.brand || '';
                            const model = server.model || '';
                            const match = [code, sn, ip, user, brand, model].some(v => v.toLowerCase().includes(q));
                            if (!match) return false;
                          }
                          if (serverStatusFilter && server.status !== serverStatusFilter) return false;
                          return true;
                        })
                        .map(server => (
                        <tr key={server.id}>
                          <td>{server.asset_code && String(server.asset_code).startsWith('SY-SR-') ? server.asset_code : (server.id != null ? `SY-SR-${String(server.id).padStart(4, '0')}` : '-')}</td>
                          <td>{server.serial_number || '-'}</td>
                          <td>{server.brand || '-'}</td>
                          <td>{server.model || '-'}</td>
                          <td>{server.ip_address || '-'}</td>
                          <td>{server.system_username || '-'}</td>
                          <td>{server.system_password || '-'}</td>
                          <td>{server.user_person || '-'}</td>
                          <td>{server.u_position || '-'}</td>
                          <td>
                            <span className={`status ${server.status}`}>
                              {server.status === 'online' ? '使用中' : 
                               server.status === 'offline' ? '空闲' : 
                               server.status === 'maintenance' ? '在库' :
                               server.status === 'pending_scrap' ? '待报废' :
                               server.status === 'scrapped' ? '已报废' : server.status}
                            </span>
                          </td>
                          <td>{server.location || '-'}</td>
                          <td>{server.department || '-'}</td>
                          <td>
                            <button className="btn-primary" onClick={() => viewServerDetail(server.id)}>详情</button>
                            <button className="btn-success" onClick={() => viewServerParts(server)}>配件</button>
                            <button className="btn-secondary" onClick={() => openEditServerForm(server)}>编辑</button>
                            <button className="btn-info" onClick={() => viewServerHistory(server.id, server.asset_code)}>历史</button>
                            <button className="btn-warning" onClick={() => scrapServer(server.id)}>报废</button>
                            <button className="btn-danger" onClick={() => deleteServer(server.id)}>删除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {activeMenu === 'parts' && <PartsManagement />}

          {/* 机房管理：服务器U位 / 服务器功耗 */}
          {activeMenu === 'server-u' && (
            <section className="rack-management">
              <div className="section-header">
                <h2>服务器U位</h2>
                <div className="header-actions">
                  <button className="btn-primary">添加机柜</button>
                </div>
              </div>
              <div className="racks-grid">
                {racks.map(rack => (
                  <div key={rack.id} className="rack-card" onClick={() => selectRack(rack)}>
                    <h3>{rack.name}</h3>
                    <p>总U数: {rack.totalU}</p>
                    <button className="btn-primary">查看详情</button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {activeMenu === 'server-power' && (
            <section className="placeholder">
              <h2>服务器功耗</h2>
              <p>此功能正在开发中...</p>
            </section>
          )}

          {/* 机柜详情（从服务器U位进入） */}
          {activeMenu === 'rack-detail' && selectedRack && (
            <section className="rack-detail">
              <div className="section-header">
                <h2>{selectedRack.name} - 机柜详情</h2>
                <div className="header-actions">
                  <button className="btn-secondary" onClick={backToRackList}>返回</button>
                </div>
              </div>
              <div className="rack-visualization">
                <h3>42U机柜布局</h3>
                <div className="rack-u-spaces">
                  {[...Array(selectedRack.totalU)].map((_, index) => (
                    <div key={index} className="u-space">U{index + 1}</div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 资产报废：资产待报废 / 报废资产 / 删除回收站 */}
          {['scrap-pending', 'scrap-done', 'scrap-recycle'].includes(activeMenu) && (
            <AssetScrapManagement
              initialTab={activeMenu === 'scrap-pending' ? 'pending' : activeMenu === 'scrap-done' ? 'scrapped' : 'recycle'}
            />
          )}

          {/* 用户管理：用户 / 角色管理 / LDAP配置 */}
          {activeMenu === 'users' && <UserManagement />}
          {activeMenu === 'roles' && <RoleManagement />}
          {activeMenu === 'ldap' && <ADConfigManagement />}
        </main>
      </div>

      {/* 服务器详情模态框 */}
      {selectedServerId && (
        <ServerDetail 
          serverId={selectedServerId} 
          onClose={closeServerDetail} 
        />
      )}
      
      {/* 创建/编辑服务器表单模态框（OA 风格） */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-form-server oa-form">
            <div className="modal-header server-detail-header">
              <div className="server-detail-title-wrap">
                <h2>服务器资产</h2>
                <p className="server-detail-subtitle">{editingServer ? `编辑：${serverFormData.serial_number || serverFormData.ip_address || '未命名'}` : '新增服务器'}</p>
              </div>
              <button type="button" className="btn-close" onClick={closeServerForm} aria-label="关闭">×</button>
            </div>
            <div className="modal-body server-detail-body">
              <form onSubmit={handleServerSubmit} className="oa-form-form">
                <section className="form-section">
                  <h3 className="detail-section-title">基础信息</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      {editingServer ? (
                        <div className="form-group">
                          <label>资产编码</label>
                          <input type="text" value={serverFormData.asset_code} readOnly disabled className="readonly-input" />
                        </div>
                      ) : (
                        <div className="form-group">
                          <label>资产编码</label>
                          <input type="text" readOnly disabled className="readonly-input" placeholder="自动生成（SY-SR-XXXX）" />
                        </div>
                      )}
                      <div className="form-group">
                        <label htmlFor="serial_number">序列号(SN)</label>
                        <input type="text" id="serial_number" name="serial_number" value={serverFormData.serial_number} onChange={handleServerInputChange} placeholder="选填" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="brand">品牌</label>
                        <input type="text" id="brand" name="brand" value={serverFormData.brand} onChange={handleServerInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="model">型号</label>
                        <input type="text" id="model" name="model" value={serverFormData.model} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="cpu_model">CPU型号</label>
                        <input type="text" id="cpu_model" name="cpu_model" value={serverFormData.cpu_model} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="cpu_cores">CPU核心数</label>
                        <input type="number" id="cpu_cores" name="cpu_cores" min="1" value={serverFormData.cpu_cores} onChange={handleServerInputChange} />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">网络信息</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="ip_address">系统IP</label>
                        <input type="text" id="ip_address" name="ip_address" value={serverFormData.ip_address} onChange={handleServerInputChange} placeholder="如 192.168.1.10" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="system_username">系统账号</label>
                        <input type="text" id="system_username" name="system_username" value={serverFormData.system_username} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="system_password">系统密码</label>
                        <input type="text" id="system_password" name="system_password" value={serverFormData.system_password} onChange={handleServerInputChange} placeholder="明文可见" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="bmc_ip">BMC IP</label>
                        <input type="text" id="bmc_ip" name="bmc_ip" value={serverFormData.bmc_ip} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="bmc_username">BMC账号</label>
                        <input type="text" id="bmc_username" name="bmc_username" value={serverFormData.bmc_username} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="bmc_password">BMC密码</label>
                        <input type="text" id="bmc_password" name="bmc_password" value={serverFormData.bmc_password} onChange={handleServerInputChange} placeholder="明文可见" />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">使用人 / U位 / 位置 / 部门</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="user_person">使用人</label>
                        <input type="text" id="user_person" name="user_person" value={serverFormData.user_person} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="u_position">U位</label>
                        <input type="text" id="u_position" name="u_position" value={serverFormData.u_position} onChange={handleServerInputChange} placeholder="如 A柜-12" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="u_height">U高度</label>
                        <input type="number" id="u_height" name="u_height" min="1" value={serverFormData.u_height} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="location">位置</label>
                        <input type="text" id="location" name="location" value={serverFormData.location} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="department">部门</label>
                        <input type="text" id="department" name="department" value={serverFormData.department} onChange={handleServerInputChange} />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">状态 / 合同与日期</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="status">状态</label>
                        <select id="status" name="status" value={serverFormData.status} onChange={handleServerInputChange}>
                          <option value="online">使用中</option>
                          <option value="offline">空闲</option>
                          <option value="maintenance">在库</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="contract_number">合同号</label>
                        <input type="text" id="contract_number" name="contract_number" value={serverFormData.contract_number} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="purchase_date">采购日期</label>
                        <input type="date" id="purchase_date" name="purchase_date" value={serverFormData.purchase_date} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="warranty_expire">保修到期</label>
                        <input type="date" id="warranty_expire" name="warranty_expire" value={serverFormData.warranty_expire} onChange={handleServerInputChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="remark">备注</label>
                      <textarea id="remark" name="remark" value={serverFormData.remark} onChange={handleServerInputChange} rows={2} placeholder="选填" />
                    </div>
                  </div>
                </section>
                <div className="form-actions oa-form-actions">
                  <button type="button" className="btn-secondary" onClick={closeServerForm}>取消</button>
                  <button type="submit" className="btn-primary">{editingServer ? '更新' : '创建'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 服务器历史记录弹窗 */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={closeHistoryModal}>
          <div className="modal-content history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>服务器历史记录 ({historyServerAssetCode})</h2>
              <button className="close-btn" onClick={closeHistoryModal}>&times;</button>
            </div>
            <div className="modal-body">
              {historyLoading ? (
                <div className="loading-state">加载中...</div>
              ) : serverHistoryData.length === 0 ? (
                <div className="empty-state">暂无历史记录</div>
              ) : (
                <table className="data-table history-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>操作类型</th>
                      <th>操作人</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serverHistoryData.map(record => (
                      <tr key={record.id}>
                        <td>{record.date ? new Date(record.date).toLocaleString('zh-CN') : '-'}</td>
                        <td>{record.action || '-'}</td>
                        <td>{record.operator || '-'}</td>
                        <td className="history-remark">{record.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 服务器关联配件弹窗 */}
      {showPartsModal && (
        <div className="modal-overlay" onClick={closePartsModal}>
          <div className="modal-content history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>关联配件 ({partsServerInfo?.asset_code || partsServerInfo?.serial_number})</h2>
              <button className="close-btn" onClick={closePartsModal}>&times;</button>
            </div>
            <div className="modal-body">
              {partsLoading ? (
                <div className="loading-state">加载中...</div>
              ) : serverPartsData.length === 0 ? (
                <div className="empty-state">暂无关联配件</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>资产编码</th>
                      <th>SN</th>
                      <th>类型</th>
                      <th>品牌</th>
                      <th>型号</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serverPartsData.map(part => (
                      <tr key={part.id}>
                        <td>{part.asset_code || '-'}</td>
                        <td>{part.sn || '-'}</td>
                        <td>{part.part_type || '-'}</td>
                        <td>{part.brand || '-'}</td>
                        <td>{part.model || '-'}</td>
                        <td><span className={`status ${part.status}`}>{partStatusText(part.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;