import React, { useState, useEffect } from 'react';
import { assetAPI } from '../services/api';

/**
 * 资产报废管理 - 待报废资产列表、已报废资产列表、报废操作
 * 与项目介绍 3.1 资产管理模块 - 报废流程 一致
 */
const AssetScrapManagement = () => {
  const [activeTab, setActiveTab] = useState('pending'); // pending | scrapped
  const [pendingAssets, setPendingAssets] = useState([]);
  const [scrappedAssets, setScrappedAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPendingScrap = async () => {
    try {
      setLoading(true);
      const response = await assetAPI.getPendingScrapAssets();
      setPendingAssets(response.data || []);
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
      const response = await assetAPI.getScrappedAssets();
      setScrappedAssets(response.data || []);
    } catch (err) {
      console.error('获取已报废资产失败:', err);
      alert('获取已报废资产失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') fetchPendingScrap();
    else fetchScrapped();
  }, [activeTab]);

  const confirmScrap = async (assetId) => {
    if (!window.confirm('确定要确认报废这个资产吗？确认后资产将被正式报废。')) return;
    try {
      await assetAPI.confirmScrapAsset(assetId);
      alert('资产已确认报废');
      fetchPendingScrap();
      fetchScrapped();
    } catch (err) {
      console.error('确认报废失败:', err);
      alert('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteToRecycle = async (assetId) => {
    if (!window.confirm('确定要删除这个资产吗？资产将被移到回收站。')) return;
    try {
      await assetAPI.deleteAsset(assetId);
      alert('资产已移到回收站');
      fetchPendingScrap();
      fetchScrapped();
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const viewDetail = async (assetId) => {
    try {
      setDetailLoading(true);
      const [assetRes, historyRes] = await Promise.all([
        assetAPI.getAsset(assetId),
        assetAPI.getAssetHistory(assetId)
      ]);
      const asset = assetRes.data;
      asset.history = historyRes.data;
      setSelectedAsset(asset);
      setShowDetail(true);
    } catch (err) {
      console.error('获取资产详情失败:', err);
      alert('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const statusText = (status) => {
    const map = {
      in_storage: '在库',
      in_use: '使用中',
      maintenance: '维修中',
      idle: '空闲',
      pending_scrap: '待报废',
      scrapped: '已报废',
      deleted: '已删除'
    };
    return map[status] || status;
  };

  const renderTable = (list, isPending) => (
    <table>
      <thead>
        <tr>
          <th>SN</th>
          <th>品牌</th>
          <th>型号</th>
          <th>BMC IP</th>
          <th>使用人</th>
          <th>状态</th>
          <th>部门</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {list.length === 0 ? (
          <tr>
            <td colSpan="8" style={{ padding: '20px', textAlign: 'center' }}>暂无数据</td>
          </tr>
        ) : (
          list.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.sn}</td>
              <td>{asset.brand || '-'}</td>
              <td>{asset.model}</td>
              <td>{asset.bmc_ip || '-'}</td>
              <td>{asset.user || '-'}</td>
              <td><span className={`status ${asset.status}`}>{statusText(asset.status)}</span></td>
              <td>{asset.department || '-'}</td>
              <td>
                <button className="btn-info" onClick={() => viewDetail(asset.id)}>详情</button>
                {isPending && (
                  <>
                    <button className="btn-success" onClick={() => confirmScrap(asset.id)}>确认报废</button>
                    <button className="btn-danger" onClick={() => deleteToRecycle(asset.id)}>移至回收站</button>
                  </>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className="asset-scrap-management" style={{ padding: '20px' }}>
      <h2>资产报废管理</h2>
      <div className="tabs" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          className={activeTab === 'pending' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('pending')}
        >
          待报废资产
        </button>
        <button
          className={activeTab === 'scrapped' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('scrapped')}
        >
          已报废资产
        </button>
      </div>
      <div className="section-header" style={{ marginBottom: '12px' }}>
        <button className="btn-secondary" onClick={() => activeTab === 'pending' ? fetchPendingScrap() : fetchScrapped()}>
          刷新
        </button>
      </div>
      {loading ? (
        <p>加载中...</p>
      ) : (
        renderTable(activeTab === 'pending' ? pendingAssets : scrappedAssets, activeTab === 'pending')
      )}

      {/* 资产详情弹窗 */}
      {showDetail && selectedAsset && (
        <div className="modal-overlay" onClick={() => { setShowDetail(false); setSelectedAsset(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>资产详情 - {selectedAsset.sn}</h2>
              <button className="modal-close" onClick={() => { setShowDetail(false); setSelectedAsset(null); }}>×</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <p>加载中...</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div><strong>SN:</strong> {selectedAsset.sn}</div>
                    <div><strong>型号:</strong> {selectedAsset.model}</div>
                    <div><strong>品牌:</strong> {selectedAsset.brand || '-'}</div>
                    <div><strong>状态:</strong> {statusText(selectedAsset.status)}</div>
                    <div><strong>BMC IP:</strong> {selectedAsset.bmc_ip || '-'}</div>
                    <div><strong>使用人:</strong> {selectedAsset.user || '-'}</div>
                    <div><strong>部门:</strong> {selectedAsset.department || '-'}</div>
                    <div><strong>U位:</strong> {selectedAsset.u_position || '-'} ({selectedAsset.u_height || 0}U)</div>
                  </div>
                  {selectedAsset.history && selectedAsset.history.length > 0 && (
                    <div>
                      <strong>历史记录</strong>
                      <table style={{ width: '100%', marginTop: '8px' }}>
                        <thead>
                          <tr>
                            <th>时间</th>
                            <th>操作类型</th>
                            <th>操作人</th>
                            <th>备注</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAsset.history.map((h) => (
                            <tr key={h.id}>
                              <td>{new Date(h.date).toLocaleString('zh-CN')}</td>
                              <td>{h.action}</td>
                              <td>{h.operator}</td>
                              <td>{h.remark || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedAsset(null); }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetScrapManagement;
