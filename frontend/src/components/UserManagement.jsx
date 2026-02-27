import React, { useState, useEffect } from 'react';
import { userAPI, roleAPI } from '../services/api';

/** initialUserType: 'local' | 'ad' | 'ad-group' */
const UserManagement = ({ initialUserType = null, currentUserRole = 'user', permissions = [] }) => {
  const hasPermission = (perm) => (permissions || []).includes('*') || (permissions || []).includes(perm) || currentUserRole === 'admin';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [userTypeTab, setUserTypeTab] = useState(initialUserType || 'local'); // local | ad | ad-group
  const [adGroups, setAdGroups] = useState([]);
  const [loadingAdGroups, setLoadingAdGroups] = useState(false);
  const [adGroupsLoaded, setAdGroupsLoaded] = useState(false);
  const [adGroupsError, setAdGroupsError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleUser, setRoleUser] = useState(null);
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    email: '',
    role: 'user',
  });
  const [roleForm, setRoleForm] = useState({ role: 'user' });
  const [roleOptions, setRoleOptions] = useState(['user', 'admin']);

  const buildUserFilterParams = (tab = userTypeTab, query = searchQuery) => {
    const params = {};
    const q = (query || '').trim();
    if (q) params.query = q;
    if (tab === 'local') params.is_ad_user = false;
    if (tab === 'ad') params.is_ad_user = true;
    return params;
  };

  // 获取用户列表（带分页）
  const fetchUsers = async (targetPage = currentPage, tab = userTypeTab, query = searchQuery) => {
    if (tab === 'ad-group') return;
    try {
      setLoading(true);
      const filterParams = buildUserFilterParams(tab, query);
      const skip = (targetPage - 1) * pageSize;
      const [listRes, countRes] = await Promise.all([
        userAPI.getUsers({ ...filterParams, skip, limit: pageSize }),
        userAPI.countUsers(filterParams),
      ]);
      setUsers(listRes.data || []);
      setTotalUsers(Number(countRes.data?.total || 0));
    } catch (err) {
      console.error('获取用户列表失败:', err);
      alert('获取用户列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await roleAPI.getRoles();
      const names = (res.data || []).map((r) => r.name).filter(Boolean);
      if (names.length > 0) {
        setRoleOptions(names);
      }
    } catch (err) {
      setRoleOptions(['user', 'admin']);
    }
  };

  // 搜索用户
  const searchUsers = async () => {
    if (userTypeTab === 'ad-group') {
      // AD组页签按本地已加载数据即时过滤，无需额外请求
      return;
    }
    setCurrentPage(1);
    await fetchUsers(1, userTypeTab, searchQuery);
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

  // 聚合所有AD域用户组（组名 -> 成员）
  const fetchAllAdGroups = async (forceRefresh = false) => {
    if (!forceRefresh && adGroupsLoaded && adGroups.length > 0) return;
    try {
      setLoadingAdGroups(true);
      setAdGroupsError('');
      const cacheKey = 'ad_groups_cache_v1';
      if (!forceRefresh) {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const ts = Number(parsed?.ts || 0);
            const list = Array.isArray(parsed?.data) ? parsed.data : [];
            // 5分钟缓存，避免频繁切页重复打AD查询
            if (list.length > 0 && Date.now() - ts < 5 * 60 * 1000) {
              setAdGroups(list);
              setAdGroupsLoaded(true);
              return;
            }
          } catch (e) {
            // ignore cache parse errors
          }
        }
      }
      const res = await userAPI.getAdGroups({ skip: 0, limit: 5000 });
      const groupList = Array.isArray(res?.data?.items) ? res.data.items : [];
      setAdGroups(groupList);
      setAdGroupsLoaded(true);
      sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: groupList }));
    } catch (err) {
      console.error('加载AD域用户组失败:', err);
      setAdGroupsError(err?.response?.data?.detail || err?.message || '加载失败');
    } finally {
      setLoadingAdGroups(false);
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
      const res = await userAPI.syncAllAdUsers();
      const total = res?.data?.total ?? 0;
      const created = res?.data?.created ?? 0;
      const updated = res?.data?.updated ?? 0;
      const groups = res?.data?.groups ?? 0;
      alert(`同步完成：总数 ${total}，新增 ${created}，更新 ${updated}，组关系 ${groups}`);
      await fetchUsers(currentPage, userTypeTab, searchQuery);
      setAdGroupsLoaded(false);
      sessionStorage.removeItem('ad_groups_cache_v1');
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

  const openCreateModal = () => {
    setCreateForm({
      username: '',
      password: '',
      email: '',
      role: 'user',
    });
    setShowCreateModal(true);
  };

  const submitCreateUser = async (e) => {
    e.preventDefault();
    if (!hasPermission('user:write')) {
      alert('仅管理员可新增用户');
      return;
    }
    if (!createForm.username.trim() || !createForm.password.trim()) {
      alert('用户名和密码不能为空');
      return;
    }
    try {
      setCreatingUser(true);
      await userAPI.createUser({
        username: createForm.username.trim(),
        password: createForm.password,
        email: createForm.email.trim() || null,
        role: createForm.role,
      });
      alert('用户创建成功');
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      console.error('创建用户失败:', err);
      alert('创建失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreatingUser(false);
    }
  };

  const openRoleModal = (user) => {
    setRoleUser(user);
    setRoleForm({ role: user.role || 'user' });
    setShowRoleModal(true);
  };

  const submitAssignRole = async (e) => {
    e.preventDefault();
    if (!hasPermission('role:write')) {
      alert('仅管理员可分配角色');
      return;
    }
    if (!roleUser) return;
    try {
      setSavingRole(true);
      await userAPI.updateUser(roleUser.id, { role: roleForm.role });
      alert('角色分配成功');
      setShowRoleModal(false);
      setRoleUser(null);
      fetchUsers();
    } catch (err) {
      console.error('分配角色失败:', err);
      alert('分配失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingRole(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // 与外部联动：进入页面时同步 Tab
  useEffect(() => {
    if (initialUserType && (initialUserType === 'local' || initialUserType === 'ad' || initialUserType === 'ad-group')) {
      setUserTypeTab(initialUserType);
    }
  }, [initialUserType]);

  useEffect(() => {
    if (userTypeTab === 'ad-group') {
      fetchAllAdGroups(false);
    } else {
      fetchUsers(currentPage, userTypeTab, searchQuery);
    }
  }, [userTypeTab, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil((totalUsers || 0) / pageSize));

  return (
    <div style={{ padding: '20px' }}>
      <h2>用户管理</h2>

      {/* 本地用户 / AD域用户 Tab */}
      <div className="tabs" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          className={userTypeTab === 'local' ? 'tab active' : 'tab'}
          onClick={() => { setUserTypeTab('local'); setCurrentPage(1); }}
        >
          本地用户
        </button>
        <button
          className={userTypeTab === 'ad' ? 'tab active' : 'tab'}
          onClick={() => { setUserTypeTab('ad'); setCurrentPage(1); }}
        >
          AD域用户
        </button>
        <button
          className={userTypeTab === 'ad-group' ? 'tab active' : 'tab'}
          onClick={() => { setUserTypeTab('ad-group'); setCurrentPage(1); }}
        >
          AD域用户组
        </button>
      </div>
      
      {/* 搜索栏 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder={userTypeTab === 'ad-group' ? '搜索用户组（组名）' : '搜索用户（用户名、邮箱、显示名称）'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
          style={{ flex: 1, padding: '8px', fontSize: '14px' }}
        />
        <button onClick={searchUsers} style={{ padding: '8px 16px' }}>
          搜索
        </button>
        <button onClick={() => fetchUsers(currentPage, userTypeTab, searchQuery)} style={{ padding: '8px 16px' }}>
          刷新
        </button>
        {userTypeTab === 'ad-group' && (
          <button
            onClick={() => fetchAllAdGroups(true)}
            style={{ padding: '8px 16px', backgroundColor: '#17a2b8', color: 'white' }}
          >
            刷新AD域用户组
          </button>
        )}
        {hasPermission('user:write') && userTypeTab === 'local' && (
          <button onClick={openCreateModal} style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white' }}>
            新增用户
          </button>
        )}
        {hasPermission('user:write') && userTypeTab === 'ad' && (
          <button onClick={syncAllAdUsers} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white' }}>
            同步所有AD域用户
          </button>
        )}
      </div>

      {/* 用户列表 */}
      {userTypeTab === 'ad-group' ? (
        loadingAdGroups ? (
          <p>加载中...</p>
        ) : adGroupsError ? (
          <div style={{ padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404' }}>
            加载失败：{adGroupsError}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>组名</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>成员数量</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>成员</th>
              </tr>
            </thead>
            <tbody>
              {adGroups.filter((g) => g.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: '20px', textAlign: 'center' }}>
                    暂无AD域用户组数据
                  </td>
                </tr>
              ) : (
                adGroups
                  .filter((g) => g.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                  .map((group) => (
                    <tr key={group.name}>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{group.name}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>{group.count}</td>
                      <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                        {group.members.map((m) => m.display_name || m.username).join('，') || '-'}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )
      ) : loading ? (
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
                    {hasPermission('role:write') && (
                      <button
                        onClick={() => openRoleModal(user)}
                        style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px', backgroundColor: '#6f42c1', color: 'white' }}
                      >
                        分配角色
                      </button>
                    )}
                    <button 
                      onClick={() => viewUserDetail(user)}
                      style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}
                    >
                      查看详情
                    </button>
                    {hasPermission('user:write') && user.is_ad_user && (
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

      {userTypeTab !== 'ad-group' && !loading && (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>
            共 {totalUsers} 条，当前第 {currentPage} / {totalPages} 页
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{ padding: '6px 12px' }}
            >
              上一页
            </button>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '6px 8px' }}
            >
              <option value={20}>20/页</option>
              <option value={50}>50/页</option>
              <option value={100}>100/页</option>
            </select>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{ padding: '6px 12px' }}
            >
              下一页
            </button>
          </div>
        </div>
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

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>新增本地用户</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={submitCreateUser}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px' }}>用户名 *</label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                    style={{ width: '100%', padding: '8px' }}
                    required
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px' }}>密码 *</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    style={{ width: '100%', padding: '8px' }}
                    required
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px' }}>邮箱</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px' }}>角色</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    {roleOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
                <button type="submit" className="btn-primary" disabled={creatingUser}>
                  {creatingUser ? '创建中...' : '创建用户'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && roleUser && (
        <div className="modal-overlay" onClick={() => { setShowRoleModal(false); setRoleUser(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>分配角色 - {roleUser.username}</h2>
              <button className="modal-close" onClick={() => { setShowRoleModal(false); setRoleUser(null); }}>×</button>
            </div>
            <form onSubmit={submitAssignRole}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px' }}>选择角色</label>
                  <select
                    value={roleForm.role}
                    onChange={(e) => setRoleForm({ role: e.target.value })}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    {roleOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <p style={{ color: '#666', margin: 0 }}>保存后将立即更新用户权限。</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowRoleModal(false); setRoleUser(null); }}>
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={savingRole}>
                  {savingRole ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
