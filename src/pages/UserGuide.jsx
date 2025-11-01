import React from 'react';
import { Typography, Card, Divider, List, Table, Modal, Tag, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

const { Title, Paragraph, Text } = Typography;

// 仅面向普通用户（非 ADMIN）功能说明
const buildSectionsForNormalUser = () => [
  {
    key: 'nav',
    title: '页面导航与入口',
    items: [
      '顶部头像菜单：个人账号、使用说明、退出登录；',
      '首页页签：教练概览（默认）、我的课表、我的学员；',
      '卡片区统计含：本周课时、今日课时、明日课时、上周课时；',
      '“今日/明日/请假”三标签：快速查看当天/明天课程与请假；',
      '进入课表有两条路径：a) 首页列表点击“查看”；b) 顶部进入“我的课表”；',
    ],
  },
  {
    key: 'quickstart',
    title: '快速上手',
    items: [
      '登录后默认进入主页，先确认今天/明日是否有课与请假；',
      '点击“我的课表”进入课表页，熟悉表头（周一~周日/日期）与时间行；',
      '手机端可左右滑动表格；若右侧边框不完整，轻微横滑即可看到完整边框；',
    ],
  },
  {
    key: 'types',
    title: '课表类型说明',
    items: [
      '周固定课表：以星期展示（周一~周日），用于长期稳定安排；',
      '日期范围课表：以具体日期展示，用于短期或某段时间的安排；',
      '在页面顶部或标题区域，会显示当前视图模式与日期范围提示；',
    ],
  },
  {
    key: 'timetable',
    title: '查看课表',
    items: [
      '点击表头“周几/日期”可打开“当天课程”弹窗：按时间顺序罗列；',
      '在弹窗中可一键复制该日课程文本（含时间与学员），适合发朋友圈/群；',
      '表格单元格中每个学员以彩色标记展示，便于区分与快速定位；',
    ],
  },
  {
    key: 'manage',
    title: '课程编辑（按权限）',
    items: [
      '点击单元格中的学员标签，弹出操作菜单：',
      '  · 修改学员姓名：直接改名保存；',
      '  · 移动课程：选择目标“日期/周几 + 时间段”，原位置清空；',
      '  · 复制课程：选择目标“日期/周几 + 时间段”，原位置保留；',
      '  · 删除课程：仅移除该条课程；',
      '“当天课程”弹窗支持“批量复制该日课程”到另一日期（常用于调班）；',
    ],
  },
  {
    key: 'leave',
    title: '请假相关（如已开通）',
    items: [
      '主页“请假”页签可查看当天请假记录与剩余课程；',
      '部分页面可把某条课程标记为“请假/恢复”，仅对当条记录生效（以权限为准）；',
    ],
  },
  {
    key: 'share',
    title: '复制与分享',
    items: [
      '点击表头进入“当天课程”弹窗，使用“复制到剪贴板”，得到规范文本：',
      '  · 含日期/周几 + 时间 + 学员姓名；',
      '  · 支持追加其他教练课程合并复制（如页面提供该选项时）；',
      '复制后可直接粘贴到微信群/朋友圈/公告文案；',
    ],
  },
  {
    key: 'profile',
    title: '个人账号',
    items: [
      '头像菜单 → 个人账号：可修改昵称与基础资料；',
      '修改密码：输入旧密码、新密码两次确认后保存；',
      '注销账号（软删除）：谨慎操作，提交后账号将被禁用；',
      '支持退出登录；',
    ],
  },
  {
    key: 'mobile',
    title: '移动端技巧',
    items: [
      '表格可左右滑动；若右侧边框不完整，轻微横向滚动即可；',
      '复制文本更适合在手机端分享与转发；',
      'iOS 上已启用平滑滚动与触摸优化；',
    ],
  },
  {
    key: 'faq',
    title: '常见问题与提示',
    items: [
      '看不到某些按钮？说明未开通对应权限，请联系管理员；',
      '复制文本排版异常？先粘贴到记事本再转发，或直接在微信中粘贴；',
      '表格太宽？横向滑动查看；如需更窄显示，可在系统中缩短学员昵称；',
    ],
  },
];

const buildDemoData = () => {
  const timeSlots = [
    '08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00',
    '13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00',
  ];
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const columns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 120, align: 'center' },
    ...days.map((d, di) => ({
      title: d,
      dataIndex: `d${di}`,
      key: `d${di}`,
      align: 'center',
      render: (val, record) => (
        <div style={{ minHeight: 32, padding: 2 }} onClick={() => record.onCellClick(di)}>
          {val}
        </div>
      )
    }))
  ];

  const mock = {
    0: { 0: ['刘家睿'], 1: ['李一帆'], 2: ['孙韩旭'], 3: ['赵可欣'] },
    1: { 0: ['王思远'], 2: ['周梓涵'], 5: ['袁清扬'] },
    2: { 1: ['王昊阳'], 3: ['陈奕名','郑晨曦'] },
    3: { 0: ['林知远'], 4: ['彭奕晨'], 6: ['陆子昂'] },
    4: { 2: ['陈泽源','麦欣逸'], 5: ['沈欣然'] },
    5: { 1: ['张智涵'], 3: ['刘子墨'], 6: ['韩宇轩'] },
    6: { 0: ['李泽楷'], 2: ['梁梓萱'], 5: ['许嘉言'] },
  }; // 20+ 示例

  const data = timeSlots.map((t, ti) => ({
    key: ti,
    time: t,
    onCellClick: () => {},
  }));

  return { timeSlots, days, columns, data, mock };
};

