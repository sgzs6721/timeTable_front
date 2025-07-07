import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, message, Tabs, Space, Typography, Alert, Spin, Radio, Table, Tag, Modal, List } from 'antd';
import { AudioOutlined, StopOutlined, ArrowLeftOutlined, SendOutlined, EditOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, addScheduleByVoice, addScheduleByText, addScheduleByFormat } from '../services/timetable';

const { TextArea } = Input;
const { Text } = Typography;

const InputTimetable = ({ user, textInputValue, setTextInputValue }) => {
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [parser, setParser] = useState('format');
  const [recordingTime, setRecordingTime] = useState(0);
  const [parsedResults, setParsedResults] = useState([]);
  const [examplesModalVisible, setExamplesModalVisible] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  const navigate = useNavigate();
  const { timetableId } = useParams();

  useEffect(() => {
    if (!timetable) {
      fetchTimetable();
    }
    setActiveTab('text'); // 默认选中文字录入
    return () => {
      // 清理定时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [timetableId]);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        setTimetable(response.data);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // 开始计时
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      message.error('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // 处理录音数据
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await submitVoiceInput(audioBlob);
      };
    }
  };

  const submitVoiceInput = async (audioBlob) => {
    setSubmitting(true);
    try {
      const type = timetable.isWeekly ? 'WEEKLY' : 'DATE_RANGE';
      // Voice input should probably always use AI parser, or you can add a switch for it too.
      // For now, it defaults to 'ai' as per existing logic.
      const response = await addScheduleByVoice(timetableId, audioBlob, type);
      if (response.success) {
        message.success('语音录入成功！课程已添加到课表中');
        setRecordingTime(0);
      } else {
        message.error(response.message || '语音处理失败');
      }
    } catch (error) {
      message.error('语音录入失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTextInput = async () => {
    if (!textInputValue.trim()) {
      message.warning('请输入课程安排信息');
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
          <Radio.Button value="ai" disabled>AI解析</Radio.Button>
        </Radio.Group>
      </div>

      <Alert
        message={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>录入说明</span>
            {timetable && (
              <Tag color={timetable.isWeekly ? 'blue' : 'green'}>
                {timetable.isWeekly ? '周固定课表' : '日期范围课表'}
              </Tag>
            )}
          </div>
        }
        description={
          <div>
            每个学员占一行，可批量录入。
            <Button type="link" icon={<QuestionCircleOutlined />} onClick={() => setExamplesModalVisible(true)} style={{ padding: '0 5px' }}>
              查看详细格式与示例
            </Button>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <TextArea
        rows={6}
        value={textInputValue}
        placeholder={placeholderText}
        onChange={(e) => {
          setTextInputValue(e.target.value);
          if (parsedResults.length > 0) {
            setParsedResults([]);
          }
        }}
      />
      {parsedResults.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <Typography.Title level={5}>解析预览</Typography.Title>
          {parsedResults.map((item, index) => (
            <Alert
              key={index}
              style={{ marginBottom: '8px' }}
              type={item.errorMessage ? 'error' : 'success'}
              showIcon
              icon={item.errorMessage ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              message={item.errorMessage ? `第 ${index + 1} 行解析失败` : `第 ${index + 1} 行解析成功`}
              description={
                item.errorMessage 
                ? <div><strong>输入:</strong> {item.studentName}<br/><strong>原因:</strong> {item.errorMessage}</div>
                : <div><strong>学员:</strong> {item.studentName}, <strong>时间:</strong> {item.time}, <strong>{timetable.isWeekly ? '星期' : '日期'}:</strong> {timetable.isWeekly ? item.dayOfWeek : item.date}</div>
              }
            />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
        <Button
          type="default"
          danger
          onClick={() => navigate('/dashboard')}
          size="large"
          style={{ flex: 1, height: '40px' }}
        >
          返回
        </Button>
        <Button
          type="primary"
          className="text-submit-button"
          size="large"
          loading={submitting}
          onClick={submitTextInput}
          disabled={submitting}
          style={{ flex: 1, height: '40px' }}
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

  const voiceTabContent = (
    <div className="voice-input-container">
      <Alert
        message="录入说明"
        description="请选择录入时间（日期时间或星期时间），然后输入人名。系统会根据日期（星期）和时间将人名填入课表。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {isRecording && (
          <Text strong style={{ fontSize: '18px', color: '#ff4d4f' }}>
            录音中... {formatTime(recordingTime)}
          </Text>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <Button
          type={isRecording ? "danger" : "primary"}
          icon={isRecording ? <StopOutlined /> : <AudioOutlined />}
          className="voice-button"
          size="large"
          loading={submitting}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={submitting}
        >
          {isRecording ? '停止录音' : '开始录音'}
        </Button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 16, color: '#666' }}>
        {isRecording ? '点击停止录音按钮完成录入' : '点击麦克风按钮开始语音录入'}
      </div>
    </div>
  );

  const items = [
    { key: 'text', label: '文字录入', children: textTabContent },
    { key: 'voice', label: '语音录入', children: voiceTabContent, disabled: true },
  ];

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Space align="center" size="large">
          <CalendarOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
          <h1 style={{ margin: 0 }}>{timetable?.name}</h1>
        </Space>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Space>
          {/* Maybe some actions here */}
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} centered>
        <Tabs.TabPane tab="文字录入" key="text">
          {textTabContent}
        </Tabs.TabPane>
        <Tabs.TabPane tab="语音录入" key="voice" disabled>
          {voiceTabContent}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default InputTimetable; 