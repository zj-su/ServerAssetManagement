import React, { useState, useRef, useEffect } from 'react';
import { authAPI } from '../services/api';
import '../App.css';

const getRoleFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.role || null;
  } catch (e) {
    return null;
  }
};

const getPermissionsFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Array.isArray(payload?.permissions) ? payload.permissions : [];
  } catch (e) {
    return [];
  }
};

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const res = await authAPI.login({ username, password });
      if (!isMountedRef.current) return;
      const data = res.data;
      const token = data?.access_token ?? data?.token ?? data?.data?.access_token ?? data?.data?.token;
      if (!token || typeof token !== 'string') {
        setError('登录响应异常，请重试');
        return;
      }
      const role = data?.role || getRoleFromToken(token) || 'user';
      const permissions = Array.isArray(data?.permissions) ? data.permissions : getPermissionsFromToken(token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify({ username, role, permissions }));
      onLogin({ username, role, permissions, token });
    } catch (err) {
      if (!isMountedRef.current) return;
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || d.loc?.join('.')).join('; ')
        : typeof detail === 'string'
          ? detail
          : err.message || '网络异常或用户名/密码错误';
      setError('登录失败: ' + msg);
      console.error('Login error:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>用户登录</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">用户名:</label>
            <input
              type="text"
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">密码:</label>
            <input
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;