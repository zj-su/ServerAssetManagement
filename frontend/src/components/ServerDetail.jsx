import React, { useState, useEffect } from 'react';
import { serverAPI, assetAPI } from '../services/api';
import '../App.css';

function ServerDetail({ serverId, onClose }) {
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // 配件列表状态
  const [showParts, setShowParts] = useState(false);
  const [parts, setParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);

  useEffect(() => {
    const fetchServerDetail = async () => {
      if (!serverId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await serverAPI.getServer(serverId);
        // 兼容直接返回对象或 { data: 对象 } 两种格式
        const payload = res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data;
        if (payload && (payload.id != null || payload.serial_number != null)) {
          setServer(payload);
        } else {
          setError('服务器数据为空');
        }
      } catch (err) {
        setError('获取服务器详情失败: ' + (err.message || err.response?.data?.detail || '未知错误'));
        console.error('Error fetching server detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServerDetail();
  }, [serverId]);

  // 获取关联配件
  const fetchParts = async () => {
    if (!server?.serial_number) {
      setParts([]);
      return;
    }
    try {
      setPartsLoading(true);
      const res = await assetAPI.getAssetsByServerSN(server.serial_number);
      setParts(res.data || []);
    } catch (err) {
      console.error('获取关联配件失败:', err);
      setParts([]);
    } finally {
      setPartsLoading(false);
    }
  };

  // 切换配件显示
  const toggleParts = () => {
    if (!showParts) {
      fetchParts();
    }
    setShowParts(!showParts);
  };

  const partStatusText = (s) => {
    const map = {
      in_storage: '在库',
      in_use: '使用中',
      idle: '空闲',
      pending_scrap: '待报废',
      scrapped: '已报废'
    };
    return map[s] || s;
  };

  const fmt = (v) => (v != null && v !== '' ? String(v) : '—');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('zh-CN') : '—');
  const statusText = (s) => {
    const map = {
      online: '使用中',
      offline: '空闲',
      maintenance: '在库',
      pending_scrap: '待报废',
      scrapped: '已报废'
    };
    return map[s] || s;
  };

  if (loading) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content server-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header server-detail-header">
            <h2>服务器详情</h2>
            <button type="button" className="btn-close" onClick={onClose} aria-label="关闭">×</button>
          </div>
          <div className="modal-body">
            <p className="server-detail-loading">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content server-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header server-detail-header">
            <h2>服务器详情</h2>
            <button type="button" className="btn-close" onClick={onClose} aria-label="关闭">×</button>
          </div>
          <div className="modal-body">
            <p className="error">{error}</p>
            <button type="button" className="btn-primary" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  if (!server || (server.id == null && server.serial_number == null)) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content server-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header server-detail-header">
            <h2>服务器详情</h2>
            <button type="button" className="btn-close" onClick={onClose} aria-label="关闭">×</button>
          </div>
          <div className="modal-body">
            <p style={{ color: '#64748b' }}>暂无数据</p>
            <button type="button" className="btn-secondary" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const title = server.asset_code || (fmt(server.serial_number) !== '—' ? server.serial_number : server.ip_address || `#${server.id}`);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content server-detail-modal oa-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header server-detail-header">
          <div className="server-detail-title-wrap">
            <h2>服务器资产详情</h2>
            <p className="server-detail-subtitle">{title}</p>
          </div>
          <div className="server-detail-header-right">
            <span className={`status status-tag ${server.status}`}>{statusText(server.status)}</span>
            <button type="button" className="btn-close" onClick={onClose} aria-label="关闭">×</button>
          </div>
        </div>
        <div className="modal-body server-detail-body">
          <section className="detail-section">
            <h3 className="detail-section-title">基础信息</h3>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">资产编码</span><span className="detail-value">{server.asset_code && String(server.asset_code).startsWith('SY-SR-') ? server.asset_code : (server.id != null ? `SY-SR-${String(server.id).padStart(4, '0')}` : '—')}</span></div>
              <div className="detail-item"><span className="detail-label">序列号(SN)</span><span className="detail-value">{fmt(server.serial_number)}</span></div>
              <div className="detail-item"><span className="detail-label">品牌</span><span className="detail-value">{fmt(server.brand)}</span></div>
              <div className="detail-item"><span className="detail-label">型号</span><span className="detail-value">{fmt(server.model)}</span></div>
              <div className="detail-item"><span className="detail-label">CPU型号</span><span className="detail-value">{fmt(server.cpu_model)}</span></div>
              <div className="detail-item"><span className="detail-label">CPU核心数</span><span className="detail-value">{fmt(server.cpu_cores)}</span></div>
            </div>
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">网络信息</h3>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">系统IP</span><span className="detail-value">{fmt(server.ip_address)}</span></div>
              <div className="detail-item"><span className="detail-label">BMC IP</span><span className="detail-value">{fmt(server.bmc_ip)}</span></div>
              <div className="detail-item"><span className="detail-label">BMC账号</span><span className="detail-value">{fmt(server.bmc_username)}</span></div>
              <div className="detail-item"><span className="detail-label">BMC密码</span><span className="detail-value">{fmt(server.bmc_password)}</span></div>
              <div className="detail-item"><span className="detail-label">系统账号</span><span className="detail-value">{fmt(server.system_username)}</span></div>
              <div className="detail-item"><span className="detail-label">系统密码</span><span className="detail-value">{fmt(server.system_password)}</span></div>
            </div>
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">使用与位置</h3>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">使用人</span><span className="detail-value">{fmt(server.user_person)}</span></div>
              <div className="detail-item"><span className="detail-label">部门</span><span className="detail-value">{fmt(server.department)}</span></div>
              <div className="detail-item"><span className="detail-label">U位</span><span className="detail-value">{fmt(server.u_position)}</span></div>
              <div className="detail-item"><span className="detail-label">U高度</span><span className="detail-value">{fmt(server.u_height)}</span></div>
              <div className="detail-item"><span className="detail-label">位置</span><span className="detail-value">{fmt(server.location)}</span></div>
            </div>
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">合同与保修</h3>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">合同号</span><span className="detail-value">{fmt(server.contract_number)}</span></div>
              <div className="detail-item"><span className="detail-label">采购日期</span><span className="detail-value">{fmtDate(server.purchase_date)}</span></div>
              <div className="detail-item"><span className="detail-label">保修到期</span><span className="detail-value">{fmtDate(server.warranty_expire)}</span></div>
              <div className="detail-item detail-item-full"><span className="detail-label">备注</span><span className="detail-value">{fmt(server.remark)}</span></div>
            </div>
          </section>

          {/* 关联配件区块 */}
          <section className="detail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="detail-section-title" style={{ margin: 0 }}>关联配件</h3>
              <button 
                type="button" 
                className={showParts ? "btn-secondary" : "btn-info"} 
                onClick={toggleParts}
                disabled={!server.serial_number}
                style={{ padding: '4px 12px', fontSize: '13px' }}
              >
                {showParts ? '收起' : '查看配件'}
              </button>
            </div>
            {!server.serial_number && (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>该服务器无序列号，无法关联配件</p>
            )}
            {showParts && (
              <>
                {partsLoading ? (
                  <p style={{ color: '#64748b' }}>加载中...</p>
                ) : parts.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>暂无关联配件</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa', textAlign: 'left' }}>资产编码</th>
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa', textAlign: 'left' }}>SN</th>
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa', textAlign: 'left' }}>类型</th>
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa', textAlign: 'left' }}>型号</th>
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#f8f9fa', textAlign: 'left' }}>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part) => (
                        <tr key={part.id}>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{part.asset_code || '—'}</td>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{part.sn || '—'}</td>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{part.part_type || '—'}</td>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{part.model || '—'}</td>
                          <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>
                            <span className={`status ${part.status}`}>{partStatusText(part.status)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>

          <section className="detail-section detail-section-meta">
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">创建时间</span><span className="detail-value">{server.created_at ? new Date(server.created_at).toLocaleString('zh-CN') : '—'}</span></div>
              <div className="detail-item"><span className="detail-label">更新时间</span><span className="detail-value">{server.updated_at ? new Date(server.updated_at).toLocaleString('zh-CN') : '—'}</span></div>
            </div>
          </section>
        </div>
        <div className="modal-footer server-detail-footer">
          <button type="button" className="btn-primary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

export default ServerDetail;
