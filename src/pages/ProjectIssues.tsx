import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Table, Typography, Spin, Space, Tag, Modal, Layout, Row, Col, Card, Timeline, Input, Select, Button, message, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getProjectIssues, GET_PROJECT_TEAM, client } from '../services/linearClient';
import { useTheme } from '../context/ThemeContext';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import useDebounce from '../hooks/useDebounce';

const { Title, Text } = Typography;

interface ProjectMilestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
  issues?: {
    nodes: Array<{
      id: string;
      state: {
        type: string;
      };
    }>;
  };
}

interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  estimate?: number;
  cycle?: {
    id: string;
    name: string;
    number: number;
    startsAt: string;
    endsAt: string;
  };
  state: {
    name: string;
    type: string;
    color: string;
  };
  labels?: {
    nodes: Array<{
      name: string;
      color: string;
    }>;
  };
  projectMilestone?: ProjectMilestone;
  createdAt: string;
  updatedAt: string;
}

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
  state: string;
  issues?: {
    nodes: Issue[];
  };
  projectMilestones?: {
    nodes: ProjectMilestone[];
  };
}

const PriorityBars: FC<{ level?: number }> = ({ level }) => {
  // 0: No priority (0 bar), 1: Urgent (4 bar), 2: High (3 bar), 3: Normal (2 bar), 4: Low (1 bar)
  const safeLevel = typeof level === 'number' && level >= 0 && level <= 4 ? level : 0;
  const filledBars = safeLevel === 0 ? 0 : 5 - safeLevel;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            width: 4,
            height: 6 + (i + 1) * 3,
            borderRadius: 2,
            background: i < filledBars ? '#6B7280' : '#e5e7eb',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
};

