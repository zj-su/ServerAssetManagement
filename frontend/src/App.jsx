import React, { useState, useEffect } from 'react';
import ServerDetail from './components/ServerDetail';
import AssetManagement from './components/AssetManagement';
import AssetScrapManagement from './components/AssetScrapManagement';
import PartsManagement from './components/PartsManagement';
import PartReceiptManagement from './components/PartReceiptManagement';
import ServerReceiptManagement from './components/ServerReceiptManagement';
import LoginForm from './components/LoginForm';
import UserManagement from './components/UserManagement';
import ADConfigManagement from './components/ADConfigManagement';
import { serverAPI } from './services/api';
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
  const [activeMenu, setActiveMenu] = useState('assets'); // 默认激活资产管理菜单
  const [racks, setRacks] = useState([]); // 机柜列表
  const [selectedRack, setSelectedRack] = useState(null); // 选中的机柜
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false); // 服务器管理菜单是否展开
  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false); // 资产管理菜单是否展开
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false); // 入库管理菜单是否展开

  // 服务器表单状态
  const [serverFormData, setServerFormData] = useState({
    hostname: '',
    ip_address: '',
    mac_address: '',
    bmc_ip: '',
    cpu_model: '',
    cpu_cores: 4,
    memory_gb: 16,
    disk_info: '',
    status: 'offline'
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

  // 返回机柜列表
  const backToRackList = () => {
    setSelectedRack(null);
    setActiveMenu('racks');
  };

  // 切换服务器管理菜单展开状态
  const toggleServerMenu = () => {
    setIsServerMenuOpen(!isServerMenuOpen);
    if (activeMenu !== 'servers' && activeMenu !== 'racks' && activeMenu !== 'rack-detail') {
      setActiveMenu('servers');
    }
  };

  // 切换入库管理菜单展开状态（入库 - 配件/服务器入库单）
  const toggleReceiptMenu = () => {
    setIsReceiptMenuOpen(!isReceiptMenuOpen);
    if (activeMenu !== 'part-receipt' && activeMenu !== 'server-receipt') {
      setActiveMenu('part-receipt');
    }
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
      hostname: '',
      ip_address: '',
      mac_address: '',
      bmc_ip: '',
      cpu_model: '',
      cpu_cores: 4,
      memory_gb: 16,
      disk_info: '',
      status: 'offline'
    });
    setShowCreateForm(true);
  };

  // 打开编辑服务器表单
  const openEditServerForm = (server) => {
    setEditingServer(server);
    setServerFormData({
      hostname: server.hostname || '',
      ip_address: server.ip_address || '',
      mac_address: server.mac_address || '',
      bmc_ip: server.bmc_ip || '',
      cpu_model: server.cpu_model || '',
      cpu_cores: server.cpu_cores || 4,
      memory_gb: server.memory_gb || 16,
      disk_info: server.disk_info || '',
      status: server.status || 'offline'
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
    setServerFormData(prev => ({
      ...prev,
      [name]: name === 'cpu_cores' || name === 'memory_gb' ? parseInt(value) || 0 : value
    }));
  };

  // 提交服务器表单
  const handleServerSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingServer) {
        // 更新服务器
        const response = await serverAPI.updateServer(editingServer.id, serverFormData);
        alert('服务器更新成功');
      } else {
        // 创建服务器
        const response = await serverAPI.createServer(serverFormData);
        alert('服务器创建成功');
      }
      
      // 关闭表单并刷新列表
      closeServerForm();
      fetchServers();
    } catch (err) {
      console.error('Error saving server:', err);
      alert('保存失败: ' + (err.message || '未知错误'));
    }
  };

  // 删除服务器
  const deleteServer = async (serverId) => {
    if (!window.confirm('确定要删除这台服务器吗？')) {
      return;
    }
    
    try {
      await serverAPI.deleteServer(serverId);
      alert('服务器删除成功');
      fetchServers();
    } catch (err) {
      console.error('Error deleting server:', err);
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  // 页面加载时获取服务器列表和资产列表（仅在已登录时）
  useEffect(() => {
    if (isAuthenticated) {
      fetchServers();
      fetchRacks();
    }
  }, [isAuthenticated]);

  // 当切换到入库相关页面时，自动展开入库管理子菜单
  useEffect(() => {
    if (activeMenu === 'part-receipt' || activeMenu === 'server-receipt') {
      setIsReceiptMenuOpen(true);
    }
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
        {/* 左侧菜单栏 - 与项目介绍一致：资产管理、报废、入库、服务器、用户、AD域 */}
        <nav className="sidebar">
          <ul>
            <li className={activeMenu === 'assets' ? 'active' : ''} onClick={() => setActiveMenu('assets')}>
              <span>资产管理</span>
            </li>
            <li className={activeMenu === 'asset-scrap' ? 'active' : ''} onClick={() => setActiveMenu('asset-scrap')}>
              <span>报废管理</span>
            </li>
            <li className={activeMenu === 'parts' ? 'active' : ''} onClick={() => setActiveMenu('parts')}>
              <span>配件管理</span>
            </li>
            <li className={activeMenu === 'part-receipt' || activeMenu === 'server-receipt' ? 'active' : ''} onClick={toggleReceiptMenu}>
              <span>入库管理</span>
              {isReceiptMenuOpen && (
                <ul className="submenu">
                  <li className={activeMenu === 'part-receipt' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveMenu('part-receipt'); }}>
                    <span>配件入库单</span>
                  </li>
                  <li className={activeMenu === 'server-receipt' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveMenu('server-receipt'); }}>
                    <span>服务器入库单</span>
                  </li>
                </ul>
              )}
            </li>
            <li className={activeMenu === 'servers' || activeMenu === 'racks' || activeMenu === 'rack-detail' ? 'active' : ''} onClick={toggleServerMenu}>
              <span>服务器管理</span>
              {isServerMenuOpen && (
                <ul className="submenu">
                  <li className={activeMenu === 'racks' || activeMenu === 'rack-detail' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveMenu('racks'); }}>
                    <span>机柜管理</span>
                  </li>
                </ul>
              )}
            </li>
            <li className={activeMenu === 'deploy' ? 'active' : ''} onClick={() => setActiveMenu('deploy')}>
              <span>部署新系统</span>
            </li>
            <li className={activeMenu === 'monitoring' ? 'active' : ''} onClick={() => setActiveMenu('monitoring')}>
              <span>监控数据</span>
            </li>
            <li className={activeMenu === 'users' ? 'active' : ''} onClick={() => setActiveMenu('users')}>
              <span>用户管理</span>
            </li>
            <li className={activeMenu === 'ad-config' ? 'active' : ''} onClick={() => setActiveMenu('ad-config')}>
              <span>AD域配置</span>
            </li>
          </ul>
        </nav>
        
        {/* 主内容区域 */}
        <main className="App-main">
          {/* 资产管理视图 - AssetManagement.jsx */}
          {activeMenu === 'assets' && (
            <AssetManagement />
          )}

          {/* 资产报废管理视图 - AssetScrapManagement.jsx */}
          {activeMenu === 'asset-scrap' && (
            <AssetScrapManagement />
          )}

          {/* 配件管理视图 - PartsManagement.jsx */}
          {activeMenu === 'parts' && (
            <PartsManagement />
          )}

          {/* 配件入库单管理视图 - PartReceiptManagement.jsx */}
          {activeMenu === 'part-receipt' && (
            <PartReceiptManagement />
          )}

          {/* 服务器入库单管理视图 - ServerReceiptManagement.jsx */}
          {activeMenu === 'server-receipt' && (
            <ServerReceiptManagement />
          )}

          {/* 服务器管理视图 */}
          {activeMenu === 'servers' && (
            <section className="dashboard">
              <div className="section-header">
                <h2>服务器概览</h2>
                <div className="header-actions">
                  <button className="btn-refresh" onClick={fetchServers}>刷新</button>
                  <button className="btn-primary" onClick={openCreateServerForm}>添加服务器</button>
                </div>
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
                        <th>ID</th>
                        <th>主机名</th>
                        <th>IP地址</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servers.map(server => (
                        <tr key={server.id}>
                          <td>{server.id}</td>
                          <td>{server.hostname}</td>
                          <td>{server.ip_address}</td>
                          <td>
                            <span className={`status ${server.status}`}>
                              {server.status === 'online' ? '在线' : 
                               server.status === 'offline' ? '离线' : '维护中'}
                            </span>
                          </td>
                          <td>
                            <button className="btn-primary" onClick={() => viewServerDetail(server.id)}>详情</button>
                            <button className="btn-secondary" onClick={() => openEditServerForm(server)}>编辑</button>
                            {server.status === 'online' ? (
                              <>
                                <button className="btn-warning" onClick={() => powerOffServer(server.id)}>关机</button>
                                <button className="btn-secondary" onClick={() => rebootServer(server.id)}>重启</button>
                              </>
                            ) : server.status === 'offline' ? (
                              <button className="btn-success" onClick={() => powerOnServer(server.id)}>开机</button>
                            ) : (
                              <>
                                <button className="btn-success" onClick={() => powerOnServer(server.id)}>开机</button>
                                <button className="btn-warning" onClick={() => powerOffServer(server.id)}>关机</button>
                              </>
                            )}
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

          {/* 机柜管理视图 */}
          {activeMenu === 'racks' && (
            <section className="rack-management">
              <div className="section-header">
                <h2>机柜管理</h2>
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

          {/* 机柜详情视图 */}
          {activeMenu === 'rack-detail' && selectedRack && (
            <section className="rack-detail">
              <div className="section-header">
                <h2>{selectedRack.name} - 机柜详情</h2>
                <div className="header-actions">
                  <button className="btn-secondary" onClick={backToRackList}>返回机柜列表</button>
                </div>
              </div>
              
              <div className="rack-visualization">
                <h3>42U机柜布局</h3>
                <div className="rack-u-spaces">
                  {[...Array(selectedRack.totalU)].map((_, index) => (
                    <div key={index} className="u-space">
                      U{index + 1}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 其他菜单视图（占位符） */}
          {activeMenu === 'users' && <UserManagement />}
          {activeMenu === 'ad-config' && <ADConfigManagement />}
          {(activeMenu === 'deploy' || activeMenu === 'monitoring') && (
            <section className="placeholder">
              <h2>{activeMenu === 'deploy' ? '部署新系统' : '监控数据'}</h2>
              <p>此功能正在开发中...</p>
            </section>
          )}
        </main>
      </div>
      
      {/* 服务器详情模态框 */}
      {selectedServerId && (
        <ServerDetail 
          serverId={selectedServerId} 
          onClose={closeServerDetail} 
        />
      )}
      
      {/* 创建/编辑服务器表单模态框 */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingServer ? '编辑服务器' : '添加服务器'}</h2>
              <button className="modal-close" onClick={closeServerForm}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleServerSubmit}>
                <div className="form-group">
                  <label htmlFor="hostname">主机名:</label>
                  <input
                    type="text"
                    id="hostname"
                    name="hostname"
                    value={serverFormData.hostname}
                    onChange={handleServerInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="ip_address">IP地址:</label>
                  <input
                    type="text"
                    id="ip_address"
                    name="ip_address"
                    value={serverFormData.ip_address}
                    onChange={handleServerInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="mac_address">MAC地址:</label>
                  <input
                    type="text"
                    id="mac_address"
                    name="mac_address"
                    value={serverFormData.mac_address}
                    onChange={handleServerInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="bmc_ip">BMC IP:</label>
                  <input
                    type="text"
                    id="bmc_ip"
                    name="bmc_ip"
                    value={serverFormData.bmc_ip}
                    onChange={handleServerInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="cpu_model">CPU型号:</label>
                  <input
                    type="text"
                    id="cpu_model"
                    name="cpu_model"
                    value={serverFormData.cpu_model}
                    onChange={handleServerInputChange}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="cpu_cores">CPU核心数:</label>
                    <input
                      type="number"
                      id="cpu_cores"
                      name="cpu_cores"
                      min="1"
                      value={serverFormData.cpu_cores}
                      onChange={handleServerInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="memory_gb">内存(GB):</label>
                    <input
                      type="number"
                      id="memory_gb"
                      name="memory_gb"
                      min="1"
                      value={serverFormData.memory_gb}
                      onChange={handleServerInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="disk_info">磁盘信息:</label>
                  <textarea
                    id="disk_info"
                    name="disk_info"
                    value={serverFormData.disk_info}
                    onChange={handleServerInputChange}
                    placeholder='{"ssd": "1TB", "hdd": "2TB"}'
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="status">状态:</label>
                  <select
                    id="status"
                    name="status"
                    value={serverFormData.status}
                    onChange={handleServerInputChange}
                  >
                    <option value="online">在线</option>
                    <option value="offline">离线</option>
                    <option value="maintenance">维护中</option>
                  </select>
                </div>
                
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={closeServerForm}>取消</button>
                  <button type="submit" className="btn-primary">
                    {editingServer ? '更新' : '创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;