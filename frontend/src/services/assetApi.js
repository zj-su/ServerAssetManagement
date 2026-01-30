// 资产管理API接口
const BASE_URL = 'http://localhost:8000/api/v1';

// 获取资产列表
export const getAssets = async (statusFilter = "in_storage,in_use,maintenance") => {
  const response = await fetch(`${BASE_URL}/assets/?status_filter=${statusFilter}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 获取待报废资产列表
export const getPendingScrapAssets = async () => {
  const response = await fetch(`${BASE_URL}/assets/pending-scrap`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 获取已删除资产列表（回收站）
export const getDeletedAssets = async () => {
  const response = await fetch(`${BASE_URL}/assets/deleted`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 获取特定资产详情
export const getAsset = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 创建资产
export const createAsset = async (assetData) => {
  const response = await fetch(`${BASE_URL}/assets/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assetData),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 更新资产
export const updateAsset = async (id, assetData) => {
  const response = await fetch(`${BASE_URL}/assets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assetData),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 报废资产（移到待报废）
export const scrapAsset = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}/scrap`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 确认报废资产
export const confirmScrapAsset = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}/confirm-scrap`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 删除资产（移到回收站）
export const deleteAsset = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}/delete`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 从回收站恢复资产
export const restoreAsset = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}/restore`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// 永久删除资产
export const permanentlyDeleteAsset = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
};

// 获取资产历史记录
export const getAssetHistory = async (id) => {
  const response = await fetch(`${BASE_URL}/assets/${id}/history`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};