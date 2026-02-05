import React, { useState, useEffect } from 'react';
import { receiptAPI, assetAPI } from '../services/api';

/**
 * 配件入库单管理
 * 配件入库单列表、创建配件入库单、入库单明细管理
 */
const PartReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    receipt_type: 'part',
    remark: ''
  });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await receiptAPI.getReceipts('part');
      setReceipts(response.data || []);
    } catch (err) {
      console.error('获取配件入库单列表失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('获取列表失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setLoading(false);
    }
  };

  const createReceipt = async () => {
    try {
      setError(null);
      const response = await receiptAPI.createReceipt(formData);
      const newReceipt = response.data;
      setShowCreateForm(false);
      setFormData({ receipt_type: 'part', remark: '' });
      await fetchReceipts();
      if (newReceipt && newReceipt.id) {
        const detailRes = await receiptAPI.getReceipt(newReceipt.id);
        setSelectedReceipt(detailRes.data);
        setShowDetail(true);
        setShowAddAssetModal(true);
        fetchAvailableAssets();
      }
    } catch (err) {
      console.error('创建配件入库单失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('创建失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const viewReceiptDetail = async (receiptId) => {
    try {
      setError(null);
      const response = await receiptAPI.getReceipt(receiptId);
      setSelectedReceipt(response.data);
      setShowDetail(true);
    } catch (err) {
      console.error('获取配件入库单详情失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('获取详情失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('确定要删除这个入库单吗？只有空入库单才能删除。')) return;
    try {
      setError(null);
      await receiptAPI.deleteReceipt(receiptId);
      setShowDetail(false);
      setSelectedReceipt(null);
      setShowAddAssetModal(false);
      fetchReceipts();
    } catch (err) {
      console.error('删除配件入库单失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('删除失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  // 获取可用资产（在库的配件）
  const fetchAvailableAssets = async () => {
    try {
      const response = await assetAPI.getAssets('in_storage');
      setAvailableAssets(response.data || []);
    } catch (err) {
      console.error('获取可用资产失败:', err);
    }
  };

  const addAssetToReceipt = async (assetId) => {
    if (!selectedReceipt) return;
    try {
      setError(null);
      await receiptAPI.addReceiptItem(selectedReceipt.id, assetId);
      await viewReceiptDetail(selectedReceipt.id);
      fetchAvailableAssets();
    } catch (err) {
      console.error('添加资产失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('添加失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const revokeReceiptItem = async (itemId) => {
    if (!window.confirm('确定要撤销该资产吗？仅可撤销两天内录入的资产。')) return;
    if (!selectedReceipt) return;
    try {
      setError(null);
      await receiptAPI.revokeReceiptItem(selectedReceipt.id, itemId);
      await viewReceiptDetail(selectedReceipt.id);
      if (selectedReceipt.items?.length <= 1) {
        setShowDetail(false);
        setSelectedReceipt(null);
        setShowAddAssetModal(false);
      }
      fetchReceipts();
    } catch (err) {
      console.error('撤销资产失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('撤销失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const assetsNotInReceipt = selectedReceipt?.items
    ? availableAssets.filter((a) => !selectedReceipt.items.some((it) => it.asset_id === a.id))
    : availableAssets;

  const formatDateTime = (str) => {
    if (!str) return '-';
    const d = new Date(str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>配件入库单管理</h2>
      {error && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '4px', color: '#c00' }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: '12px', fontSize: '12px' }}>关闭</button>
        </div>
      )}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button className="btn-primary" onClick={() => { setError(null); setShowCreateForm(true); }}>创建配件入库单</button>
        <button className="btn-secondary" onClick={fetchReceipts}>刷新</button>
      </div>

      {/* 创建入库单表单 */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建配件入库单</h2>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>备注:</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows="3"
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateForm(false)}>取消</button>
              <button className="btn-primary" onClick={createReceipt}>创建</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ padding: '24px', textAlign: 'center', color: '#666' }}>加载中...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>入库单号</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>类型</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作人</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>资产数量</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>创建时间</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>暂无配件入库单，请先创建</td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_number}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {receipt.receipt_type === 'part' ? '配件' : '服务器'}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.operator}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.asset_count}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {new Date(receipt.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button 
                      onClick={() => viewReceiptDetail(receipt.id)}
                      style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}
                    >
                      查看详情
                    </button>
                    {receipt.asset_count === 0 && (
                      <button 
                        onClick={() => deleteReceipt(receipt.id)}
                        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white' }}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* 入库单详情 */}
      {showDetail && selectedReceipt && (
        <div className="modal-overlay" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>入库单详情 - {selectedReceipt.receipt_number}</h2>
              <button className="modal-close" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '15px' }}>
                <strong>入库单号:</strong> {selectedReceipt.receipt_number}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>类型:</strong> {selectedReceipt.receipt_type === 'part' ? '配件' : '服务器'}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>操作人:</strong> {selectedReceipt.operator}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>资产数量:</strong> {selectedReceipt.asset_count}
              </div>
              {selectedReceipt.remark && (
                <div style={{ marginBottom: '15px' }}>
                  <strong>备注:</strong> {selectedReceipt.remark}
                </div>
              )}
              
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong>资产明细</strong>
                  <button className="btn-primary" onClick={() => { fetchAvailableAssets(); setShowAddAssetModal(true); }}>添加资产</button>
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>仅可撤销两天内录入的资产</p>
                {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>资产编码</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>SN</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>品牌</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>型号</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>录入时间</th>
                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.asset_code || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.sn}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.brand || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.model || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{formatDateTime(item.created_at)}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            <button onClick={() => revokeReceiptItem(item.id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>撤销</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#666', marginTop: '10px' }}>暂无资产，可点击「添加资产」加入</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {showAddAssetModal && (
        <div className="modal-overlay" onClick={() => setShowAddAssetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>添加资产到入库单</h2>
              <button className="modal-close" onClick={() => setShowAddAssetModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {assetsNotInReceipt.length === 0 ? (
                <p style={{ color: '#666' }}>没有可添加的资产（在库且未加入本单的资产）</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>资产编码</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>SN</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>品牌</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>型号</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsNotInReceipt.map((asset) => (
                      <tr key={asset.id}>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.asset_code || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.sn}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.brand || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.model || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                          <button className="btn-primary" onClick={() => addAssetToReceipt(asset.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>添加</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddAssetModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartReceiptManagement;