const UserGuide = ({ user }) => {
  const navigate = useNavigate();
  const sections = buildSectionsForNormalUser();
  const demo = buildDemoData();
  const [preview, setPreview] = React.useState({ open: false, dayIndex: 0, timeIndex: 0 });

  const displayColumns = React.useMemo(() => {
    return demo.columns.map((c) => {
      if (c.dataIndex === 'time') return c;
      return {
        ...c,
        render: (val, record) => {
          const di = parseInt(c.key.replace('d',''), 10);
          const students = (demo.mock[di] && demo.mock[di][record.key]) || [];
          return (
            <div
              style={{ minHeight: 32, cursor: students.length ? 'pointer' : 'default' }}
              onClick={() => {
                if (students.length) setPreview({ open: true, dayIndex: di, timeIndex: record.key });
              }}
            >
              {students.map((s, idx) => (<Tag color="blue" key={idx} style={{ margin: 2, lineHeight: '20px' }}>{s}</Tag>))}
            </div>
          );
        }
      };
    });
  }, [demo]);
  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px' }}>
      <Card styles={{ body: { position: 'relative', padding: 0 } }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <Title level={3} style={{ margin: 0 }}>使用说明（普通用户）</Title>
          <Button type="link" onClick={() => navigate(-1)}>返回</Button>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '16px 24px' }}>
          <div style={{ flex: '1 1 260px', minWidth: 240 }}>
            <Paragraph>
              本说明仅面向普通用户（非管理员），涵盖登录后常用页面与操作，帮助你快速完成日常排课、查看与分享。
            </Paragraph>
            <Divider />
          </div>
          <div style={{ flex: '3 1 520px', minWidth: 320 }}>
            {sections.map(section => (
              <div id={section.key} key={section.key} style={{ scrollMarginTop: 80 }}>
                <Title level={4}>{section.title}</Title>
                <List
                  size="small"
                  dataSource={section.items}
                  renderItem={(item) => (
                    <List.Item>
                      <Text>- {item}</Text>
                    </List.Item>
                  )}
                />
                <Divider />
              </div>
            ))}
            <Title level={4} id="demo" style={{ scrollMarginTop: 80 }}>课表演示（示意）</Title>
            <Paragraph>
              下方为一个示例课表（仅演示，不会保存数据）。点击蓝色学员标签，可弹出“课程操作预览”对话框，展示实际系统里的常见操作项。
            </Paragraph>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Table
                size="small"
                bordered
                pagination={false}
                columns={displayColumns}
                dataSource={demo.data}
                scroll={{ x: 'max-content' }}
              />
            </Card>
            <Paragraph>
              操作步骤示例（点击 → 弹窗/动作 → 结果）：
            </Paragraph>
            <List
              size="small"
              dataSource={[
                '顶部“我的课表” → 打开课表页 → 展示周一~周日与时间行；',
                '表头“周三/09-18” → 弹出“当天课程” → 按时间排序显示；',
                '弹窗右上“复制到剪贴板” → 已复制文本 → 可直接粘贴到微信；',
                '单元格学员标签 → 弹出课程操作菜单 → 选择“移动到…” → 选择目标时间 → 成功移动；',
                '单元格学员标签 → 选择“复制到…” → 选择目标时间 → 原位置保留、目标位置新增；',
                '单元格学员标签 → 选择“删除” → 确认 → 该条课程被移除；',
                '“当天课程”弹窗底部“复制整日到其他日期” → 选择日期 → 复制完成；',
              ]}
              renderItem={(i) => (<List.Item>• {i}</List.Item>)}
            />
            <Divider />
            <Modal
              open={preview.open}
              title="课程操作预览（示意）"
              onCancel={() => setPreview({ ...preview, open: false })}
              footer={[
                <Button key="close" type="primary" onClick={() => setPreview({ ...preview, open: false })}>我知道了</Button>
              ]}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>可执行操作（示意）：</Text>
                <List size="small" dataSource={[
                  '修改学员姓名',
                  '移动到其他时间/日期',
                  '复制到其他时间/日期',
                  '删除该课程',
                ]} renderItem={(it)=> (<List.Item>- {it}</List.Item>)} />
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary">提示：实际页面中的操作会直接改变你的真实课表，这里仅作预览说明。</Text>
              </Space>
            </Modal>
            <Paragraph type="secondary">
              如遇到界面与说明不一致，可能是账号权限或版本不同，请联系管理员开通或获取最新指引。
            </Paragraph>
          </div>
        </div>
      </Card>
      
      <Footer />
    </div>
  );
};

export default UserGuide;


