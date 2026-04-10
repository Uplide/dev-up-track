import { useState } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Row, Col, Space } from 'antd';
import { useTheme } from '../context/ThemeContext';
import { useParams, useNavigate } from 'react-router-dom';
import { createIssue } from '../services/linearClient';
import { Helmet } from 'react-helmet-async';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  tablePlugin,
  imagePlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  ListsToggle,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import './CustomerRequest.css';

const { Title, Text } = Typography;

interface CustomerRequestForm {
  title: string;
  description: string;
  customerName: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_PRIORITY';
}

const priorityOptions = [
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
  { label: 'No Priority', value: 'NO_PRIORITY' },
];

export default function CustomerRequest() {
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useTheme();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onEditorChange = (content: string) => {
    form.setFieldsValue({ description: content });
  };

  const MAX_DIMENSION = 1200;
  const TARGET_QUALITY = 0.7; // ~30% compression target
  const MIN_QUALITY = 0.35;
  const MAX_SINGLE_IMAGE_BYTES = 140 * 1024;
  const LINEAR_DESCRIPTION_LIMIT = 250000;
  const SAFE_DESCRIPTION_LIMIT = 240000;
  const MAX_INLINE_IMAGE_CHARS = 230000;

  const readAsDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(blob);
    });

  const optimizeImageForBase64 = async (file: File): Promise<string> => {
    // Keep SVG as-is
    if (file.type === 'image/svg+xml') {
      return readAsDataUrl(file);
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image file'));
        img.src = objectUrl;
      });

      const largestSide = Math.max(image.width, image.height);
      const scale = largestSide > MAX_DIMENSION ? MAX_DIMENSION / largestSide : 1;
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return readAsDataUrl(file);
      }

      // Keep reducing quality and, if needed, dimensions until it is small enough.
      let workingWidth = targetWidth;
      let workingHeight = targetHeight;
      let quality = TARGET_QUALITY;
      let blob: Blob | null = null;

      while (workingWidth >= 360 && workingHeight >= 360) {
        canvas.width = workingWidth;
        canvas.height = workingHeight;
        ctx.clearRect(0, 0, workingWidth, workingHeight);
        ctx.drawImage(image, 0, 0, workingWidth, workingHeight);

        quality = TARGET_QUALITY;
        while (quality >= MIN_QUALITY) {
          blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
          if (blob && blob.size <= MAX_SINGLE_IMAGE_BYTES) {
            return readAsDataUrl(blob);
          }
          quality -= 0.08;
        }

        workingWidth = Math.round(workingWidth * 0.85);
        workingHeight = Math.round(workingHeight * 0.85);
      }

      if (blob) {
        return readAsDataUrl(blob);
      }

      throw new Error('Image optimization failed');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const getInlineImagePayloadSize = (markdown: string) => {
    const matches = markdown.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g) || [];
    return matches.reduce((sum, item) => sum + item.length, 0);
  };

  // Image upload handler
  const imageUploadHandler = async (image: File): Promise<string> => {
    try {
      return await optimizeImageForBase64(image);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Failed to optimize image';
      message.error(messageText);
      throw error;
    }
  };

  const onFinish = async (values: CustomerRequestForm) => {
    if (!projectId) {
      message.error('Project ID not found');
      return;
    }

    setLoading(true);
    try {
      const title = `[CS] ${values.title}`;
      const description = `**Customer Name:** ${values.customerName}\n\n${values.description}`;
      const inlineImagePayloadSize = getInlineImagePayloadSize(description);

      if (description.length > LINEAR_DESCRIPTION_LIMIT) {
        message.error(`Description exceeds Linear limit (${description.length}/${LINEAR_DESCRIPTION_LIMIT}).`);
        return;
      }

      if (description.length > SAFE_DESCRIPTION_LIMIT) {
        message.error('Description is too large. Please reduce image size/quantity.');
        return;
      }

      if (inlineImagePayloadSize > MAX_INLINE_IMAGE_CHARS) {
        message.error('Total image size is too large. Please use fewer/smaller images.');
        return;
      }

      console.log('Creating issue with:', {
        projectId,
        title,
        description,
        priority: values.priority
      });

      const result = await createIssue({
        projectId,
        title,
        description,
        priority: values.priority,
      });

      console.log('Issue creation result:', result);

      message.success('Request created successfully');
      form.resetFields();
      // Geri dön
      navigate(`/project/${projectId}/issues`);
    } catch (error) {
      console.error('Detailed error:', error);
      if (error instanceof Error) {
        message.error(`Error: ${error.message}`);
      } else {
        message.error('Failed to create request');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Create Customer Request - Up Dev Track</title>
      </Helmet>

      <div style={{
        padding: '24px 20px 40px',
        maxWidth: '920px',
        margin: '0 auto',
        background: isDarkMode ? '#141414' : '#fff'
      }}>
        <div className="customer-request-header">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/project/${projectId}/issues`)}
            type="text"
            style={{
              color: isDarkMode ? '#fff' : undefined,
            }}
          />
          <div>
            <Title level={3} style={{ margin: 0, color: isDarkMode ? '#fff' : undefined }}>
              Create Customer Request
            </Title>
            <Text type="secondary">Capture the request clearly and send it to project issues.</Text>
          </div>
        </div>

        <Card
          className={`customer-request-card ${isDarkMode ? 'dark' : 'light'}`}
          style={{
            background: isDarkMode ? '#1f1f1f' : '#fff',
            borderColor: isDarkMode ? '#303030' : '#e5e7eb'
          }}
        >
          <Form
            className="customer-request-form"
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ priority: 'MEDIUM' }}
          >
            <Form.Item
              name="title"
              label={<Text style={{ color: isDarkMode ? '#fff' : undefined }}>Title</Text>}
              rules={[{ required: true, message: 'Please enter a title' }]}
            >
              <Input
                placeholder="e.g. CSV export should include assignee email"
                style={{
                  background: isDarkMode ? '#141414' : '#fff',
                  borderColor: isDarkMode ? '#303030' : undefined,
                  color: isDarkMode ? '#fff' : undefined
                }}
              />
            </Form.Item>

            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="customerName"
                  label={<Text style={{ color: isDarkMode ? '#fff' : undefined }}>Customer Name</Text>}
                  rules={[{ required: true, message: 'Please enter customer name' }]}
                >
                  <Input
                    placeholder="Customer name"
                    style={{
                      background: isDarkMode ? '#141414' : '#fff',
                      borderColor: isDarkMode ? '#303030' : undefined,
                      color: isDarkMode ? '#fff' : undefined
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="priority"
                  label={<Text style={{ color: isDarkMode ? '#fff' : undefined }}>Priority</Text>}
                  rules={[{ required: true, message: 'Please select a priority level' }]}
                >
                  <Select
                    options={priorityOptions}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label={<Text style={{ color: isDarkMode ? '#fff' : undefined }}>Description</Text>}
              rules={[{ required: true, message: 'Please enter a description' }]}
            >
              <div className={`editor-wrapper ${isDarkMode ? 'dark' : 'light'}`}>
                <MDXEditor
                  onChange={onEditorChange}
                  markdown=""
                  contentEditableClassName={`editor-content ${isDarkMode ? 'dark' : 'light'}`}
                  plugins={[
                    headingsPlugin(),
                    listsPlugin(),
                    quotePlugin(),
                    thematicBreakPlugin(),
                    markdownShortcutPlugin(),
                    tablePlugin(),
                    imagePlugin({
                      imageUploadHandler,
                      imageAutocompleteSuggestions: []
                    }),
                    toolbarPlugin({
                      toolbarContents: () => (
                        <>
                          <UndoRedo />
                          <BoldItalicUnderlineToggles />
                          <BlockTypeSelect />
                          <CreateLink />
                          <InsertImage />
                          <ListsToggle />
                          <InsertTable />
                        </>
                      )
                    })
                  ]}
                />
              </div>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => navigate(`/project/${projectId}/issues`)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                >
                  Submit Request
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
