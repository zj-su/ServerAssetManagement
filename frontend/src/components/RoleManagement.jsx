import React, { useState, useEffect } from 'react';
import { roleAPI } from '../services/api';

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({ name: '', description: '', permissions: [] });

  // 可用权限列表
  const availablePermissions = [
    { key: 'server:read', label: '服务器查看' },
    { key: 'server:write', label: '服务器编辑' },
    { key: 'server:delete', label: '服务器删除' },
    { key: 'part:read', label: '配件查看' },
    { key: 'part:write', label: '配件编辑' },
    { key: 'part:delete', label: '配件删除' },
    { key: 'receipt:read', label: '入库单查看' },
    { key: 'receipt:write', label: '入库单编辑' },
    { key: 'receipt:delete', label: '入库单删除' },
    { key: 'scrap:read', label: '报废管理查看' },
    { key: 'scrap:write', label: '报废管理操作' },
    { key: 'user:read', label: '用户查看' },
    { key: 'user:write', label: '用户编辑' },
    { key: 'user:delete', label: '用户删除' },
    { key: 'role:read', label: '角色查看' },
    { key: 'role:write', label: '角色编辑' },
    { key: 'role:delete', label: '角色删除' },
  ];

  useEffect(() => {
    fetchRoles();
  }, []);

  // 获取角色列表
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await roleAPI.getRoles();
      setRoles(response.data || []);
    } catch (err) {
      console.error('获取角色列表失败:', err);
      // 如果API不存在，使用默认角色
      setRoles([
        { id: 1, name: 'admin', description: '管理员', permissions: ['*'] },
        { id: 2, name: 'user', description: '普通用户', permissions: ['server:read', 'part:read', 'receipt:read'] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 打开添加角色弹窗
  const openAddRoleModal = () => {
    setEditingRole(null);
    setRoleFormData({ name: '', description: '', permissions: [] });
    setShowRoleModal(true);
  };

  // 打开编辑角色弹窗
  const openEditRoleModal = (role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name || '',
      description: role.description || '',
      permissions: role.permissions || []
    });
    setShowRoleModal(true);
  };

  // 关闭角色弹窗
  const closeRoleModal = () => {
    setShowRoleModal(false);
    setEditingRole(null);
    setRoleFormData({ name: '', description: '', permissions: [] });
  };

  // 处理角色表单输入
  const handleRoleInputChange = (e) => {
    const { name, value } = e.target;
    setRoleFormData(prev => ({ ...prev, [name]: value }));
  };

  // 处理权限勾选
  const handlePermissionChange = (permKey) => {
    setRoleFormData(prev => {
      const perms = prev.permissions || [];
      if (perms.includes(permKey)) {
        return { ...prev, permissions: perms.filter(p => p !== permKey) };
      } else {
        return { ...prev, permissions: [...perms, permKey] };
      }
    });
  };

  // 提交角色表单
  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) {
      alert('请输入角色名称');
      return;
    }
    try {
      if (editingRole) {
        await roleAPI.updateRole(editingRole.id, roleFormData);
        alert('角色更新成功');
      } else {
        await roleAPI.createRole(roleFormData);
        alert('角色创建成功');
      }
      closeRoleModal();
      fetchRoles();
    } catch (err) {
      console.error('保存角色失败:', err);
      alert('保存失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 删除角色
  const deleteRole = async (roleId, roleName) => {
    if (roleName === 'admin') {
      alert('不能删除管理员角色');
      return;
    }
    if (!window.confirm(`确定要删除角色 "${roleName}" 吗？`)) {
      return;
    }
    try {
      await roleAPI.deleteRole(roleId);
      alert('删除成功');
      fetchRoles();
    } catch (err) {
      console.error('删除角色失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>角色管理</h2>

      {/* 操作栏 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={openAddRoleModal} 
          style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          添加角色
        </button>
        <button 
          onClick={fetchRoles} 
          style={{ padding: '8px 16px' }}
        >
          刷新
        </button>
      </div>

      {/* 角色列表 */}
      {loading ? (
        <p>加载中...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>ID</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>角色名称</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>描述</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>权限数量</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>
                  暂无角色数据
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{role.id}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      backgroundColor: role.name === 'admin' ? '#dc3545' : '#6c757d',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {role.name}
                    </span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{role.description || '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {role.permissions?.includes('*') ? '全部权限' : (role.permissions?.length || 0)}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button 
                      onClick={() => openEditRoleModal(role)}
                      style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}
                    >
                      编辑
                    </button>
                    {role.name !== 'admin' && (
                      <button 
                        onClick={() => deleteRole(role.id, role.name)}
                        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
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

      {/* 角色编辑/添加弹窗 */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={closeRoleModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingRole ? '编辑角色' : '添加角色'}</h2>
              <button className="modal-close" onClick={closeRoleModal}>×</button>
            </div>
            <form onSubmit={handleRoleSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>角色名称 *</label>
                  <input
                    type="text"
                    name="name"
                    value={roleFormData.name}
                    onChange={handleRoleInputChange}
                    disabled={editingRole?.name === 'admin'}
                    style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="请输入角色名称"
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>描述</label>
                  <input
                    type="text"
                    name="description"
                    value={roleFormData.description}
                    onChange={handleRoleInputChange}
                    style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="请输入角色描述"
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>权限配置</label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '8px',
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {availablePermissions.map((perm) => (
                      <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={roleFormData.permissions?.includes(perm.key) || roleFormData.permissions?.includes('*')}
                          onChange={() => handlePermissionChange(perm.key)}
                          disabled={editingRole?.name === 'admin'}
                        />
                        <span style={{ fontSize: '13px' }}>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeRoleModal}>取消</button>
                <button 
                  type="submit" 
                  style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {editingRole ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
