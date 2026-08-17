import { useState } from "react";
import { 
  Card as AntCard, 
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
  Eye, 
  CornerDownRight,
  Smartphone,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  Plus,
  Filter,
  RefreshCw,
  Search,
  Grid as GridIcon,
  Sliders,
  Send,
  Zap
} from "lucide-react";

import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { ButtonGroup, ActionToolbar, ActionGrid } from "../components/common/ButtonLayout";
import { GridContainer, StatCard, BentoGrid } from "../components/common/GridContainer";
import { UIverseButton } from "../components/common/UIverseButton";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function DesignSystemPage() {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("cards");
  const [loading, setLoading] = useState(false);
  const [activeSegment, setActiveSegment] = useState("all");

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

  const renderStatusTag = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <Tag color="success" className="font-semibold flex items-center gap-1 w-fit m-0">
            <CheckCircle2 size={12} /> Approved
          </Tag>
        );
      case "rejected":
        return (
          <Tag color="error" className="font-semibold flex items-center gap-1 w-fit m-0">
            <XCircle size={12} /> Rejected
          </Tag>
        );
      case "pending":
      default:
        return (
          <Tag color="warning" className="font-semibold flex items-center gap-1 w-fit m-0">
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
              size="xs" 
              variant="ghost" 
              iconLeft={<Eye size={14} className="text-gray-500" />}
              onClick={() => message.info(`Viewing details for ${record.claimId}`)}
            />
          </Tooltip>
          {record.status === "pending" && (
            <>
              <Button 
                size="xs" 
                variant="outline"
                className="hover:!bg-emerald-50 !text-emerald-700 !border-emerald-300"
                onClick={() => message.success(`Approved ${record.claimId}`)}
              >
                Approve
              </Button>
              <Button 
                size="xs" 
                variant="danger"
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
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-900/50 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Component System v2.0
            </span>
          </div>
          <Title level={3} style={{ margin: 0, color: "#ffffff" }} className="flex items-center gap-2">
            <Layers className="text-indigo-400" size={24} /> Cyrix UI Component Architecture
          </Title>
          <Paragraph className="!text-slate-300 !m-0 text-xs md:text-sm mt-1">
            Modern, ultra-responsive Card UI components, Button layouts, Button groups, Action Toolbars & Responsive Grid Systems.
          </Paragraph>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="glow" size="sm" iconLeft={<Sparkles size={14} />}>
            Explore Components
          </Button>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs"
        items={[
          {
            key: "cards",
            label: "🃏 Modern Card UI",
            children: (
              <div className="space-y-6 pt-2">
                <Alert
                  message="Card UI Showcase"
                  description="Flexible, beautiful Cards featuring glassmorphism, subtle gradients, metric badges, headers, and footer action bars."
                  type="info"
                  showIcon
                />

                <div>
                  <Title level={5} className="mb-4">Card Variants Showcase</Title>
                  <GridContainer cols={3} gap="md">
                    {/* Default Card */}
                    <Card 
                      title="Standard Action Card" 
                      subtitle="Default subtle card with crisp borders"
                      icon={<ShieldCheck size={18} />}
                      badge={<Tag color="blue">Active</Tag>}
                      footer={<span className="font-semibold text-indigo-600 flex items-center gap-1 cursor-pointer">View Policy <ArrowUpRight size={14} /></span>}
                    >
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Standard card for dashboard widgets, summary items, and detail views. Clean spacing and typography.
                      </p>
                    </Card>

                    {/* Gradient Card */}
                    <Card 
                      variant="gradient"
                      title="Gradient Highlight Card" 
                      subtitle="Premium gradient accent card"
                      icon={<Zap size={18} />}
                      badge={<Tag color="purple">Featured</Tag>}
                      footer={<span className="font-medium text-slate-500">Updated 5m ago</span>}
                    >
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Subtle background gradient for highlight metrics, priority warnings, or standout operational alerts.
                      </p>
                    </Card>

                    {/* Glass Card */}
                    <Card 
                      variant="glass"
                      title="Glassmorphism Card" 
                      subtitle="Frosted glass backdrop effect"
                      icon={<Sparkles size={18} />}
                      badge={<Tag color="cyan">Glass UI</Tag>}
                      footer={<span className="font-semibold text-slate-800">Translucent backdrop</span>}
                    >
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Modern glassmorphic panel with blurred background backdrop filters and subtle inner shadows.
                      </p>
                    </Card>

                    {/* Metric Card */}
                    <Card 
                      variant="metric"
                      title="Metric Summary Card" 
                      subtitle="Real-time analytical stats"
                      icon={<TrendingUp size={18} />}
                    >
                      <div className="space-y-2">
                        <div className="text-2xl font-extrabold text-slate-900">₹1,48,920</div>
                        <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 size={14} /> +18.4% vs last month
                        </div>
                      </div>
                    </Card>

                    {/* Bordered Card */}
                    <Card 
                      variant="bordered"
                      title="Interactive Bordered Card" 
                      subtitle="Hover border transition"
                      interactive
                    >
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Hover over this card to observe the subtle scale, border accent, and shadow transition effects.
                      </p>
                    </Card>

                    {/* Flat Card */}
                    <Card 
                      variant="flat"
                      title="Flat Container Card" 
                      subtitle="Low-contrast flat container"
                    >
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Clean flat background for nesting secondary information, input fields, or secondary lists.
                      </p>
                    </Card>
                  </GridContainer>
                </div>
              </div>
            )
          },
          {
            key: "buttons",
            label: "🔘 Buttons & Button Layouts",
            children: (
              <div className="space-y-6 pt-2">
                <Alert
                  message="Button Variants & Layout Orchestration"
                  description="Interactive buttons with glow, gradient, shimmer effects, plus Action Toolbars, Segmented Controls, and Button Groups."
                  type="success"
                  showIcon
                />

                {/* Button Variants */}
                <div>
                  <Title level={5} className="mb-3">Button Variants & Sizes</Title>
                  <div className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="danger">Danger</Button>
                      <Button variant="gradient">Gradient</Button>
                      <Button variant="glow">Glow Effect</Button>
                      <Button variant="glass">Glass</Button>
                      <Button variant="primary" shimmer iconLeft={<Send size={14} />}>
                        Shimmer Button
                      </Button>
                    </div>

                    <Divider style={{ margin: "12px 0" }} />

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Sizes:</span>
                      <Button size="xs" variant="primary">Extra Small (xs)</Button>
                      <Button size="sm" variant="primary">Small (sm)</Button>
                      <Button size="md" variant="primary">Medium (md)</Button>
                      <Button size="lg" variant="primary">Large (lg)</Button>
                      <Button size="xl" variant="primary">Extra Large (xl)</Button>
                    </div>
                  </div>
                </div>

                {/* Button Layouts & Groups */}
                <div>
                  <Title level={5} className="mb-3">Button Groups & Toolbars</Title>
                  <div className="space-y-4">
                    {/* Action Toolbar */}
                    <div>
                      <Text type="secondary" className="text-xs block mb-2 font-medium">1. Action Toolbar (Header Control Row)</Text>
                      <ActionToolbar 
                        title={<span className="flex items-center gap-2 text-indigo-900"><Filter size={16} /> Claims Control Toolbar</span>}
                        leftActions={
                          <>
                            <Button size="sm" variant="outline" iconLeft={<Search size={14} />}>Search</Button>
                            <Button size="sm" variant="secondary" iconLeft={<RefreshCw size={14} />}>Sync</Button>
                          </>
                        }
                        rightActions={
                          <Button size="sm" variant="gradient" iconLeft={<Plus size={14} />}>New Claim</Button>
                        }
                      />
                    </div>

                    {/* Segmented Control */}
                    <div>
                      <Text type="secondary" className="text-xs block mb-2 font-medium">2. Segmented Button Group (Filter Control)</Text>
                      <ButtonGroup variant="segmented">
                        {["all", "pending", "approved", "rejected"].map((seg) => (
                          <button
                            key={seg}
                            onClick={() => setActiveSegment(seg)}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                              activeSegment === seg
                                ? "bg-white text-indigo-600 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {seg} Claims
                          </button>
                        ))}
                      </ButtonGroup>
                    </div>

                    {/* Attached Button Group */}
                    <div>
                      <Text type="secondary" className="text-xs block mb-2 font-medium">3. Attached Button Group</Text>
                      <ButtonGroup variant="attached">
                        <Button variant="outline" size="sm">Left Action</Button>
                        <Button variant="outline" size="sm">Middle Action</Button>
                        <Button variant="outline" size="sm">Right Action</Button>
                      </ButtonGroup>
                    </div>

                    {/* Quick Action Grid */}
                    <div>
                      <Text type="secondary" className="text-xs block mb-2 font-medium">4. Quick Action Button Grid (Mobile & Dashboard)</Text>
                      <ActionGrid columns={4}>
                        <Button variant="glass" size="md" iconLeft={<Plus size={16} />} fullWidth>Submit Claim</Button>
                        <Button variant="glass" size="md" iconLeft={<FileSpreadsheet size={16} />} fullWidth>Export Data</Button>
                        <Button variant="glass" size="md" iconLeft={<CheckCircle2 size={16} />} fullWidth>Approve Batch</Button>
                        <Button variant="glass" size="md" iconLeft={<Sliders size={16} />} fullWidth>Settings</Button>
                      </ActionGrid>
                    </div>
                  </div>
                </div>
              </div>
            )
          },
          {
            key: "grids",
            label: "🔲 Responsive Grids & Bento",
            children: (
              <div className="space-y-6 pt-2">
                <Alert
                  message="Grid Layout System"
                  description="Responsive Grid Containers, Stat Metrics Grids, and asymmetric Bento Box layouts for maximum analytical clarity."
                  type="info"
                  showIcon
                  icon={<GridIcon className="text-indigo-600" size={18} />}
                />

                {/* Stat Grid */}
                <div>
                  <Title level={5} className="mb-3">Stat Metric Grid (4-Col Grid)</Title>
                  <GridContainer cols={4} gap="md">
                    <StatCard 
                      title="Total Claims"
                      value="1,492"
                      change="+12.5%"
                      changeType="increase"
                      icon={<DollarSign size={20} />}
                      badge="July 2026"
                      accentColor="indigo"
                    />
                    <StatCard 
                      title="Pending Approval"
                      value="34"
                      change="-5.2%"
                      changeType="decrease"
                      icon={<Clock size={20} />}
                      badge="Needs Action"
                      accentColor="amber"
                    />
                    <StatCard 
                      title="Approved Amount"
                      value="₹12.4L"
                      change="+24.1%"
                      changeType="increase"
                      icon={<CheckCircle2 size={20} />}
                      badge="98.2% Pass"
                      accentColor="emerald"
                    />
                    <StatCard 
                      title="Active Field Staff"
                      value="184"
                      change="Stable"
                      changeType="neutral"
                      icon={<Users size={20} />}
                      badge="12 Zones"
                      accentColor="purple"
                    />
                  </GridContainer>
                </div>

                {/* Bento Grid */}
                <div>
                  <Title level={5} className="mb-3">Bento Box Grid Layout</Title>
                  <BentoGrid>
                    <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Zap size={18} className="text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Feature Highlight</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-white">Automated Claim Validation Engine</h3>
                        <p className="text-xs text-indigo-200 leading-relaxed max-w-lg">
                          Real-time OCR receipt scanning, location distance checks, policy compliance deductions, and auto-flagging of suspicious duplicate entries.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-indigo-800/80 flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1"><ShieldCheck size={14} /> Active Protection</span>
                        <Button size="xs" variant="glow">View Rules</Button>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Quick Stat</span>
                        <div className="text-3xl font-extrabold text-indigo-600">4.8m</div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Average approval turnaround time</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <TrendingUp size={14} /> 32% faster than target
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">System Health</span>
                        <div className="text-3xl font-extrabold text-slate-900">99.9%</div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Worker backend uptime</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-500">
                        <Activity size={14} className="text-indigo-600" /> Cloudflare Edge Workers
                      </div>
                    </div>
                  </BentoGrid>
                </div>
              </div>
            )
          },
          {
            key: "uiverse",
            label: "⚡ UIverse Interactive Elements",
            children: (
              <div className="space-y-6 pt-2">
                <Alert
                  message="UIverse.io Interactive Elements & Custom Controls"
                  description="Explore glowing 3D buttons, neon badges, dual-ring orbit loaders, and Color Hunt harmonized color tokens."
                  type="success"
                  showIcon
                  icon={<Sparkles className="text-emerald-600" size={18} />}
                />

                <div>
                  <Title level={5} className="mb-3">UIverse Interactive Buttons</Title>
                  <div className="flex flex-wrap items-center gap-4 p-6 bg-slate-900 rounded-2xl shadow-xl">
                    <UIverseButton variant="glow" iconLeft={<Sparkles size={16} />}>
                      Glow Action
                    </UIverseButton>
                    <UIverseButton variant="cyber">
                      Cyber Shimmer
                    </UIverseButton>
                    <UIverseButton variant="glass">
                      Glassmorphism
                    </UIverseButton>
                    <UIverseButton variant="gradient">
                      Gradient Pill
                    </UIverseButton>
                    <UIverseButton variant="neon">
                      Neon Cyber
                    </UIverseButton>
                  </div>
                </div>
              </div>
            )
          },
          {
            key: "palette",
            label: "🎨 Palette & Typography",
            children: (
              <div className="space-y-6 pt-2">
                <Alert
                  message="Global Styles & Palette System"
                  description="Design Tokens mapped to Cyrix brand colors combined with compact typography and status indicators."
                  type="info"
                  showIcon
                />
                
                <div>
                  <Title level={5} className="mb-3">Brand & Status Colors</Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={12} sm={8} md={6}>
                      <AntCard size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200 shadow-xs">
                        <div className="h-12 w-full rounded-md mb-2 bg-[#2563EB]"></div>
                        <Text strong className="block text-gray-900">Primary Accent</Text>
                        <Text type="secondary" className="text-xs">#2563EB (Royal Blue)</Text>
                      </AntCard>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                      <AntCard size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200 shadow-xs">
                        <div className="h-12 w-full rounded-md mb-2 bg-[#16A34A]"></div>
                        <Text strong className="block text-gray-900">Approved (Success)</Text>
                        <Text type="secondary" className="text-xs">#16A34A (Green-600)</Text>
                      </AntCard>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                      <AntCard size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200 shadow-xs">
                        <div className="h-12 w-full rounded-md mb-2 bg-[#D97706]"></div>
                        <Text strong className="block text-gray-900">Pending (Warning)</Text>
                        <Text type="secondary" className="text-xs">#D97706 (Amber-600)</Text>
                      </AntCard>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                      <AntCard size="small" bodyStyle={{ padding: "12px" }} className="text-center border border-gray-200 shadow-xs">
                        <div className="h-12 w-full rounded-md mb-2 bg-[#DC2626]"></div>
                        <Text strong className="block text-gray-900">Rejected (Error)</Text>
                        <Text type="secondary" className="text-xs">#DC2626 (Red-600)</Text>
                      </AntCard>
                    </Col>
                  </Row>
                </div>

                <Divider style={{ margin: "16px 0" }} />

                <div>
                  <Title level={5} className="mb-3">Typography System</Title>
                  <AntCard size="small" className="space-y-4 border border-gray-200 bg-slate-50/50 shadow-xs">
                    <div>
                      <Title level={2} style={{ margin: 0, color: "#0B0F19" }}>Heading 2 (28px/34px)</Title>
                      <Text type="secondary" className="text-xs">Page titles and primary section headers</Text>
                    </div>
                    <div>
                      <Title level={4} style={{ margin: 0, color: "#0B0F19" }}>Heading 4 (18px/28px)</Title>
                      <Text type="secondary" className="text-xs">Section headers or modal titles</Text>
                    </div>
                    <div>
                      <Title level={5} style={{ margin: 0, color: "#0B0F19" }}>Heading 5 (16px/24px)</Title>
                      <Text type="secondary" className="text-xs">Card titles and table section tags</Text>
                    </div>
                    <div>
                      <Text className="block text-sm font-semibold text-gray-900">Body Medium - 14px/20px Semibold</Text>
                      <Text className="block text-sm text-gray-700">Body Regular - 14px/20px Normal</Text>
                      <Text type="secondary" style={{ fontSize: "12px" }}>Caption Text - 12px/16px Regular</Text>
                    </div>
                  </AntCard>
                </div>
              </div>
            )
          },
          {
            key: "form",
            label: "📋 Form & Controls",
            children: (
              <div className="space-y-4 pt-2">
                <Paragraph type="secondary" style={{ fontSize: "12px" }}>
                  A compact, structured form setup matching the <strong>Submit Expense Form</strong> screen requirements.
                </Paragraph>

                <AntCard className="border border-gray-200 bg-gray-50/30 max-w-2xl mx-auto" size="small">
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
                      <Button variant="secondary" size="sm" onClick={() => form.resetFields()}>Reset</Button>
                      <Button variant="primary" size="sm" htmlType="submit" isLoading={loading}>
                        Submit Claim
                      </Button>
                    </div>
                  </Form>
                </AntCard>
              </div>
            )
          },
          {
            key: "approval",
            label: "📊 Table Listing",
            children: (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <Paragraph type="secondary" style={{ fontSize: "12px", margin: 0 }}>
                      High-density tabular listing optimized for desktop displays.
                    </Paragraph>
                  </div>
                  <Button variant="primary" size="sm" iconLeft={<FileSpreadsheet size={14} />}>
                    Export List
                  </Button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
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
            key: "mobile",
            label: "📱 Mobile Card View",
            children: (
              <div className="space-y-4 pt-2">
                <Paragraph type="secondary" style={{ fontSize: "12px" }}>
                  Demonstrates how tabular data seamlessly transitions into <strong>Card-Based Listings</strong> on mobile devices.
                </Paragraph>

                <div className="max-w-md mx-auto bg-slate-100/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <Text strong className="text-xs text-slate-500 uppercase tracking-wider">Active Claims (3)</Text>
                    <Smartphone size={16} className="text-slate-400" />
                  </div>

                  {claimsData.map((item) => (
                    <Card key={item.key} variant="default" padding="sm" interactive className="shadow-xs hover:border-indigo-300">
                      <div className="flex justify-between items-start">
                        <div>
                          <Text strong className="font-mono text-xs text-indigo-600 block">{item.claimId}</Text>
                          <Text className="font-semibold text-slate-900 text-sm">{item.employee}</Text>
                          <Text type="secondary" className="block text-[11px] mt-0.5">{item.category} • {item.date}</Text>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Text className="font-bold text-slate-900 text-sm">₹{item.amount.toLocaleString("en-IN")}</Text>
                          {renderStatusTag(item.status)}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <Text type="secondary" style={{ fontSize: "10px" }} className="uppercase font-bold">{item.zone}</Text>
                        <Button size="xs" variant="ghost" className="!text-indigo-600 p-0 hover:bg-transparent" iconRight={<CornerDownRight size={12} />}>
                          Details
                        </Button>
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
