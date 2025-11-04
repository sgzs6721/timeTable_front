import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import SalaryMaster from './SalaryMaster';
import Footer from '../components/Footer';
import useMediaQuery from '../hooks/useMediaQuery';

const OrganizationSalaryManagement = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams();
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fa'
    }}>
      {/* 标题栏 - 全宽，紫色背景 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: isMobile ? '1rem' : '1.5rem 2rem',
        position: 'relative'
      }}>
        <Button
          onClick={() => navigate('/organization-management')}
          icon={<LeftOutlined />}
          shape="circle"
          style={{
            position: 'absolute',
            left: isMobile ? '1rem' : '2rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: '#fff'
          }}
        />
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <h1 style={{ margin: 0, color: '#fff', fontSize: isMobile ? '20px' : '24px' }}>工资管理</h1>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ 
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? '0.5rem' : '1rem 2rem 2rem'
      }}>
        <SalaryMaster />
      </div>
      
      <Footer />
    </div>
  );
};

export default OrganizationSalaryManagement;

