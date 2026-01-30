import React, { useState, useEffect } from 'react';
import { assetAPI } from '../services/api';

const AssetManagement = () => {
  const [activeTab, setActiveTab] = useState('entry'); // entry, pending-scrap, scrapped, deleted
  const [assets, setAssets] = useState([]);
  const [pendingScrapAssets, setPendingScrapAssets] = useState([]);
  const [scrappedAssets, setScrappedAssets] = useState([]);
  const [deletedAssets, setDeletedAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showAssetDetail, setShowAssetDetail] = useState(false);
  const [assetDetailLoading, setAssetDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 资产表单状态
  const [assetFormData, setAssetFormData] = useState({
    sn: '',
    model: '',
    brand: '',
    bmc_ip: '',
    user: '',
    system_ip: '',
    system_username: '',
    system_password: '',
    u_position: '',
    u_height: 1,
    purchase_date: '',
    warranty_expiry: '',
    status: 'in_storage',
    location: '',
    department: ''
  });

  // 获取在库资产列表（在线资产）
  const fetchAssets = async () => {
    try {
      const response = await assetAPI.getAssets("in_storage,in_use,maintenance");
      setAssets(response.data);
    } catch (err) {
      console.error('Error fetching assets from API:', err);
    }
  };

  // 获取待报废资产列表
  const fetchPendingScrapAssets = async () => {
    try {
      const response = await assetAPI.getPendingScrapAssets();
      setPendingScrapAssets(response.data);
    } catch (err) {
      console.error('Error fetching pending scrap assets from API:', err);
    }
  };

  // 获取已报废资产列表
  const fetchScrappedAssets = async () => {
    try {
      const response = await assetAPI.getScrappedAssets();
      setScrappedAssets(response.data);
    } catch (err) {
      console.error('Error fetching scrapped assets from API:', err);
    }
  };

  // 获取已删除资产列表（回收站）
  const fetchDeletedAssets = async () => {
    try {
      const response = await assetAPI.getDeletedAssets();
      setDeletedAssets(response.data);
    } catch (err) {
      console.error('Error fetching deleted assets from API:', err);
    }
  };

  // 搜索资产
  const searchAssets = async (query) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      return;
    }
    
    try {
      const response = await assetAPI.searchAssets(query);
      setSearchResults(response.data);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Error searching assets:', err);
      alert('搜索失败: ' + (err.response?.data?.detail || err.message || '未知错误'));
    }
  };

  // 获取资产详情
  const fetchAssetDetail = async (assetId) => {
    try {
      setAssetDetailLoading(true);
      // 获取资产详情
      const assetResponse = await assetAPI.getAsset(assetId);
      const asset = assetResponse.data;
      
      // 获取资产历史记录
      const historyResponse = await assetAPI.getAssetHistory(assetId);
      asset.history = historyResponse.data;
      
      setSelectedAsset(asset);
      setShowAssetDetail(true);
    } catch (err) {
      console.error('Error fetching asset detail from API:', err);
      alert('获取资产详情失败');
    } finally {
      setAssetDetailLoading(false);
    }
  };

  // 打开创建资产表单
  const openCreateAssetForm = () => {
    setEditingAsset(null);
    setAssetFormData({
      sn: '',
      model: '',
      brand: '',
      bmc_ip: '',
      user: '',
      system_ip: '',
      system_username: '',
      system_password: '',
      u_position: '',
      u_height: 1,
      purchase_date: '',
      warranty_expiry: '',
      status: 'in_storage',
      location: '',
      department: ''
    });
    setShowAssetForm(true);
  };

  // 打开编辑资产表单
  const openEditAssetForm = (asset) => {
    setEditingAsset(asset);
    setAssetFormData({
      sn: asset.sn || '',
      model: asset.model || '',
      brand: asset.brand || '',
      bmc_ip: asset.bmc_ip || '',
      user: asset.user || '',
      system_ip: asset.system_ip || '',
      system_username: asset.system_username || '',
      system_password: asset.system_password || '',
      u_position: asset.u_position || '',
      u_height: asset.u_height || 1,
      purchase_date: asset.purchase_date || '',
      warranty_expiry: asset.warranty_expiry || '',
      status: asset.status || 'in_storage',
      location: asset.location || '',
      department: asset.department || ''
    });
    setShowAssetForm(true);
  };

  // 关闭资产表单
  const closeAssetForm = () => {
    setShowAssetForm(false);
    setEditingAsset(null);
  };

  // 处理资产表单输入变化
  const handleAssetInputChange = (e) => {
    const { name, value } = e.target;
    setAssetFormData(prev => ({
      ...prev,
      [name]: name === 'u_height' ? parseInt(value) || 0 : value
    }));
  };

  // 提交资产表单
  const handleAssetSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingAsset) {
        // 更新资产
        const response = await assetAPI.updateAsset(editingAsset.id, assetFormData);
        alert('资产更新成功');
      } else {
        // 创建资产
        const response = await assetAPI.createAsset(assetFormData);
        alert('资产创建成功');
      }
      
      // 关闭表单并刷新列表
      closeAssetForm();
      fetchAssets();
    } catch (err) {
      console.error('Error saving asset:', err);
      alert('保存失败: ' + (err.response?.data?.detail || err.message || '未知错误'));
    }
  };

  // 报废资产（移到待报废）
  const scrapAsset = async (assetId) => {
    if (!window.confirm('确定要将这个资产标记为待报废吗？')) {
      return;
    }
    
    try {
      await assetAPI.scrapAsset(assetId);
      alert('资产已标记为待报废');
      fetchAssets();
      fetchPendingScrapAssets();
    } catch (err) {
      console.error('Error scrapping asset:', err);
      alert('操作失败: ' + (err.message || '未知错误'));
    }
  };

  // 确认报废资产
  const confirmScrapAsset = async (assetId) => {
    if (!window.confirm('确定要确认报废这个资产吗？确认后资产将被正式报废。')) {
      return;
    }
    
    try {
      await assetAPI.confirmScrapAsset(assetId);
      alert('资产已确认报废');
      fetchPendingScrapAssets();
      fetchScrappedAssets(); // 更新已报废资产列表
    } catch (err) {
      console.error('Error confirming scrap asset:', err);
      alert('操作失败: ' + (err.message || '未知错误'));
    }
  };

  // 删除资产（移到回收站）
  const deleteAsset = async (assetId) => {
    if (!window.confirm('确定要删除这个资产吗？资产将被移到回收站。')) {
      return;
    }
    
    try {
      await assetAPI.deleteAsset(assetId);
      alert('资产已移到回收站');
      
      if (activeTab === 'entry') {
        fetchAssets();
      } else if (activeTab === 'pending-scrap') {
        fetchPendingScrapAssets();
      } else if (activeTab === 'scrapped') {
        fetchScrappedAssets();
      }
      
      fetchDeletedAssets();
    } catch (err) {
      console.error('Error deleting asset:', err);
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  // 从回收站恢复资产
  const restoreAsset = async (assetId) => {
    if (!window.confirm('确定要从回收站恢复这个资产吗？')) {
      return;
    }
    
    try {
      await assetAPI.restoreAsset(assetId);
      alert('资产已从回收站恢复');
      fetchDeletedAssets();
      fetchAssets();
    } catch (err) {
      console.error('Error restoring asset:', err);
      alert('恢复失败: ' + (err.message || '未知错误'));
    }
  };

  // 永久删除资产
  const permanentlyDeleteAsset = async (assetId) => {
    if (!window.confirm('确定要永久删除这个资产吗？此操作不可恢复！')) {
      return;
    }
    
    try {
      await assetAPI.permanentlyDeleteAsset(assetId);
      alert('资产已永久删除');
      fetchDeletedAssets();
    } catch (err) {
      console.error('Error permanently deleting asset:', err);
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  // 关闭资产详情
  const closeAssetDetail = () => {
    setShowAssetDetail(false);
    setSelectedAsset(null);
  };

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // 处理搜索提交
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    searchAssets(searchQuery);
  };

  // 切换标签页时刷新数据
  useEffect(() => {
    // 如果正在显示搜索结果，则不清空搜索结果
    if (!showSearchResults) {
      switch (activeTab) {
        case 'entry':
          fetchAssets();
          break;
        case 'pending-scrap':
          fetchPendingScrapAssets();
          break;
        case 'scrapped':
          fetchScrappedAssets();
          break;
        case 'deleted':
          fetchDeletedAssets();
          break;
        default:
          break;
      }
    }
  }, [activeTab, showSearchResults]);

  // 初始化时加载数据
  useEffect(() => {
    fetchAssets();
    fetchPendingScrapAssets();
    fetchScrappedAssets();
    fetchDeletedAssets();
  }, []);

  // 渲染资产表格
  const renderAssetTable = (assets) => (
    <table>
      <thead>
        <tr>
          <th>SN</th>
          <th>品牌</th>
          <th>型号</th>
          <th>BMC IP</th>
          <th>使用人</th>
          <th>系统IP</th>
          <th>系统账号</th>
          <th>系统密码</th>
          <th>U位</th>
          <th>状态</th>
          <th>部门</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {assets.map(asset => (
          <tr key={asset.id}>
            <td>{asset.sn}</td>
            <td>{asset.brand}</td>
            <td>{asset.model}</td>
            <td>{asset.bmc_ip}</td>
            <td>{asset.user}</td>
            <td>{asset.system_ip}</td>
            <td>{asset.system_username}</td>
            <td>{asset.system_password}</td>
            <td>{asset.u_position} ({asset.u_height}U)</td>
            <td>
              <span className={`status ${asset.status}`}>
                {asset.status === 'in_use' ? '使用中' : 
                 asset.status === 'in_storage' ? '在库' :
                 asset.status === 'maintenance' ? '维修中' :
                 asset.status === 'pending_scrap' ? '待报废' :
                 asset.status === 'scrapped' ? '已报废' :
                 asset.status === 'deleted' ? '已删除' :
                 asset.status === 'idle' ? '空闲' : asset.status}
              </span>
            </td>
            <td>{asset.department}</td>
            <td>
              <button className="btn-info" onClick={() => fetchAssetDetail(asset.id)}>详情</button>
              {asset.status !== 'pending_scrap' && asset.status !== 'scrapped' && asset.status !== 'deleted' && (
                <button className="btn-primary" onClick={() => openEditAssetForm(asset)}>编辑</button>
              )}
              {asset.status === 'in_storage' || asset.status === 'in_use' || asset.status === 'maintenance' || asset.status === 'idle' ? (
                <button className="btn-warning" onClick={() => scrapAsset(asset.id)}>报废</button>
              ) : null}
              {asset.status === 'pending_scrap' && (
                <button className="btn-success" onClick={() => confirmScrapAsset(asset.id)}>确认报废</button>
              )}
              {(asset.status === 'pending_scrap' || asset.status === 'scrapped') && (
                <button className="btn-danger" onClick={() => deleteAsset(asset.id)}>删除</button>
              )}
              {asset.status === 'deleted' && (
                <>
                  <button className="btn-success" onClick={() => restoreAsset(asset.id)}>恢复</button>
                  <button className="btn-danger" onClick={() => permanentlyDeleteAsset(asset.id)}>永久删除</button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="asset-management">
      <div className="section-header">
        <h2>资产管理</h2>
        <div className="header-actions">
          {activeTab === 'entry' && (
            <button className="btn-primary" onClick={openCreateAssetForm}>添加资产</button>
          )}
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="搜索SN、使用人、BMC IP、系统IP..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <button type="submit" className="btn-search">搜索</button>
            {showSearchResults && (
              <button 
                type="button" 
                className="btn-clear-search" 
                onClick={() => {
                  setShowSearchResults(false);
                  setSearchQuery('');
                }}
              >
                清除搜索
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="tabs">
        <button 
          className={activeTab === 'entry' ? 'tab active' : 'tab'}
          onClick={() => {
            setActiveTab('entry');
            setShowSearchResults(false);
          }}
        >
          在线资产
        </button>
        <button 
          className={activeTab === 'pending-scrap' ? 'tab active' : 'tab'}
          onClick={() => {
            setActiveTab('pending-scrap');
            setShowSearchResults(false);
          }}
        >
          资产待报废
        </button>
        <button 
          className={activeTab === 'scrapped' ? 'tab active' : 'tab'}
          onClick={() => {
            setActiveTab('scrapped');
            setShowSearchResults(false);
          }}
        >
          报废资产
        </button>
        <button 
          className={activeTab === 'deleted' ? 'tab active' : 'tab'}
          onClick={() => {
            setActiveTab('deleted');
            setShowSearchResults(false);
          }}
        >
          删除回收站
        </button>
      </div>

      {/* 搜索结果视图 */}
      {showSearchResults && (
        <div className="assets-list">
          <h3>搜索结果 (找到 {searchResults.length} 条记录)</h3>
          {renderAssetTable(searchResults)}
        </div>
      )}

      {/* 在线资产视图 */}
      {activeTab === 'entry' && !showSearchResults && (
        <div className="assets-list">
          {renderAssetTable(assets)}
        </div>
      )}

      {/* 资产待报废视图 */}
      {activeTab === 'pending-scrap' && !showSearchResults && (
        <div className="assets-list">
          {renderAssetTable(pendingScrapAssets)}
        </div>
      )}

      {/* 报废资产视图 */}
      {activeTab === 'scrapped' && !showSearchResults && (
        <div className="assets-list">
          {renderAssetTable(scrappedAssets)}
        </div>
      )}

      {/* 删除回收站视图 */}
      {activeTab === 'deleted' && !showSearchResults && (
        <div className="assets-list">
          {renderAssetTable(deletedAssets)}
        </div>
      )}

      {/* 资产详情模态框 */}
      {showAssetDetail && selectedAsset && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>资产详情 - {selectedAsset.sn}</h2>
              <button className="modal-close" onClick={closeAssetDetail}>×</button>
            </div>
            <div className="modal-body">
              {assetDetailLoading ? (
                <p>加载中...</p>
              ) : (
                <div className="asset-detail-info">
                  <h3>基本信息</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>序列号:</label>
                      <span>{selectedAsset.sn}</span>
                    </div>
                    <div className="form-group">
                      <label>品牌:</label>
                      <span>{selectedAsset.brand}</span>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>型号:</label>
                      <span>{selectedAsset.model}</span>
                    </div>
                    <div className="form-group">
                      <label>状态:</label>
                      <span className={`status ${selectedAsset.status}`}>
                        {selectedAsset.status === 'in_use' ? '使用中' : 
                         selectedAsset.status === 'in_storage' ? '在库' :
                         selectedAsset.status === 'maintenance' ? '维修中' :
                         selectedAsset.status === 'pending_scrap' ? '待报废' :
                         selectedAsset.status === 'scrapped' ? '已报废' :
                         selectedAsset.status === 'deleted' ? '已删除' :
                         selectedAsset.status === 'idle' ? '空闲' : selectedAsset.status}
                      </span>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>采购日期:</label>
                      <span>{selectedAsset.purchase_date ? selectedAsset.purchase_date.split('T')[0] : ''}</span>
                    </div>
                    <div className="form-group">
                      <label>保修到期:</label>
                      <span>{selectedAsset.warranty_expiry ? selectedAsset.warranty_expiry.split('T')[0] : ''}</span>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>使用人:</label>
                      <span>{selectedAsset.user || '无'}</span>
                    </div>
                    <div className="form-group">
                      <label>所属部门:</label>
                      <span>{selectedAsset.department || '无'}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>位置:</label>
                    <span>{selectedAsset.location || '未分配'}</span>
                  </div>
                  
                  <h3>网络信息</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>BMC IP:</label>
                      <span>{selectedAsset.bmc_ip || '无'}</span>
                    </div>
                    <div className="form-group">
                      <label>系统IP:</label>
                      <span>{selectedAsset.system_ip || '无'}</span>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>系统账号:</label>
                      <span>{selectedAsset.system_username || '无'}</span>
                    </div>
                    <div className="form-group">
                      <label>系统密码:</label>
                      <span>{selectedAsset.system_password || '无'}</span>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>U位:</label>
                      <span>{selectedAsset.u_position || '未分配'} ({selectedAsset.u_height}U)</span>
                    </div>
                  </div>
                  
                  <h3>变更历史</h3>
                  <div className="asset-history">
                    <table>
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>操作</th>
                          <th>操作人</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAsset.history && selectedAsset.history.map(record => (
                          <tr key={record.id}>
                            <td>{record.date ? new Date(record.date).toLocaleString('zh-CN') : ''}</td>
                            <td>{record.action}</td>
                            <td>{record.operator}</td>
                            <td>{record.remark}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 创建/编辑资产表单模态框 */}
      {showAssetForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingAsset ? '编辑资产' : '添加资产'}</h2>
              <button className="modal-close" onClick={closeAssetForm}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAssetSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="sn">序列号(SN):</label>
                    <input
                      type="text"
                      id="sn"
                      name="sn"
                      value={assetFormData.sn}
                      onChange={handleAssetInputChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="brand">品牌:</label>
                    <input
                      type="text"
                      id="brand"
                      name="brand"
                      value={assetFormData.brand}
                      onChange={handleAssetInputChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="model">型号:</label>
                  <input
                    type="text"
                    id="model"
                    name="model"
                    value={assetFormData.model}
                    onChange={handleAssetInputChange}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="bmc_ip">BMC IP:</label>
                    <input
                      type="text"
                      id="bmc_ip"
                      name="bmc_ip"
                      value={assetFormData.bmc_ip}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="user">使用人:</label>
                    <input
                      type="text"
                      id="user"
                      name="user"
                      value={assetFormData.user}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="system_ip">系统IP:</label>
                  <input
                    type="text"
                    id="system_ip"
                    name="system_ip"
                    value={assetFormData.system_ip}
                    onChange={handleAssetInputChange}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="system_username">系统账号:</label>
                    <input
                      type="text"
                      id="system_username"
                      name="system_username"
                      value={assetFormData.system_username}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="system_password">系统密码:</label>
                    <input
                      type="text"
                      id="system_password"
                      name="system_password"
                      value={assetFormData.system_password}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="u_position">设备U位:</label>
                    <input
                      type="text"
                      id="u_position"
                      name="u_position"
                      value={assetFormData.u_position}
                      onChange={handleAssetInputChange}
                      placeholder="例如: 10-11"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="u_height">设备高度(U):</label>
                    <select
                      id="u_height"
                      name="u_height"
                      value={assetFormData.u_height}
                      onChange={handleAssetInputChange}
                    >
                      <option value="1">1U</option>
                      <option value="2">2U</option>
                      <option value="4">4U</option>
                      <option value="6">6U</option>
                      <option value="8">8U</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="purchase_date">采购日期:</label>
                    <input
                      type="date"
                      id="purchase_date"
                      name="purchase_date"
                      value={assetFormData.purchase_date}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="warranty_expiry">保修到期:</label>
                    <input
                      type="date"
                      id="warranty_expiry"
                      name="warranty_expiry"
                      value={assetFormData.warranty_expiry}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="status">状态:</label>
                    <select
                      id="status"
                      name="status"
                      value={assetFormData.status}
                      onChange={handleAssetInputChange}
                    >
                      <option value="in_storage">在库</option>
                      <option value="in_use">使用中</option>
                      <option value="maintenance">维修中</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="department">所属部门:</label>
                    <input
                      type="text"
                      id="department"
                      name="department"
                      value={assetFormData.department}
                      onChange={handleAssetInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="location">位置:</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={assetFormData.location}
                    onChange={handleAssetInputChange}
                    placeholder="例如: A机柜-U10"
                  />
                </div>
                
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={closeAssetForm}>取消</button>
                  <button type="submit" className="btn-primary">
                    {editingAsset ? '更新' : '创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;