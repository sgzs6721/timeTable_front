import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Tag, 
  Space, 
  Popconfirm,
  Row,
  Col,
  Spin,
  Radio,
  Pagination
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  HistoryOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import CustomerStatusHistoryModal from '../components/CustomerStatusHistoryModal';
import { 
  createCustomer, 
  getCustomers, 
  updateCustomer, 
  deleteCustomer, 
  getCustomersByStatus 
} from '../services/customer';
import { getApiBaseUrl } from '../config/api';
import dayjs from 'dayjs';
import './CustomerManagement.css';

const { Option } = Select;
const { TextArea } = Input;

const CustomerManagement = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('all');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [salesFilter, setSalesFilter] = useState('all');
  const [timeFilterType, setTimeFilterType] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [currentDatePage, setCurrentDatePage] = useState(0);
  const [salesList, setSalesList] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const isSales = user?.position?.toUpperCase() === 'SALES';

  useEffect(() => {
    fetchCustomers();
    if (isAdmin) {
      fetchSalesList();
    }
  }, []);

  useEffect(() => {
    extractAvailableDates();
  }, [customers]);

  useEffect(() => {
    filterCustomers();
  }, [customers, activeTab, salesFilter, timeFilterType, selectedDate]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await getCustomers();
      if (response && response.success) {
        // 按创建时间倒序排列（最新的在前面）
        const sortedData = (response.data || []).sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        setCustomers(sortedData);
      } else {
        message.error('获取客户列表失败');
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
      message.error('获取客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data && data.success) {
        // 只获取销售人员
        const sales = (data.data || []).filter(u => u.position === 'SALES' || u.role === 'ADMIN');
        setSalesList(sales);
      }
    } catch (error) {
      console.error('获取销售人员列表失败:', error);
    }
  };

  const extractAvailableDates = () => {
    const dates = new Set();
    const weeks = new Set();
    const months = new Set();

    customers.forEach(customer => {
      if (customer.createdAt) {
        const date = dayjs(customer.createdAt);
        
        // 提取日期 (YYYY-MM-DD)
        dates.add(date.format('YYYY-MM-DD'));
        
        // 提取周 (YYYY-WW)
        const weekStr = `${date.year()}-W${String(date.week()).padStart(2, '0')}`;
        weeks.add(weekStr);
        
        // 提取月份 (YYYY-MM)
        months.add(date.format('YYYY-MM'));
      }
    });

    // 转换为数组并排序（倒序，最新的在前面）
    const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
    const sortedWeeks = Array.from(weeks).sort((a, b) => b.localeCompare(a));
    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));

    setAvailableDates(sortedDates);
    setAvailableWeeks(sortedWeeks);
    setAvailableMonths(sortedMonths);

    // 设置默认选中第一个
    if (timeFilterType === 'day' && sortedDates.length > 0 && !selectedDate) {
      setSelectedDate(sortedDates[0]);
    } else if (timeFilterType === 'week' && sortedWeeks.length > 0 && !selectedDate) {
      setSelectedDate(sortedWeeks[0]);
    } else if (timeFilterType === 'month' && sortedMonths.length > 0 && !selectedDate) {
      setSelectedDate(sortedMonths[0]);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // 按状态过滤
    if (activeTab !== 'all') {
      filtered = filtered.filter(customer => customer.status === activeTab);
    }

    // 按销售人员过滤
    if (salesFilter !== 'all') {
      filtered = filtered.filter(customer => 
        customer.createdBy === parseInt(salesFilter) || 
        customer.assignedSalesId === parseInt(salesFilter)
      );
    }

    // 按时间过滤
    if (timeFilterType !== 'all' && selectedDate) {
      filtered = filtered.filter(customer => {
        const createdDate = dayjs(customer.createdAt);
        
        if (timeFilterType === 'day') {
          return createdDate.format('YYYY-MM-DD') === selectedDate;
        } else if (timeFilterType === 'week') {
          const weekStr = `${createdDate.year()}-W${String(createdDate.week()).padStart(2, '0')}`;
          return weekStr === selectedDate;
        } else if (timeFilterType === 'month') {
          return createdDate.format('YYYY-MM') === selectedDate;
        }
        return true;
      });
    }

    setFilteredCustomers(filtered);
    setCurrentDatePage(0);
  };

  const handleCreate = () => {
    setEditingCustomer(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue({
      childName: customer.childName,
      parentPhone: customer.parentPhone,
      notes: customer.notes,
      source: customer.source
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await deleteCustomer(id);
      if (response && response.success) {
        message.success('删除成功');
        fetchCustomers();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleOpenHistory = (customer, e) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedCustomer(customer);
    setHistoryModalVisible(true);
  };

  const handleHistorySuccess = () => {
    fetchCustomers();
  };

  const handleResetFilters = () => {
    setSalesFilter('all');
    setTimeFilterType('all');
    setSelectedDate('');
    setActiveTab('all');
  };

  const handleTimeFilterTypeChange = (type) => {
    setTimeFilterType(type);
    // 切换时间类型时，自动选择第一个可用日期
    if (type === 'day' && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    } else if (type === 'week' && availableWeeks.length > 0) {
      setSelectedDate(availableWeeks[0]);
    } else if (type === 'month' && availableMonths.length > 0) {
      setSelectedDate(availableMonths[0]);
    } else {
      setSelectedDate('');
    }
  };

  const getMonthDisplayText = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return `${year}年${parseInt(month)}月`;
  };

  const getWeekDisplayText = (weekStr) => {
    const [year, week] = weekStr.split('-W');
    return `${year}年第${week}周`;
  };

  const handleSubmit = async (values) => {
    try {
      const customerData = {
        childName: values.childName,
        parentPhone: values.parentPhone,
        status: editingCustomer ? editingCustomer.status : 'NEW', // 新建时固定为NEW，编辑时保持原状态
        notes: values.notes,
        source: values.source || null
      };

      let response;
      if (editingCustomer) {
        response = await updateCustomer(editingCustomer.id, customerData);
      } else {
        response = await createCustomer(customerData);
      }

      if (response && response.success) {
        message.success(editingCustomer ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchCustomers();
      } else {
        message.error(response?.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'NEW': 'blue',
      'CONTACTED': 'orange',
      'SCHEDULED': 'purple',
      'PENDING_CONFIRM': 'yellow',
      'VISITED': 'green',
      'SOLD': 'success',
      'RE_EXPERIENCE': 'cyan',
      'CLOSED': 'default'
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: '孩子姓名',
      dataIndex: 'childName',
      key: 'childName',
      width: 100,
      render: (name, record) => (
        <Button 
          type="link" 
          onClick={() => handleEdit(record)}
          style={{ padding: 0, height: 'auto' }}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '性别/年龄',
      key: 'genderAge',
      width: 90,
      render: (_, record) => {
        const gender = record.childGender === 'MALE' ? '男' : record.childGender === 'FEMALE' ? '女' : '';
        const age = record.childAge ? `${record.childAge}岁` : '';
        return gender || age ? `${gender}${age ? '/' + age : ''}` : '-';
      },
    },
    {
      title: '年级',
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 130,
      render: (_, record) => (
        <div>
          {record.parentPhone && (
            <div>
              <PhoneOutlined /> {record.parentPhone}
            </div>
          )}
          {record.wechat && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              微信: {record.wechat}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '家长',
      dataIndex: 'parentRelation',
      key: 'parentRelation',
      width: 60,
      render: (relation) => {
        if (relation === 'MOTHER') return '妈妈';
        if (relation === 'FATHER') return '爸爸';
        if (relation === 'OTHER') return '其他';
        return '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '分配销售',
      dataIndex: 'assignedSalesName',
      key: 'assignedSalesName',
      width: 100,
      render: (name) => name || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个客户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const getStatusText = (status) => {
    const statusMap = {
      'NEW': '新建',
      'CONTACTED': '已联系',
      'SCHEDULED': '已安排上门',
      'PENDING_CONFIRM': '待确认',
      'VISITED': '已上门',
      'SOLD': '已成交',
      'RE_EXPERIENCE': '待再体验',
      'CLOSED': '已结束'
    };
    return statusMap[status] || status;
  };

  // 按日期分组客户
  const groupCustomersByDate = (customers) => {
    const groups = {};

    customers.forEach(customer => {
      const dateKey = dayjs(customer.createdAt).format('YYYY-MM-DD');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(customer);
    });

    // 按日期倒序排序
    const sortedGroups = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .reduce((acc, key) => {
        acc[key] = groups[key];
        return acc;
      }, {});

    return sortedGroups;
  };

  const groupedCustomers = groupCustomersByDate(filteredCustomers);

  // 格式化日期显示
  const formatDateTitle = (dateStr) => {
    const date = dayjs(dateStr);
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.day()];
    return `${dateStr} 星期${weekday}`;
  };

  const renderCustomerCard = (customer) => (
    <Col key={customer.id} xs={24} sm={12} md={8} lg={8} xl={8}>
      <Card
        style={{ height: '100%' }}
        bodyStyle={{ padding: '12px' }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {customer.childName}
              </span>
              {customer.parentPhone && (
                <span style={{ color: '#999', fontSize: '13px', marginLeft: '12px' }}>
                  {customer.parentPhone}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {customer.source && (
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {customer.source}
                </span>
              )}
              <Tag color={getStatusColor(customer.status)}>
                {getStatusText(customer.status)}
              </Tag>
            </div>
          </div>
          
          {customer.notes && (
            <div style={{ 
              color: '#000', 
              fontSize: '13px', 
              marginBottom: 4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {customer.notes}
            </div>
          )}

          {customer.lastStatusChangeNote && (
            <div style={{ 
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px dashed #e8e8e8'
            }}>
              <div style={{ 
                color: '#666', 
                fontSize: '12px',
                marginBottom: 2
              }}>
                最近流转：
              </div>
              <div style={{ 
                color: '#999', 
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.5'
              }}>
                {customer.lastStatusChangeNote}
                {customer.lastStatusChangeTime && (
                  <span style={{ marginLeft: '8px', color: '#bbb' }}>
                    {dayjs(customer.lastStatusChangeTime).format('MM-DD HH:mm')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0', height: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', color: '#999', fontSize: '12px', flex: 1 }}>
            {customer.createdByName && (
              <span>{customer.createdByName}</span>
            )}
            {customer.createdAt && (
              <span>{dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm')}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Button 
              type="text"
              icon={<HistoryOutlined />}
              title="状态流转记录"
              onClick={(e) => handleOpenHistory(customer, e)}
            />
            <Button 
              type="text"
              icon={<EditOutlined />}
              title="编辑"
              onClick={() => handleEdit(customer)}
            />
            <Popconfirm
              title="确定要删除这个客户吗？"
              onConfirm={() => handleDelete(customer.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="text"
                danger
                icon={<DeleteOutlined />}
                title="删除"
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </div>
        </div>
      </Card>
    </Col>
  );

  return (
    <div style={{ padding: '2px' }}>
        <Card bodyStyle={{ padding: '8px' }}>
          {/* 过滤器 */}
          <div className="customer-filter-area" style={{ marginBottom: 12 }}>
            <Row gutter={8}>
            <Col span={24} style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large" style={{ width: '100%' }}>
                新建客户
              </Button>
            </Col>
            
            {isAdmin && (
              <Col span={12} style={{ marginBottom: 12 }}>
                <Select
                  value={salesFilter}
                  onChange={setSalesFilter}
                  style={{ width: '100%' }}
                  placeholder="全部销售"
                  size="large"
                >
                  <Option value="all">全部销售</Option>
                  {salesList.map(sales => (
                    <Option key={sales.id} value={sales.id.toString()}>
                      {sales.nickname || sales.username}
                    </Option>
                  ))}
                </Select>
              </Col>
            )}
            
            <Col span={isAdmin ? 12 : 24} style={{ marginBottom: 12 }}>
              <Select
                value={activeTab}
                onChange={setActiveTab}
                style={{ width: '100%' }}
                placeholder="全部状态"
                size="large"
              >
                <Option value="all">全部状态</Option>
                <Option value="NEW">新建</Option>
                <Option value="CONTACTED">已联系</Option>
                <Option value="SCHEDULED">已安排上门</Option>
                <Option value="PENDING_CONFIRM">待确认</Option>
                <Option value="VISITED">已上门</Option>
                <Option value="SOLD">已成交</Option>
                <Option value="RE_EXPERIENCE">待再体验</Option>
                <Option value="CLOSED">已结束</Option>
              </Select>
            </Col>
            
            
            <Col xs={24} sm={24} md={24} lg={24}>
              <Radio.Group 
                value={timeFilterType} 
                onChange={(e) => handleTimeFilterTypeChange(e.target.value)}
                style={{ width: '100%' }}
                size="large"
              >
                <Radio.Button value="all" style={{ width: '25%', textAlign: 'center' }}>
                  全部
                </Radio.Button>
                <Radio.Button value="day" style={{ width: '25%', textAlign: 'center' }}>
                  按日
                </Radio.Button>
                <Radio.Button value="week" style={{ width: '25%', textAlign: 'center' }}>
                  按周
                </Radio.Button>
                <Radio.Button value="month" style={{ width: '25%', textAlign: 'center' }}>
                  按月
                </Radio.Button>
              </Radio.Group>
            </Col>
            
            {timeFilterType !== 'all' && (
              <Col xs={24} sm={24} md={24} lg={24} style={{ marginTop: 12 }}>
                {timeFilterType === 'day' && (
                  <Select
                    value={selectedDate}
                    onChange={setSelectedDate}
                    style={{ width: '100%' }}
                    placeholder="选择日期"
                    size="large"
                  >
                    {availableDates.map(date => (
                      <Option key={date} value={date}>{date}</Option>
                    ))}
                  </Select>
                )}
                {timeFilterType === 'week' && (
                  <Select
                    value={selectedDate}
                    onChange={setSelectedDate}
                    style={{ width: '100%' }}
                    placeholder="选择周"
                    size="large"
                  >
                    {availableWeeks.map(week => (
                      <Option key={week} value={week}>
                        {getWeekDisplayText(week)}
                      </Option>
                    ))}
                  </Select>
                )}
                {timeFilterType === 'month' && (
                  <Select
                    value={selectedDate}
                    onChange={setSelectedDate}
                    style={{ width: '100%' }}
                    placeholder="选择月份"
                    size="large"
                  >
                    {availableMonths.map(month => (
                      <Option key={month} value={month}>
                        {getMonthDisplayText(month)}
                      </Option>
                    ))}
                  </Select>
                )}
              </Col>
            )}
            </Row>
          </div>

        {/* 卡片列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <p>暂无客户数据</p>
          </div>
        ) : (
          <div className="customer-card-list" style={{ overflow: 'hidden', width: '100%' }}>
            {(() => {
              const dateGroups = Object.entries(groupedCustomers);
              const totalPages = dateGroups.length;
              
              if (totalPages === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                    当前筛选条件下暂无数据
                  </div>
                );
              }

              // 确保当前页在有效范围内
              const validPage = Math.min(currentDatePage, totalPages - 1);
              const [currentDate, currentCustomers] = dateGroups[validPage] || ['', []];
              
              return (
                <>
                  <div style={{ marginBottom: 12, overflow: 'hidden', width: '100%' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      marginBottom: 12,
                      padding: '8px 20px',
                      gap: '4em',
                      background: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(67, 206, 162, 0.25)'
                    }}>
                      <h3 style={{ 
                        margin: 0,
                        color: '#fff',
                        fontSize: '15px',
                        fontWeight: '500',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <CalendarOutlined />
                        {formatDateTitle(currentDate)}
                      </h3>
                      <span style={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '13px',
                        fontWeight: '400'
                      }}>
                        共 {currentCustomers.length} 条数据
                      </span>
                    </div>
                    <Row gutter={[4, 8]} style={{ margin: 0, width: '100%' }}>
                      {currentCustomers.map(customer => renderCustomerCard(customer))}
                    </Row>
                  </div>
                  
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                      <Pagination
                        current={validPage + 1}
                        total={totalPages}
                        pageSize={1}
                        onChange={(page) => setCurrentDatePage(page - 1)}
                        showSizeChanger={false}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Card>

      {/* 客户表单模态框 */}
      <Modal
        title={editingCustomer ? '编辑客户' : '新建客户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="childName"
                label="孩子姓名"
                rules={[{ required: true, message: '请输入孩子姓名' }]}
              >
                <Input placeholder="请输入孩子姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="parentPhone"
                label="家长电话"
                rules={[{ required: true, message: '请输入家长电话' }]}
              >
                <Input placeholder="请输入家长电话" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="source"
            label="地点"
          >
            <Input placeholder="请输入地点" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="详情"
            rules={[{ required: true, message: '请输入详情' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="请输入详细信息，如：什么时候有时间、家长关系（爸爸/妈妈）、性别、年龄、微信号等" 
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCustomer ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 状态流转记录模态框 */}
      <CustomerStatusHistoryModal
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        customer={selectedCustomer}
        onSuccess={handleHistorySuccess}
      />
    </div>
  );
};

export default CustomerManagement;