const ProjectIssues: FC = () => {
  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCycles, setSelectedCycles] = useState<string[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<string>('all');
  const [allLabels, setAllLabels] = useState<Array<{ name: string; color: string }>>([]);
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const debouncedSearchText = useDebounce(searchText, 300);
  const debouncedLabels = useDebounce(selectedLabels, 300);
  const debouncedStates = useDebounce(selectedStates, 300);
  const debouncedCycles = useDebounce(selectedCycles, 300);

  useEffect(() => {
    fetchProjectIssues();
    fetchAllLabels();
  }, [projectId]);

  useEffect(() => {
    fetchProjectIssues();
  }, [debouncedLabels, debouncedStates, debouncedCycles]);

  useEffect(() => {
    if (projectData?.issues?.nodes) {
      projectData.issues.nodes.forEach(issue => {
        console.log('Issue:', issue.identifier, 'Priority:', issue.priority);
      });
    }
  }, [projectData]);

  const fetchProjectIssues = async () => {
    if (!projectId) {
      message.error('Project ID is missing');
      return;
    }

    try {
      setLoading(true);
      const data = await getProjectIssues(projectId, debouncedLabels, debouncedStates);
      console.log('Fetched project data:', data);
      setProjectData(data);
    } catch (error) {
      console.error('Error fetching issues:', error);
      message.error('Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLabels = async () => {
    if (!projectId) return;

    try {
      const { data } = await client.query({
        query: GET_PROJECT_TEAM,
        variables: { projectId },
      });

      console.log('Team Data:', data);
      console.log('All Labels:', data?.project?.teams?.nodes?.[0]?.labels?.nodes);

      if (data?.project?.teams?.nodes?.[0]?.labels?.nodes) {
        setAllLabels(data.project.teams.nodes[0].labels.nodes);
        console.log('Set Labels:', data.project.teams.nodes[0].labels.nodes);
      }
    } catch (error) {
      console.error('Error fetching labels:', error);
    }
  };

  const showIssueDetails = (record: Issue) => {
    setSelectedIssue(record);
    setIsModalVisible(true);
  };

  const priorityMap = {
    0: { text: 'No Priority', color: '#6B7280' },
    1: { text: 'High', color: '#EF4444' },
    2: { text: 'Medium', color: '#F59E0B' },
    3: { text: 'Low', color: '#10B981' },
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateCompletionPercentage = (milestone: ProjectMilestone) => {
    if (!milestone.issues?.nodes?.length) return 0;
    
    const totalIssues = milestone.issues.nodes.length;
    const completedIssues = milestone.issues.nodes.filter(
      issue => issue.state.type === 'completed'
    ).length;
    
    return Math.round((completedIssues / totalIssues) * 100);
  };

  const filteredIssues = projectData?.issues?.nodes
    .filter((issue: Issue) => {
      if (debouncedSearchText && !issue.title.toLowerCase().includes(debouncedSearchText.toLowerCase())) {
        return false;
      }

      if (selectedMilestone !== 'all' && (!issue.projectMilestone || issue.projectMilestone.id !== selectedMilestone)) {
        return false;
      }

      if (debouncedCycles.length > 0 && (!issue.cycle || !debouncedCycles.includes(`Cycle ${issue.cycle.number}`))) {
        return false;
      }

      return true;
    }) || [];

  // Calculate estimate totals
  const calculateEstimates = () => {
    const totalEstimate = filteredIssues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
    const completedEstimate = filteredIssues
      .filter(issue => issue.state.type === 'completed')
      .reduce((sum, issue) => sum + (issue.estimate || 0), 0);
    const remainingEstimate = totalEstimate - completedEstimate;

    return { totalEstimate, completedEstimate, remainingEstimate };
  };

  const { totalEstimate, completedEstimate, remainingEstimate } = calculateEstimates();

  // Get unique cycles for filter - use number and create display name
  const allCycles = Array.from(
    new Set(
      projectData?.issues?.nodes
        .map(issue => {
          if (!issue.cycle) return null;
          return `Cycle ${issue.cycle.number}`;
        })
        .filter(Boolean)
    )
  ).sort();
  
  

  const columns: ColumnsType<Issue> = [
    {
      title: 'ID',
      dataIndex: 'identifier',
      key: 'identifier',
      width: 100,
      sorter: (a: Issue, b: Issue) => a.identifier.localeCompare(b.identifier),
      render: (identifier: string) => (
        <Text type="secondary" style={{ fontFamily: 'monospace' }}>
          {identifier}
        </Text>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a: Issue, b: Issue) => a.title.localeCompare(b.title),
      render: (text: string, record: Issue) => (
        <a onClick={() => showIssueDetails(record)} style={{ color: isDarkMode ? '#1890ff' : '#1677ff' }}>
          {text}
        </a>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      sorter: (a: Issue, b: Issue) => {
        const priorityA = typeof a.priority === 'number' ? a.priority : 0;
        const priorityB = typeof b.priority === 'number' ? b.priority : 0;
        return priorityA - priorityB;
      },
      render: (priority: number | undefined) => {
        const safeLevel = typeof priority === 'number' && priority >= 0 && priority <= 4 ? priority : 0;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PriorityBars level={safeLevel} />
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: ['state', 'name'],
      key: 'status',
      sorter: (a: Issue, b: Issue) => a.state.name.localeCompare(b.state.name),
      render: (text: string, record: Issue) => (
        <Tag color={record.state.color}>{text}</Tag>
      ),
    },
    {
      title: 'Estimate',
      dataIndex: 'estimate',
      key: 'estimate',
      width: 100,
      sorter: (a: Issue, b: Issue) => {
        const estimateA = a.estimate || 0;
        const estimateB = b.estimate || 0;
        return estimateA - estimateB;
      },
      render: (estimate: number | undefined) => (
        <Text type="secondary" style={{ fontFamily: 'monospace' }}>
          {estimate || '-'}
        </Text>
      ),
    },
    {
      title: 'Cycle',
      key: 'cycle',
      sorter: (a: Issue, b: Issue) => {
        const cycleA = a.cycle?.number || 0;
        const cycleB = b.cycle?.number || 0;
        return cycleA - cycleB;
      },
      render: (_, record: Issue) =>
        record.cycle && (
          <Tag
            style={{
              background: 'transparent',
              border: '1px solid #1890ff',
              color: '#1890ff',
              fontWeight: 500,
              borderRadius: 6,
              fontSize: 14,
              padding: '2px 12px'
            }}
          >
            Cycle {record.cycle.number}
          </Tag>
        ),
    },
    {
      title: 'Milestone',
      key: 'milestone',
      sorter: (a: Issue, b: Issue) => {
        const milestoneA = a.projectMilestone?.name || '';
        const milestoneB = b.projectMilestone?.name || '';
        return milestoneA.localeCompare(milestoneB);
      },
      render: (_, record: Issue) =>
        record.projectMilestone && (
          <Tag
            style={{
              background: 'transparent',
              border: '1px solid #d1d5db',
              color: '#6B7280',
              fontWeight: 500,
              borderRadius: 6,
              fontSize: 14,
              padding: '2px 12px'
            }}
          >
            {record.projectMilestone.name}
          </Tag>
        ),
    },
    {
      title: 'Labels',
      dataIndex: 'labels',
      key: 'labels',
      sorter: (a: Issue, b: Issue) => {
        const labelsA = a.labels?.nodes?.map(l => l.name).join(', ') || '';
        const labelsB = b.labels?.nodes?.map(l => l.name).join(', ') || '';
        return labelsA.localeCompare(labelsB);
      },
      render: (labels?: { nodes: Array<{ name: string; color: string }> }) => (
        <Space size={[0, 8]} wrap>
          {labels?.nodes?.map((label, index) => (
            <Tag
              key={index}
              style={{
                margin: '2px',
                padding: '0 8px',
                height: '22px',
                lineHeight: '20px',
                borderRadius: '4px',
                background: 'transparent',
                border: `1px solid ${label.color}`,
                color: label.color,
                fontWeight: 500
              }}
            >
              {label.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: Issue, b: Issue) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (date: string) => formatDateTime(date),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: (a: Issue, b: Issue) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      defaultSortOrder: 'descend',
      render: (date: string) => formatDateTime(date),
    },
  ];

  return (
    <>
      <Helmet>
        <title>{projectData?.name ? `${projectData.name} Issues` : 'Project Issues'} - Up Dev Track</title>
      </Helmet>

      <Layout style={{ minHeight: '100vh', background: isDarkMode ? '#141414' : '#fff' }}>
        <div style={{ padding: '24px' }}>
          <Row gutter={24}>
            <Col span={18}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Title level={2} style={{ margin: 0, color: isDarkMode ? '#fff' : undefined }}>
                    {projectData?.name || 'Project'} Issues
                  </Title>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate(`/project/${projectId}/request`)}
                  >
                    Create Customer Request
                  </Button>
                </div>

                <Space wrap>
                  <Input
                    placeholder="Search issues"
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ width: 200 }}
                  />
                  <Select
                    mode="multiple"
                    placeholder="Filter by state"
                    value={selectedStates}
                    onChange={setSelectedStates}
                    style={{ width: 200 }}
                    options={Array.from(
                      new Set(projectData?.issues?.nodes.map(issue => issue.state.name))
                    ).map(state => ({
                      label: state,
                      value: state
                    }))}
                  />
                  <Select
                    mode="multiple"
                    placeholder="Filter by label"
                    value={selectedLabels}
                    onChange={setSelectedLabels}
                    style={{ width: 200 }}
                    options={allLabels.map(label => ({
                      label: label.name,
                      value: label.name,
                      color: label.color
                    }))}
                    optionLabelProp="label"
                    optionRender={(option) => (
                      <Space>
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: option.data.color,
                            display: 'inline-block',
                            marginRight: 8
                          }}
                        />
                        {option.label}
                      </Space>
                    )}
                    tagRender={(props) => {
                      const { label, value, closable, onClose } = props;
                      const option = allLabels.find(l => l.name === value);
                      return (
                        <Tag
                          color={option?.color}
                          closable={closable}
                          onClose={onClose}
                          style={{ marginRight: 3 }}
                        >
                          {label}
                        </Tag>
                      );
                    }}
                  />
                  <Select
                    mode="multiple"
                    placeholder="Filter by cycle"
                    value={selectedCycles}
                    onChange={setSelectedCycles}
                    style={{ width: 200 }}
                    options={allCycles.map(cycle => ({
                      label: cycle,
                      value: cycle
                    }))}
                  />
                </Space>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <Table
                    columns={columns}
                    dataSource={filteredIssues}
                    rowKey="id"
                    pagination={{
                      pageSize: 50,
                      showSizeChanger: false,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} issues`,
                    }}
                    style={{
                      background: isDarkMode ? '#1f1f1f' : '#fff',
                      borderRadius: '8px',
                    }}
                  />
                )}

                {/* Estimate Totals */}
                <div style={{ 
                  marginTop: 16, 
                  padding: 16, 
                  background: isDarkMode ? '#1f1f1f' : '#f5f5f5',
                  borderRadius: 8,
                  border: `1px solid ${isDarkMode ? '#303030' : '#d9d9d9'}`
                }}>
                  <Space size="large">
                    <div>
                      <Text type="secondary">Total Estimate:</Text>
                      <Text strong style={{ marginLeft: 8, color: isDarkMode ? '#fff' : undefined }}>
                        {totalEstimate}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">Completed:</Text>
                      <Text strong style={{ marginLeft: 8, color: '#52c41a' }}>
                        {completedEstimate}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">Remaining:</Text>
                      <Text strong style={{ marginLeft: 8, color: '#fa8c16' }}>
                        {remainingEstimate}
                      </Text>
                    </div>
                  </Space>
                </div>
              </Space>
            </Col>

            <Col span={6}>
              <Card
                title={
                  <Space>
                    <CalendarOutlined />
                    <span>Project Timeline</span>
                  </Space>
                }
                style={{
                  background: isDarkMode ? '#1f1f1f' : '#fff',
                  position: 'sticky',
                  top: 24,
                }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">Project Duration</Text>
                    <div style={{ marginTop: 8 }}>
                      {projectData?.startDate && (
                        <Tag color="blue">
                          Start: {formatDate(projectData.startDate)}
                        </Tag>
                      )}
                      {projectData?.targetDate && (
                        <Tag color="orange">
                          Target: {formatDate(projectData.targetDate)}
                        </Tag>
                      )}
                    </div>
                  </div>

                  <div>
                    <Text type="secondary">Project Estimates</Text>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Total Estimate: </Text>
                        <Text strong>{totalEstimate}</Text>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Completed: </Text>
                        <Text strong style={{ color: '#52c41a' }}>{completedEstimate}</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Remaining: </Text>
                        <Text strong style={{ color: '#fa8c16' }}>{remainingEstimate}</Text>
                      </div>
                    </div>
                  </div>

                  {projectData?.description && (
                    <div>
                      <Text type="secondary">Description</Text>
                      <div style={{ marginTop: 8 }}>
                        <ReactMarkdown>{projectData.description}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  <div>
                    <Text strong>Milestones</Text>
                    <Timeline style={{ marginTop: 8 }}>
                      <Timeline.Item>
                        <div 
                          onClick={() => setSelectedMilestone('all')}
                          style={{ 
                            cursor: 'pointer',
                            padding: '8px',
                            background: selectedMilestone === 'all'
                              ? (isDarkMode ? '#2a2a2a' : '#f0f0f0') 
                              : 'transparent',
                            borderRadius: '4px',
                            marginBottom: '4px'
                          }}
                        >
                          <Text strong>All Issues</Text>
                        </div>
                      </Timeline.Item>
                      {[...(projectData?.projectMilestones?.nodes || [])]
                        .sort((a, b) => {
                          if (!a.targetDate) return 1;
                          if (!b.targetDate) return -1;
                          return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
                        })
                        .map(milestone => (
                          <Timeline.Item key={milestone.id}>
                            <div 
                              onClick={() => setSelectedMilestone(milestone.id)}
                              style={{ 
                                cursor: 'pointer',
                                padding: '4px 8px',
                                background: 'transparent',
                                border: selectedMilestone === milestone.id ? '2px solid #6B7280' : '1px solid #d1d5db',
                                color: '#6B7280',
                                borderRadius: '4px',
                                marginBottom: '4px',
                                minHeight: 'unset',
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                fontWeight: 500
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Text strong style={{ color: '#6B7280' }}>{milestone.name}</Text>
                                {milestone.targetDate && (
                                  <div style={{ fontSize: '12px', color: '#bdbdbd', marginTop: 2 }}>
                                    Target: {formatDate(milestone.targetDate)}
                                  </div>
                                )}
                                {milestone.description && (
                                  <div style={{ marginTop: 2, fontSize: '13px', color: '#bdbdbd' }}>
                                    {milestone.description}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'center' }}>
                                <Progress 
                                  type="circle" 
                                  percent={calculateCompletionPercentage(milestone)} 
                                  size={[24, 24]}
                                  strokeColor={isDarkMode ? '#1890ff' : '#1677ff'}
                                  format={() => ''}
                                />
                                <Text type="secondary" style={{ fontSize: '14px' }}>
                                  {calculateCompletionPercentage(milestone)}%
                                </Text>
                              </div>
                            </div>
                          </Timeline.Item>
                        ))}
                    </Timeline>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>

        <Modal
          title={selectedIssue?.title}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={800}
        >
          {selectedIssue && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontFamily: 'monospace' }}>
                  {selectedIssue.identifier}
                </Text>
              </div>
              <div>
                <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Status:</Text>
                <Tag color={selectedIssue.state.color} style={{ marginLeft: 8 }}>
                  {selectedIssue.state.name}
                </Tag>
              </div>

              <div>
                <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Priority:</Text>
                <Tag
                  color={priorityMap[selectedIssue.priority as keyof typeof priorityMap]?.color}
                  style={{ marginLeft: 8 }}
                >
                  {priorityMap[selectedIssue.priority as keyof typeof priorityMap]?.text}
                </Tag>
              </div>

              {selectedIssue.estimate && (
                <div>
                  <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Estimate:</Text>
                  <Tag color="purple" style={{ marginLeft: 8 }}>
                    {selectedIssue.estimate}
                  </Tag>
                </div>
              )}

              {selectedIssue.cycle && (
                <div>
                  <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Cycle:</Text>
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    Cycle {selectedIssue.cycle.number}
                  </Tag>
                </div>
              )}

              {selectedIssue.projectMilestone && (
                <div>
                  <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Milestone:</Text>
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {selectedIssue.projectMilestone.name}
                  </Tag>
                  {selectedIssue.projectMilestone.targetDate && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      (Target: {formatDate(selectedIssue.projectMilestone.targetDate)})
                    </Text>
                  )}
                </div>
              )}

              {selectedIssue.labels?.nodes && selectedIssue.labels.nodes.length > 0 && (
                <div>
                  <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Labels:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space size={[0, 8]} wrap>
                      {selectedIssue.labels.nodes.map((label, index) => (
                        <Tag key={index} color={label.color}>
                          {label.name}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              )}

              <div>
                <Text strong style={{ color: isDarkMode ? '#fff' : undefined }}>Description:</Text>
                <div 
                  style={{ 
                    marginTop: 8,
                    padding: 16,
                    background: isDarkMode ? '#141414' : '#f5f5f5',
                    borderRadius: 8,
                    color: isDarkMode ? '#fff' : undefined
                  }}
                >
                  <ReactMarkdown>{selectedIssue.description || 'No description provided.'}</ReactMarkdown>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Created: {formatDateTime(selectedIssue.createdAt)}
                  {selectedIssue.updatedAt !== selectedIssue.createdAt && 
                    ` • Updated: ${formatDateTime(selectedIssue.updatedAt)}`
                  }
                </Text>
              </div>
            </Space>
          )}
        </Modal>
      </Layout>
    </>
  );
};

export default ProjectIssues;
