import React from 'react';

const Footer = () => {
  return (
    <div style={{ 
      marginTop: 'auto',
      paddingTop: '16px',
      paddingBottom: '16px',
      borderTop: '1px solid #f0f0f0'
    }}>
      <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '4px' }}>
        © 2023-{new Date().getFullYear()} 飓风乒乓培训中关村校区
      </div>
      <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '2px' }}>
        雷网科技（北京）有限公司
      </div>
    </div>
  );
};

export default Footer;