// API服务模块
import axios from 'axios';

// 使用相对路径，开发时由 Vite 代理到后端，支持远程访问
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

// 请求拦截器：始终携带 Token（未登录时由后端返回 401/403）
api.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：401/403 视为未认证时清除状态并跳转登录（登录/注册接口不触发跳转）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isLoginOrRegister = url.includes('/users/login') || url.includes('/users/register');
    if (isLoginOrRegister) {
      return Promise.reject(error);
    }
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const authDetails = ['Not authenticated', '无效的认证token', '用户不存在', '未提供认证信息'];
    const isAuthError = status === 401 || (status === 403 && (typeof detail === 'string' && authDetails.some(d => detail.includes(d))));
    if (isAuthError) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// 服务器相关API（带尾部斜杠避免 307 重定向导致 403）
export const serverAPI = {
  // 获取服务器列表
  getServers: () => api.get('/servers/'),
  
  // 获取服务器详情
  getServer: (id) => api.get(`/servers/${id}`),
  
  // 创建服务器（带尾斜杠避免 307 重定向导致 403）
  createServer: (data) => api.post('/servers/', data),
  
  // 更新服务器
  updateServer: (id, data) => api.put(`/servers/${id}`, data),
  
  // 删除服务器
  deleteServer: (id) => api.delete(`/servers/${id}`),
  
  // 服务器开机
  powerOn: (id) => api.post(`/servers/${id}/power/on`),
  
  // 服务器关机
  powerOff: (id) => api.post(`/servers/${id}/power/off`),
  
  // 服务器重启
  reboot: (id) => api.post(`/servers/${id}/power/reboot`),

  // 批量导入：POST /api/v1/import-servers/（带尾斜杠避免 307 重定向导致 405）
  // receiptId 可选，如果传入则将服务器关联到该入库单
  importServers: (file, receiptId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = receiptId ? { receipt_id: receiptId } : {};
    return api.post('/import-servers/', formData, { params });
  },
  
  // 下载服务器导入模板
  downloadTemplate: () => api.get('/servers-template/', { responseType: 'blob' }),

  // 获取服务器历史记录
  getServerHistory: (id) => api.get(`/servers/${id}/history`),

  // 搜索服务器（按SN、主机名、IP、资产编码）
  searchServers: (q) => api.get(`/servers/search`, { params: { q } }),

  // 报废服务器（移到待报废）
  scrapServer: (id) => api.put(`/servers/${id}/scrap`),

  // 确认报废服务器
  confirmScrapServer: (id) => api.put(`/servers/${id}/confirm-scrap`),

  // 获取待报废服务器列表
  getPendingScrapServers: () => api.get('/servers/scrap/pending'),

  // 获取已报废服务器列表
  getScrappedServers: () => api.get('/servers/scrap/scrapped'),
  
  // 删除服务器（移至回收站，软删除）
  deleteServerToRecycle: (id) => api.put(`/servers/${id}/delete`),
  
  // 获取已删除服务器列表（回收站）
  getDeletedServers: () => api.get('/servers/deleted/list'),
  
  // 从回收站恢复服务器
  restoreServer: (id) => api.put(`/servers/${id}/restore`),
  
  // 永久删除服务器（需要管理员权限）
  permanentlyDeleteServer: (id) => api.delete(`/servers/${id}`),
};

// 认证相关API
export const authAPI = {
  // 用户登录
  login: (credentials) => api.post('/users/login', credentials),
  
  // 用户注册
  register: (userData) => api.post('/users/register', userData),
};

