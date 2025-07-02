import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, message, Tabs, Space, Typography, Alert } from 'antd';
import { AudioOutlined, StopOutlined, ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, addScheduleByVoice, addScheduleByText } from '../services/timetable';

const { TextArea } = Input;
const { Text } = Typography;

const InputTimetable = ({ user, textInputValue, setTextInputValue }) => {
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const navigate = useNavigate();
  const { timetableId } = useParams();

  useEffect(() => {
    fetchTimetable();
    setActiveTab('text'); // 默认选中文字录入
    return () => {
      // 清理定时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [timetableId]);

  const fetchTimetable = async () => {
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
      const response = await addScheduleByVoice(timetableId, audioBlob);
      if (response.success) {
        message.success('语音录入成功！课程已添加到课表中');
        setRecordingTime(0);
        // 可以在这里刷新课表或跳转到查看页面
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
      const response = await addScheduleByText(timetableId, textInputValue.trim());
      if (response.success && response.data && response.data.length > 0) {
        message.success('文本解析成功！请确认排课信息。');
        navigate(`/timetables/${timetableId}/confirm-schedule`, { state: { data: response.data } });
      } else {
        message.error(response.message || '无法从文本中解析出有效的排课信息');
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

  const textTabContent = (
    <div style={{ padding: '20px 0' }}>
      <Alert
        message="录入说明"
        description="请选择录入时间（日期时间或星期时间），然后输入人名。系统会根据日期（星期）和时间将人名填入课表。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <TextArea
        rows={6}
        value={textInputValue}
        onChange={(e) => setTextInputValue(e.target.value)}
      />
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
        <Button
          type="default"
          danger
          onClick={() => navigate('/dashboard')}
          size="large"
          style={{ flex: 1 }}
        >
          返回
        </Button>
        <Button
          type="primary"
          icon={<SendOutlined />}
          className="text-submit-button"
          size="large"
          loading={submitting}
          onClick={submitTextInput}
          disabled={submitting}
          style={{ flex: 1 }}
        >
          提交
        </Button>
      </div>
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

  const tabItems = [
    {
      key: 'voice',
      label: '语音录入',
      children: voiceTabContent,
    },
    {
      key: 'text',
      label: '文字录入',
      children: textTabContent,
    },
  ];

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className="content-container" style={{ maxWidth: '900px' }}>
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center', 
          marginBottom: '24px'
        }}
      >
        <Typography.Title 
          level={4} 
          style={{ margin: 0 }}
        >
          {timetable?.name}
        </Typography.Title>
      </div>
      
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
          <Tabs.TabPane tab="文字录入" key="text">
            {textTabContent}
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span style={{ color: '#ccc' }}>语音录入 <AudioOutlined />（开发中）</span>} key="voice" disabled>
            {voiceTabContent}
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default InputTimetable; 