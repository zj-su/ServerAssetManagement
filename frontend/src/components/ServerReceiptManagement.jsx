import React, { useState, useEffect } from 'react';
import { receiptAPI, assetAPI } from '../services/api';

/**
 * 服务器入库单管理 - 与项目介绍 7.1 ServerReceiptManagement.jsx 一致
 * 服务器入库单列表、创建服务器入库单、入库单明细管理
 */
const ServerReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);

  const [formData, setFormData] = useState({
    receipt_type: 'server',
    remark: ''
  });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await receiptAPI.getReceipts('server');
      setReceipts(response.data || []);
    } catch (err) {
      console.error('获取服务器入库单列表失败:', err);
      alert('获取服务器入库单列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const createReceipt = async () => {
    try {
      await receiptAPI.createReceipt(formData);
      alert('服务器入库单创建成功');
      setShowCreateForm(false);
      setFormData({ receipt_type: 'server', remark: '' });
      fetchReceipts();
    } catch (err) {
      console.error('创建服务器入库单失败:', err);
      alert('创建失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const viewReceiptDetail = async (receiptId) => {
    try {
      const response = await receiptAPI.getReceipt(receiptId);
      setSelectedReceipt(response.data);
      setShowDetail(true);
    } catch (err) {
      console.error('获取服务器入库单详情失败:', err);
      alert('获取详情失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('确定要删除这个入库单吗？只有空入库单才能删除。')) return;
    try {
      await receiptAPI.deleteReceipt(receiptId);
      alert('入库单已删除');
      fetchReceipts();
    } catch (err) {
      console.error('删除服务器入库单失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

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
      await receiptAPI.addReceiptItem(selectedReceipt.id, assetId);
      alert('资产已添加到入库单');
      viewReceiptDetail(selectedReceipt.id);
      fetchAvailableAssets();
    } catch (err) {
      console.error('添加资产失败:', err);
      alert('添加失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const revokeReceiptItem = async (itemId) => {
    if (!window.confirm('确定要撤销这个资产吗？只能撤销两天内录入的资产。')) return;
    if (!selectedReceipt) return;
    try {
      await receiptAPI.revokeReceiptItem(selectedReceipt.id, itemId);
      alert('资产已撤销');
      viewReceiptDetail(selectedReceipt.id);
    } catch (err) {
      console.error('撤销资产失败:', err);
      alert('撤销失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>服务器入库单管理</h2>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button className="btn-primary" onClick={() => setShowCreateForm(true)}>创建服务器入库单</button>
        <button onClick={fetchReceipts}>刷新</button>
      </div>

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建服务器入库单</h2>
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
        <p>加载中...</p>
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
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>暂无服务器入库单数据</td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_number}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_type === 'part' ? '配件' : '服务器'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.operator}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.asset_count}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{new Date(receipt.created_at).toLocaleString('zh-CN')}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button onClick={() => viewReceiptDetail(receipt.id)} style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}>查看详情</button>
                    {receipt.asset_count === 0 && (
                      <button onClick={() => deleteReceipt(receipt.id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white' }}>删除</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {showDetail && selectedReceipt && (
        <div className="modal-overlay" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>入库单详情 - {selectedReceipt.receipt_number}</h2>
              <button className="modal-close" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '15px' }}><strong>入库单号:</strong> {selectedReceipt.receipt_number}</div>
              <div style={{ marginBottom: '15px' }}><strong>类型:</strong> {selectedReceipt.receipt_type === 'part' ? '配件' : '服务器'}</div>
              <div style={{ marginBottom: '15px' }}><strong>操作人:</strong> {selectedReceipt.operator}</div>
              <div style={{ marginBottom: '15px' }}><strong>资产数量:</strong> {selectedReceipt.asset_count}</div>
              {selectedReceipt.remark && <div style={{ marginBottom: '15px' }}><strong>备注:</strong> {selectedReceipt.remark}</div>}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong>资产明细:</strong>
                  <button className="btn-primary" onClick={() => { fetchAvailableAssets(); setShowAddAssetModal(true); }}>添加资产</button>
                </div>
                {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
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
                      {selectedReceipt.items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.asset_code || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.sn}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.brand || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.model || '-'}</td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            <button onClick={() => revokeReceiptItem(item.id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white' }}>撤销</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#666', marginTop: '10px' }}>暂无资产</p>
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
              {availableAssets.length === 0 ? (
                <p>没有可用的资产</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>SN</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>品牌</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>型号</th>
                      <th style={{ padding: '8px', border: '1px solid #ddd' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.sn}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.brand || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{asset.model || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                          <button onClick={() => { addAssetToReceipt(asset.id); setShowAddAssetModal(false); }} style={{ padding: '4px 8px', fontSize: '12px' }}>添加</button>
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

export default ServerReceiptManagement;
