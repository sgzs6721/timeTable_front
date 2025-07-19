import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, message, Space, Typography, Alert, Spin, Radio, Table, Tag, Modal, List } from 'antd';
import { LeftOutlined, SendOutlined, EditOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, addScheduleByText, addScheduleByFormat } from '../services/timetable';

const { TextArea } = Input;
const { Text } = Typography;

const InputTimetable = ({ user, textInputValue, setTextInputValue }) => {
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parser, setParser] = useState('format');
  const [parsedResults, setParsedResults] = useState([]);
  const [examplesModalVisible, setExamplesModalVisible] = useState(false);

  const navigate = useNavigate();
  const { timetableId } = useParams();



  useEffect(() => {
    if (!timetable) {
      fetchTimetable();
    }

  }, [timetableId]);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        setTimetable(response.data.timetable);
      } else {
        message.error(response.message || '获取课表失败');
        navigate('/dashboard');
      }
    } catch (error) {
      message.error('获取课表失败，请检查网络连接');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };





  const submitTextInput = async () => {
    if (!textInputValue.trim()) {
      message.warning('请输入课程安排信息');
      return;
    }
    
    // 检查timetable是否已加载
    if (!timetable) {
      message.error('课表信息未加载完成，请稍后再试');
      return;
    }
    
    setSubmitting(true);
    try {
      const type = timetable.isWeekly ? 'WEEKLY' : 'DATE_RANGE';
      
      let response;
      if (parser === 'ai') {
        response = await addScheduleByText(timetableId, textInputValue.trim(), type, parser);
      } else {
        response = await addScheduleByFormat(timetableId, textInputValue.trim(), type);
      }
      
      if (response.success && response.data) {
        setParsedResults(response.data);
        
        const successfulSchedules = response.data.filter(item => !item.errorMessage);
        const failedSchedules = response.data.filter(item => item.errorMessage);

        if (failedSchedules.length > 0) {
          message.warning(`有 ${failedSchedules.length} 行解析失败，请根据提示修改。`);
        } else {
          message.success('全部解析成功！请确认排课信息。');
          navigate(`/timetables/${timetableId}/confirm-schedule`, { state: { data: successfulSchedules, timetableType: type } });
        }
      } else {
        message.error(response.message || '无法从文本中解析出有效的排课信息');
        setParsedResults([]);
      }
    } catch (error) {
      message.error('文字录入失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const placeholderText = timetable?.isWeekly
    ? "例如:\n小明 周一,周三 9-10, 16-17\n李四 周二,周四 18-20"
    : "例如:\n王五 8.14-8.16, 8.20 10-11\n赵六 9.1 14:00-15:00";
    
  // Moved these example components out of the main component to avoid re-creation on every render
  const WeeklyExamples = () => (
    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      <Typography.Title level={4}>周固定课表 - 录入格式示例</Typography.Title>
      <List
        bordered
        dataSource={[
          { title: '基本规则', items: ['每个学员占一行，可批量录入。', '【姓名】、【星期】、【时间】三个要素，顺序可任意调换。', '支持中英文逗号、空格作为分隔符。'] },
          { title: '星期格式 (支持范围和各种别名)', items: ['单个星期: `周一`、`星期三`、`日`、`天`。', '只写数字: `1` (周一)、`7` (周日)。', '星期范围: `1-5`、`周一至周五`、`一到三`。'] },
          { title: '时间格式 (支持范围和智能识别)', items: ['单个钟点: `16` (会被解析为 16:00-17:00)。', '钟点范围: `16-18` (会平铺为 16-17 和 17-18 两条记录)。', '智能识别下午: `2-4` (会被解析为 14:00-16:00)。'] },
          { title: '数字格式', items: ['支持中文大小写数字，如 `八` `捌` `十` `拾`。', '示例: `周八` 会被识别为 `周一` (自动修正)。 `星期八月` 这种写法系统会智能识别。'] },
          { title: '【核心功能】多对多组合', items: ['一行内可包含多个【星期】和多个【时间】，系统会自动组合。', '示例: `李四  周一,周三  10-11, 16-17`', '会自动为李四创建4条记录：周一(10-11)、周一(16-17)、周三(10-11)、周三(16-17)。'] }
        ]}
        renderItem={item => (
          <List.Item>
            <List.Item.Meta
              title={<Typography.Text strong>{item.title}</Typography.Text>}
              description={
                <ul>
                  {item.items.map((desc, i) => <li key={i}><Typography.Text copyable={{ tooltips: ['复制示例', '已复制!'] }}>{desc}</Typography.Text></li>)}
                </ul>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  const DateRangeExamples = () => (
    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      <Typography.Title level={4}>日期范围课表 - 录入格式示例</Typography.Title>
       <List
        bordered
        dataSource={[
          { title: '基本规则', items: ['每个学员占一行，可批量录入。', '【姓名】、【日期】、【时间】三个要素，顺序可任意调换。', '支持中英文逗号、空格作为分隔符。'] },
          { title: '日期格式 (支持范围和多种分隔符)', items: ['单个日期: `8.15`、`8/15`。', '日期范围: `8.15-8.20`、`8.15至20`、`8月15日~8月20日`。', '省略年份，系统会自动使用当前年份。'] },
          { title: '时间格式 (支持范围和智能识别)', items: ['单个钟点: `16` (会被解析为 16:00-17:00)。', '钟点范围: `16-18` (会平铺为 16-17 和 17-18 两条记录)。', '智能识别下午: `2-4` (会被解析为 14:00-16:00)。'] },
          { title: '数字格式', items: ['支持中文大小写数字，如 `八月十五`。'] },
          { title: '【核心功能】多对多组合', items: ['一行内可包含多个【日期】和多个【时间】，系统会自动组合。', '示例: `李四 8.15, 8.20-8.22 10-11, 16-17`', '会自动为李四创建 (1+3) * 2 = 8条记录。'] }
        ]}
        renderItem={item => (
          <List.Item>
            <List.Item.Meta
              title={<Typography.Text strong>{item.title}</Typography.Text>}
              description={
                <ul>
                  {item.items.map((desc, i) => <li key={i}><Typography.Text copyable={{ tooltips: ['复制示例', '已复制!'] }}>{desc}</Typography.Text></li>)}
                </ul>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <Spin size="large" />
      </div>
    );
  }

  const alertTitle = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <span>录入说明</span>
      <Tag color={parser === 'ai' ? 'purple' : 'green'}>{timetable?.isWeekly ? '周固定课表' : '日期范围课表'}</Tag>
    </div>
  );

  const formatParserDescription = (
    <span>
      每个学员占一行，可批量录入。<br />
      <a onClick={() => setExamplesModalVisible(true)} style={{ textDecoration: 'underline' }}>
        查看详细格式与示例
        <ExclamationCircleOutlined style={{ marginLeft: 4 }} />
      </a>
    </span>
  );

  const aiParserDescription = timetable?.isWeekly ? (
    <span>
      AI智能解析：请输入包含<b>学员</b>、<b>星期</b>及<b>时间</b>的自然语言。
    </span>
  ) : (
    <span>
      AI智能解析：请输入包含<b>学员</b>、<b>日期</b>及<b>时间</b>的自然语言。<br />
      日期支持复杂表达，如 "7.11到7.30的单数日" 或 "7月每周一三五"。
    </span>
  );

  const textTabContent = (
    <div style={{ padding: '20px 0' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Typography.Text>解析模式:</Typography.Text>
        <Radio.Group
          onChange={(e) => setParser(e.target.value)}
          value={parser}
          buttonStyle="solid"
        >
          <Radio.Button value="format">格式解析</Radio.Button>
          <Radio.Button value="ai">AI解析</Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', overflow: 'hidden', margin: '24px 0' }}>
        <Alert
          message={alertTitle}
          description={parser === 'ai' ? aiParserDescription : formatParserDescription}
          type="info"
          showIcon
          style={{ border: 'none', borderRadius: 0 }}
        />
        <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '0 1rem' }} />
        <TextArea
          value={textInputValue}
          onChange={(e) => setTextInputValue(e.target.value)}
          placeholder={placeholderText}
          autoSize={{ minRows: 6, maxRows: 12 }}
          bordered={false}
          style={{ resize: 'none', width: '100%', padding: '12px' }}
        />
      </div>

      {/* 提交与返回按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem' }}>
        <Button
          onClick={() => navigate(`/view-timetable/${timetableId}`)}
          style={{ flex: 1, borderColor: '#ff4d4f', color: '#ff4d4f' }}
        >
          返回
        </Button>
        <Button
          type="primary"
          onClick={submitTextInput}
          loading={submitting}
          disabled={submitting}
          style={{ flex: 1, background: 'linear-gradient(to right, #6a11cb 0%, #2575fc 100%)', borderColor: 'transparent' }}
        >
          提交
        </Button>
      </div>
      <Modal
        title="录入格式详细说明"
        open={examplesModalVisible}
        onCancel={() => setExamplesModalVisible(false)}
        footer={<Button onClick={() => setExamplesModalVisible(false)}>关闭</Button>}
        width={700}
      >
        {timetable?.isWeekly ? <WeeklyExamples /> : <DateRangeExamples />}
      </Modal>
    </div>
  );



  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 课表加载状态提示 */}
      {!timetable && (
        <div style={{ textAlign: 'center', padding: '20px', background: '#f0f8ff', borderRadius: '6px', marginBottom: '16px' }}>
          <Typography.Text type="secondary">
            📋 正在加载课表信息...
          </Typography.Text>
        </div>
      )}
      
       {/* 标题部分 */}
       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
        {/* Row 1: Button and Title */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Button
              type="text"
              onClick={() => navigate(`/view-timetable/${timetableId}`)}
              icon={<LeftOutlined style={{ fontSize: 18 }} />}
              style={{
                position: 'absolute',
                left: 0,
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '1px solid #d9d9d9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <Space>
                <CalendarOutlined style={{ fontSize: '22px', color: '#8a2be2' }} />
                <h1 style={{ margin: 0, fontSize: '22px' }}>课表录入</h1>
            </Space>
        </div>

        {/* Row 2: Subtitle */}
        {timetable?.name && (
            <div style={{ marginTop: '8px' }}>
                <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                    {timetable.name}
                </Typography.Text>
            </div>
        )}
      </div>

      {textTabContent}
    </div>
  );
};

export default InputTimetable; 