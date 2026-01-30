import React, { useState, useEffect } from 'react';
import { serverAPI } from '../services/api';
import '../App.css';

function ServerDetail({ serverId, onClose }) {
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchServerDetail = async () => {
      try {
        setLoading(true);
        const data = await serverAPI.getServer(serverId);
        setServer(data);
        setError(null);
      } catch (err) {
        setError('获取服务器详情失败: ' + (err.message || '未知错误'));
        console.error('Error fetching server detail:', err);
      } finally {
        setLoading(false);
      }
    };

    if (serverId) {
      fetchServerDetail();
    }
  }, [serverId]);

  if (loading) {
    return (
      <div className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>服务器详情</h2>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>服务器详情</h2>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p className="error">{error}</p>
            <button className="btn-primary" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>服务器详情 - {server.hostname}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="server-detail">
            <div className="detail-row">
              <span className="label">ID:</span>
              <span>{server.id}</span>
            </div>
            <div className="detail-row">
              <span className="label">主机名:</span>
              <span>{server.hostname}</span>
            </div>
            <div className="detail-row">
              <span className="label">IP地址:</span>
              <span>{server.ip_address}</span>
            </div>
            <div className="detail-row">
              <span className="label">MAC地址:</span>
              <span>{server.mac_address || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">BMC IP:</span>
              <span>{server.bmc_ip || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">状态:</span>
              <span>
                <span className={`status ${server.status}`}>
                  {server.status === 'online' ? '在线' : 
                   server.status === 'offline' ? '离线' : '维护中'}
                </span>
              </span>
            </div>
            <div className="detail-row">
              <span className="label">CPU型号:</span>
              <span>{server.cpu_model || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">CPU核心数:</span>
              <span>{server.cpu_cores || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">内存(GB):</span>
              <span>{server.memory_gb || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">磁盘信息:</span>
              <span>{server.disk_info || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">位置:</span>
              <span>{server.location || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">创建时间:</span>
              <span>{new Date(server.created_at).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">更新时间:</span>
              <span>{new Date(server.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

export default ServerDetail;