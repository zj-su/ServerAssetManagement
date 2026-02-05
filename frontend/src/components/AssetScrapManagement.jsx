import React, { useState, useEffect } from 'react';
import { assetAPI, serverAPI } from '../services/api';

/**
 * 资产报废管理 - 待报废资产、报废资产、删除回收站（支持 initialTab 与左侧菜单联动）
 */
const AssetScrapManagement = ({ initialTab = 'pending' }) => {
  const [activeTab, setActiveTab] = useState(initialTab); // pending | scrapped | recycle
  const [pendingAssets, setPendingAssets] = useState([]);
  const [scrappedAssets, setScrappedAssets] = useState([]);
  const [deletedAssets, setDeletedAssets] = useState([]);
  // 服务器报废相关状态
  const [pendingServers, setPendingServers] = useState([]);
  const [scrappedServers, setScrappedServers] = useState([]);
  const [deletedServers, setDeletedServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // 与左侧菜单联动：外部切换菜单时同步 Tab
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const fetchPendingScrap = async () => {
    try {
      setLoading(true);
      // 同时获取配件和服务器的待报废列表
      const [assetRes, serverRes] = await Promise.all([
        assetAPI.getPendingScrapAssets(),
        serverAPI.getPendingScrapServers()
      ]);
      setPendingAssets(assetRes.data || []);
      setPendingServers(serverRes.data || []);
    } catch (err) {
      console.error('获取待报废资产失败:', err);
      alert('获取待报废资产失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchScrapped = async () => {
    try {
      setLoading(true);
      // 同时获取配件和服务器的已报废列表
      const [assetRes, serverRes] = await Promise.all([
        assetAPI.getScrappedAssets(),
        serverAPI.getScrappedServers()
      ]);
      setScrappedAssets(assetRes.data || []);
      setScrappedServers(serverRes.data || []);
    } catch (err) {
      console.error('获取已报废资产失败:', err);
      alert('获取已报废资产失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchDeleted = async () => {
    try {
      setLoading(true);
      // 同时获取配件和服务器的已删除列表
      const [assetRes, serverRes] = await Promise.all([
        assetAPI.getDeletedAssets(),
        serverAPI.getDeletedServers()
      ]);
      setDeletedAssets(assetRes.data || []);
      setDeletedServers(serverRes.data || []);
    } catch (err) {
      console.error('获取回收站列表失败:', err);
      alert('获取回收站列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 恢复配件
  const restoreFromRecycle = async (assetId) => {
    if (!window.confirm('确定要从回收站恢复该配件吗？')) return;
    try {
      await assetAPI.restoreAsset(assetId);
      alert('已恢复');
      fetchDeleted();
    } catch (err) {
      console.error('恢复失败:', err);
      alert('恢复失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 恢复服务器
  const restoreServerFromRecycle = async (serverId) => {
    if (!window.confirm('确定要从回收站恢复该服务器吗？')) return;
    try {
      await serverAPI.restoreServer(serverId);
      alert('服务器已恢复');
      fetchDeleted();
    } catch (err) {
      console.error('恢复失败:', err);
      alert('恢复失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 永久删除配件
  const permanentlyDeleteAsset = async (assetId) => {
    if (!window.confirm('确定要永久删除该配件吗？此操作不可恢复！')) return;
    try {
      await assetAPI.permanentlyDeleteAsset(assetId);
      alert('已永久删除');
      fetchDeleted();
    } catch (err) {
      console.error('永久删除失败:', err);
      alert('永久删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 永久删除服务器
  const permanentlyDeleteServer = async (serverId) => {
    if (!window.confirm('确定要永久删除该服务器吗？此操作不可恢复！')) return;
    try {
      await serverAPI.permanentlyDeleteServer(serverId);
      alert('服务器已永久删除');
      fetchDeleted();
    } catch (err) {
      console.error('永久删除失败:', err);
      alert('永久删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') fetchPendingScrap();
    else if (activeTab === 'scrapped') fetchScrapped();
    else if (activeTab === 'recycle') fetchDeleted();
  }, [activeTab]);

  const confirmScrap = async (assetId) => {
    if (!window.confirm('确定要确认报废这个配件吗？确认后将被正式报废。')) return;
    try {
      await assetAPI.confirmScrapAsset(assetId);
      alert('配件已确认报废');
      fetchPendingScrap();
      fetchScrapped();
    } catch (err) {
      console.error('确认报废失败:', err);
      alert('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const confirmScrapServer = async (serverId) => {
    if (!window.confirm('确定要确认报废这个服务器吗？确认后将被正式报废。')) return;
    try {
      await serverAPI.confirmScrapServer(serverId);
      alert('服务器已确认报废');
      fetchPendingScrap();
      fetchScrapped();
    } catch (err) {
      console.error('确认报废失败:', err);
      alert('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteToRecycle = async (assetId) => {
    if (!window.confirm('确定要删除这个配件吗？配件将被移到回收站。')) return;
    try {
      await assetAPI.deleteAsset(assetId);
      alert('配件已移到回收站');
      fetchPendingScrap();
      fetchScrapped();
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 将服务器移至回收站
  const deleteServerToRecycle = async (serverId) => {
    if (!window.confirm('确定要删除这个服务器吗？服务器将被移到回收站。')) return;
    try {
      await serverAPI.deleteServerToRecycle(serverId);
      alert('服务器已移到回收站');
      fetchPendingScrap();
      fetchScrapped();
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const viewDetail = async (assetId, type = 'asset') => {
    try {
      setDetailLoading(true);
      if (type === 'server') {
        // 获取服务器详情和历史
        const [serverRes, historyRes] = await Promise.all([
          serverAPI.getServer(assetId),
          serverAPI.getServerHistory(assetId)
        ]);
        const server = serverRes.data;
        server.history = historyRes.data;
        server._type = 'server';
        setSelectedAsset(server);
      } else {
        // 获取配件详情和历史
        const [assetRes, historyRes] = await Promise.all([
          assetAPI.getAsset(assetId),
          assetAPI.getAssetHistory(assetId)
        ]);
        const asset = assetRes.data;
        asset.history = historyRes.data;
        asset._type = 'asset';
        setSelectedAsset(asset);
      }
      setShowDetail(true);
    } catch (err) {
      console.error('获取详情失败:', err);
      alert('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const statusText = (status) => {
    const map = {
      // 配件状态
      in_storage: '在库',
      in_use: '使用中',
      idle: '空闲',
      // 服务器状态
      online: '使用中',
      offline: '空闲',
      maintenance: '在库',
      // 通用状态
      pending_scrap: '待报废',
      scrapped: '已报废',
      deleted: '已删除'
    };
    return map[status] || status;
  };

  // 渲染统一表格（服务器和配件合并）
  const renderTable = (list, options = {}) => {
    const { isPending, isRecycle } = options;
    return (
      <table>
        <thead>
          <tr>
            <th>类型</th>
            <th>资产编码</th>
            <th>SN</th>
            <th>品牌</th>
            <th>型号</th>
            <th>使用人</th>
            <th>状态</th>
            <th>部门</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ padding: '20px', textAlign: 'center' }}>暂无数据</td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={`${item._type}-${item.id}`}>
                <td>{item._type === 'server' ? '服务器' : '配件'}</td>
                <td>{item.asset_code || '-'}</td>
                <td>{item._type === 'server' ? (item.serial_number || '-') : (item.sn || '-')}</td>
                <td>{item.brand || '-'}</td>
                <td>{item.model || '-'}</td>
                <td>{item._type === 'server' ? (item.user_person || '-') : (item.user || '-')}</td>
                <td><span className={`status ${item.status}`}>{statusText(item.status)}</span></td>
                <td>{item.department || '-'}</td>
                <td>
                  <button className="btn-info" onClick={() => viewDetail(item.id, item._type)}>详情</button>
                  {isPending && item._type === 'asset' && (
                    <>
                      <button className="btn-success" onClick={() => confirmScrap(item.id)}>确认报废</button>
                      <button className="btn-danger" onClick={() => deleteToRecycle(item.id)}>移至回收站</button>
                    </>
                  )}
                  {isPending && item._type === 'server' && (
                    <>
                      <button className="btn-success" onClick={() => confirmScrapServer(item.id)}>确认报废</button>
                      <button className="btn-danger" onClick={() => deleteServerToRecycle(item.id)}>移至回收站</button>
                    </>
                  )}
                  {isRecycle && item._type === 'asset' && (
                    <>
                      <button className="btn-success" onClick={() => restoreFromRecycle(item.id)}>恢复</button>
                      <button className="btn-danger" onClick={() => permanentlyDeleteAsset(item.id)}>永久删除</button>
                    </>
                  )}
                  {isRecycle && item._type === 'server' && (
                    <>
                      <button className="btn-success" onClick={() => restoreServerFromRecycle(item.id)}>恢复</button>
                      <button className="btn-danger" onClick={() => permanentlyDeleteServer(item.id)}>永久删除</button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  };

  const onRefresh = () => {
    if (activeTab === 'pending') fetchPendingScrap();
    else if (activeTab === 'scrapped') fetchScrapped();
    else if (activeTab === 'recycle') fetchDeleted();
  };

  // 合并服务器和配件列表，添加类型标识
  const getMergedList = () => {
    let assets = [];
    let servers = [];
    
    if (activeTab === 'pending') {
      assets = pendingAssets.map(a => ({ ...a, _type: 'asset' }));
      servers = pendingServers.map(s => ({ ...s, _type: 'server' }));
    } else if (activeTab === 'scrapped') {
      assets = scrappedAssets.map(a => ({ ...a, _type: 'asset' }));
      servers = scrappedServers.map(s => ({ ...s, _type: 'server' }));
    } else {
      // 回收站：同时显示已删除的配件和服务器
      assets = deletedAssets.map(a => ({ ...a, _type: 'asset' }));
      servers = deletedServers.map(s => ({ ...s, _type: 'server' }));
    }
    
    return [...servers, ...assets];
  };

  const currentList = getMergedList();
  const tableOptions = activeTab === 'pending' ? { isPending: true } : activeTab === 'recycle' ? { isRecycle: true } : {};

  return (
    <div className="asset-scrap-management" style={{ padding: '20px' }}>
      <h2>资产报废管理</h2>
      <div className="tabs" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          className={activeTab === 'pending' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('pending')}
        >
          资产待报废
        </button>
        <button
          className={activeTab === 'scrapped' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('scrapped')}
        >
          报废资产
        </button>
        <button
          className={activeTab === 'recycle' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('recycle')}
        >
          删除回收站
        </button>
      </div>
      <div className="section-header" style={{ marginBottom: '12px' }}>
        <button className="btn-secondary" onClick={onRefresh}>刷新</button>
      </div>
      {loading ? (
        <p>加载中...</p>
      ) : (
        renderTable(currentList, tableOptions)
      )}

      {/* 资产/服务器详情弹窗 */}
      {showDetail && selectedAsset && (
        <div className="modal-overlay" onClick={() => { setShowDetail(false); setSelectedAsset(null); }}>
          <div className="modal-content server-detail-modal oa-detail" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header server-detail-header">
              <div className="server-detail-title-wrap">
                <h2>{selectedAsset._type === 'server' ? '服务器' : '配件'}报废详情</h2>
                <p className="server-detail-subtitle">
                  {selectedAsset._type === 'server' 
                    ? (selectedAsset.asset_code || selectedAsset.serial_number || '-') 
                    : (selectedAsset.asset_code || selectedAsset.sn || '-')}
                </p>
              </div>
              <div className="server-detail-header-right">
                <span className={`status status-tag ${selectedAsset.status}`}>{statusText(selectedAsset.status)}</span>
                <button type="button" className="btn-close" onClick={() => { setShowDetail(false); setSelectedAsset(null); }}>×</button>
              </div>
            </div>
            <div className="modal-body server-detail-body">
              {detailLoading ? (
                <p className="server-detail-loading">加载中...</p>
              ) : (
                <>
                  {selectedAsset._type === 'server' ? (
                    /* 服务器详情 - 区块化展示 */
                    <>
                      <section className="detail-section">
                        <h3 className="detail-section-title">基础信息</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">资产编码</span><span className="detail-value">{selectedAsset.asset_code || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">序列号(SN)</span><span className="detail-value">{selectedAsset.serial_number || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">品牌</span><span className="detail-value">{selectedAsset.brand || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">型号</span><span className="detail-value">{selectedAsset.model || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">CPU型号</span><span className="detail-value">{selectedAsset.cpu_model || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">CPU核心数</span><span className="detail-value">{selectedAsset.cpu_cores || '—'}</span></div>
                        </div>
                      </section>
                      <section className="detail-section">
                        <h3 className="detail-section-title">网络信息</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">主机名</span><span className="detail-value">{selectedAsset.hostname || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">系统IP</span><span className="detail-value">{selectedAsset.ip_address || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">BMC IP</span><span className="detail-value">{selectedAsset.bmc_ip || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">BMC账号</span><span className="detail-value">{selectedAsset.bmc_username || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">系统账号</span><span className="detail-value">{selectedAsset.system_username || '—'}</span></div>
                        </div>
                      </section>
                      <section className="detail-section">
                        <h3 className="detail-section-title">使用与位置</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">使用人</span><span className="detail-value">{selectedAsset.user_person || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">部门</span><span className="detail-value">{selectedAsset.department || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">U位</span><span className="detail-value">{selectedAsset.u_position || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">U高度</span><span className="detail-value">{selectedAsset.u_height || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">位置</span><span className="detail-value">{selectedAsset.location || '—'}</span></div>
                        </div>
                      </section>
                      <section className="detail-section">
                        <h3 className="detail-section-title">合同与保修</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">合同号</span><span className="detail-value">{selectedAsset.contract_number || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">采购日期</span><span className="detail-value">{selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString('zh-CN') : '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">保修到期</span><span className="detail-value">{selectedAsset.warranty_expire ? new Date(selectedAsset.warranty_expire).toLocaleDateString('zh-CN') : '—'}</span></div>
                          <div className="detail-item detail-item-full"><span className="detail-label">备注</span><span className="detail-value">{selectedAsset.remark || '—'}</span></div>
                        </div>
                      </section>
                    </>
                  ) : (
                    /* 配件详情 - 区块化展示 */
                    <>
                      <section className="detail-section">
                        <h3 className="detail-section-title">基础信息</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">资产编码</span><span className="detail-value">{selectedAsset.asset_code || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">序列号(SN)</span><span className="detail-value">{selectedAsset.sn || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">品牌</span><span className="detail-value">{selectedAsset.brand || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">型号</span><span className="detail-value">{selectedAsset.model || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">配件类型</span><span className="detail-value">{selectedAsset.part_type || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">容量</span><span className="detail-value">{selectedAsset.capacity ? `${selectedAsset.capacity} ${selectedAsset.capacity_unit || ''}` : '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">核心数</span><span className="detail-value">{selectedAsset.cpu_cores || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">频率</span><span className="detail-value">{selectedAsset.frequency ? `${selectedAsset.frequency} ${selectedAsset.frequency_unit || ''}` : '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">接口类型</span><span className="detail-value">{selectedAsset.interface_type || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">规格</span><span className="detail-value">{selectedAsset.spec || '—'}</span></div>
                        </div>
                      </section>
                      <section className="detail-section">
                        <h3 className="detail-section-title">使用与位置</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">使用人</span><span className="detail-value">{selectedAsset.user || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">关联服务器SN</span><span className="detail-value">{selectedAsset.purchased_with_server_sn || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">位置</span><span className="detail-value">{selectedAsset.location || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">部门</span><span className="detail-value">{selectedAsset.department || '—'}</span></div>
                        </div>
                      </section>
                      <section className="detail-section">
                        <h3 className="detail-section-title">合同与保修</h3>
                        <div className="detail-grid">
                          <div className="detail-item"><span className="detail-label">合同号</span><span className="detail-value">{selectedAsset.contract_number || '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">采购日期</span><span className="detail-value">{selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString('zh-CN') : '—'}</span></div>
                          <div className="detail-item"><span className="detail-label">保修到期</span><span className="detail-value">{selectedAsset.warranty_expiry ? new Date(selectedAsset.warranty_expiry).toLocaleDateString('zh-CN') : '—'}</span></div>
                          <div className="detail-item detail-item-full"><span className="detail-label">备注</span><span className="detail-value">{selectedAsset.remark || '—'}</span></div>
                        </div>
                      </section>
                    </>
                  )}
                  {/* 历史记录区块 */}
                  {selectedAsset.history && selectedAsset.history.length > 0 && (
                    <section className="detail-section">
                      <h3 className="detail-section-title">历史记录</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa' }}>时间</th>
                            <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa' }}>操作类型</th>
                            <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa' }}>操作人</th>
                            <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa' }}>备注</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAsset.history.map((h) => (
                            <tr key={h.id}>
                              <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{new Date(h.date).toLocaleString('zh-CN')}</td>
                              <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{h.action}</td>
                              <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{h.operator}</td>
                              <td style={{ padding: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>{h.remark || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer server-detail-footer">
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedAsset(null); }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetScrapManagement;
