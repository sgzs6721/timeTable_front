import React, { useState, useEffect } from 'react';
import { Card, Table, Select, message, Spin, Tag, Statistic, Row, Col, Typography, Empty } from 'antd';
import { MoneyCollectOutlined } from '@ant-design/icons';
import { getAllSalaryCalculations, getSalaryCalculations, getAvailableMonths } from '../services/salaryCalculation';
import useMediaQuery from '../hooks/useMediaQuery';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const MySalary = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [salaryData, setSalaryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [coachFilter, setCoachFilter] = useState('all');
  const [coaches, setCoaches] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [summaryData, setSummaryData] = useState({
    totalSalary: 0,
    totalHours: 0,
    totalTeachers: 0
  });
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // 判断是否为管理员
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  useEffect(() => {
    fetchSalaryData();
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    fetchCoaches();
    filterData();
  }, [salaryData, selectedMonth, coachFilter]);

  const fetchAvailableMonths = async () => {
    try {
      const response = await getAvailableMonths();
      if (response && response.success) {
        setAvailableMonths(response.data || []);
      }
    } catch (error) {
      console.error('获取可用月份列表失败:', error);
      // 如果获取失败，使用默认的最近12个月
      const defaultMonths = [];
      for (let i = 0; i < 12; i++) {
        defaultMonths.push(dayjs().subtract(i, 'month').format('YYYY-MM'));
      }
      setAvailableMonths(defaultMonths);
    }
  };

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const response = await getAllSalaryCalculations();
      if (response && response.success) {
        const data = response.data || [];
        
        // 转换数据格式以匹配前端组件的期望
        const transformedData = data.map(item => ({
          id: `${item.userId}-${item.month}`, // 使用组合ID确保唯一性
          coachId: item.userId,
          coachName: item.nickname || item.username,
          month: item.month,
          baseSalary: item.baseSalary,
          hourlyRate: item.hourlyRate,
          totalHours: item.totalHours,
          hourlyPay: item.hourlyPay,
          socialSecurity: item.socialSecurity,
          commissionRate: item.commissionRate,
          commission: item.commission,
          totalSalary: item.totalSalary,
          payStatus: item.payStatus,
          salaryPeriod: item.salaryPeriod
        }));
        
        // 强制去重：确保同一个教练在同一个月份只有一条记录
        const uniqueMap = new Map();
        transformedData.forEach(item => {
          const key = `${item.coachId}-${item.month}`;
          // 如果已经存在该key，则跳过；否则添加
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        
        const uniqueData = Array.from(uniqueMap.values());
        
        console.log('===== 调试信息 =====');
        console.log('API原始返回:', data.length, '条');
        console.log('去重后:', uniqueData.length, '条');
        console.log('详细数据:', uniqueData);
        
        setSalaryData(uniqueData);
      } else {
        message.error('获取工资数据失败：' + (response?.message || '未知错误'));
      }
    } catch (error) {
      console.error('获取工资数据失败:', error);
      message.error('获取工资数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoaches = async () => {
    try {
      // 从工资数据中提取教练列表
      const uniqueCoaches = [];
      const coachMap = new Map();
      
      salaryData.forEach(item => {
        if (!coachMap.has(item.coachId)) {
          coachMap.set(item.coachId, {
            id: item.coachId,
            name: item.coachName
          });
          uniqueCoaches.push({
            id: item.coachId,
            name: item.coachName
          });
        }
      });
      
      setCoaches(uniqueCoaches);
    } catch (error) {
      console.error('获取教练列表失败:', error);
    }
  };

  const filterData = () => {
    let filtered = [...salaryData]; // 创建副本避免修改原数组

    // 对于普通用户，只显示自己的数据
    if (!isAdmin && user?.id) {
      filtered = filtered.filter(item => item.coachId === user.id);
    }

    // 对于管理员，按月份过滤
    if (isAdmin && selectedMonth && selectedMonth !== 'all') {
      filtered = filtered.filter(item => item.month === selectedMonth);
    }

    // 对于管理员，按教练过滤
    if (isAdmin && coachFilter && coachFilter !== 'all') {
      filtered = filtered.filter(item => item.coachId === parseInt(coachFilter));
    }
    
    // 对于普通用户，只显示当年的数据
    if (!isAdmin) {
      const currentYear = dayjs().format('YYYY');
      filtered = filtered.filter(item => item.month.startsWith(currentYear));
    }

    // 再次去重（双重保险）：同一个教练在同一个月份只保留一条记录
    const uniqueMap = new Map();
    filtered.forEach(item => {
      const key = `${item.coachId}-${item.month}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });
    
    filtered = Array.from(uniqueMap.values());

    // 按月份排序数据（最新月份在前）
    filtered.sort((a, b) => {
      if (a.month === b.month) {
        return a.coachName.localeCompare(b.coachName); // 同月份内按教练名称排序
      }
      return b.month.localeCompare(a.month); // 月份倒序
    });

    setFilteredData(filtered);

    // 计算汇总数据
    const summary = filtered.reduce((acc, item) => ({
      totalSalary: acc.totalSalary + item.totalSalary,
      totalHours: acc.totalHours + item.totalHours,
      totalTeachers: isAdmin ? filtered.length : 1
    }), { totalSalary: 0, totalHours: 0, totalTeachers: 0 });

    setSummaryData(summary);
  };

  // 处理表格分组数据
  const getTableDataSource = () => {
    // 先对filteredData进行最后一次去重
    const uniqueMap = new Map();
    filteredData.forEach(item => {
      const key = `${item.coachId}-${item.month}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });
    const uniqueFiltered = Array.from(uniqueMap.values());
    
    if (selectedMonth !== 'all') {
      return uniqueFiltered;
    }

    // 按月份分组
    const groupedData = [];
    const monthGroups = {};
    
    uniqueFiltered.forEach(item => {
      if (!monthGroups[item.month]) {
        monthGroups[item.month] = [];
      }
      monthGroups[item.month].push(item);
    });

    // 按月份顺序添加数据
    Object.keys(monthGroups)
      .sort((a, b) => b.localeCompare(a)) // 最新月份在前
      .forEach(month => {
        // 添加月份分组标题
        groupedData.push({
          id: `month-${month}`,
          isMonthHeader: true,
          month: month,
          coachName: dayjs(month).format('YYYY年MM月'),
          baseSalary: '',
          totalHours: '',
          hourlyPay: '',
          commission: '',
          socialSecurity: '',
          totalSalary: ''
        });
        
        // 添加该月份的数据
        groupedData.push(...monthGroups[month]);
      });

    return groupedData;
  };


  const columns = [
    {
      title: isAdmin ? '教练' : '月份',
      dataIndex: isAdmin ? 'coachName' : 'month',
      key: isAdmin ? 'coachName' : 'month',
      width: 80,
      align: 'center',
      render: (text, record) => {
        if (record.isMonthHeader) {
          return (
            <div style={{ 
              textAlign: 'left', 
              fontWeight: 'bold', 
              fontSize: '14px',
              color: '#1890ff',
              padding: '8px 0'
            }}>
              {text}
            </div>
          );
        }
        // 普通用户显示月份
        if (!isAdmin) {
          return <Text strong style={{ whiteSpace: 'nowrap' }}>{dayjs(text).format('YYYY年MM月')}</Text>;
        }
        return <Text strong style={{ whiteSpace: 'nowrap' }}>{text}</Text>;
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: record.isMonthHeader ? 'left' : 'center',
          backgroundColor: record.isMonthHeader ? '#f0f9ff' : 'transparent'
        },
        colSpan: record.isMonthHeader ? 7 : 1
      })
    },
        {
          title: '底薪',
          dataIndex: 'baseSalary',
          key: 'baseSalary',
          width: 80,
          align: 'center',
          render: (value, record) => {
            if (record.isMonthHeader) return null;
            return <span style={{ whiteSpace: 'nowrap' }}>¥{Math.round(value)}</span>;
          },
          onCell: (record) => ({
            style: { whiteSpace: 'nowrap', textAlign: 'center' },
            colSpan: record.isMonthHeader ? 0 : 1
          })
        },
    {
      title: '课时数',
      dataIndex: 'totalHours',
      key: 'totalHours',
      width: 70,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader) return null;
        return <span style={{ whiteSpace: 'nowrap' }}>{value}</span>;
      },
      onCell: (record) => ({
        style: { whiteSpace: 'nowrap', textAlign: 'center' },
        colSpan: record.isMonthHeader ? 0 : 1
      })
    },
        {
          title: '课时费',
          dataIndex: 'hourlyPay',
          key: 'hourlyPay',
          width: 90,
          align: 'center',
          render: (value, record) => {
            if (record.isMonthHeader) return null;
            return <span style={{ whiteSpace: 'nowrap' }}>¥{Math.round(value)}</span>;
          },
          onCell: (record) => ({
            style: { whiteSpace: 'nowrap', textAlign: 'center' },
            colSpan: record.isMonthHeader ? 0 : 1
          })
        },
        {
          title: '提成',
          dataIndex: 'commission',
          key: 'commission',
          width: 70,
          align: 'center',
          render: (value, record) => {
            if (record.isMonthHeader) return null;
            return <span style={{ whiteSpace: 'nowrap' }}>¥{Math.round(value)}</span>;
          },
          onCell: (record) => ({
            style: { whiteSpace: 'nowrap', textAlign: 'center' },
            colSpan: record.isMonthHeader ? 0 : 1
          })
        },
        {
          title: '社保',
          dataIndex: 'socialSecurity',
          key: 'socialSecurity',
          width: 80,
          align: 'center',
          render: (value, record) => {
            if (record.isMonthHeader) return null;
            return <Text style={{ color: '#52c41a', whiteSpace: 'nowrap' }}>¥{Math.round(value)}</Text>;
          },
          onCell: (record) => ({
            style: { whiteSpace: 'nowrap', textAlign: 'center' },
            colSpan: record.isMonthHeader ? 0 : 1
          })
        },
        {
          title: '应发工资',
          dataIndex: 'totalSalary',
          key: 'totalSalary',
          width: 100,
          align: 'center',
          render: (value, record) => {
            if (record.isMonthHeader) return null;
            return (
              <Text strong style={{ color: '#52c41a', fontSize: '16px', whiteSpace: 'nowrap' }}>
                ¥{Math.round(value)}
              </Text>
            );
          },
          onCell: (record) => ({
            style: { whiteSpace: 'nowrap', textAlign: 'center' },
            colSpan: record.isMonthHeader ? 0 : 1
          })
        }
  ];

  // 生成月份选项（从后端API获取的可用月份列表）
  const monthOptions = availableMonths.map(month => (
    <Option key={month} value={month}>
      {dayjs(month).format('YYYY年MM月')}
    </Option>
  ));

  return (
    <div style={{ padding: isMobile ? '4px 8px' : '8px 8px 24px 8px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 大的容器卡片 - 包含所有工资相关内容 */}
      <Card 
        style={{ 
          borderRadius: '8px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #e8e8e8'
        }}
        bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
      >
        {/* 标题 */}
        <div style={{ marginBottom: 20, fontSize: '16px', fontWeight: 500 }}>
          <MoneyCollectOutlined style={{ marginRight: 8 }} />
          我的工资
        </div>

        {/* 过滤器和记薪周期容器 - 只对管理员显示 */}
        {isAdmin && (
          <div style={{ 
            marginBottom: 20, 
            padding: '20px', 
            backgroundColor: '#fff', 
            borderRadius: '8px',
            border: '1px solid #e8e8e8',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            {/* 过滤器 */}
            <Row gutter={16} align="middle" style={{ marginBottom: filteredData.length > 0 ? 20 : 0 }}>
              <Col xs={12} sm={12}>
                <div>
                  <div style={{ 
                    marginBottom: 8, 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: '#262626',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '3px', 
                      height: '14px', 
                      backgroundColor: '#1890ff', 
                      borderRadius: '2px',
                      marginRight: '8px'
                    }}></span>
                    月份筛选
                  </div>
                  <Select
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    style={{ 
                      width: '100%', 
                      minWidth: isMobile ? 100 : 140,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    placeholder="请选择月份"
                    size="large"
                    suffixIcon={<span style={{ color: '#bfbfbf' }}>▼</span>}
                  >
                    <Option value="all">
                      <span style={{ color: '#1890ff', fontWeight: 500 }}>全部月份</span>
                    </Option>
                    {monthOptions}
                  </Select>
                </div>
              </Col>
              <Col xs={12} sm={12}>
                <div>
                  <div style={{ 
                    marginBottom: 8, 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: '#262626',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '3px', 
                      height: '14px', 
                      backgroundColor: '#52c41a', 
                      borderRadius: '2px',
                      marginRight: '8px'
                    }}></span>
                    教练筛选
                  </div>
                  <Select
                    value={coachFilter}
                    onChange={setCoachFilter}
                    style={{ 
                      width: '100%', 
                      minWidth: isMobile ? 100 : 140,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    placeholder="请选择教练"
                    size="large"
                    suffixIcon={<span style={{ color: '#bfbfbf' }}>▼</span>}
                  >
                    <Option value="all">
                      <span style={{ color: '#52c41a', fontWeight: 500 }}>全部教练</span>
                    </Option>
                    {coaches.map(coach => (
                      <Option key={coach.id} value={coach.id}>
                        {coach.name}
                      </Option>
                    ))}
                  </Select>
                </div>
              </Col>
            </Row>

            {/* 记薪周期显示 */}
            {filteredData.length > 0 && (
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: '#f0f9ff', 
                borderRadius: '6px', 
                borderLeft: '4px solid #1890ff' 
              }}>
                <Text style={{ fontSize: '14px', color: '#666' }}>
                  记薪周期：<Text strong style={{ color: '#1890ff' }}>{filteredData[0].salaryPeriod}</Text>
                </Text>
              </div>
            )}
          </div>
        )}

        {/* 汇总卡片 */}
        <Row gutter={8} style={{ marginBottom: 20 }}>
          <Col xs={isAdmin ? 8 : 12} sm={isAdmin ? 8 : 12}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title={<span style={{ fontSize: '12px' }}>{isAdmin ? '总工资' : `${dayjs().format('YYYY')}年总工资`}</span>}
                value={Math.round(summaryData.totalSalary)}
                prefix="¥"
                valueStyle={{ color: '#52c41a', fontSize: isMobile ? '16px' : '20px' }}
              />
            </Card>
          </Col>
          <Col xs={isAdmin ? 8 : 12} sm={isAdmin ? 8 : 12}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title={<span style={{ fontSize: '12px' }}>{isAdmin ? '总课时' : `${dayjs().format('YYYY')}年总课时`}</span>}
                value={summaryData.totalHours}
                valueStyle={{ color: '#1890ff', fontSize: isMobile ? '16px' : '20px' }}
                formatter={(value) => (
                  <span>{value}{isMobile ? '' : '课时'}</span>
                )}
              />
            </Card>
          </Col>
          {isAdmin && (
            <Col xs={8} sm={8}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic
                  title={<span style={{ fontSize: '12px' }}>教练数</span>}
                  value={summaryData.totalTeachers}
                  valueStyle={{ color: '#722ed1', fontSize: isMobile ? '16px' : '20px' }}
                  formatter={(value) => (
                    <span>{value}{isMobile ? '' : '人'}</span>
                  )}
                />
              </Card>
            </Col>
          )}
        </Row>

        {/* 工资列表 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '20px' }}>
          <Spin spinning={loading}>
            {filteredData.length === 0 ? (
              <Empty 
                description="暂无工资数据" 
                style={{ margin: '40px 0' }}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={isAdmin ? getTableDataSource() : filteredData}
                rowKey={(record) => record.isMonthHeader ? record.id : `${record.coachId}-${record.month}`}
                pagination={!isAdmin ? false : (selectedMonth === 'all' ? false : {
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
                  size: isMobile ? 'small' : 'default',
                  style: { textAlign: 'center', marginTop: '16px' }
                })}
                scroll={{ x: 570 }}
                size={isMobile ? 'small' : 'middle'}
              />
            )}
          </Spin>
        </div>
      </Card>
    </div>
  );
};

export default MySalary;
