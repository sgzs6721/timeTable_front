import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import './App.css';

const { Content } = Layout;

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

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('退出登录成功');
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <Router>
      <Layout className="app-container">
        {user && <AppHeader user={user} onLogout={handleLogout} />}
        <Content>
          <Routes>
            <Route
              path="/login"
              element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />}
            />
            <Route
              path="/register"
              element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/dashboard" />}
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
              path="/"
              element={<Navigate to={user ? "/dashboard" : "/login"} />}
            />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
}

export default App;