import React, { useState, useEffect } from 'react';
import { adConfigAPI } from '../services/api';

const ADConfigManagement = () => {
  const [config, setConfig] = useState({
    enabled: false,
    server: '',
    domain: '',
    base_dn: '',
    bind_user: '',
    bind_password: '',
    user_search_base: '',
    group_search_base: '',
    use_ssl: false,
    use_tls: true,
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');

  // 获取AD域配置
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await adConfigAPI.getConfig();
      if (response.data) {
        setConfig({
          ...response.data,
          bind_password: '' // 密码不返回，保持为空
        });
      }
    } catch (err) {
      console.error('获取AD域配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    try {
      setSaving(true);
      await adConfigAPI.updateConfig(config);
      alert('AD域配置保存成功');
      fetchConfig();
    } catch (err) {
      console.error('保存AD域配置失败:', err);
      alert('保存失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  // 删除配置
  const deleteConfig = async () => {
    if (!window.confirm('确定要删除AD域配置吗？')) {
      return;
    }
    
    try {
      await adConfigAPI.deleteConfig();
      alert('AD域配置已删除');
      setConfig({
        enabled: false,
        server: '',
        domain: '',
        base_dn: '',
        bind_user: '',
        bind_password: '',
        user_search_base: '',
        group_search_base: '',
        use_ssl: false,
        use_tls: true,
        description: ''
      });
    } catch (err) {
      console.error('删除AD域配置失败:', err);
      alert('删除失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!testUsername || !testPassword) {
      alert('请输入测试用户名和密码');
      return;
    }
    
    try {
      setTesting(true);
      setTestResult(null);
      const response = await adConfigAPI.testConfig({
        username: testUsername,
        password: testPassword
      });
      setTestResult(response.data);
    } catch (err) {
      console.error('测试AD域连接失败:', err);
      setTestResult({
        success: false,
        message: err.response?.data?.detail || err.message || '测试失败'
      });
    } finally {
      setTesting(false);
    }
  };

  // 处理表单输入
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="ldap-page">
      <div className="ldap-header">
        <h2>LDAP 配置管理</h2>
        <p>集中维护 AD/LDAP 连接参数、认证策略与连通性测试。</p>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div className="ldap-layout">
          <section className="ldap-card">
            <div className="ldap-card-header">
              <h3>基础连接配置</h3>
            </div>
            <form className="ldap-form-grid">
              <div className="ldap-switch-row">
                <label className="ldap-switch-label">
                  <input type="checkbox" name="enabled" checked={config.enabled} onChange={handleInputChange} />
                  <span>启用 AD 域认证</span>
                </label>
                <label className="ldap-switch-label">
                  <input type="checkbox" name="use_ssl" checked={config.use_ssl} onChange={handleInputChange} />
                  <span>启用 SSL</span>
                </label>
                <label className="ldap-switch-label">
                  <input type="checkbox" name="use_tls" checked={config.use_tls} onChange={handleInputChange} />
                  <span>启用 TLS（推荐）</span>
                </label>
              </div>

              <div className="form-group">
                <label>AD域服务器地址:</label>
                <input
                  type="text"
                  name="server"
                  value={config.server}
                  onChange={handleInputChange}
                  placeholder="ldap://ad-server:389"
                />
              </div>

              <div className="form-group">
                <label>域名:</label>
                <input
                  type="text"
                  name="domain"
                  value={config.domain}
                  onChange={handleInputChange}
                  placeholder="yourdomain.com"
                />
              </div>

              <div className="form-group">
                <label>基础DN:</label>
                <input
                  type="text"
                  name="base_dn"
                  value={config.base_dn}
                  onChange={handleInputChange}
                  placeholder="DC=yourdomain,DC=com"
                />
              </div>

              <div className="form-group">
                <label>服务账号:</label>
                <input
                  type="text"
                  name="bind_user"
                  value={config.bind_user}
                  onChange={handleInputChange}
                  placeholder="CN=ServiceAccount,OU=ServiceAccounts,DC=yourdomain,DC=com"
                />
              </div>

              <div className="form-group">
                <label>服务账号密码:</label>
                <input
                  type="password"
                  name="bind_password"
                  value={config.bind_password}
                  onChange={handleInputChange}
                  placeholder="留空表示不修改"
                />
              </div>

              <div className="form-group">
                <label>用户搜索基础DN（可选）:</label>
                <input
                  type="text"
                  name="user_search_base"
                  value={config.user_search_base}
                  onChange={handleInputChange}
                  placeholder="留空则使用基础DN"
                />
              </div>

              <div className="form-group">
                <label>组搜索基础DN（可选）:</label>
                <input
                  type="text"
                  name="group_search_base"
                  value={config.group_search_base}
                  onChange={handleInputChange}
                  placeholder="留空则使用基础DN"
                />
              </div>

              <div className="form-group ldap-span-2">
                <label>配置说明:</label>
                <textarea
                  name="description"
                  value={config.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="可选，用于记录配置说明"
                />
              </div>

              <div className="ldap-actions ldap-span-2">
                <button type="button" onClick={saveConfig} disabled={saving} className="btn-primary">
                  {saving ? '保存中...' : '保存配置'}
                </button>
                <button type="button" onClick={deleteConfig} className="btn-secondary">
                  删除配置
                </button>
              </div>
            </form>
          </section>

          <section className="ldap-card ldap-test-card">
            <div className="ldap-card-header">
              <h3>连接测试</h3>
            </div>
            <p className="ldap-test-desc">
              输入AD域用户名和密码测试连接和认证
            </p>

            <div className="ldap-test-grid">
              <div className="form-group">
                <label>测试用户名:</label>
                <input
                  type="text"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  placeholder="username 或 username@domain.com"
                />
              </div>

              <div className="form-group">
                <label>测试密码:</label>
                <input
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="输入密码"
                />
              </div>
            </div>

            <button onClick={testConnection} disabled={testing || !config.enabled} className="btn-primary">
              {testing ? '测试中...' : '测试连接'}
            </button>

            {testResult && (
              <div className={`ldap-test-result ${testResult.success ? 'ok' : 'fail'}`}>
                <strong>{testResult.success ? '✓ 测试成功' : '✗ 测试失败'}</strong>
                <p>{testResult.message}</p>
                {testResult.user_info && (
                  <div style={{ marginTop: '10px', fontSize: '14px' }}>
                    <p><strong>用户信息:</strong></p>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                      <li>用户名: {testResult.user_info.username}</li>
                      <li>邮箱: {testResult.user_info.email}</li>
                      <li>显示名称: {testResult.user_info.display_name || '-'}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default ADConfigManagement;
