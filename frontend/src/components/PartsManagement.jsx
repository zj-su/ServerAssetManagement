import React, { useState, useEffect } from 'react';
import { assetAPI } from '../services/api';

/**
 * 配件管理 - 配件列表、配件管理操作
 * 与项目介绍 7.1 主要页面组件 - PartsManagement.jsx 一致
 * 配件为在库状态(in_storage)的资产
 */
const PartsManagement = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formData, setFormData] = useState({
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
    status: 'in_storage',
    location: '',
    department: ''
  });

  const fetchParts = async () => {
    try {
      setLoading(true);
      const response = await assetAPI.getAssets('in_storage');
      setParts(response.data || []);
    } catch (err) {
      console.error('获取配件列表失败:', err);
      alert('获取配件列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const openCreate = () => {
    setEditingPart(null);
    setFormData({
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
      status: 'in_storage',
      location: '',
      department: ''
    });
    setShowForm(true);
  };

  const openEdit = (asset) => {
    setEditingPart(asset);
    setFormData({
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
      status: asset.status || 'in_storage',
      location: asset.location || '',
      department: asset.department || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPart) {
        await assetAPI.updateAsset(editingPart.id, formData);
        alert('配件更新成功');
      } else {
        await assetAPI.createAsset(formData);
        alert('配件添加成功');
      }
      setShowForm(false);
      fetchParts();
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const scrapPart = async (id) => {
    if (!window.confirm('确定要将此配件标记为待报废吗？')) return;
    try {
      await assetAPI.scrapAsset(id);
      alert('已标记为待报废');
      fetchParts();
    } catch (err) {
      console.error('操作失败:', err);
      alert('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteToRecycle = async (id) => {
    if (!window.confirm('确定要删除此配件吗？将移至回收站。')) return;
    try {
      await assetAPI.deleteAsset(id);
      alert('已移至回收站');
      fetchParts();
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
      setSelectedPart(asset);
      setShowDetail(true);
    } catch (err) {
      console.error('获取详情失败:', err);
      alert('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const statusText = (s) => ({ in_storage: '在库', in_use: '使用中', maintenance: '维修中', idle: '空闲', pending_scrap: '待报废', scrapped: '已报废', deleted: '已删除' }[s] || s);

  return (
    <div className="parts-management" style={{ padding: '20px' }}>
      <h2>配件管理</h2>
      <div className="section-header" style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
        <button className="btn-primary" onClick={openCreate}>添加配件</button>
        <button className="btn-secondary" onClick={fetchParts}>刷新</button>
      </div>
      {loading ? (
        <p>加载中...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SN</th>
              <th>品牌</th>
              <th>型号</th>
              <th>BMC IP</th>
              <th>使用人</th>
              <th>U位</th>
              <th>部门</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center' }}>暂无配件数据（在库资产）</td>
              </tr>
            ) : (
              parts.map((p) => (
                <tr key={p.id}>
                  <td>{p.sn}</td>
                  <td>{p.brand || '-'}</td>
                  <td>{p.model}</td>
                  <td>{p.bmc_ip || '-'}</td>
                  <td>{p.user || '-'}</td>
                  <td>{p.u_position ? `${p.u_position} (${p.u_height || 0}U)` : '-'}</td>
                  <td>{p.department || '-'}</td>
                  <td>
                    <button className="btn-info" onClick={() => viewDetail(p.id)}>详情</button>
                    <button className="btn-primary" onClick={() => openEdit(p)}>编辑</button>
                    <button className="btn-warning" onClick={() => scrapPart(p.id)}>待报废</button>
                    <button className="btn-danger" onClick={() => deleteToRecycle(p.id)}>删除</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* 创建/编辑表单 */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPart ? '编辑配件' : '添加配件'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>序列号 SN *</label>
                  <input
                    type="text"
                    value={formData.sn}
                    onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
                    required
                    disabled={!!editingPart}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>品牌</label>
                    <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>型号 *</label>
                    <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>BMC IP</label>
                  <input type="text" value={formData.bmc_ip} onChange={(e) => setFormData({ ...formData, bmc_ip: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>使用人</label>
                  <input type="text" value={formData.user} onChange={(e) => setFormData({ ...formData, user: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>部门</label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>U位</label>
                    <input type="text" value={formData.u_position} onChange={(e) => setFormData({ ...formData, u_position: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>U高度</label>
                    <input type="number" min={1} value={formData.u_height} onChange={(e) => setFormData({ ...formData, u_height: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
                  <button type="submit" className="btn-primary">{editingPart ? '更新' : '创建'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetail && selectedPart && (
        <div className="modal-overlay" onClick={() => { setShowDetail(false); setSelectedPart(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>配件详情 - {selectedPart.sn}</h2>
              <button className="modal-close" onClick={() => { setShowDetail(false); setSelectedPart(null); }}>×</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <p>加载中...</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div><strong>SN:</strong> {selectedPart.sn}</div>
                    <div><strong>型号:</strong> {selectedPart.model}</div>
                    <div><strong>品牌:</strong> {selectedPart.brand || '-'}</div>
                    <div><strong>状态:</strong> {statusText(selectedPart.status)}</div>
                    <div><strong>使用人:</strong> {selectedPart.user || '-'}</div>
                    <div><strong>部门:</strong> {selectedPart.department || '-'}</div>
                    <div><strong>BMC IP:</strong> {selectedPart.bmc_ip || '-'}</div>
                    <div><strong>系统IP:</strong> {selectedPart.system_ip || '-'}</div>
                  </div>
                  {selectedPart.history && selectedPart.history.length > 0 && (
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
                          {selectedPart.history.map((h) => (
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
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedPart(null); }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsManagement;
