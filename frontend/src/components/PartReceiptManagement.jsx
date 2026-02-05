import React, { useState, useEffect, useRef } from 'react';
import { receiptAPI, assetAPI, serverAPI } from '../services/api';

/**
 * 配件入库单管理
 * 配件入库单列表、创建配件入库单、入库单明细管理
 */

// 下拉选项配置
const PART_TYPE_OPTIONS = ['内存', '硬盘', 'CPU', '网卡', 'RAID卡', '其他'];

// 根据配件类型联动的选项映射
const SPEC_BY_TYPE = {
  '内存': [],
  '硬盘': ['2.5英寸', '3.5英寸'],
  'CPU': [],
  '网卡': ['PCIe'],
  'RAID卡': ['PCIe'],
  '其他': [],
};
const CAPACITY_UNIT_BY_TYPE = {
  '内存': ['GB'],
  '硬盘': ['GB', 'TB', 'PB'],
  'CPU': [],
  '网卡': [],
  'RAID卡': [],
  '其他': ['GB', 'TB', 'MB'],
};
const FREQUENCY_UNIT_BY_TYPE = {
  '内存': ['MHz'],
  '硬盘': [],
  'CPU': ['GHz'],
  '网卡': ['G'],
  'RAID卡': [],
  '其他': ['MHz', 'GHz'],
};
const INTERFACE_BY_TYPE = {
  '内存': ['DDR3', 'DDR4', 'DDR5'],
  '硬盘': ['SATA', 'SAS', 'NVMe', 'M.2', 'U.2'],
  'CPU': ['LGA1700', 'LGA4189', 'SP3', 'AM5'],
  '网卡': ['RJ45', 'SFP', 'SFP+', 'QSFP'],
  'RAID卡': [],
  '其他': ['其他'],
};

// 获取联动选项的辅助函数
const getOptionsForType = (mapping, partType) => {
  if (!partType || !mapping[partType]) {
    return [...new Set(Object.values(mapping).flat())];
  }
  return mapping[partType] || [];
};

const PartReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    receipt_type: 'part',
    purchaser: '',
    company: '',
    department: '',
    remark: ''
  });

  // 添加新配件表单
  const [showAddPartForm, setShowAddPartForm] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [partFormData, setPartFormData] = useState({
    sn: '',
    model: '',
    brand: '',
    part_type: '',
    capacity: '',
    capacity_unit: '',
    cpu_cores: '',
    frequency: '',
    frequency_unit: '',
    interface_type: '',
    spec: '',
    user: '',
    purchased_with_server_sn: '',
    status: 'in_storage',
    location: '',
    department: '',
    contract_number: '',
    purchase_date: '',
    warranty_expiry: '',
    remark: ''
  });

  // 服务器搜索相关状态
  const [serverSearchText, setServerSearchText] = useState('');
  const [serverSearchResults, setServerSearchResults] = useState([]);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const serverSearchRef = useRef(null);
  const serverDropdownRef = useRef(null);

  // 批量导入配件状态
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // 搜索服务器
  const searchServers = async (keyword) => {
    if (!keyword || keyword.trim().length === 0) {
      setServerSearchResults([]);
      return;
    }
    try {
      setServerSearchLoading(true);
      const res = await serverAPI.searchServers(keyword.trim());
      setServerSearchResults(res.data || []);
    } catch (err) {
      console.error('搜索服务器失败:', err);
      setServerSearchResults([]);
    } finally {
      setServerSearchLoading(false);
    }
  };

  // 防抖搜索服务器
  useEffect(() => {
    const timer = setTimeout(() => {
      if (serverSearchText) {
        searchServers(serverSearchText);
      } else {
        setServerSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [serverSearchText]);

  // 选择服务器
  const selectServer = (server) => {
    setPartFormData(prev => ({
      ...prev,
      purchased_with_server_sn: server.serial_number || '',
      user: server.user_person || prev.user,
      department: server.department || prev.department,
      location: server.location || prev.location
    }));
    setServerSearchText(`${server.serial_number || ''} (${server.hostname || server.ip_address || server.asset_code || ''})`);
    setShowServerDropdown(false);
    setServerSearchResults([]);
  };

  // 清除关联服务器
  const clearServerSelection = () => {
    setPartFormData(prev => ({
      ...prev,
      purchased_with_server_sn: ''
    }));
    setServerSearchText('');
    setServerSearchResults([]);
  };

  // 点击外部关闭服务器下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        serverSearchRef.current && 
        !serverSearchRef.current.contains(event.target) &&
        serverDropdownRef.current &&
        !serverDropdownRef.current.contains(event.target)
      ) {
        setShowServerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 重置配件表单
  const resetPartForm = () => {
    setPartFormData({
      sn: '',
      model: '',
      brand: '',
      part_type: '',
      capacity: '',
      capacity_unit: '',
      cpu_cores: '',
      frequency: '',
      frequency_unit: '',
      interface_type: '',
      spec: '',
      user: '',
      purchased_with_server_sn: '',
      status: 'in_storage',
      location: '',
      department: '',
      contract_number: '',
      purchase_date: '',
      warranty_expiry: '',
      remark: ''
    });
    setServerSearchText('');
    setServerSearchResults([]);
  };

  /** 批量导入配件（Excel），关联到当前入库单 */
  const handleImportAssets = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedReceipt) {
      setError('请先选择入库单');
      e.target.value = '';
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setError('请选择 .xlsx 或 .xls 格式的 Excel 文件（配件导入模板）');
      e.target.value = '';
      return;
    }
    try {
      setError(null);
      setImporting(true);
      setImportResult(null);
      // 传入当前入库单ID，将导入的配件关联到该入库单
      const res = await assetAPI.importAssets(file, selectedReceipt.id);
      setImportResult(res.data);
      if (res.data?.created > 0) {
        // 刷新入库单详情以更新asset_count
        await viewReceiptDetail(selectedReceipt.id);
        fetchReceipts();
      }
    } catch (err) {
      console.error('批量导入配件失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('批量导入失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };
  
  // 文件输入引用
  const fileInputRef = useRef(null);

  /** 下载配件导入模板 */
  const handleDownloadTemplate = async () => {
    try {
      const res = await assetAPI.downloadTemplate();
      const blob = new Blob([res.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '配件导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载模板失败:', err);
      setError('下载模板失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 处理配件表单输入
  const handlePartInputChange = (e) => {
    const { name, value } = e.target;
    const numFields = ['cpu_cores'];
    setPartFormData(prev => {
      const updated = {
        ...prev,
        [name]: numFields.includes(name) ? (value === '' ? '' : parseInt(value, 10) || 0) : value
      };
      // 配件类型变化时联动其他字段
      if (name === 'part_type') {
        const newType = value;
        const specOptions = SPEC_BY_TYPE[newType] || [];
        if (specOptions.length === 1) {
          updated.spec = specOptions[0];
        } else if (prev.spec && !specOptions.includes(prev.spec)) {
          updated.spec = '';
        }
        const capUnits = CAPACITY_UNIT_BY_TYPE[newType] || [];
        if (capUnits.length === 1) {
          updated.capacity_unit = capUnits[0];
        } else if (prev.capacity_unit && !capUnits.includes(prev.capacity_unit)) {
          updated.capacity_unit = '';
        }
        const freqUnits = FREQUENCY_UNIT_BY_TYPE[newType] || [];
        updated.frequency_unit = freqUnits.length > 0 ? freqUnits[0] : '';
        if (prev.interface_type && !getOptionsForType(INTERFACE_BY_TYPE, newType).includes(prev.interface_type)) {
          updated.interface_type = '';
        }
      }
      return updated;
    });
  };

  // 提交添加配件
  const handleAddPart = async (e) => {
    e.preventDefault();
    if (!selectedReceipt) return;
    
    const snTrim = (partFormData.sn || '').trim();
    const modelTrim = (partFormData.model || '').trim();
    if (!snTrim || !modelTrim) {
      setError('SN 和型号为必填');
      return;
    }
    
    const payload = { ...partFormData };
    if (payload.purchase_date === '') payload.purchase_date = null;
    if (payload.warranty_expiry === '') payload.warranty_expiry = null;
    if (payload.cpu_cores === '' || payload.cpu_cores == null) payload.cpu_cores = null;
    
    try {
      setError(null);
      setAddingPart(true);
      const createRes = await assetAPI.createAsset(payload);
      const newAsset = createRes.data;
      if (newAsset?.id) {
        await receiptAPI.addReceiptItem(selectedReceipt.id, newAsset.id);
        await viewReceiptDetail(selectedReceipt.id);
        fetchReceipts();
        resetPartForm();
        setShowAddPartForm(false);
        alert('配件添加成功！');
      }
    } catch (err) {
      console.error('添加配件失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('添加配件失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setAddingPart(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await receiptAPI.getReceipts('part');
      setReceipts(response.data || []);
    } catch (err) {
      console.error('获取配件入库单列表失败:', err);
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
      setFormData({ receipt_type: 'part', purchaser: '', company: '', department: '', remark: '' });
      await fetchReceipts();
      if (newReceipt && newReceipt.id) {
        const detailRes = await receiptAPI.getReceipt(newReceipt.id);
        setSelectedReceipt(detailRes.data);
        setShowDetail(true);
      }
    } catch (err) {
      console.error('创建配件入库单失败:', err);
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
      console.error('获取配件入库单详情失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('获取详情失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('确定要删除这个入库单吗？关联的配件也会被一起删除。')) return;
    try {
      setError(null);
      await receiptAPI.deleteReceipt(receiptId);
      setShowDetail(false);
      setSelectedReceipt(null);
      setShowAddPartForm(false);
      fetchReceipts();
      // 触发配件列表刷新事件
      window.dispatchEvent(new CustomEvent('assetDataChanged'));
    } catch (err) {
      console.error('删除配件入库单失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('删除失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const submitReceipt = async () => {
    if (!selectedReceipt) return;
    if (!selectedReceipt.items?.length) {
      setError('至少需有一条配件明细才能提交入库');
      return;
    }
    if (!window.confirm('提交后将锁定单据，不可再添加/删除明细。确定提交入库？')) return;
    try {
      setError(null);
      await receiptAPI.submitReceipt(selectedReceipt.id);
      await viewReceiptDetail(selectedReceipt.id);
      fetchReceipts();
      // 触发配件列表刷新事件
      window.dispatchEvent(new CustomEvent('assetDataChanged'));
    } catch (err) {
      console.error('提交入库失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('提交失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  const revokeReceiptItem = async (itemId) => {
    const isDraft = selectedReceipt?.status === 'draft';
    const msg = isDraft ? '确定从本单移除该配件？配件将保留可入其他单。' : '确定撤销该配件？仅可撤销两天内录入的，且需管理员权限。';
    if (!window.confirm(msg)) return;
    if (!selectedReceipt) return;
    try {
      setError(null);
      await receiptAPI.revokeReceiptItem(selectedReceipt.id, itemId);
      await viewReceiptDetail(selectedReceipt.id);
      if (selectedReceipt.items?.length <= 1) {
        setShowDetail(false);
        setSelectedReceipt(null);
        setShowAddPartForm(false);
      }
      fetchReceipts();
    } catch (err) {
      console.error('移除/撤销配件失败:', err);
      const msg = err.response?.data?.detail || err.message;
      setError('操作失败: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }
  };

  useEffect(() => {
    fetchReceipts();
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
      <h2>配件入库单管理</h2>
      {error && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '4px', color: '#c00' }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: '12px', fontSize: '12px' }}>关闭</button>
        </div>
      )}
      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => { setError(null); setShowCreateForm(true); }}>创建配件入库单</button>
        <button className="btn-secondary" onClick={fetchReceipts}>刷新</button>
      </div>

      {/* 创建入库单表单 */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建配件入库单</h2>
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
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="请输入资产归属部门"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
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
                <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>暂无配件入库单，请先创建</td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_number}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{receipt.receipt_date ? formatDateTime(receipt.receipt_date).split(' ')[0] : '-'}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      backgroundColor: receipt.status === 'submitted' ? '#dcfce7' : '#f3f4f6',
                      color: receipt.status === 'submitted' ? '#166534' : '#4b5563' 
                    }}>
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
                      <button onClick={() => deleteReceipt(receipt.id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>删除</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* 入库单详情 */}
      {showDetail && selectedReceipt && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #1890ff', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>配件入库单</h2>
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
              <button className="modal-close" onClick={() => { setShowDetail(false); setSelectedReceipt(null); setImportResult(null); }}>×</button>
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
                    <span style={{ fontSize: '14px', color: '#1890ff', fontWeight: 600 }}>{selectedReceipt.asset_count || 0} 件</span>
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
              
              {/* 配件明细区块 */}
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
                    配件明细
                    <span style={{ fontSize: '12px', color: '#999', fontWeight: 400 }}>（共 {selectedReceipt.items?.length || 0} 件）</span>
                  </div>
                </div>
                {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fafafa' }}>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>资产编码</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>SN</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>类型</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>品牌</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>型号</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #e8e8e8', textAlign: 'left', fontWeight: 500, color: '#666' }}>录入时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.items.map((item, index) => (
                          <tr key={item.id || index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '10px 8px', color: '#1890ff' }}>{item.asset_code || '-'}</td>
                            <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{item.sn || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.part_type || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.brand || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{item.model || '-'}</td>
                            <td style={{ padding: '10px 8px', color: '#999' }}>{formatDateTime(item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                    暂无配件明细
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
                    添加配件
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={() => { resetPartForm(); setShowAddPartForm(true); }} style={{ padding: '8px 16px' }}>
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
                        onChange={handleImportAssets}
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
                    提示：可单个添加或下载模板批量导入配件到本入库单
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
                        导入结果：成功 <span style={{ color: '#52c41a' }}>{importResult.created}</span> 件，跳过 <span style={{ color: '#faad14' }}>{importResult.skipped}</span> 条
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
              <button className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedReceipt(null); setImportResult(null); }} style={{ padding: '8px 20px' }}>关闭</button>
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

      {/* 添加配件表单弹窗 */}
      {showAddPartForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-form-server oa-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header server-detail-header">
              <div className="server-detail-title-wrap">
                <h2>添加配件</h2>
                <p className="server-detail-subtitle">入库单：{selectedReceipt?.receipt_number}</p>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddPartForm(false)} aria-label="关闭">×</button>
            </div>
            <div className="modal-body server-detail-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <form onSubmit={handleAddPart} className="oa-form-form">
                <section className="form-section">
                  <h3 className="detail-section-title">基础信息</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label>资产编码</label>
                        <input type="text" readOnly disabled className="readonly-input" placeholder="根据类型自动生成" />
                      </div>
                      <div className="form-group">
                        <label>序列号(SN) <span style={{ color: '#c00' }}>*</span></label>
                        <input type="text" name="sn" value={partFormData.sn} onChange={handlePartInputChange} required />
                      </div>
                      <div className="form-group">
                        <label>品牌</label>
                        <input type="text" name="brand" value={partFormData.brand} onChange={handlePartInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>型号 <span style={{ color: '#c00' }}>*</span></label>
                        <input type="text" name="model" value={partFormData.model} onChange={handlePartInputChange} required />
                      </div>
                      <div className="form-group">
                        <label>配件类型</label>
                        <select name="part_type" value={partFormData.part_type} onChange={handlePartInputChange}>
                          <option value="">请选择</option>
                          {PART_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>规格</label>
                        {(() => {
                          const specOpts = SPEC_BY_TYPE[partFormData.part_type] || [];
                          if (specOpts.length === 0) {
                            return <input type="text" value="无" readOnly disabled className="readonly-input" />;
                          } else if (specOpts.length === 1) {
                            return <input type="text" value={partFormData.spec || specOpts[0]} readOnly disabled className="readonly-input" />;
                          } else {
                            return (
                              <select name="spec" value={partFormData.spec} onChange={handlePartInputChange}>
                                <option value="">请选择</option>
                                {specOpts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>容量</label>
                        <input type="text" name="capacity" value={partFormData.capacity} onChange={handlePartInputChange} />
                      </div>
                      <div className="form-group">
                        <label>容量单位</label>
                        {(() => {
                          const capOpts = CAPACITY_UNIT_BY_TYPE[partFormData.part_type] || [];
                          if (capOpts.length === 0) {
                            return <input type="text" value="无" readOnly disabled className="readonly-input" />;
                          } else if (capOpts.length === 1) {
                            return <input type="text" value={partFormData.capacity_unit || capOpts[0]} readOnly disabled className="readonly-input" />;
                          } else {
                            return (
                              <select name="capacity_unit" value={partFormData.capacity_unit} onChange={handlePartInputChange}>
                                <option value="">请选择</option>
                                {capOpts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            );
                          }
                        })()}
                      </div>
                      <div className="form-group">
                        <label>核心数</label>
                        <input type="number" name="cpu_cores" min={0} value={partFormData.cpu_cores} onChange={handlePartInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>频率</label>
                        <input type="text" name="frequency" value={partFormData.frequency} onChange={handlePartInputChange} />
                      </div>
                      <div className="form-group">
                        <label>频率单位</label>
                        <input type="text" value={partFormData.frequency_unit || '无'} readOnly disabled className="readonly-input" />
                      </div>
                      <div className="form-group">
                        <label>接口类型</label>
                        {getOptionsForType(INTERFACE_BY_TYPE, partFormData.part_type).length > 0 ? (
                          <select name="interface_type" value={partFormData.interface_type} onChange={handlePartInputChange}>
                            <option value="">请选择</option>
                            {getOptionsForType(INTERFACE_BY_TYPE, partFormData.part_type).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type="text" value="无" readOnly disabled className="readonly-input" />
                        )}
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">使用人 / 关联 / 状态 / 位置 / 部门</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label>使用人</label>
                        <input type="text" name="user" value={partFormData.user} onChange={handlePartInputChange} />
                      </div>
                      <div className="form-group" style={{ position: 'relative' }}>
                        <label>关联服务器</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            ref={serverSearchRef}
                            value={serverSearchText} 
                            onChange={(e) => {
                              setServerSearchText(e.target.value);
                              setShowServerDropdown(true);
                              if (!e.target.value) {
                                setPartFormData(prev => ({ ...prev, purchased_with_server_sn: '' }));
                              }
                            }}
                            onFocus={() => setShowServerDropdown(true)}
                            placeholder="搜索SN/主机名/IP..." 
                            style={{ flex: 1 }}
                          />
                          {partFormData.purchased_with_server_sn && (
                            <button type="button" className="btn-secondary" onClick={clearServerSelection} style={{ padding: '4px 8px' }}>清除</button>
                          )}
                        </div>
                        {partFormData.purchased_with_server_sn && (
                          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                            已关联: {partFormData.purchased_with_server_sn}
                          </div>
                        )}
                        {showServerDropdown && serverSearchText && (
                          <div 
                            ref={serverDropdownRef}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              zIndex: 1000
                            }}
                          >
                            {serverSearchLoading ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>搜索中...</div>
                            ) : serverSearchResults.length === 0 ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>无匹配结果</div>
                            ) : (
                              serverSearchResults.map(server => (
                                <div 
                                  key={server.id}
                                  onClick={() => selectServer(server)}
                                  style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f1f5f9',
                                    fontSize: '13px'
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                                  onMouseLeave={(e) => e.target.style.background = '#fff'}
                                >
                                  <div style={{ fontWeight: 500 }}>{server.serial_number || '(无SN)'}</div>
                                  <div style={{ color: '#64748b', fontSize: '12px' }}>
                                    {server.hostname || '-'} | {server.ip_address || '-'} | {server.asset_code || '-'}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <div className="form-group">
                        <label>状态</label>
                        <select name="status" value={partFormData.status} onChange={handlePartInputChange}>
                          <option value="in_storage">在库</option>
                          <option value="in_use">使用中</option>
                          <option value="idle">空闲</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>位置</label>
                        <input type="text" name="location" value={partFormData.location} onChange={handlePartInputChange} />
                      </div>
                      <div className="form-group">
                        <label>部门</label>
                        <input type="text" name="department" value={partFormData.department} onChange={handlePartInputChange} />
                      </div>
                    </div>
                  </div>
                </section>
                <section className="form-section">
                  <h3 className="detail-section-title">合同与日期</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      <div className="form-group">
                        <label>合同号</label>
                        <input type="text" name="contract_number" value={partFormData.contract_number} onChange={handlePartInputChange} />
                      </div>
                      <div className="form-group">
                        <label>采购日期</label>
                        <input type="date" name="purchase_date" value={partFormData.purchase_date} onChange={handlePartInputChange} />
                      </div>
                      <div className="form-group">
                        <label>保修到期</label>
                        <input type="date" name="warranty_expiry" value={partFormData.warranty_expiry} onChange={handlePartInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: '1 1 100%' }}>
                        <label>备注</label>
                        <textarea name="remark" value={partFormData.remark} onChange={handlePartInputChange} rows={2} placeholder="选填" />
                      </div>
                    </div>
                  </div>
                </section>
                <div className="form-actions oa-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddPartForm(false)}>取消</button>
                  <button type="submit" className="btn-primary" disabled={addingPart}>{addingPart ? '添加中...' : '添加配件'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartReceiptManagement;
