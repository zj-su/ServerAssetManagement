import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getUsers();
      setUsers(response.data || []);
    } catch (err) {
      console.error('获取用户列表失败:', err);
      alert('获取用户列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 搜索用户
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      fetchUsers();
      return;
    }
    
    try {
      setLoading(true);
      const response = await userAPI.searchUsers(searchQuery);
      setUsers(response.data || []);
    } catch (err) {
      console.error('搜索用户失败:', err);
      alert('搜索失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 获取AD域用户组
  const fetchUserGroups = async (userId) => {
    try {
      setLoadingGroups(true);
      const response = await userAPI.getUserGroups(userId);
      setUserGroups(response.data || []);
    } catch (err) {
      console.error('获取用户组失败:', err);
      setUserGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  // 同步AD域用户
  const syncAdUser = async (username) => {
    if (!window.confirm(`确定要同步AD域用户 "${username}" 吗？`)) {
      return;
    }
    
    try {
      await userAPI.syncAdUser(username);
      alert('同步成功');
      fetchUsers();
    } catch (err) {
      console.error('同步AD域用户失败:', err);
      alert('同步失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 批量同步所有AD域用户
  const syncAllAdUsers = async () => {
    if (!window.confirm('确定要同步所有AD域用户吗？这可能需要一些时间。')) {
      return;
    }
    
    try {
      await userAPI.syncAllAdUsers();
      alert('同步任务已触发，请稍后刷新查看结果');
      fetchUsers();
    } catch (err) {
      console.error('批量同步失败:', err);
      alert('同步失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 查看用户详情
  const viewUserDetail = async (user) => {
    setSelectedUser(user);
    if (user.is_ad_user) {
      fetchUserGroups(user.id);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>用户管理</h2>
      
      {/* 搜索栏 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="搜索用户（用户名、邮箱、显示名称）"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
          style={{ flex: 1, padding: '8px', fontSize: '14px' }}
        />
        <button onClick={searchUsers} style={{ padding: '8px 16px' }}>
          搜索
        </button>
        <button onClick={fetchUsers} style={{ padding: '8px 16px' }}>
          刷新
        </button>
        <button onClick={syncAllAdUsers} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white' }}>
          同步所有AD域用户
        </button>
      </div>

      {/* 用户列表 */}
      {loading ? (
        <p>加载中...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>ID</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>用户名</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>显示名称</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>邮箱</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>角色</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>类型</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center' }}>
                  暂无用户数据
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{user.id}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{user.username}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{user.display_name || '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{user.email}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      backgroundColor: user.role === 'admin' ? '#dc3545' : '#6c757d',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {user.is_ad_user ? (
                      <span style={{ color: '#28a745' }}>AD域用户</span>
                    ) : (
                      <span style={{ color: '#6c757d' }}>本地用户</span>
                    )}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button 
                      onClick={() => viewUserDetail(user)}
                      style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}
                    >
                      查看详情
                    </button>
                    {user.is_ad_user && (
                      <button 
                        onClick={() => syncAdUser(user.username)}
                        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#17a2b8', color: 'white' }}
                      >
                        同步
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* 用户详情模态框 */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>用户详情 - {selectedUser.username}</h2>
              <button className="modal-close" onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '15px' }}>
                <strong>用户名:</strong> {selectedUser.username}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>显示名称:</strong> {selectedUser.display_name || '-'}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>邮箱:</strong> {selectedUser.email}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>角色:</strong> {selectedUser.role === 'admin' ? '管理员' : '普通用户'}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>用户类型:</strong> {selectedUser.is_ad_user ? 'AD域用户' : '本地用户'}
              </div>
              {selectedUser.is_ad_user && (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <strong>AD域DN:</strong> {selectedUser.ad_dn || '-'}
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <strong>用户所属的AD域组:</strong>
                    {loadingGroups ? (
                      <p>加载中...</p>
                    ) : userGroups.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                        {userGroups.map((group, index) => (
                          <li key={index} style={{ 
                            padding: '8px', 
                            margin: '5px 0', 
                            backgroundColor: '#f5f5f5', 
                            borderRadius: '4px' 
                          }}>
                            {group}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#666', marginTop: '10px' }}>
                        该用户未加入任何AD域组，或无法获取组信息
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedUser(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
