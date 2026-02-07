import React, { useState, useEffect } from 'react';
import { Card, Table, Select, message, Spin, Tag, Typography, Empty } from 'antd';
import { getAllSalaryCalculations, getSalaryCalculations, getAvailableMonths } from '../services/salaryCalculation';
import useMediaQuery from '../hooks/useMediaQuery';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const MySalary = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [salaryData, setSalaryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [availableMonths, setAvailableMonths] = useState([]);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // 判断是否为管理职位（MANAGER职位可以查看所有人工资）
  const isAdmin = user?.position === 'MANAGER';

  useEffect(() => {
    // 先获取工资数据，再获取可用月份列表
    const loadData = async () => {
      await fetchSalaryData();
      await fetchAvailableMonths();
    };
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [salaryData, selectedMonth]);

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

  const filterData = () => {
    let filtered = [...salaryData]; // 创建副本避免修改原数组

    // 对于普通用户，只显示自己的数据
    if (!isAdmin && user?.id) {
      filtered = filtered.filter(item => String(item.coachId) === String(user.id));
    }

    // 对于管理员，按月份过滤
    if (isAdmin && selectedMonth && selectedMonth !== 'all') {
      filtered = filtered.filter(item => item.month === selectedMonth);
    }
    
    // 对于普通用户，显示有课时的数据（不限制年份，因为后端已经只返回最近12个月的数据）
    if (!isAdmin) {
      filtered = filtered.filter(item => item.totalHours > 0);
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
  };

  // 处理管理员表格分组数据（按月份）
  const getAdminTableDataSource = () => {
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

    const groupedData = [];
    const monthGroups = {};
    
    uniqueFiltered.forEach(item => {
      if (!monthGroups[item.month]) {
        monthGroups[item.month] = [];
      }
      monthGroups[item.month].push(item);
    });

    Object.keys(monthGroups)
      .sort((a, b) => b.localeCompare(a))
      .forEach(month => {
        const monthData = monthGroups[month];
        
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
        
        groupedData.push(...monthData);
        
        const monthTotalBaseSalary = monthData.reduce((sum, row) => sum + (row.baseSalary || 0), 0);
        const monthTotalHours = monthData.reduce((sum, row) => sum + (row.totalHours || 0), 0);
        const monthTotalHourlyPay = monthData.reduce((sum, row) => sum + (row.hourlyPay || 0), 0);
        const monthTotalCommission = monthData.reduce((sum, row) => sum + (row.commission || 0), 0);
        const monthTotalSocialSecurity = monthData.reduce((sum, row) => sum + (row.socialSecurity || 0), 0);
        const monthTotalSalary = monthData.reduce((sum, row) => sum + (row.totalSalary || 0), 0);
        
        groupedData.push({
          id: `subtotal-${month}`,
          isMonthSubtotal: true,
          month: month,
          coachName: '总计',
          baseSalary: monthTotalBaseSalary,
          totalHours: monthTotalHours,
          hourlyPay: monthTotalHourlyPay,
          commission: monthTotalCommission,
          socialSecurity: monthTotalSocialSecurity,
          totalSalary: monthTotalSalary
        });
      });

    return groupedData;
  };

  // 处理普通用户表格分组数据（按年份）
  const getUserTableDataSource = () => {
    const uniqueMap = new Map();
    filteredData.forEach(item => {
      const key = `${item.coachId}-${item.month}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });
    const uniqueFiltered = Array.from(uniqueMap.values());
    
    if (uniqueFiltered.length === 0) {
      return [];
    }

    // 按年份分组
    const groupedData = [];
    const yearGroups = {};
    
    uniqueFiltered.forEach(item => {
      const year = item.month.substring(0, 4);
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push(item);
    });

    // 按年份顺序添加数据（最新年份在前）
    Object.keys(yearGroups)
      .sort((a, b) => b.localeCompare(a))
      .forEach(year => {
        const yearData = yearGroups[year];
        
        // 计算该年份的小计
        const yearTotalBaseSalary = yearData.reduce((sum, row) => sum + (row.baseSalary || 0), 0);
        const yearTotalHours = yearData.reduce((sum, row) => sum + (row.totalHours || 0), 0);
        const yearTotalHourlyPay = yearData.reduce((sum, row) => sum + (row.hourlyPay || 0), 0);
        const yearTotalCommission = yearData.reduce((sum, row) => sum + (row.commission || 0), 0);
        const yearTotalSocialSecurity = yearData.reduce((sum, row) => sum + (row.socialSecurity || 0), 0);
        const yearTotalSalary = yearData.reduce((sum, row) => sum + (row.totalSalary || 0), 0);
        
        // 添加年份标题（只作为背景，不显示文字）
        groupedData.push({
          id: `year-${year}`,
          isYearHeader: true,
          year: year,
          month: '',
          coachName: '',
          baseSalary: '',
          totalHours: '',
          hourlyPay: '',
          commission: '',
          socialSecurity: '',
          totalSalary: ''
        });
        
        // 添加该年份的总计行（紧随年份标题）
        groupedData.push({
          id: `year-subtotal-${year}`,
          isYearSubtotal: true,
          year: year,
          month: `${year}年总计`,
          coachName: '',
          baseSalary: yearTotalBaseSalary,
          totalHours: yearTotalHours,
          hourlyPay: yearTotalHourlyPay,
          commission: yearTotalCommission,
          socialSecurity: yearTotalSocialSecurity,
          totalSalary: yearTotalSalary
        });
        
        // 按月份排序该年的数据（最新月份在前）
        const sortedYearData = yearData.sort((a, b) => b.month.localeCompare(a.month));
        groupedData.push(...sortedYearData);
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
        // 管理员的月份标题
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
        // 管理员的月份小计
        if (record.isMonthSubtotal) {
          return <Text strong style={{ color: '#1890ff', whiteSpace: 'nowrap' }}>{text}</Text>;
        }
        // 普通用户的年份标题（只显示背景，不显示文字）
        if (record.isYearHeader) {
          return null;
        }
        // 普通用户的年份小计
        if (record.isYearSubtotal) {
          return <Text strong style={{ color: '#1890ff', fontSize: '14px', whiteSpace: 'nowrap' }}>{text}</Text>;
        }
        // 普通用户显示月份
        if (!isAdmin) {
          return <Text strong style={{ whiteSpace: 'nowrap' }}>{dayjs(text).format('YYYY年MM月')}</Text>;
        }
        return <Text strong style={{ whiteSpace: 'nowrap' }}>{text}</Text>;
      },
      onCell: (record) => {
        let backgroundColor = 'transparent';
        let colSpan = 1;
        let textAlign = 'center';
        
        if (record.isMonthHeader) {
          backgroundColor = '#f0f9ff';
          colSpan = 7;
          textAlign = 'left';
        } else if (record.isMonthSubtotal) {
          backgroundColor = '#fafafa';
        } else if (record.isYearHeader) {
          backgroundColor = '#f0f9ff';
          colSpan = 7;
          textAlign = 'left';
        } else if (record.isYearSubtotal) {
          backgroundColor = '#fafafa';
        }
        
        return {
          style: { 
            whiteSpace: 'nowrap', 
            textAlign,
            backgroundColor,
            fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal',
            padding: record.isYearHeader ? '8px' : undefined
          },
          colSpan
        };
      }
    },
    {
      title: '应发工资',
      dataIndex: 'totalSalary',
      key: 'totalSalary',
      width: 100,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader || record.isYearHeader) return null;
        return (
          <Text strong={record.isMonthSubtotal || record.isYearSubtotal} 
                style={{ 
                  fontSize: (record.isMonthSubtotal || record.isYearSubtotal) ? '16px' : '16px', 
                  whiteSpace: 'nowrap',
                  color: record.isYearSubtotal ? '#1890ff' : 'inherit'
                }}>
            ¥{Math.round(value)}
          </Text>
        );
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: 'center',
          backgroundColor: (record.isMonthSubtotal || record.isYearSubtotal) ? '#fafafa' : 'transparent',
          fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal'
        },
        colSpan: (record.isMonthHeader || record.isYearHeader) ? 0 : 1
      })
    },
    {
      title: '底薪',
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      width: 80,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader || record.isYearHeader) return null;
        return <span style={{ whiteSpace: 'nowrap', fontWeight: record.isYearSubtotal ? 'bold' : 'normal' }}>¥{Math.round(value)}</span>;
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: 'center',
          backgroundColor: (record.isMonthSubtotal || record.isYearSubtotal) ? '#fafafa' : 'transparent',
          fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal'
        },
        colSpan: (record.isMonthHeader || record.isYearHeader) ? 0 : 1
      })
    },
    {
      title: '课时数',
      dataIndex: 'totalHours',
      key: 'totalHours',
      width: 70,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader || record.isYearHeader) return null;
        return <span style={{ whiteSpace: 'nowrap', fontWeight: record.isYearSubtotal ? 'bold' : 'normal' }}>{value}</span>;
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: 'center',
          backgroundColor: (record.isMonthSubtotal || record.isYearSubtotal) ? '#fafafa' : 'transparent',
          fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal'
        },
        colSpan: (record.isMonthHeader || record.isYearHeader) ? 0 : 1
      })
    },
    {
      title: '课时费',
      dataIndex: 'hourlyPay',
      key: 'hourlyPay',
      width: 90,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader || record.isYearHeader) return null;
        return <span style={{ whiteSpace: 'nowrap', fontWeight: record.isYearSubtotal ? 'bold' : 'normal' }}>¥{Math.round(value)}</span>;
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: 'center',
          backgroundColor: (record.isMonthSubtotal || record.isYearSubtotal) ? '#fafafa' : 'transparent',
          fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal'
        },
        colSpan: (record.isMonthHeader || record.isYearHeader) ? 0 : 1
      })
    },
    {
      title: '提成',
      dataIndex: 'commission',
      key: 'commission',
      width: 70,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader || record.isYearHeader) return null;
        return <span style={{ whiteSpace: 'nowrap', fontWeight: record.isYearSubtotal ? 'bold' : 'normal' }}>¥{Math.round(value)}</span>;
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: 'center',
          backgroundColor: (record.isMonthSubtotal || record.isYearSubtotal) ? '#fafafa' : 'transparent',
          fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal'
        },
        colSpan: (record.isMonthHeader || record.isYearHeader) ? 0 : 1
      })
    },
    {
      title: '社保',
      dataIndex: 'socialSecurity',
      key: 'socialSecurity',
      width: 80,
      align: 'center',
      render: (value, record) => {
        if (record.isMonthHeader || record.isYearHeader) return null;
        return <span style={{ whiteSpace: 'nowrap', fontWeight: record.isYearSubtotal ? 'bold' : 'normal' }}>¥{Math.round(value)}</span>;
      },
      onCell: (record) => ({
        style: { 
          whiteSpace: 'nowrap', 
          textAlign: 'center',
          backgroundColor: (record.isMonthSubtotal || record.isYearSubtotal) ? '#fafafa' : 'transparent',
          fontWeight: (record.isMonthSubtotal || record.isYearSubtotal) ? 'bold' : 'normal'
        },
        colSpan: (record.isMonthHeader || record.isYearHeader) ? 0 : 1
      })
    }
  ];

  // 生成月份选项（从后端API获取的可用月份列表，并附带记薪周期）
  const monthOptions = availableMonths.map(month => {
    // 找到该月份的任意一条记录来获取salaryPeriod（同一个月的记薪周期应该都一样）
    const monthData = salaryData.find(item => item.month === month);
    const salaryPeriod = monthData?.salaryPeriod;
    
    return (
      <Option key={month} value={month}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ flex: '0 0 auto' }}>{dayjs(month).format('YYYY年MM月')}</span>
          {salaryPeriod && (
            <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '12px', flex: '0 0 auto', whiteSpace: 'nowrap' }}>
              {salaryPeriod}
            </span>
          )}
        </div>
      </Option>
    );
  });

  return (
    <div style={{ padding: isMobile ? '4px 8px' : '8px 8px 24px 8px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 大的容器卡片 - 包含所有工资相关内容 */}
      <Card 
        style={{ 
          borderRadius: '8px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #e8e8e8'
        }}
        styles={{ body: { padding: isMobile ? '16px' : '24px' } }}
      >
        {/* 月份选择 - 只对管理员显示 */}
        {isAdmin && (
          <div style={{ marginBottom: 20 }}>
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              style={{ 
                width: isMobile ? '100%' : '350px'
              }}
              placeholder="请选择月份"
              size="large"
            >
              <Option value="all">
                <span style={{ color: '#1890ff', fontWeight: 500 }}>全部月份</span>
              </Option>
              {monthOptions}
            </Select>
          </div>
        )}

        {/* 工资列表 */}
        <div>
          <Spin spinning={loading}>
            {filteredData.length === 0 ? (
              <Empty 
                description="暂无工资数据" 
                style={{ margin: '40px 0' }}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={isAdmin ? getAdminTableDataSource() : getUserTableDataSource()}
                rowKey={(record) => {
                  if (record.isMonthHeader || record.isYearHeader) return record.id;
                  if (record.isMonthSubtotal || record.isYearSubtotal) return record.id;
                  return `${record.coachId}-${record.month}`;
                }}
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
                summary={(pageData) => {
                  // 普通用户不显示底部总计（已有每年小计）
                  if (!isAdmin) {
                    return null;
                  }
                  
                  // 对于管理员在“全部月份”视图下，不显示底部总计（已有每月小计）
                  if (isAdmin && selectedMonth === 'all') {
                    return null;
                  }
                  
                  // 过滤掉标题行和小计行
                  const dataRows = pageData.filter(row => 
                    !row.isMonthHeader && !row.isMonthSubtotal && 
                    !row.isYearHeader && !row.isYearSubtotal
                  );
                  
                  if (dataRows.length === 0) return null;
                  
                  // 计算总计
                  const totalBaseSalary = dataRows.reduce((sum, row) => sum + (row.baseSalary || 0), 0);
                  const totalHours = dataRows.reduce((sum, row) => sum + (row.totalHours || 0), 0);
                  const totalHourlyPay = dataRows.reduce((sum, row) => sum + (row.hourlyPay || 0), 0);
                  const totalCommission = dataRows.reduce((sum, row) => sum + (row.commission || 0), 0);
                  const totalSocialSecurity = dataRows.reduce((sum, row) => sum + (row.socialSecurity || 0), 0);
                  const totalSalarySum = dataRows.reduce((sum, row) => sum + (row.totalSalary || 0), 0);
                  
                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                        <Table.Summary.Cell index={0} align="center">
                          <Text strong style={{ color: '#1890ff' }}>总计</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="center">
                          <Text strong style={{ fontSize: '16px' }}>
                            ¥{Math.round(totalSalarySum)}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="center">
                          <Text strong>¥{Math.round(totalBaseSalary)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="center">
                          <Text strong>{totalHours}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="center">
                          <Text strong>¥{Math.round(totalHourlyPay)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="center">
                          <Text strong>¥{Math.round(totalCommission)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6} align="center">
                          <Text strong>¥{Math.round(totalSocialSecurity)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            )}
          </Spin>
        </div>
      </Card>
    </div>
  );
};

export default MySalary;
