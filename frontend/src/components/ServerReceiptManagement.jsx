import React, { useState, useEffect, useRef } from 'react';
import { receiptAPI, assetAPI, serverAPI, userAPI } from '../services/api';

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
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    receipt_type: 'server',
    purchaser: '',
    company: '',
    department: '',
    remark: ''
  });

  /** 添加服务器表单 */
  const [showAddServerForm, setShowAddServerForm] = useState(false);
  const [addingServer, setAddingServer] = useState(false);
  const [serverFormData, setServerFormData] = useState({
    serial_number: '',
    hostname: '',
    ip_address: '',
    mac_address: '',
    brand: '',
    model: '',
    bmc_ip: '',
    bmc_username: '',
    bmc_password: '',
    user_person: '',
    system_username: '',
    system_password: '',
    u_position: '',
    u_height: '',
    status: 'maintenance',
    location: '',
    department: '',
    contract_number: '',
    purchase_date: '',
    warranty_expire: '',
    remark: '',
    cpu_model: '',
    cpu_cores: '',
    memory_gb: '',
    disk_info: ''
  });

  /** 批量导入服务器（Excel） */
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const [adGroupOptions, setAdGroupOptions] = useState([]);

  // 查询AD域用户组，用于部门联想
  const searchAdGroups = async (keyword = '') => {
    try {
      const res = await userAPI.getAdGroups({
        query: keyword.trim(),
        limit: 50,
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setAdGroupOptions(items.map((item) => item.name).filter(Boolean));
    } catch (err) {
      console.error('查询AD域用户组失败:', err);
      setAdGroupOptions([]);
    }
  };

  // 处理服务器表单输入
  const handleServerInputChange = (e) => {
    const { name, value } = e.target;
    const numFields = ['cpu_cores', 'memory_gb', 'u_height'];
    setServerFormData(prev => ({
      ...prev,
      [name]: numFields.includes(name) ? (value === '' ? '' : parseInt(value) || 0) : value
    }));
  };

  // 重置服务器表单
  const resetServerForm = () => {
    setServerFormData({
      serial_number: '',
      hostname: '',
      ip_address: '',
      mac_address: '',
      brand: '',
      model: '',
      bmc_ip: '',
      bmc_username: '',
      bmc_password: '',
      user_person: '',
      system_username: '',
      system_password: '',
      u_position: '',
      u_height: '',
      status: 'maintenance',
      location: '',
      department: '',
      contract_number: '',
      purchase_date: '',
      warranty_expire: '',
      remark: '',
      cpu_model: '',
      cpu_cores: '',
      memory_gb: '',
      disk_info: ''
    });
  };

  // 提交添加服务器
  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!selectedReceipt) return;
    
    const numKeys = ['cpu_cores', 'memory_gb', 'u_height'];
    const payload = { ...serverFormData };
    numKeys.forEach(k => {
      if (payload[k] === '' || payload[k] == null) payload[k] = null;
      else if (typeof payload[k] !== 'number') payload[k] = parseInt(payload[k], 10);
    });
    if (payload.purchase_date === '') payload.purchase_date = null;
    if (payload.warranty_expire === '') payload.warranty_expire = null;
    
    // 关联到当前入库单
    payload.receipt_id = selectedReceipt.id;
    
    try {
      setError(null);
      setAddingServer(true);
      const res = await serverAPI.createServer(payload);
      const created = res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data;
      if (created && created.id != null) {
        // 更新入库单数量
        await viewReceiptDetail(selectedReceipt.id);
        fetchReceipts();
        resetServerForm();
        alert('服务器添加成功！');
      }
    } catch (err) {
      console.error('添加服务器失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('添加服务器失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setAddingServer(false);
    }
  };

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
      setFormData({ receipt_type: 'server', purchaser: '', company: '', department: '', remark: '' });
      await fetchReceipts();
      if (newReceipt && newReceipt.id) {
        const detailRes = await receiptAPI.getReceipt(newReceipt.id);
        setSelectedReceipt(detailRes.data);
        setShowDetail(true);
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
    if (!window.confirm('确定要删除这个入库单吗？关联的服务器也会被一起删除。')) return;
    try {
      setError(null);
      await receiptAPI.deleteReceipt(receiptId);
      setShowDetail(false);
      setSelectedReceipt(null);
      setShowAddServerForm(false);
      fetchReceipts();
      // 触发服务器列表刷新事件
      window.dispatchEvent(new CustomEvent('serverDataChanged'));
    } catch (err) {
      console.error('删除服务器入库单失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('删除失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  /** 批量导入服务器（Excel），关联到当前入库单 */
  const handleBatchImport = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!selectedReceipt) {
      setError('请先选择入库单');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setError('请选择 .xlsx 或 .xls 格式的 Excel 文件（服务器导入模板）');
      return;
    }
    try {
      setError(null);
      setImportResult(null);
      setImporting(true);
      // 传入当前入库单ID，将导入的服务器关联到该入库单
      const res = await serverAPI.importServers(file, selectedReceipt.id);
      setImportResult(res.data);
      if (res.data?.created > 0) {
        // 刷新入库单详情以更新asset_count
        await viewReceiptDetail(selectedReceipt.id);
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

  /** 下载服务器导入模板 */
  const handleDownloadTemplate = async () => {
    try {
      const res = await serverAPI.downloadTemplate();
      const blob = new Blob([res.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '服务器导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载模板失败:', err);
      setError('下载模板失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const submitReceipt = async () => {
    if (!selectedReceipt) return;
    if (!window.confirm('提交后将锁定单据。确定提交入库？')) return;
    try {
      setError(null);
      await receiptAPI.submitReceipt(selectedReceipt.id);
      await viewReceiptDetail(selectedReceipt.id);
      fetchReceipts();
      // 触发服务器列表刷新事件
      window.dispatchEvent(new CustomEvent('serverDataChanged'));
    } catch (err) {
      console.error('提交入库失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('提交失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  useEffect(() => {
    fetchReceipts();
    searchAdGroups('');
  }, []);

  const formatDateTime = (str) => {
    if (!str) return '-';
    const d = new Date(str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN');
  };

  /**
   * 判断入库单是否可以删除：
   * - 草稿状态：可以删除
   * - 已入库状态：提交后1天内可以删除
   */
  const canDeleteReceipt = (receipt) => {
    if (!receipt) return false;
    if (receipt.status === 'draft') return true;
    if (receipt.status === 'submitted' && receipt.submitted_at) {
      const submittedAt = new Date(receipt.submitted_at);
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;
      return (now - submittedAt) < oneDayMs;
    }
    return false;
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
      </div>

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建服务器入库单</h2>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>采购人:</label>
                <input
                  type="text"
                  value={formData.purchaser}
                  onChange={(e) => setFormData({ ...formData, purchaser: e.target.value })}
                  placeholder="请输入采购人姓名"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group">
                <label>所属/承租公司:</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="请输入所属或承租公司名称"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group">
                <label>资产归属部门:</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, department: value });
                    searchAdGroups(value);
                  }}
                  onFocus={() => searchAdGroups(formData.department || '')}
                  list="server-receipt-ad-groups"
                  placeholder="请输入或搜索AD域用户组"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
                <datalist id="server-receipt-ad-groups">
                  {adGroupOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
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
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>入库日期</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>状态</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>入库人</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>采购人</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>入库数量</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>所属/承租公司</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>归属部门</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>暂无服务器入库单，请先创建</td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_number}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_date ? formatDateTime(receipt.receipt_date).split(' ')[0] : '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <span style={{ color: receipt.status === 'submitted' ? '#0a0' : '#666' }}>
                      {receipt.status === 'submitted' ? '已入库' : '草稿'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.operator}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.purchaser || '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.asset_count}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.company || '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.department || '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <button onClick={() => viewReceiptDetail(receipt.id)} style={{ marginRight: '5px', padding: '4px 8px', fontSize: '12px' }}>查看详情</button>
                    {canDeleteReceipt(receipt) && (
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
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #1890ff', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>服务器入库单</h2>
                <span style={{ 
                  padding: '2px 12px', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: selectedReceipt.status === 'submitted' ? '#e6f7e6' : '#fff7e6',
                  color: selectedReceipt.status === 'submitted' ? '#52c41a' : '#faad14',
                  border: `1px solid ${selectedReceipt.status === 'submitted' ? '#b7eb8f' : '#ffe58f'}`
                }}>
                  {selectedReceipt.status === 'submitted' ? '已入库' : '草稿'}
                </span>
              </div>
              <button className="modal-close" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px', backgroundColor: '#f5f7fa' }}>
              {/* OA风格基本信息区块 */}
              <div style={{ 
                backgroundColor: '#fff', 
                borderRadius: '8px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: 600, 
                  color: '#333',
                  marginBottom: '16px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e8e8e8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ width: '4px', height: '16px', backgroundColor: '#1890ff', borderRadius: '2px' }}></span>
                  基本信息
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>入库单号</span>
                    <span style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>{selectedReceipt.receipt_number}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>入库日期</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>{selectedReceipt.receipt_date ? formatDateTime(selectedReceipt.receipt_date).split(' ')[0] : '-'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>入库数量</span>
                    <span style={{ fontSize: '14px', color: '#1890ff', fontWeight: 600 }}>{selectedReceipt.asset_count} 台</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>入库人</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>{selectedReceipt.operator}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>采购人</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>{selectedReceipt.purchaser || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>所属/承租公司</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>{selectedReceipt.company || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>资产归属部门</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>{selectedReceipt.department || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>制单时间</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>{formatDateTime(selectedReceipt.created_at)}</span>
                  </div>
                  {selectedReceipt.submitted_at && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>提交时间</span>
                      <span style={{ fontSize: '14px', color: '#333' }}>{formatDateTime(selectedReceipt.submitted_at)}</span>
                    </div>
                  )}
                  {selectedReceipt.remark && (
                    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 3' }}>
                      <span style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>备注</span>
                      <span style={{ fontSize: '14px', color: '#666' }}>{selectedReceipt.remark}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 服务器明细区块 */}
              <div style={{ 
                backgroundColor: '#fff', 
                borderRadius: '8px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: 600, 
                  color: '#333',
                  marginBottom: '16px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e8e8e8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '16px', backgroundColor: '#52c41a', borderRadius: '2px' }}></span>
                    服务器明细
                    <span style={{ fontSize: '12px', color: '#999', fontWeight: 400 }}>（共 {selectedReceipt.items?.length || 0} 台）</span>
                  </div>
                </div>
                {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fafafa' }}>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>资产编码</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>序列号</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>主机名</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>IP地址</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>品牌</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>型号</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.items.map((item, index) => (
                          <tr key={item.id || index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '10px 8px', color: '#1890ff' }}>{item.asset_code || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.sn || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.hostname || '-'}</td>
                            <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{item.ip_address || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.brand || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.model || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                backgroundColor: item.status === 'online' ? '#e6f7e6' : item.status === 'offline' ? '#e6f7ff' : '#f6f6f6',
                                color: item.status === 'online' ? '#52c41a' : item.status === 'offline' ? '#1890ff' : '#666'
                              }}>
                                {item.status === 'online' ? '使用中' : item.status === 'offline' ? '空闲' : item.status === 'maintenance' ? '在库' : item.status || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                    暂无服务器明细
                  </div>
                )}
              </div>
              
              {/* 操作区块 - 仅草稿状态显示 */}
              {selectedReceipt.status === 'draft' && (
                <div style={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '8px', 
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: 600, 
                    color: '#333',
                    marginBottom: '16px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e8e8e8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ width: '4px', height: '16px', backgroundColor: '#faad14', borderRadius: '2px' }}></span>
                    添加服务器
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={() => { resetServerForm(); setShowAddServerForm(true); }} style={{ padding: '8px 16px' }}>
                      + 单个添加
                    </button>
                    <span style={{ color: '#d9d9d9' }}>|</span>
                    <button className="btn-secondary" onClick={handleDownloadTemplate} style={{ fontSize: '13px', padding: '8px 16px' }}>
                      下载导入模板
                    </button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: importing ? 'not-allowed' : 'pointer' }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={handleBatchImport}
                        disabled={importing}
                      />
                      <span 
                        className="btn-primary" 
                        style={{ fontSize: '13px', padding: '8px 16px', opacity: importing ? 0.6 : 1 }}
                      >
                        {importing ? '导入中...' : '批量导入'}
                      </span>
                    </label>
                  </div>
                  <div style={{ marginTop: '12px', color: '#999', fontSize: '12px' }}>
                    提示：可单个添加或下载模板批量导入服务器到本入库单
                  </div>
                  {importResult && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px 16px', 
                      background: importResult.errors?.length > 0 ? '#fff2f0' : '#f6ffed', 
                      border: `1px solid ${importResult.errors?.length > 0 ? '#ffccc7' : '#b7eb8f'}`,
                      borderRadius: '6px' 
                    }}>
                      <div style={{ fontWeight: 500, marginBottom: '8px' }}>
                        导入结果：成功 <span style={{ color: '#52c41a' }}>{importResult.created}</span> 台，跳过 <span style={{ color: '#faad14' }}>{importResult.skipped}</span> 条
                      </div>
                      {importResult.skipped_details?.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          跳过原因：{importResult.skipped_details.map((s) => `第${s.row}行-${s.reason}`).join('；')}
                        </div>
                      )}
                      {importResult.errors?.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
                          错误：{importResult.errors.map((e) => `第${e.row}行-${e.reason}`).join('；')}
                        </div>
                      )}
                      <button type="button" onClick={() => setImportResult(null)} style={{ marginTop: '8px', fontSize: '12px', padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>关闭</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ backgroundColor: '#fff', borderTop: '1px solid #e8e8e8', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedReceipt(null); }} style={{ padding: '8px 20px' }}>关闭</button>
              {selectedReceipt.status === 'draft' && (
                <button className="btn-primary" onClick={submitReceipt} style={{ padding: '8px 20px', backgroundColor: '#1890ff', border: 'none' }}>提交入库</button>
              )}
              {canDeleteReceipt(selectedReceipt) && (
                <button className="btn-secondary" onClick={() => deleteReceipt(selectedReceipt.id)} style={{ padding: '8px 20px', backgroundColor: '#ff4d4f', color: 'white', border: 'none' }}>删除入库单</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 添加服务器表单弹窗 */}
      {showAddServerForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-form-server oa-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header server-detail-header">
              <div className="server-detail-title-wrap">
                <h2>添加服务器</h2>
                <p className="server-detail-subtitle">入库单：{selectedReceipt?.receipt_number}</p>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddServerForm(false)} aria-label="关闭">×</button>
            </div>
            <div className="modal-body server-detail-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <form onSubmit={handleAddServer} className="oa-form-form">
                <section className="form-section">
                  <h3 className="detail-section-title">基础信息</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label>资产编码</label>
                        <input type="text" readOnly disabled className="readonly-input" placeholder="自动生成（SY-SR-XXXX）" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="serial_number">序列号(SN) <span style={{ color: 'red' }}>*</span></label>
                        <input type="text" id="serial_number" name="serial_number" value={serverFormData.serial_number} onChange={handleServerInputChange} placeholder="必填，用于去重" required />
                      </div>
                      <div className="form-group">
                        <label htmlFor="brand">品牌</label>
                        <input type="text" id="brand" name="brand" value={serverFormData.brand} onChange={handleServerInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="model">型号</label>
                        <input type="text" id="model" name="model" value={serverFormData.model} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="cpu_model">CPU型号</label>
                        <input type="text" id="cpu_model" name="cpu_model" value={serverFormData.cpu_model} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="cpu_cores">CPU核心数</label>
                        <input type="number" id="cpu_cores" name="cpu_cores" min="1" value={serverFormData.cpu_cores} onChange={handleServerInputChange} />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">网络信息</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="ip_address">系统IP</label>
                        <input type="text" id="ip_address" name="ip_address" value={serverFormData.ip_address} onChange={handleServerInputChange} placeholder="如 192.168.1.10" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="system_username">系统账号</label>
                        <input type="text" id="system_username" name="system_username" value={serverFormData.system_username} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="system_password">系统密码</label>
                        <input type="text" id="system_password" name="system_password" value={serverFormData.system_password} onChange={handleServerInputChange} placeholder="明文可见" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="bmc_ip">BMC IP</label>
                        <input type="text" id="bmc_ip" name="bmc_ip" value={serverFormData.bmc_ip} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="bmc_username">BMC账号</label>
                        <input type="text" id="bmc_username" name="bmc_username" value={serverFormData.bmc_username} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="bmc_password">BMC密码</label>
                        <input type="text" id="bmc_password" name="bmc_password" value={serverFormData.bmc_password} onChange={handleServerInputChange} placeholder="明文可见" />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">使用人 / U位 / 位置 / 部门</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="user_person">使用人</label>
                        <input type="text" id="user_person" name="user_person" value={serverFormData.user_person} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="u_position">U位</label>
                        <input type="text" id="u_position" name="u_position" value={serverFormData.u_position} onChange={handleServerInputChange} placeholder="如 A柜-12" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="u_height">U高度</label>
                        <input type="number" id="u_height" name="u_height" min="1" value={serverFormData.u_height} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="location">位置</label>
                        <input type="text" id="location" name="location" value={serverFormData.location} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="department">部门</label>
                        <input
                          type="text"
                          id="department"
                          name="department"
                          value={serverFormData.department}
                          onChange={(e) => {
                            handleServerInputChange(e);
                            searchAdGroups(e.target.value);
                          }}
                          onFocus={() => searchAdGroups(serverFormData.department || '')}
                          list="server-item-ad-groups"
                          placeholder="请输入或搜索AD域用户组"
                        />
                        <datalist id="server-item-ad-groups">
                          {adGroupOptions.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">状态 / 合同与日期</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="status">状态</label>
                        <select id="status" name="status" value={serverFormData.status} onChange={handleServerInputChange}>
                          <option value="online">使用中</option>
                          <option value="offline">空闲</option>
                          <option value="maintenance">在库</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="contract_number">合同号</label>
                        <input type="text" id="contract_number" name="contract_number" value={serverFormData.contract_number} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="purchase_date">采购日期</label>
                        <input type="date" id="purchase_date" name="purchase_date" value={serverFormData.purchase_date} onChange={handleServerInputChange} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="warranty_expire">保修到期</label>
                        <input type="date" id="warranty_expire" name="warranty_expire" value={serverFormData.warranty_expire} onChange={handleServerInputChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="remark">备注</label>
                      <textarea id="remark" name="remark" value={serverFormData.remark} onChange={handleServerInputChange} rows={2} placeholder="选填" />
                    </div>
                  </div>
                </section>
                <div className="form-actions oa-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddServerForm(false)}>取消</button>
                  <button type="submit" className="btn-primary" disabled={addingServer}>{addingServer ? '添加中...' : '添加服务器'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerReceiptManagement;
