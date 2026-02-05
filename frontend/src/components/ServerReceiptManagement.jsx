import React, { useState, useEffect, useRef } from 'react';
import { receiptAPI, assetAPI, serverAPI } from '../services/api';

/**
 * 服务器入库单管理
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
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    receipt_type: 'server',
    remark: ''
  });

  /** 录入新资产并入单（无在库资产时可直接创建） */
  const [newAssetForm, setNewAssetForm] = useState({ sn: '', model: '', brand: '', remark: '' });
  const [addingNew, setAddingNew] = useState(false);

  /** 批量导入服务器（Excel） */
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await receiptAPI.getReceipts('server');
      setReceipts(response.data || []);
    } catch (err) {
      console.error('获取服务器入库单列表失败:', err);
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
      setFormData({ receipt_type: 'server', remark: '' });
      await fetchReceipts();
      if (newReceipt && newReceipt.id) {
        const detailRes = await receiptAPI.getReceipt(newReceipt.id);
        setSelectedReceipt(detailRes.data);
        setShowDetail(true);
        setShowAddAssetModal(true);
        fetchAvailableAssets();
      }
    } catch (err) {
      console.error('创建服务器入库单失败:', err);
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
      console.error('获取服务器入库单详情失败:', err);
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
      console.error('删除服务器入库单失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('删除失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
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

  /** 创建新资产并加入本单（业界做法：入库时直接录入新资产） */
  const handleBatchImport = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setError('请选择 .xlsx 或 .xls 格式的 Excel 文件（服务器导入模板）');
      return;
    }
    try {
      setError(null);
      setImportResult(null);
      setImporting(true);
      const res = await serverAPI.importServers(file);
      setImportResult(res.data);
      if (res.data?.created > 0) {
        fetchReceipts();
      }
    } catch (err) {
      console.error('批量导入服务器失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('导入失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const createAndAddAsset = async (e) => {
    e?.preventDefault();
    const { sn, model, brand, remark } = newAssetForm;
    const snTrim = (sn || '').trim();
    const modelTrim = (model || '').trim();
    if (!snTrim || !modelTrim) {
      setError('SN 和型号为必填');
      return;
    }
    if (!selectedReceipt) return;
    try {
      setError(null);
      setAddingNew(true);
      const createRes = await assetAPI.createAsset({
        sn: snTrim,
        model: modelTrim,
        brand: (brand || '').trim() || undefined,
        remark: (remark || '').trim() || undefined,
        status: 'in_storage'
      });
      const newAsset = createRes.data;
      if (newAsset?.id) {
        await receiptAPI.addReceiptItem(selectedReceipt.id, newAsset.id);
        setNewAssetForm({ sn: '', model: '', brand: '', remark: '' });
        await viewReceiptDetail(selectedReceipt.id);
        fetchAvailableAssets();
      }
    } catch (err) {
      console.error('创建并添加资产失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('创建并添加失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setAddingNew(false);
    }
  };

  const submitReceipt = async () => {
    if (!selectedReceipt) return;
    if (!selectedReceipt.items?.length) {
      setError('至少需有一条资产明细才能提交入库');
      return;
    }
    if (!window.confirm('提交后将锁定单据，不可再添加/删除明细。确定提交入库？')) return;
    try {
      setError(null);
      await receiptAPI.submitReceipt(selectedReceipt.id);
      await viewReceiptDetail(selectedReceipt.id);
      fetchReceipts();
    } catch (err) {
      console.error('提交入库失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('提交失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const revokeReceiptItem = async (itemId) => {
    const isDraft = selectedReceipt?.status === 'draft';
    const msg = isDraft ? '确定从本单移除该资产？资产将保留可入其他单。' : '确定撤销该资产？仅可撤销两天内录入的，且需管理员权限。';
    if (!window.confirm(msg)) return;
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
      console.error('移除/撤销资产失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('操作失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
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
      <h2>服务器入库单管理</h2>
      {error && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '4px', color: '#c00' }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: '12px', fontSize: '12px' }}>关闭</button>
        </div>
      )}
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => { setError(null); setShowCreateForm(true); }}>创建服务器入库单</button>
        <button className="btn-secondary" onClick={fetchReceipts}>刷新</button>
        <span style={{ marginLeft: '8px' }}>
          <a href="/服务器导入模板_(5).xlsx" download style={{ marginRight: '8px', fontSize: '13px' }}>下载导入模板</a>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleBatchImport}
          />
          <button
            className="btn-secondary"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? '导入中...' : '批量导入服务器'}
          </button>
        </span>
      </div>
      {importResult && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '4px', fontSize: '13px' }}>
          <strong>导入结果：</strong> 成功入库 {importResult.created} 台，跳过 {importResult.skipped} 条
          {importResult.skipped_details?.length > 0 && (
            <span>（跳过原因：IP或主机名已存在等）</span>
          )}
          {importResult.errors?.length > 0 && (
            <div style={{ marginTop: '6px', color: '#c00' }}>错误行：{importResult.errors.map((e) => `第${e.row}行 ${e.reason}`).join('; ')}</div>
          )}
          <button type="button" onClick={() => setImportResult(null)} style={{ marginLeft: '12px', fontSize: '12px' }}>关闭</button>
        </div>
      )}

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
        <p style={{ padding: '24px', textAlign: 'center', color: '#666' }}>加载中...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>入库单号</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>类型</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>状态</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>制单人</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>资产数量</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>制单时间</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>入库时间</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>暂无服务器入库单，请先创建</td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_number}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_type === 'part' ? '配件' : '服务器'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <span style={{ color: receipt.status === 'submitted' ? '#0a0' : '#666' }}>
                      {receipt.status === 'submitted' ? '已入库' : '草稿'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.operator}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.asset_count}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formatDateTime(receipt.created_at)}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.submitted_at ? formatDateTime(receipt.submitted_at) : '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button onClick={() => viewReceiptDetail(receipt.id)} style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}>查看详情</button>
                    {receipt.status === 'draft' && (
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
              <div style={{ marginBottom: '15px' }}><strong>状态:</strong> <span style={{ color: selectedReceipt.status === 'submitted' ? '#0a0' : '#666' }}>{selectedReceipt.status === 'submitted' ? '已入库' : '草稿'}</span></div>
              <div style={{ marginBottom: '15px' }}><strong>制单人:</strong> {selectedReceipt.operator}</div>
              <div style={{ marginBottom: '15px' }}><strong>资产数量:</strong> {selectedReceipt.asset_count}</div>
              <div style={{ marginBottom: '15px' }}><strong>制单时间:</strong> {formatDateTime(selectedReceipt.created_at)}</div>
              {selectedReceipt.submitted_at && <div style={{ marginBottom: '15px' }}><strong>入库时间:</strong> {formatDateTime(selectedReceipt.submitted_at)}</div>}
              {selectedReceipt.remark && <div style={{ marginBottom: '15px' }}><strong>备注:</strong> {selectedReceipt.remark}</div>}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong>资产明细</strong>
                  {selectedReceipt.status === 'draft' && (
                    <button className="btn-primary" onClick={() => { fetchAvailableAssets(); setShowAddAssetModal(true); }}>添加资产</button>
                  )}
                </div>
                {selectedReceipt.status === 'submitted' && <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>已入库单仅可撤销两天内录入的资产（需管理员）</p>}
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
                            <button onClick={() => revokeReceiptItem(item.id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                              {selectedReceipt.status === 'draft' ? '移除' : '撤销'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#666', marginTop: '10px' }}>{selectedReceipt.status === 'draft' ? '暂无资产，可点击「添加资产」加入' : '暂无资产'}</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>关闭</button>
              {selectedReceipt.status === 'draft' && selectedReceipt.items?.length > 0 && (
                <button className="btn-primary" onClick={submitReceipt} style={{ marginLeft: '8px' }}>提交入库</button>
              )}
              {selectedReceipt.status === 'draft' && (
                <button className="btn-secondary" onClick={() => deleteReceipt(selectedReceipt.id)} style={{ marginLeft: '8px', backgroundColor: '#dc3545', color: 'white' }}>删除入库单</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddAssetModal && (
        <div className="modal-overlay" onClick={() => setShowAddAssetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h2>添加资产到入库单</h2>
              <button className="modal-close" onClick={() => setShowAddAssetModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {/* 选择已有在库资产 */}
              <div style={{ marginBottom: '20px' }}>
                <strong style={{ display: 'block', marginBottom: '8px' }}>选择已有在库资产</strong>
                {assetsNotInReceipt.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>暂无在库且未加入本单的资产，可在下方录入新资产并入单</p>
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
              {/* 录入新资产并入单（业界做法：无在库资产时可直接创建） */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '8px' }}>录入新资产并入单</strong>
                <form onSubmit={createAndAddAsset}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '140px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>SN <span style={{ color: '#c00' }}>*</span></label>
                      <input
                        type="text"
                        value={newAssetForm.sn}
                        onChange={(e) => setNewAssetForm((f) => ({ ...f, sn: e.target.value }))}
                        placeholder="序列号"
                        style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ minWidth: '140px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>型号 <span style={{ color: '#c00' }}>*</span></label>
                      <input
                        type="text"
                        value={newAssetForm.model}
                        onChange={(e) => setNewAssetForm((f) => ({ ...f, model: e.target.value }))}
                        placeholder="型号"
                        style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ minWidth: '100px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>品牌</label>
                      <input
                        type="text"
                        value={newAssetForm.brand}
                        onChange={(e) => setNewAssetForm((f) => ({ ...f, brand: e.target.value }))}
                        placeholder="可选"
                        style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>备注</label>
                      <input
                        type="text"
                        value={newAssetForm.remark}
                        onChange={(e) => setNewAssetForm((f) => ({ ...f, remark: e.target.value }))}
                        placeholder="可选"
                        style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={addingNew} style={{ padding: '6px 14px' }}>
                        {addingNew ? '处理中...' : '创建并加入本单'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
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
