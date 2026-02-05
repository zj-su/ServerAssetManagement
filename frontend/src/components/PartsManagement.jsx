import React, { useState, useEffect, useRef } from 'react';
import { assetAPI, serverAPI } from '../services/api';
import '../App.css';

/**
 * 配件管理 - 资产编码根据类型自动生成(SY-MEM-/SY-HDD-/SY-CPU-等)、分组表单、OA 风格详情
 */

// 下拉选项配置
const PART_TYPE_OPTIONS = ['内存', '硬盘', 'CPU', '网卡', 'RAID卡', '其他'];

// 根据配件类型联动的选项映射
// 规格配置：数组长度为1表示自动带出（不可选择），长度>1表示可选择，长度为0表示无
const SPEC_BY_TYPE = {
  '内存': [],
  '硬盘': ['2.5英寸', '3.5英寸'],
  'CPU': [],
  '网卡': ['PCIe'],      // 自动带出
  'RAID卡': ['PCIe'],    // 自动带出
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
    // 未选择类型时返回所有选项的并集
    return [...new Set(Object.values(mapping).flat())];
  }
  return mapping[partType] || [];
};

const PartsManagement = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  // 搜索与筛选
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partTypeFilter, setPartTypeFilter] = useState('');
  const [formData, setFormData] = useState({
    asset_code: '',
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
    remark: '',
    bmc_ip: '',
    system_ip: '',
    system_username: '',
    system_password: '',
    u_position: '',
    u_height: 1,
    cpu_model: '',
    memory_gb: '',
    disk_info: ''
  });

  // 服务器搜索选择相关状态
  const [serverSearchText, setServerSearchText] = useState('');
  const [serverSearchResults, setServerSearchResults] = useState([]);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const serverSearchRef = useRef(null);
  const serverDropdownRef = useRef(null);

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

  // 防抖搜索
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

  // 服务器状态映射到配件状态
  const mapServerStatusToPartStatus = (serverStatus) => {
    const statusMap = {
      'online': 'in_use',         // 服务器使用中 → 配件使用中
      'offline': 'idle',          // 服务器空闲 → 配件空闲
      'maintenance': 'in_storage' // 服务器在库 → 配件在库
    };
    return statusMap[serverStatus] || 'in_storage';
  };

  // 选择服务器 - 自动同步使用人、部门、状态和位置
  const selectServer = (server) => {
    setFormData(prev => ({
      ...prev,
      purchased_with_server_sn: server.serial_number || '',
      user: server.user_person || prev.user,
      department: server.department || prev.department,
      status: mapServerStatusToPartStatus(server.status),
      location: server.location || prev.location
    }));
    setServerSearchText(`${server.serial_number || ''} (${server.hostname || server.ip_address || server.asset_code || ''})`);
    setShowServerDropdown(false);
    setServerSearchResults([]);
  };

  // 清除关联服务器
  const clearServerSelection = () => {
    setFormData(prev => ({
      ...prev,
      purchased_with_server_sn: '',
      // 清除关联时不自动清空使用人和部门，保留用户可能修改的值
    }));
    setServerSearchText('');
    setServerSearchResults([]);
  };

  // 点击外部关闭下拉框
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

  const fetchParts = async () => {
    try {
      setLoading(true);
      const response = await assetAPI.getAssets('in_storage,in_use,idle');
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

  // 监听配件数据变化事件（入库/删除入库单时触发）
  useEffect(() => {
    const handleAssetDataChanged = () => {
      console.log('配件数据已变化，自动刷新列表');
      fetchParts();
    };
    window.addEventListener('assetDataChanged', handleAssetDataChanged);
    return () => {
      window.removeEventListener('assetDataChanged', handleAssetDataChanged);
    };
  }, []);

  const fmt = (v) => (v != null && v !== '' ? String(v) : '—');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('zh-CN') : '—');
  const statusText = (s) => ({ in_storage: '在库', in_use: '使用中', idle: '空闲', pending_scrap: '报废', scrapped: '已报废', deleted: '已删除' }[s] || s);

  const displayAssetCode = (p) => (p.asset_code ? p.asset_code : '-');

  const openCreate = () => {
    setEditingPart(null);
    setFormData({
      asset_code: '',
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
      remark: '',
      bmc_ip: '',
      system_ip: '',
      system_username: '',
      system_password: '',
      u_position: '',
      u_height: 1,
      cpu_model: '',
      memory_gb: '',
      disk_info: ''
    });
    setServerSearchText('');
    setServerSearchResults([]);
    setShowForm(true);
  };

  const openEdit = (asset) => {
    setEditingPart(asset);
    const fmtDateVal = (d) => (d ? (d.slice ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10)) : '');
    const code = displayAssetCode(asset);
    setFormData({
      asset_code: code,
      sn: asset.sn || '',
      model: asset.model || '',
      brand: asset.brand || '',
      part_type: asset.part_type || '',
      capacity: asset.capacity ?? '',
      capacity_unit: asset.capacity_unit || '',
      cpu_cores: asset.cpu_cores ?? '',
      frequency: asset.frequency ?? '',
      frequency_unit: asset.frequency_unit || '',
      interface_type: asset.interface_type || '',
      spec: asset.spec || '',
      user: asset.user || '',
      purchased_with_server_sn: asset.purchased_with_server_sn || '',
      status: asset.status || 'in_storage',
      location: asset.location || '',
      department: asset.department || '',
      contract_number: asset.contract_number || '',
      purchase_date: fmtDateVal(asset.purchase_date),
      warranty_expiry: fmtDateVal(asset.warranty_expiry),
      remark: asset.remark || '',
      bmc_ip: asset.bmc_ip || '',
      system_ip: asset.system_ip || '',
      system_username: asset.system_username || '',
      system_password: asset.system_password || '',
      u_position: asset.u_position || '',
      u_height: asset.u_height ?? 1,
      cpu_model: asset.cpu_model || '',
      memory_gb: asset.memory_gb ?? '',
      disk_info: asset.disk_info || ''
    });
    // 如果有关联服务器SN，设置显示文本
    setServerSearchText(asset.purchased_with_server_sn || '');
    setServerSearchResults([]);
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numFields = ['cpu_cores', 'u_height', 'memory_gb'];

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: numFields.includes(name) ? (value === '' ? '' : parseInt(value, 10) || 0) : value
      };

      // 当配件类型变化时，清空不兼容的联动字段并自动设置频率单位
      if (name === 'part_type') {
        const newType = value;
        // 自动设置规格（如果只有一个选项则自动带出，否则清空不兼容的值）
        const specOptions = SPEC_BY_TYPE[newType] || [];
        if (specOptions.length === 1) {
          // 只有一个选项，自动带出
          updated.spec = specOptions[0];
        } else if (prev.spec && !specOptions.includes(prev.spec)) {
          // 多个选项但当前值不兼容，清空
          updated.spec = '';
        }
        // 自动设置容量单位（如果只有一个选项则自动带出，否则清空不兼容的值）
        const capUnits = CAPACITY_UNIT_BY_TYPE[newType] || [];
        if (capUnits.length === 1) {
          updated.capacity_unit = capUnits[0];
        } else if (prev.capacity_unit && !capUnits.includes(prev.capacity_unit)) {
          updated.capacity_unit = '';
        }
        // 自动设置频率单位（根据类型自动带出，不可选择）
        const freqUnits = FREQUENCY_UNIT_BY_TYPE[newType] || [];
        updated.frequency_unit = freqUnits.length > 0 ? freqUnits[0] : '';
        // 检查接口类型
        if (prev.interface_type && !getOptionsForType(INTERFACE_BY_TYPE, newType).includes(prev.interface_type)) {
          updated.interface_type = '';
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    delete payload.asset_code;
    
    // 确保联动字段有正确的值（如果类型选择后联动了默认值）
    const partType = payload.part_type || '';
    if (partType) {
      // 规格：如果只有一个选项且当前为空，使用默认值
      const specOpts = SPEC_BY_TYPE[partType] || [];
      if (specOpts.length === 1 && !payload.spec) {
        payload.spec = specOpts[0];
      }
      // 容量单位：如果只有一个选项且当前为空，使用默认值
      const capOpts = CAPACITY_UNIT_BY_TYPE[partType] || [];
      if (capOpts.length === 1 && !payload.capacity_unit) {
        payload.capacity_unit = capOpts[0];
      }
      // 频率单位：自动设置
      const freqOpts = FREQUENCY_UNIT_BY_TYPE[partType] || [];
      if (freqOpts.length > 0 && !payload.frequency_unit) {
        payload.frequency_unit = freqOpts[0];
      }
    }
    
    if (payload.purchase_date === '') payload.purchase_date = null;
    if (payload.warranty_expiry === '') payload.warranty_expiry = null;
    ['cpu_cores', 'u_height', 'memory_gb'].forEach(k => {
      if (payload[k] === '' || payload[k] == null) payload[k] = null;
      else if (typeof payload[k] !== 'number') payload[k] = parseInt(payload[k], 10);
    });
    
    try {
      if (editingPart) {
        await assetAPI.updateAsset(editingPart.id, payload);
        alert('配件更新成功');
      } else {
        const res = await assetAPI.createAsset(payload);
        const created = res.data;
        if (created && created.id != null && !created.asset_code) {
          created.asset_code = `SY-PT-${String(created.id).padStart(4, '0')}`; // 备用，实际由后端生成
        }
        setParts(prev => [created, ...prev]);
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
    if (!window.confirm('确定要将此配件标记为报废吗？')) return;
    try {
      await assetAPI.scrapAsset(id);
      alert('已标记为报废');
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
      asset.history = historyRes.data || [];
      setSelectedPart(asset);
      setShowDetail(true);
    } catch (err) {
      console.error('获取详情失败:', err);
      alert('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 获取所有配件类型用于筛选下拉
  const partTypes = [...new Set(parts.map(p => p.part_type).filter(Boolean))];

  // 过滤逻辑
  const filteredParts = parts.filter(p => {
    const q = searchText.toLowerCase();
    if (q) {
      const fields = [p.asset_code, p.sn, p.brand, p.model, p.user, p.spec, p.part_type, p.purchased_with_server_sn].map(v => (v || '').toLowerCase());
      if (!fields.some(f => f.includes(q))) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (partTypeFilter && p.part_type !== partTypeFilter) return false;
    return true;
  });

  return (
    <section className="dashboard">
      <div className="section-header">
        <h2>配件概览</h2>
        <div className="header-actions">
          <button className="btn-refresh" onClick={fetchParts}>刷新</button>
        </div>
      </div>

      {/* 搜索与筛选 */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="搜索：资产编码/SN/品牌/型号/使用人/规格/关联服务器SN"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', minWidth: '280px' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        >
          <option value="">全部状态</option>
          <option value="in_storage">在库</option>
          <option value="in_use">使用中</option>
          <option value="idle">空闲</option>
        </select>
        <select
          value={partTypeFilter}
          onChange={(e) => setPartTypeFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        >
          <option value="">全部类型</option>
          {partTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div className="servers-list">
          <table>
            <thead>
              <tr>
                <th>资产编码</th>
                <th>序列号(SN)</th>
                <th>品牌</th>
                <th>型号</th>
                <th>配件类型</th>
                <th>容量</th>
                <th>容量单位</th>
                <th>核心数</th>
                <th>频率</th>
                <th>频率单位</th>
                <th>接口类型</th>
                <th>规格</th>
                <th>使用人</th>
                <th>关联服务器</th>
                <th>状态</th>
                <th>位置</th>
                <th>部门</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan="18" style={{ padding: '20px', textAlign: 'center' }}>暂无匹配的配件数据</td>
                </tr>
              ) : (
                filteredParts.map((p) => (
                  <tr key={p.id}>
                    <td>{displayAssetCode(p)}</td>
                    <td>{p.sn}</td>
                    <td>{p.brand || '-'}</td>
                    <td>{p.model || '-'}</td>
                    <td>{p.part_type || '-'}</td>
                    <td>{p.capacity ?? '-'}</td>
                    <td>{p.capacity_unit || '-'}</td>
                    <td>{p.cpu_cores ?? '-'}</td>
                    <td>{p.frequency ?? '-'}</td>
                    <td>{p.frequency_unit || '-'}</td>
                    <td>{p.interface_type || '-'}</td>
                    <td>{p.spec || '-'}</td>
                    <td>{p.user || '-'}</td>
                    <td>{p.purchased_with_server_sn || '-'}</td>
                    <td><span className={`status status-tag ${p.status}`}>{statusText(p.status)}</span></td>
                    <td>{p.location || '-'}</td>
                    <td>{p.department || '-'}</td>
                    <td>
                      <button className="btn-primary" onClick={() => viewDetail(p.id)}>详情</button>
                      <button className="btn-secondary" onClick={() => openEdit(p)}>编辑</button>
                      <button className="btn-warning" onClick={() => scrapPart(p.id)}>报废</button>
                      <button className="btn-danger" onClick={() => deleteToRecycle(p.id)}>删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 创建/编辑配件表单 - 与服务器模块相同布局与样式 */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-form-server oa-form">
            <div className="modal-header server-detail-header">
              <div className="server-detail-title-wrap">
                <h2>配件资产</h2>
                <p className="server-detail-subtitle">{editingPart ? `编辑：${formData.sn || formData.asset_code || '未命名'}` : '新增配件'}</p>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowForm(false)} aria-label="关闭">×</button>
            </div>
            <div className="modal-body server-detail-body">
              <form onSubmit={handleSubmit} className="oa-form-form">
                <section className="form-section">
                  <h3 className="detail-section-title">基础信息</h3>
                  <div className="form-section-inner">
                    <div className="form-row">
                      {editingPart ? (
                        <div className="form-group">
                          <label>资产编码</label>
                          <input type="text" value={formData.asset_code} readOnly disabled className="readonly-input" />
                        </div>
                      ) : (
                        <div className="form-group">
                          <label>资产编码</label>
                          <input type="text" readOnly disabled className="readonly-input" placeholder="根据类型自动生成" />
                        </div>
                      )}
                      <div className="form-group">
                        <label>序列号(SN) *</label>
                        <input type="text" name="sn" value={formData.sn} onChange={handleInputChange} required disabled={!!editingPart} />
                      </div>
                      <div className="form-group">
                        <label>品牌</label>
                        <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>型号 *</label>
                        <input type="text" name="model" value={formData.model} onChange={handleInputChange} required />
                      </div>
                      <div className="form-group">
                        <label>配件类型</label>
                        <select name="part_type" value={formData.part_type} onChange={handleInputChange}>
                          <option value="">请选择</option>
                          {PART_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>规格</label>
                        {(() => {
                          const specOpts = SPEC_BY_TYPE[formData.part_type] || [];
                          if (specOpts.length === 0) {
                            return <input type="text" value="无" readOnly disabled className="readonly-input" />;
                          } else if (specOpts.length === 1) {
                            return <input type="text" value={formData.spec || specOpts[0]} readOnly disabled className="readonly-input" />;
                          } else {
                            return (
                              <select name="spec" value={formData.spec} onChange={handleInputChange}>
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
                        <input type="text" name="capacity" value={formData.capacity} onChange={handleInputChange} />
                      </div>
                      <div className="form-group">
                        <label>容量单位</label>
                        {(() => {
                          const capOpts = CAPACITY_UNIT_BY_TYPE[formData.part_type] || [];
                          if (capOpts.length === 0) {
                            return <input type="text" value="无" readOnly disabled className="readonly-input" />;
                          } else if (capOpts.length === 1) {
                            return <input type="text" value={formData.capacity_unit || capOpts[0]} readOnly disabled className="readonly-input" />;
                          } else {
                            return (
                              <select name="capacity_unit" value={formData.capacity_unit} onChange={handleInputChange}>
                                <option value="">请选择</option>
                                {capOpts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            );
                          }
                        })()}
                      </div>
                      <div className="form-group">
                        <label>核心数</label>
                        <input type="number" name="cpu_cores" min={0} value={formData.cpu_cores} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>频率</label>
                        <input type="text" name="frequency" value={formData.frequency} onChange={handleInputChange} />
                      </div>
                      <div className="form-group">
                        <label>频率单位</label>
                        <input type="text" value={formData.frequency_unit || '无'} readOnly disabled className="readonly-input" />
                      </div>
                      <div className="form-group">
                        <label>接口类型</label>
                        {getOptionsForType(INTERFACE_BY_TYPE, formData.part_type).length > 0 ? (
                          <select name="interface_type" value={formData.interface_type} onChange={handleInputChange}>
                            <option value="">请选择</option>
                            {getOptionsForType(INTERFACE_BY_TYPE, formData.part_type).map(o => <option key={o} value={o}>{o}</option>)}
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
                        <input type="text" name="user" value={formData.user} onChange={handleInputChange} />
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
                              // 如果清空了搜索框，也清空关联的SN
                              if (!e.target.value) {
                                setFormData(prev => ({ ...prev, purchased_with_server_sn: '' }));
                              }
                            }}
                            onFocus={() => setShowServerDropdown(true)}
                            placeholder="搜索SN/主机名/IP/资产编码..." 
                            style={{ flex: 1 }}
                          />
                          {formData.purchased_with_server_sn && (
                            <button type="button" className="btn-secondary" onClick={clearServerSelection} style={{ padding: '4px 8px' }}>清除</button>
                          )}
                        </div>
                        {formData.purchased_with_server_sn && (
                          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                            已关联: {formData.purchased_with_server_sn}
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
                        <select name="status" value={formData.status} onChange={handleInputChange}>
                          <option value="in_storage">在库</option>
                          <option value="in_use">使用中</option>
                          <option value="idle">空闲</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>位置</label>
                        <input type="text" name="location" value={formData.location} onChange={handleInputChange} />
                      </div>
                      <div className="form-group">
                        <label>部门</label>
                        <input type="text" name="department" value={formData.department} onChange={handleInputChange} />
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
                        <input type="text" name="contract_number" value={formData.contract_number} onChange={handleInputChange} />
                      </div>
                      <div className="form-group">
                        <label>采购日期</label>
                        <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleInputChange} />
                      </div>
                      <div className="form-group">
                        <label>保修到期</label>
                        <input type="date" name="warranty_expiry" value={formData.warranty_expiry} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: '1 1 100%' }}>
                        <label>备注</label>
                        <textarea name="remark" value={formData.remark} onChange={handleInputChange} rows={2} placeholder="选填" />
                      </div>
                    </div>
                  </div>
                </section>
                <div className="form-actions oa-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
                  <button type="submit" className="btn-primary">{editingPart ? '更新' : '创建'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 - OA 风格 */}
      {showDetail && selectedPart && (
        <div className="modal-overlay">
          <div className="modal-content server-detail-modal oa-detail" style={{ maxWidth: '800px' }}>
            <div className="modal-header server-detail-header">
              <div className="server-detail-title-wrap">
                <h2>配件资产详情</h2>
                <p className="server-detail-subtitle">{displayAssetCode(selectedPart)} / {selectedPart.sn}</p>
              </div>
              <div className="server-detail-header-right">
                <span className={`status status-tag ${selectedPart.status}`}>{statusText(selectedPart.status)}</span>
                <button type="button" className="btn-close" onClick={() => { setShowDetail(false); setSelectedPart(null); }}>×</button>
              </div>
            </div>
            <div className="modal-body server-detail-body">
              {detailLoading ? (
                <p className="server-detail-loading">加载中...</p>
              ) : (
                <>
                  <section className="detail-section">
                    <h3 className="detail-section-title">基础信息</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">资产编码</span><span className="detail-value">{displayAssetCode(selectedPart)}</span></div>
                      <div className="detail-item"><span className="detail-label">序列号(SN)</span><span className="detail-value">{fmt(selectedPart.sn)}</span></div>
                      <div className="detail-item"><span className="detail-label">品牌</span><span className="detail-value">{fmt(selectedPart.brand)}</span></div>
                      <div className="detail-item"><span className="detail-label">型号</span><span className="detail-value">{fmt(selectedPart.model)}</span></div>
                      <div className="detail-item"><span className="detail-label">配件类型</span><span className="detail-value">{fmt(selectedPart.part_type)}</span></div>
                      <div className="detail-item"><span className="detail-label">容量</span><span className="detail-value">{fmt(selectedPart.capacity)}</span></div>
                      <div className="detail-item"><span className="detail-label">容量单位</span><span className="detail-value">{fmt(selectedPart.capacity_unit)}</span></div>
                      <div className="detail-item"><span className="detail-label">核心数</span><span className="detail-value">{fmt(selectedPart.cpu_cores)}</span></div>
                      <div className="detail-item"><span className="detail-label">频率</span><span className="detail-value">{fmt(selectedPart.frequency)}</span></div>
                      <div className="detail-item"><span className="detail-label">频率单位</span><span className="detail-value">{fmt(selectedPart.frequency_unit)}</span></div>
                      <div className="detail-item"><span className="detail-label">接口类型</span><span className="detail-value">{fmt(selectedPart.interface_type)}</span></div>
                      <div className="detail-item"><span className="detail-label">规格</span><span className="detail-value">{fmt(selectedPart.spec)}</span></div>
                    </div>
                  </section>
                  <section className="detail-section">
                    <h3 className="detail-section-title">使用与位置</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">使用人</span><span className="detail-value">{fmt(selectedPart.user)}</span></div>
                      <div className="detail-item"><span className="detail-label">关联服务器</span><span className="detail-value">{fmt(selectedPart.purchased_with_server_sn)}</span></div>
                      <div className="detail-item"><span className="detail-label">位置</span><span className="detail-value">{fmt(selectedPart.location)}</span></div>
                      <div className="detail-item"><span className="detail-label">部门</span><span className="detail-value">{fmt(selectedPart.department)}</span></div>
                    </div>
                  </section>
                  <section className="detail-section">
                    <h3 className="detail-section-title">合同与保修</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">合同号</span><span className="detail-value">{fmt(selectedPart.contract_number)}</span></div>
                      <div className="detail-item"><span className="detail-label">采购日期</span><span className="detail-value">{fmtDate(selectedPart.purchase_date)}</span></div>
                      <div className="detail-item"><span className="detail-label">保修到期</span><span className="detail-value">{fmtDate(selectedPart.warranty_expiry)}</span></div>
                      <div className="detail-item detail-item-full"><span className="detail-label">备注</span><span className="detail-value">{fmt(selectedPart.remark)}</span></div>
                    </div>
                  </section>
                  {selectedPart.history && selectedPart.history.length > 0 && (
                    <section className="detail-section">
                      <h3 className="detail-section-title">历史记录</h3>
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px', border: '1px solid #e2e8f0', width: '140px' }}>时间</th>
                              <th style={{ padding: '8px', border: '1px solid #e2e8f0', width: '80px' }}>操作类型</th>
                              <th style={{ padding: '8px', border: '1px solid #e2e8f0', width: '70px' }}>操作人</th>
                              <th style={{ padding: '8px', border: '1px solid #e2e8f0' }}>备注</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPart.history.map((h) => (
                              <tr key={h.id}>
                                <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{new Date(h.date).toLocaleString('zh-CN')}</td>
                                <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{h.action}</td>
                                <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{h.operator}</td>
                                <td style={{ padding: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{h.remark || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer server-detail-footer">
              <button type="button" className="btn-secondary" onClick={() => { setShowDetail(false); setSelectedPart(null); }}>关闭</button>
              <button type="button" className="btn-primary" onClick={() => { setShowDetail(false); openEdit(selectedPart); }}>编辑</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PartsManagement;
