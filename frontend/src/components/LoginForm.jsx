import React, { useState } from 'react';
import { authAPI } from '../services/api';
import '../App.css';

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // 使用真实API进行登录（axios 返回 response.data 为后端 body）
      const res = await authAPI.login({ username, password });
      const token = res.data?.access_token;
      if (!token) throw new Error('登录响应无效');
      onLogin({ username: username, token });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || d.loc?.join('.')).join('; ')
        : typeof detail === 'string'
          ? detail
          : err.message || '用户名或密码错误';
      setError('登录失败: ' + msg);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
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