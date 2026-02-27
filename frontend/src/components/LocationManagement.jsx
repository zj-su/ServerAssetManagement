import React, { useEffect, useState } from 'react';
import { locationAPI } from '../services/api';

/**
 * 位置管理：创建机房/仓库等地址信息
 */
const LocationManagement = ({ permissions = [] }) => {
  const hasPermission = (perm) => permissions.includes('*') || permissions.includes(perm);
  const canWrite = hasPermission('server:write');
  const canDelete = hasPermission('server:delete');

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    description: '',
  });
  const wrapCellStyle = { whiteSpace: 'normal', wordBreak: 'break-word' };

  const fetchLocations = async (query = '', targetPage = page) => {
    try {
      setLoading(true);
      const skip = (targetPage - 1) * pageSize;
      const [listRes, countRes] = await Promise.all([
        locationAPI.getLocations({ query: query || undefined, skip, limit: pageSize }),
        locationAPI.countLocations({ query: query || undefined }),
      ]);
      setLocations(Array.isArray(listRes.data) ? listRes.data : []);
      setTotal(Number(countRes.data?.total || 0));
      setPage(targetPage);
    } catch (err) {
      console.error('获取位置列表失败:', err);
      alert('获取位置列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations('', 1);
  }, []);

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ name: '', address: '', description: '' });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      address: item.address || '',
      description: item.description || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('位置名称不能为空');
      return;
    }
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
      };
      if (editingItem) {
        await locationAPI.updateLocation(editingItem.id, payload);
        alert('位置更新成功');
      } else {
        await locationAPI.createLocation(payload);
        alert('位置创建成功');
      }
      setShowForm(false);
      setEditingItem(null);
      fetchLocations(searchText, 1);
    } catch (err) {
      console.error('保存位置失败:', err);
      alert('保存失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除该位置吗？')) return;
    try {
      await locationAPI.deleteLocation(id);
      alert('删除成功');
      const totalAfterDelete = Math.max(total - 1, 0);
      const maxPageAfterDelete = Math.max(1, Math.ceil(totalAfterDelete / pageSize));
      const targetPage = Math.min(page, maxPageAfterDelete);
      fetchLocations(searchText, targetPage);
    } catch (err) {
      console.error('删除位置失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <section className="dashboard">
      <div className="section-header">
        <h2>位置管理</h2>
        <div className="header-actions">
          <button className="btn-refresh" onClick={() => fetchLocations(searchText, page)}>刷新</button>
          {canWrite && <button className="btn-primary" onClick={openCreate}>新增位置</button>}
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="搜索位置名称/地址"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', minWidth: '280px' }}
        />
        <button className="btn-secondary" onClick={() => fetchLocations(searchText, 1)}>搜索</button>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div className="servers-list">
          <table style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '180px' }}>位置名称</th>
                <th>地址信息</th>
                <th>备注</th>
                <th style={{ width: '170px' }}>创建时间</th>
                <th style={{ width: '120px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>暂无位置数据</td>
                </tr>
              ) : (
                locations.map((item) => (
                  <tr key={item.id}>
                    <td style={wrapCellStyle}>{item.id}</td>
                    <td style={wrapCellStyle}>{item.name}</td>
                    <td style={wrapCellStyle}>{item.address || '-'}</td>
                    <td style={wrapCellStyle}>{item.description || '-'}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-'}</td>
                    <td>
                      {canWrite && <button className="btn-secondary" onClick={() => openEdit(item)}>编辑</button>}
                      {canDelete && <button className="btn-danger" onClick={() => handleDelete(item.id)}>删除</button>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <span style={{ color: '#666', fontSize: '13px' }}>
          共 {total} 条，当前第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => fetchLocations(searchText, page - 1)}
          >
            上一页
          </button>
          <button
            className="btn-secondary"
            disabled={page >= Math.max(1, Math.ceil(total / pageSize)) || loading}
            onClick={() => fetchLocations(searchText, page + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? '编辑位置' : '新增位置'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>位置名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：7号仓库、5FA机房"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>地址信息</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="可填写详细地址"
                  />
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="可选"
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
                  <button type="submit" className="btn-primary">{editingItem ? '更新' : '创建'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LocationManagement;
