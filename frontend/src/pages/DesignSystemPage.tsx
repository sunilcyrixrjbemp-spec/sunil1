import { useState } from "react";
import { 
  Card, 
  Button, 
  Table, 
  Form, 
  Input, 
  InputNumber,
  Select, 
  DatePicker, 
  Tag, 
  Typography, 
  Row, 
  Col, 
  Space, 
  Divider, 
  Tabs, 
  Badge, 
  Tooltip,
  Alert,
  message
} from "antd";
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileSpreadsheet, 
  Layers, 
  Download, 
  Eye, 
  CornerDownRight,
  Smartphone
} from "lucide-react";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function DesignSystemPage() {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("palette");
  const [loading, setLoading] = useState(false);

  // Mock data for table/list views
  const claimsData = [
    {
      key: "1",
      claimId: "CLM-9920",
      employee: "Sunil Vishnoi",
      empCode: "CY-1002",
      date: "2026-07-18",
      category: "Food & Allowance",
      amount: 1500,
      status: "pending",
      zone: "Bikaner",
    },
    {
      key: "2",
      claimId: "CLM-9844",
      employee: "Amit Sharma",
      empCode: "CY-1045",
      date: "2026-07-15",
      category: "Travel (Fuel)",
      amount: 4200,
      status: "approved",
      zone: "Jaipur",
    },
    {
      key: "3",
      claimId: "CLM-9712",
      employee: "Pooja Patel",
      empCode: "CY-1089",
      date: "2026-07-10",
      category: "Hotel Stay",
      amount: 6800,
      status: "rejected",
      zone: "Jodhpur",
    }
  ];

  const handleFormSubmit = (values: any) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success("Expense form submitted successfully (Design System Mock)!");
      console.log("Submitted values:", values);
      form.resetFields();
    }, 1000);
  };

  // Status tag renderer helper
  const renderStatusTag = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <Tag color="success" className="font-semibold flex items-center gap-1 w-fit">
            <CheckCircle2 size={12} /> Approved
          </Tag>
        );
      case "rejected":
        return (
          <Tag color="error" className="font-semibold flex items-center gap-1 w-fit">
            <XCircle size={12} /> Rejected
          </Tag>
        );
      case "pending":
      default:
        return (
          <Tag color="warning" className="font-semibold flex items-center gap-1 w-fit">
            <Clock size={12} /> Pending
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: "Claim ID",
      dataIndex: "claimId",
      key: "claimId",
      render: (text: string) => <Text className="font-mono font-bold text-indigo-600">{text}</Text>,
    },
    {
      title: "Employee",
      dataIndex: "employee",
      key: "employee",
      render: (text: string, record: any) => (
        <div>
          <Text className="font-semibold block">{text}</Text>
          <Text type="secondary" style={{ fontSize: "11px" }}>{record.empCode} • {record.zone}</Text>
        </div>
      ),
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right" as const,
      render: (val: number) => <Text className="font-bold text-gray-800">₹{val.toLocaleString("en-IN")}</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => renderStatusTag(status),
    },
    {
      title: "Actions",
      key: "actions",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Space size={8}>
          <Tooltip title="View Details">
            <Button 
              size="small" 
              type="text" 
              icon={<Eye size={14} className="text-gray-500" />}
              onClick={() => message.info(`Viewing details for ${record.claimId}`)}
            />
          </Tooltip>
          {record.status === "pending" && (
            <>
              <Button 
                size="small" 
                type="primary" 
                ghost
                className="hover:!bg-green-50"
                style={{ borderColor: "#16A34A", color: "#16A34A" }}
                onClick={() => message.success(`Approved ${record.claimId}`)}
              >
                Approve
              </Button>
              <Button 
                size="small" 
                danger 
                ghost
                onClick={() => message.error(`Rejected ${record.claimId}`)}
              >
                Reject
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Title level={4} style={{ margin: 0, color: "#1F2937" }} className="flex items-center gap-2">
            <Layers className="text-indigo-600" size={22} /> Cyrix Field Ops Design System
          </Title>
          <Paragraph type="secondary" style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
            A comprehensive, interactive style guide demonstrating visual and functional consistency using Ant Design (v5).
          </Paragraph>
        </div>
        <div className="flex items-center gap-2">
          <Badge status="processing" text="Active Theme" />
          <Divider type="vertical" />
          <Text type="secondary" className="font-mono text-xs">v1.0.0-compact</Text>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs"
        items={[
          {
            key: "palette",
            label: "Theme & Palette",
            children: (
              <div className="space-y-6 pt-2">
                <Alert
                  message="Global Styles Inherited"
                  description="Ant Design relies on Design Tokens. Below are the primary brand tokens mapped to Cyrix colors, combined with the Compact Algorithm for high-density mobile and desktop screens."
                  type="info"
                  showIcon
                />
                
                <div>
                  <Title level={5} className="mb-3">Brand & Status Colors</Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={12} sm={8} md={6}>
                      <Card size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200">
                        <div className="h-12 w-full rounded mb-2 bg-[#4F46E5]"></div>
                        <Text strong className="block">Primary Color</Text>
                        <Text type="secondary" className="text-xs">#4F46E5 (Cyrix Blue)</Text>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                      <Card size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200">
                        <div className="h-12 w-full rounded mb-2 bg-[#16A34A]"></div>
                        <Text strong className="block">Success (Approved)</Text>
                        <Text type="secondary" className="text-xs">#16A34A (Green-600)</Text>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                      <Card size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200">
                        <div className="h-12 w-full rounded mb-2 bg-[#D97706]"></div>
                        <Text strong className="block">Warning (Pending)</Text>
                        <Text type="secondary" className="text-xs">#D97706 (Amber-600)</Text>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                      <Card size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200">
                        <div className="h-12 w-full rounded mb-2 bg-[#DC2626]"></div>
                        <Text strong className="block">Error (Rejected)</Text>
                        <Text type="secondary" className="text-xs">#DC2626 (Red-600)</Text>
                      </Card>
                    </Col>
                  </Row>
                </div>

                <Divider style={{ margin: "16px 0" }} />

                <div>
                  <Title level={5} className="mb-3">Typography System</Title>
                  <Card size="small" className="space-y-4 border border-gray-200 bg-gray-50/50">
                    <div>
                      <Title level={2} style={{ margin: 0 }}>Heading 2 (Title - 24px)</Title>
                      <Text type="secondary" className="text-xs">Main page headings</Text>
                    </div>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>Heading 4 (Section - 16px)</Title>
                      <Text type="secondary" className="text-xs">Sub-sections or modal titles</Text>
                    </div>
                    <div>
                      <Title level={5} style={{ margin: 0 }}>Heading 5 (Group - 14px)</Title>
                      <Text type="secondary" className="text-xs">Card titles and table section tags</Text>
                    </div>
                    <div>
                      <Text className="block text-sm font-semibold">Body Large / Bold - 13px Semibold</Text>
                      <Text className="block text-sm">Body Regular - 13px Normal (Primary UI descriptions and user text)</Text>
                      <Text type="secondary" style={{ fontSize: "11px" }}>Caption Text - 11px Regular (Timestamps, minor subtitles, employee codes)</Text>
                    </div>
                  </Card>
                </div>
              </div>
            )
          },
          {
            key: "form",
            label: "Submit Expense Form",
            children: (
              <div className="space-y-4 pt-2">
                <Paragraph type="secondary" style={{ fontSize: "12px" }}>
                  A compact, structured form setup matching the <strong>Submit Expense Form</strong> screen requirements. Standardized input dimensions, label placement, and inline validations.
                </Paragraph>

                <Card className="border border-gray-200 bg-gray-50/30 max-w-2xl mx-auto" size="small">
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    initialValues={{ category: "travel", paymentMode: "personal" }}
                  >
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="category"
                          label={<span className="font-semibold text-xs text-gray-700">Expense Category</span>}
                          rules={[{ required: true, message: "Please select a category" }]}
                        >
                          <Select placeholder="Select category">
                            <Option value="travel">Travel & Fuel</Option>
                            <Option value="food">Food & Daily Allowance</Option>
                            <Option value="hotel">Hotel Accommodation</Option>
                            <Option value="materials">Site Supplies</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="amount"
                          label={<span className="font-semibold text-xs text-gray-700">Amount (₹)</span>}
                          rules={[{ required: true, message: "Enter a valid amount" }]}
                        >
                          <InputNumber
                            prefix="₹"
                            placeholder="Enter amount"
                            className="w-full"
                            min={1}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="expenseDate"
                          label={<span className="font-semibold text-xs text-gray-700">Expense Date</span>}
                          rules={[{ required: true, message: "Please select date" }]}
                        >
                          <DatePicker className="w-full" format="YYYY-MM-DD" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="paymentMode"
                          label={<span className="font-semibold text-xs text-gray-700">Payment Mode</span>}
                        >
                          <Select>
                            <Option value="personal">Paid out of pocket (Personal)</Option>
                            <Option value="company">Company Corporate Card</Option>
                            <Option value="advance">Adjust against Cash Advance</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      name="description"
                      label={<span className="font-semibold text-xs text-gray-700">Description / Business Purpose</span>}
                      rules={[{ required: true, message: "Enter description" }]}
                    >
                      <TextArea rows={2} placeholder="E.g., Fuel expense for Bikaner site inspection visit..." />
                    </Form.Item>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button onClick={() => form.resetFields()}>Reset</Button>
                      <Button type="primary" htmlType="submit" loading={loading} className="bg-indigo-600 hover:bg-indigo-700">
                        Submit Claim
                      </Button>
                    </div>
                  </Form>
                </Card>
              </div>
            )
          },
          {
            key: "approval",
            label: "Approval Center (Table)",
            children: (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <Paragraph type="secondary" style={{ fontSize: "12px", margin: 0 }}>
                      High-density tabular listing optimized for desktop displays in the <strong>Approval Center</strong>. Displays metadata compactly to maximize visibility of key data.
                    </Paragraph>
                  </div>
                  <Button type="primary" size="small" icon={<FileSpreadsheet size={14} />} className="bg-indigo-600">
                    Export List
                  </Button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <Table 
                    dataSource={claimsData} 
                    columns={columns} 
                    pagination={false}
                    size="small"
                  />
                </div>
              </div>
            )
          },
          {
            key: "details",
            label: "Claim Details (Card)",
            children: (
              <div className="space-y-4 pt-2">
                <Paragraph type="secondary" style={{ fontSize: "12px" }}>
                  A card-based summary layout representation of the <strong>Claim Details Review</strong> screen. Clean organization of tags, structured grids, and actions.
                </Paragraph>

                <Card 
                  title={
                    <div className="flex justify-between items-center w-full">
                      <Space size={8}>
                        <Text strong className="font-mono text-indigo-600">CLM-9920</Text>
                        <Text type="secondary">• Site Visit Fuel Allowance</Text>
                      </Space>
                      {renderStatusTag("pending")}
                    </div>
                  }
                  className="max-w-3xl mx-auto border border-gray-200"
                  size="small"
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <div className="space-y-2">
                        <div>
                          <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Submitted By</Text>
                          <Text className="font-semibold text-gray-800">Sunil Vishnoi (CY-1002)</Text>
                        </div>
                        <div>
                          <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Date of Expense</Text>
                          <Text className="font-medium">July 18, 2026</Text>
                        </div>
                        <div>
                          <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Site Zone</Text>
                          <Text className="font-medium">Bikaner Zone</Text>
                        </div>
                      </div>
                    </Col>
                    
                    <Col xs={24} sm={12}>
                      <div className="space-y-2">
                        <div>
                          <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Amount Claimed</Text>
                          <Text className="text-lg font-bold text-indigo-600">₹1,500.00</Text>
                        </div>
                        <div>
                          <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Category</Text>
                          <Text className="font-medium">Food & Allowance</Text>
                        </div>
                        <div>
                          <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Attachments</Text>
                          <div className="flex items-center gap-2 mt-1">
                            <Tag color="blue" className="cursor-pointer font-medium hover:border-indigo-400">
                              <Download size={10} className="inline mr-1" /> fuel_receipt.png
                            </Tag>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "12px 0" }} />

                  <div className="space-y-2">
                    <Text type="secondary" className="block text-[11px] uppercase font-bold tracking-wider">Business Purpose Details</Text>
                    <Text className="text-gray-700 bg-gray-50 p-2 rounded block border border-gray-100" style={{ fontSize: "12px" }}>
                      Fuel refill at BPCL petrol pump during visit to site BIK-39 for setup inspection and vendor meeting.
                    </Text>
                  </div>

                  <Divider style={{ margin: "12px 0" }} />

                  <div className="space-y-3">
                    <Text strong style={{ fontSize: "12px" }}>Reviewer Decision Comments</Text>
                    <TextArea rows={2} placeholder="Add approval remarks or reason for rejection here..." />
                    <div className="flex justify-end gap-2">
                      <Button size="small" type="primary" ghost style={{ borderColor: "#16A34A", color: "#16A34A" }} onClick={() => message.success("Claim Approved")}>
                        Approve Claim
                      </Button>
                      <Button size="small" danger ghost onClick={() => message.error("Claim Rejected")}>
                        Reject Claim
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )
          },
          {
            key: "mobile",
            label: "Mobile View (Cards List)",
            children: (
              <div className="space-y-4 pt-2">
                <Paragraph type="secondary" style={{ fontSize: "12px" }}>
                  Demonstrates how the tabular list seamlessly transitions into space-saving <strong>Card-Based Listings</strong> on mobile/tablet viewports to maintain UI readability.
                </Paragraph>

                <div className="max-w-md mx-auto bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <Text strong className="text-xs text-gray-500 uppercase tracking-wider">Active Claims (3)</Text>
                    <Smartphone size={16} className="text-gray-400" />
                  </div>

                  {claimsData.map((item) => (
                    <Card key={item.key} size="small" className="shadow-xs hover:border-indigo-300 transition-colors border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <Text strong className="font-mono text-xs text-indigo-600 block">{item.claimId}</Text>
                          <Text className="font-semibold text-gray-800 text-sm">{item.employee}</Text>
                          <Text type="secondary" className="block text-[11px] mt-0.5">{item.category} • {item.date}</Text>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Text className="font-bold text-gray-800 text-sm">₹{item.amount.toLocaleString("en-IN")}</Text>
                          {renderStatusTag(item.status)}
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-between items-center">
                        <Text type="secondary" style={{ fontSize: "10px" }} className="uppercase font-bold">{item.zone}</Text>
                        <Space size={8}>
                          <Button size="small" type="text" className="text-[11px] p-0 flex items-center gap-1 font-semibold text-indigo-600">
                            Details <CornerDownRight size={12} />
                          </Button>
                        </Space>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
