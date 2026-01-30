// API服务模块
const BASE_URL = '/api/v1';

// 通用请求函数
const request = async (url, options = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

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
    const isAuthError = status === 401 || (status === 403 && (detail === 'Not authenticated' || detail === '无效的认证token' || detail === '用户不存在'));
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
  
  // 创建服务器
  createServer: (data) => api.post('/servers', data),
  
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
  
  // 创建资产
  createAsset: (data) => api.post('/assets', data),
  
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
  
  // 添加资产历史记录
  addAssetHistory: (id, data) => api.post(`/assets/${id}/history`, data),
  
  // 搜索资产
  searchAssets: (query) => api.get(`/assets/search?query=${query}`),
};

// 入库单相关API（带尾部斜杠避免 307）
export const receiptAPI = {
  // 获取入库单列表
  getReceipts: (receiptType) => {
    if (receiptType) {
      return api.get('/receipts/', { params: { receipt_type: receiptType } });
    }
    return api.get('/receipts/');
  },
  
  // 获取入库单详情
  getReceipt: (id) => api.get(`/receipts/${id}`),
  
  // 创建入库单
  createReceipt: (data) => api.post('/receipts', data),
  
  // 删除入库单
  deleteReceipt: (id) => api.delete(`/receipts/${id}`),
  
  // 添加资产到入库单
  addReceiptItem: (receiptId, assetId) => api.post(`/receipts/${receiptId}/items?asset_id=${assetId}`),
  
  // 撤销入库单资产
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

// 部署相关API
export const deploymentAPI = {
  getDeployments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/deployments${queryString ? `?${queryString}` : ''}`);
  },

  createDeployment: (deploymentData) => request('/deployments', {
    method: 'POST',
    body: JSON.stringify(deploymentData),
  }),

  getDeployment: (id) => request(`/deployments/${id}`),

  updateDeployment: (id, deploymentData) => request(`/deployments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(deploymentData),
  }),

  deleteDeployment: (id) => request(`/deployments/${id}`, {
    method: 'DELETE',
  }),
};

// 监控相关API
export const monitoringAPI = {
  getMonitoringData: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/monitoring${queryString ? `?${queryString}` : ''}`);
  },

  getServerMonitoringData: (serverId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/monitoring/server/${serverId}${queryString ? `?${queryString}` : ''}`);
  },

  createMonitoringData: (monitoringData) => request('/monitoring', {
    method: 'POST',
    body: JSON.stringify(monitoringData),
  }),
};

export default {
  serverAPI,
  deploymentAPI,
  monitoringAPI,
};