// 资产相关API（带尾部斜杠避免 307 重定向导致 403）
export const assetAPI = {
  // 获取资产列表
  getAssets: (statusFilter) => {
    if (statusFilter) {
      return api.get('/assets/', { params: { status_filter: statusFilter } });
    }
    return api.get('/assets/');
  },
  
  // 获取待报废资产列表
  getPendingScrapAssets: () => api.get('/assets/pending-scrap'),
  
  // 获取已报废资产列表
  getScrappedAssets: () => api.get('/assets/scrapped'),
  
  // 获取已删除资产列表（回收站）
  getDeletedAssets: () => api.get('/assets/deleted'),
  
  // 获取资产详情
  getAsset: (id) => api.get(`/assets/${id}`),
  
  // 创建资产（带尾斜杠避免 307 重定向导致 403）
  createAsset: (data) => api.post('/assets/', data),
  
  // 更新资产
  updateAsset: (id, data) => api.put(`/assets/${id}`, data),
  
  // 报废资产（移到待报废）
  scrapAsset: (id) => api.put(`/assets/${id}/scrap`),
  
  // 确认报废资产
  confirmScrapAsset: (id) => api.put(`/assets/${id}/confirm-scrap`),
  
  // 删除资产（移到回收站）
  deleteAsset: (id) => api.put(`/assets/${id}/delete`),
  
  // 从回收站恢复资产
  restoreAsset: (id) => api.put(`/assets/${id}/restore`),
  
  // 永久删除资产
  permanentlyDeleteAsset: (id) => api.delete(`/assets/${id}`),
  
  // 获取资产历史记录
  getAssetHistory: (id) => api.get(`/assets/${id}/history`),
  
  // 根据服务器SN获取关联的配件
  getAssetsByServerSN: (serverSN) => api.get(`/assets/by-server-sn/${encodeURIComponent(serverSN)}`),
  
  // 添加资产历史记录
  addAssetHistory: (id, data) => api.post(`/assets/${id}/history`, data),
  
  // 搜索资产
  searchAssets: (query) => api.get(`/assets/search?query=${query}`),
  
  // 批量导入配件：POST /api/v1/import-assets/
  importAssets: (file, receiptId) => {
    const formData = new FormData();
    formData.append('file', file);
    // 如果提供了入库单ID，将其作为查询参数传递
    const url = receiptId ? `/import-assets/?receipt_id=${receiptId}` : '/import-assets/';
    return api.post(url, formData);
  },
  
  // 下载配件导入模板
  downloadTemplate: () => api.get('/assets-template/', { responseType: 'blob' }),
};

// 入库单相关API（带尾部斜杠避免 307 重定向导致 Authorization 丢失、触发登出）
export const receiptAPI = {
  // 获取入库单列表
  getReceipts: (receiptType) => {
    if (receiptType) {
      return api.get('/receipts', { params: { receipt_type: receiptType } });
    }
    return api.get('/receipts');
  },
  
  // 获取入库单详情
  getReceipt: (id) => api.get(`/receipts/${id}`),
  
  // 创建入库单（路径需与后端一致，无尾斜杠，避免 307 重定向）
  createReceipt: (data) => api.post('/receipts', data),
  
  // 提交入库（草稿 → 已入库）
  submitReceipt: (id) => api.post(`/receipts/${id}/submit`),
  
  // 删除入库单（仅草稿可删）
  deleteReceipt: (id) => api.delete(`/receipts/${id}`),
  
  // 添加资产到入库单（仅草稿可添加）
  addReceiptItem: (receiptId, assetId) => api.post(`/receipts/${receiptId}/items?asset_id=${assetId}`),
  
  // 移除/撤销明细：草稿=仅移除；已入库=撤销（2天内，需管理员）
  revokeReceiptItem: (receiptId, itemId) => api.delete(`/receipts/${receiptId}/items/${itemId}`),
};

// 用户管理相关API
export const userAPI = {
  // 获取用户列表
  getUsers: (params = {}) => api.get('/users/list', { params }),
  
  // 获取用户详情
  getUser: (id) => api.get(`/users/${id}`),
  
  // 搜索用户
  searchUsers: (query) => api.get(`/users/search?query=${query}`),
  
  // 获取AD域用户组
  getUserGroups: (id) => api.get(`/users/${id}/groups`),
  
  // 同步单个AD域用户
  syncAdUser: (username) => api.post(`/users/sync-ad-user/${username}`),
  
  // 批量同步AD域用户
  syncAllAdUsers: () => api.post('/users/sync-all-ad-users'),
};

// AD域配置相关API（带尾部斜杠避免 307）
export const adConfigAPI = {
  // 获取AD域配置
  getConfig: () => api.get('/ad-config/'),
  
  // 创建/更新AD域配置
  updateConfig: (data) => api.post('/ad-config', data),
  
  // 删除AD域配置
  deleteConfig: () => api.delete('/ad-config'),
  
  // 测试AD域连接
  testConfig: (data) => api.post('/ad-config/test', data),
};

// 角色管理相关API
export const roleAPI = {
  // 获取角色列表
  getRoles: () => api.get('/roles/'),
  
  // 获取角色详情
  getRole: (id) => api.get(`/roles/${id}`),
  
  // 创建角色
  createRole: (data) => api.post('/roles/', data),
  
  // 更新角色
  updateRole: (id, data) => api.put(`/roles/${id}`, data),
  
  // 删除角色
  deleteRole: (id) => api.delete(`/roles/${id}`),
};

export default {
  serverAPI,
  authAPI,
  assetAPI,
  receiptAPI,
  userAPI,
  adConfigAPI,
  roleAPI,
};