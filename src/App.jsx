import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, message } from 'antd';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTimetable from './pages/CreateTimetable';
import InputTimetable from './pages/InputTimetable';
import ViewTimetable from './pages/ViewTimetable';
import AdminPanel from './pages/AdminPanel';
import ConfirmSchedulePage from './pages/ConfirmSchedulePage';
import AppHeader from './components/AppHeader';
import MergePreview from './pages/MergePreview';
import UserProfile from './pages/UserProfile';
import ArchivedTimetables from './pages/ArchivedTimetables';
import ConvertPreview from './pages/ConvertPreview';
import WechatTest from './pages/WechatTest';
import UserGuide from './pages/UserGuide';
import { validateToken } from './services/auth';
import './App.css';

const { Content } = Layout;

function AppContent({ user, setUser, handleLogout, textInputValue, setTextInputValue }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  useEffect(() => {
    // 检查 URL 参数中是否有 token（微信登录跳转）
    const urlParams = new URLSearchParams(location.search);
    const tokenFromUrl = urlParams.get('token');
    const avatarFromUrl = urlParams.get('avatar');
    const nicknameFromUrl = urlParams.get('nickname');

    const handleTokenValidation = async () => {
      if (tokenFromUrl) {
        console.log('检测到 token，开始验证...', { tokenFromUrl, avatarFromUrl, nicknameFromUrl });
        setIsValidatingToken(true);
        // 保存 token 到 localStorage
        localStorage.setItem('token', tokenFromUrl);
        
        try {
          // 验证 token 并获取用户信息
          console.log('调用 validateToken API...');
          const response = await validateToken();
          console.log('validateToken 响应:', response);
          
          if (response.success && response.data) {
            // 合并用户信息，优先使用 URL 参数中的头像和昵称
            const userData = {
              ...response.data,
              avatar: avatarFromUrl || response.data.avatar,
              nickname: nicknameFromUrl || response.data.nickname
            };
            
            console.log('验证成功，用户数据:', userData);
            
            // 保存用户信息
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            setIsValidatingToken(false);
            message.success('微信登录成功');
            
            // 清除 URL 中的参数并跳转到 dashboard
            console.log('准备跳转到 dashboard');
            navigate('/dashboard', { replace: true });
          } else {
            console.error('Token 验证失败，响应:', response);
            message.error('Token 验证失败');
            localStorage.removeItem('token');
            setIsValidatingToken(false);
          }
        } catch (error) {
          console.error('Token 验证异常:', error);
          message.error('登录验证失败');
          localStorage.removeItem('token');
          setIsValidatingToken(false);
        }
      }
    };

    handleTokenValidation();
  }, [location, navigate, setUser]);

  // 如果正在验证 token，显示加载界面
  if (isValidatingToken) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #07c160',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
          微信登录中...
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  return (
    <>
      {user && <AppHeader user={user} onLogout={handleLogout} />}
      <Content>
        <Routes>
          <Route
            path="/login"
            element={!user ? <Login onLogin={(userData) => {
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
            }} /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/register"
            element={!user ? <Register onLogin={(userData) => {
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
            }} /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/dashboard"
            element={user ? <Dashboard user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/create-timetable"
            element={user ? <CreateTimetable user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/input-timetable/:timetableId"
            element={user ? <InputTimetable user={user} textInputValue={textInputValue} setTextInputValue={setTextInputValue} /> : <Navigate to="/login" />}
          />
          <Route
            path="/view-timetable/:timetableId"
            element={user ? <ViewTimetable user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/timetables/:timetableId/confirm-schedule"
            element={user ? <ConfirmSchedulePage setTextInputValue={setTextInputValue} /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin"
            element={user && user.role?.toUpperCase() === 'ADMIN' ? <AdminPanel user={user} /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/preview-merge"
            element={user ? <MergePreview user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={user ? <UserProfile user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/archived-timetables"
            element={user ? <ArchivedTimetables /> : <Navigate to="/login" />}
          />
          <Route
            path="/guide"
            element={user ? <UserGuide /> : <Navigate to="/login" />}
          />
          <Route
            path="/convert-preview"
            element={user ? <ConvertPreview /> : <Navigate to="/login" />}
          />
          <Route
            path="/wechat-test"
            element={<WechatTest />}
          />
          <Route
            path="/"
            element={<Navigate to={user ? "/dashboard" : "/login"} />}
          />
        </Routes>
      </Content>
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [textInputValue, setTextInputValue] = useState('');

  useEffect(() => {
    // 检查本地存储中是否有用户信息
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);

    // 监听用户更新事件
    const handleUserUpdate = (event) => {
      setUser(event.detail);
    };

    window.addEventListener('userUpdated', handleUserUpdate);

    return () => {
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('退出登录成功');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #1890ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
          初始化应用...
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  return (
    <Router>
      <Layout className="app-container">
        <AppContent 
          user={user} 
          setUser={setUser} 
          handleLogout={handleLogout}
          textInputValue={textInputValue}
          setTextInputValue={setTextInputValue}
        />
      </Layout>
    </Router>
  );
}

export default App;