'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import {
  Target, Users, Flag, AlertTriangle, RefreshCw,
  FileText, Layers, Info, CheckSquare, Clock,
  ArrowRight, BookOpen, Zap,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'

// ─── Shared primitives ────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

/** 单个字段说明行：字段名 + 写什么 + 为什么 */
function FieldSpec({
  name,
  what,
  why,
  tag,
}: {
  name: string
  what: string
  why: string
  tag?: string
}) {
  return (
    <div className="grid grid-cols-[160px_1fr_1fr] gap-x-4 gap-y-0 py-3 border-b border-border/40 last:border-0 items-start">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        {tag && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{tag}</Badge>}
      </div>
      <p className="text-sm text-foreground/80">{what}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{why}</p>
    </div>
  )
}

/** 表格列说明行 */
function ColSpec({
  col,
  what,
  why,
}: {
  col: string
  what: string
  why: string
}) {
  return (
    <TableRow>
      <TableCell className="text-sm font-medium font-mono text-xs">{col}</TableCell>
      <TableCell className="text-sm text-foreground/80">{what}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{why}</TableCell>
    </TableRow>
  )
}

/** 说明卡片：带图标的 callout */
function Callout({
  icon: Icon,
  text,
}: {
  icon: React.ElementType
  text: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border/50 px-4 py-3">
      <Icon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  )
}

// ─── Template 1: Mutual Customer Success Plan ─────────────────────────────────

function MutualSuccessPlan() {
  return (
    <div className="space-y-8">

      {/* 文档说明 */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">MCSP</Badge>
            <CardTitle className="text-base">Mutual Customer Success Plan</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            共同成功计划是客户与 ONIT 双方签认的完整操作系统。它回答七个问题：
            我们要去哪里、现在在哪里、什么算成功、谁负责什么、关键节点是什么、风险在哪里、怎么交接。
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Target, label: '使用时机', desc: '客户签约后第一次启动会前，由 ONIT CSM 创建，双方共同确认' },
              { icon: RefreshCw, label: '更新节奏', desc: '每次 cadence 会议（周会 / 月度 QBR）后更新状态字段，不是一次性文档' },
              { icon: Zap, label: 'Agent 用途', desc: 'Agent 照着字段结构填写，输出结构化 JSON，以后打包成 Lumen Skill 自动生成' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: 目标与背景 */}
      <Section
        icon={BookOpen}
        title="1. 目标与背景"
        subtitle="建立双方对「这次合作是什么」的共同认知，防止后续对齐成本"
      >
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-[160px_1fr_1fr] gap-x-4 pb-2 mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">字段</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">写什么</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">为什么写 / 有什么用</span>
            </div>
            <Separator className="mb-3" />
            <FieldSpec
              name="客户名称"
              what="客户公司全称"
              why="文档索引和归档用，Agent 生成时自动填入"
            />
            <FieldSpec
              name="ONIT 负责人"
              what="负责本客户的 CSM 姓名"
              why="明确单一责任人，避免「谁都管谁都不管」"
            />
            <FieldSpec
              name="客户负责人"
              what="客户侧 Champion 的姓名和职位"
              why="Champion 是内部推动者，没有 Champion 的项目成功率极低"
            />
            <FieldSpec
              name="合同开始日期"
              what="合同正式生效日期（YYYY-MM-DD）"
              why="里程碑日期的基准点，所有 M0-M3 日期从这里推算"
            />
            <FieldSpec
              name="计划周期"
              what="本计划覆盖的时间范围，例：2026-Q2（3个月）"
              why="限定范围，防止计划无限延伸；到期触发续约评估"
            />
            <FieldSpec
              name="背景摘要"
              what="2-3 句话：客户为什么来、他们在解决什么问题"
              why="让任何新加入的人（替班 CSM、技术支持）30 秒内理解客户上下文"
            />
          </CardContent>
        </Card>
      </Section>

      {/* Section 2: 现状 → 理想状态 */}
      <Section
        icon={ArrowRight}
        title="2. 现状 → 理想状态"
        subtitle="用对比结构锁定「起点」和「终点」，成功标准从这里推导"
      >
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">现状（As-Is）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Callout
                icon={Info}
                text="写客户现在的痛点或低效环节。要具体，不要写「效率低」，要写「每周人工处理 200 封邮件，平均响应时间 48 小时」。具体的现状才能推导出具体的成功标准。"
              />
              <div className="space-y-2 pt-1">
                {['痛点 1：描述当前具体的低效或缺失环节（可量化最好）',
                  '痛点 2：描述当前具体的低效或缺失环节',
                  '痛点 3：描述当前具体的低效或缺失环节'].map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-xs text-muted-foreground/60 italic">{t}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">理想状态（To-Be）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Callout
                icon={Info}
                text="写 3 个月后客户期望看到的具体状态。和现状一一对应，这样成功标准的指标就自然浮现出来。避免写「更高效」，要写「Agent 每周自动处理 ≥150 封邮件，响应时间 < 5 分钟」。"
              />
              <div className="space-y-2 pt-1">
                {['目标 1：描述 3 个月后的具体可验证状态',
                  '目标 2：描述 3 个月后的具体可验证状态',
                  '目标 3：描述 3 个月后的具体可验证状态'].map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-xs text-muted-foreground/60 italic">{t}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Section 3: 成功标准 */}
      <Section
        icon={Target}
        title="3. 成功标准（Success Criteria）"
        subtitle="把「理想状态」翻译成可量化、可验证的指标——这是验收和续约的唯一依据"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="每一行对应一个可量化指标。「基线值」从现状来，「目标值」从理想状态来，「衡量方式」必须是系统可自动读取的（Supabase / LangSmith / 问卷），不能依赖人工统计。「验收时间」绑定里程碑节点。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">列名</TableHead>
                  <TableHead className="text-xs">写什么</TableHead>
                  <TableHead className="text-xs">为什么写 / 有什么用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="指标" what="一句话描述要衡量的事情" why="指标名决定了后续所有讨论的焦点，命名要让双方都能理解" />
                <ColSpec col="基线值" what="当前的实际数值（从现状推导）" why="没有基线就无法判断是否进步；基线也是客户内部汇报的起点" />
                <ColSpec col="目标值" what="3 个月后期望达到的数值" why="目标值是双方签认的承诺，也是续约谈判的依据" />
                <ColSpec col="衡量方式" what="用什么系统、什么查询方式来验证" why="必须可自动化，避免「我觉得达到了」的主观争议" />
                <ColSpec col="验收时间" what="绑定到哪个里程碑节点（M1/M2/M3）" why="防止所有指标都堆到最后才验收，早期预警靠这个" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 4: RACI */}
      <Section
        icon={Users}
        title="4. 角色与职责（RACI）"
        subtitle="明确每个人对这个项目负什么责——防止「我以为你在管」"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="每个角色必须有唯一的真实姓名，不能只写职位。「职责范围」写这个人在本项目里具体做什么，不是他在公司里的 JD。联系方式填 Slack handle 或邮箱，确保任何人都能在 30 秒内找到对方。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">角色</TableHead>
                  <TableHead className="text-xs">写什么</TableHead>
                  <TableHead className="text-xs">为什么这个角色必须存在</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="ONIT CSM" what="负责本客户的客户成功经理姓名" why="整体进度跟踪、周会主持、风险上报的单一责任人" />
                <ColSpec col="ONIT 技术负责人" what="负责 Agent 配置和集成的工程师姓名" why="技术问题的唯一出口，防止客户找不到人答疑" />
                <ColSpec col="客户 Champion" what="客户内部推动这个项目的人（姓名+职位）" why="没有 Champion 的项目成功率极低；Champion 负责内部资源协调和验收签字" />
                <ColSpec col="客户技术对接人" what="负责 API 权限和系统对接的工程师（姓名+职位）" why="API 权限审批、系统集成测试的直接执行者，缺这个人会卡死 M0" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 5: 里程碑 */}
      <Section
        icon={Flag}
        title="5. 里程碑（Milestones）"
        subtitle="把整个实施周期切成 4 个可验收的节点——每个节点有明确的交付物和 Owner"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="里程碑不是「完成了某件事」，而是「双方都认可某个状态已达到」。每个里程碑必须有具体的交付物（可以被看见、被签字确认的东西），而不是模糊的「进展顺利」。日期在启动会上双方共同确认后填入。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[60px]">阶段</TableHead>
                  <TableHead className="text-xs">里程碑名称</TableHead>
                  <TableHead className="text-xs">交付物（写什么）</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">状态字段</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['M0', '启动会 & 环境准备', '写：哪些系统已就绪、哪些密钥已交接——可以截图或清单形式', 'ONIT 技术', '待开始 / 进行中 / 已完成'],
                  ['M1', '首个 Agent 上线', '写：哪个 Agent 在哪个生产场景处理了多少真实任务', 'ONIT CSM', '待开始 / 进行中 / 已完成'],
                  ['M2', '团队扩展 & 自动化', '写：几个 Agent 协作、人工干预率降到多少——引用 LangSmith 数据', '双方', '待开始 / 进行中 / 已完成'],
                  ['M3', '验收 & 续约评估', '写：NPS 分数、ROI 数字、续约/扩容/结束的决策结论', 'ONIT CSM', '待开始 / 进行中 / 已完成'],
                ].map(([phase, name, deliverable, owner, status]) => (
                  <TableRow key={phase}>
                    <TableCell><Badge variant="outline" className="text-xs font-mono">{phase}</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{deliverable}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{owner}</TableCell>
                    <TableCell className="text-xs text-muted-foreground/60 italic">{status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 6: 风险登记 */}
      <Section
        icon={AlertTriangle}
        title="6. 风险登记（Risk Register）"
        subtitle="提前写下可能让项目卡死的事——写出来才能提前缓解，不写就等着它发生"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="风险不是「可能出问题」的泛泛而谈，而是「如果 X 发生，会导致 Y 里程碑延迟 Z 天」。每个风险必须有缓解措施和 Owner，没有 Owner 的风险等于没有人管。概率和影响用高/中/低即可，不需要精确数字。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">列名</TableHead>
                  <TableHead className="text-xs">写什么</TableHead>
                  <TableHead className="text-xs">为什么写 / 有什么用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="风险描述" what="具体描述「如果 X 发生」的场景" why="越具体越容易识别和缓解，「技术问题」不是风险，「客户 IT 部门 API 审批超过 2 周」才是" />
                <ColSpec col="概率" what="高 / 中 / 低" why="帮助 CSM 决定投入多少精力在这个风险上" />
                <ColSpec col="影响" what="高 / 中 / 低（对里程碑的影响程度）" why="高影响的风险即使概率低也要有缓解措施" />
                <ColSpec col="缓解措施" what="提前做什么来降低这个风险发生的概率或影响" why="缓解措施必须是可执行的动作，不是「保持关注」" />
                <ColSpec col="Owner" what="谁负责监控和执行缓解措施" why="没有 Owner 的风险等于没有人管" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 7: 交接 & Cadence */}
      <Section
        icon={RefreshCw}
        title="7. 交接 & 节奏（Handoff & Cadence）"
        subtitle="定义这份文档怎么活着——什么时候更新、什么情况下视为完成"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review Cadence（写什么）</p>
                <div className="space-y-2">
                  {[
                    { name: '周会', what: '每周固定时间，15-30 分钟，更新任务状态和卡点', why: '防止问题积压到月度才发现' },
                    { name: '月度 QBR', what: '每月回顾成功标准指标，调整计划', why: 'QBR = Quarterly Business Review，是续约决策的信息来源' },
                    { name: '里程碑验收', what: '每个 M 节点，交付物确认 + 双方签字', why: '签字是法律意义上的「双方认可」，防止后续扯皮' },
                  ].map(({ name, what, why }) => (
                    <div key={name} className="rounded-lg border border-border/40 p-3 space-y-1">
                      <span className="text-xs font-medium">{name}</span>
                      <p className="text-xs text-muted-foreground">{what}</p>
                      <p className="text-[11px] text-muted-foreground/60 italic">{why}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">交接标准（什么情况下视为完成）</p>
                <Callout
                  icon={CheckSquare}
                  text="交接标准是这份计划的「完成定义」。写清楚：哪些里程碑必须完成、哪些指标必须达到、谁签字、哪些数据必须归档。这是续约谈判的起点，也是 CSM 交接给下一任的依据。"
                />
                <div className="space-y-1.5 pt-1">
                  {[
                    '所有 M0-M3 里程碑状态为「已完成」',
                    '成功标准中所有指标达到目标值（或双方书面同意调整）',
                    '客户 Champion 签字确认验收报告',
                    '续约 / 扩容 / 结束决策已明确并记录',
                    'LangSmith 运行数据已归档（链接写入本文档）',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckSquare className="w-3 h-3 mt-0.5 text-muted-foreground/40 shrink-0" />
                      <p className="text-xs text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Source note */}
      <Callout
        icon={BookOpen}
        text="本文档结构参考 GitLab Customer Success Plan 规范（dynamic, mutually agreed roadmap，按 cadence review）和 MAP（Mutual Action Plan）体系（双方 owner、target date、status、dependencies）。命名「Mutual Customer Success Plan」强调双向承诺，区别于单方面的项目计划。"
      />
    </div>
  )
}

// ─── Template 2: Onboarding Milestone Tracker ────────────────────────────────

function MilestoneTracker() {
  return (
    <div className="space-y-8">

      {/* 文档说明 */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">OMT</Badge>
            <CardTitle className="text-base">Onboarding Milestone Tracker</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            实施进度表是用户每天看的施工进度牌。它是共同成功计划的「每日视图」，聚焦四个问题：
            现在到哪了、还有多久、卡在哪里、下一步谁做什么。
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Clock, label: '更新频率', desc: '每次 cadence 会议前更新，或有卡点变化时随时更新。不需要等周会才改' },
              { icon: Users, label: '主要读者', desc: '客户侧日常跟进的人（不一定是 Champion），他们需要知道「今天该做什么」' },
              { icon: Zap, label: 'Agent 用途', desc: 'Agent 读取 MCSP 里程碑结构自动生成初始进度表，并在每次任务完成后自动更新勾选状态' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: 总览数字 */}
      <Section
        icon={Target}
        title="1. 总览数字（Summary Cards）"
        subtitle="4 个数字卡，让人 5 秒内看懂整体进度"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="这 4 个数字是从下面的阶段数据自动计算出来的，不需要手动填。Agent 更新任务勾选状态后，这里自动刷新。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">卡片名</TableHead>
                  <TableHead className="text-xs">显示什么</TableHead>
                  <TableHead className="text-xs">怎么计算 / 为什么有用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="总里程碑" what="M0 到 M3 共 4 个节点" why="让读者知道整个旅程有几步，不会觉得没有尽头" />
                <ColSpec col="已完成" what="状态为「已完成」的里程碑数量 + 完成百分比" why="进度感知的核心数字，客户内部汇报用这个" />
                <ColSpec col="进行中" what="当前处于「进行中」状态的里程碑名称" why="让读者立刻知道「现在在哪个阶段」" />
                <ColSpec col="距离 M3" what="从今天到 M3 目标日期的剩余天数" why="时间压力可视化，防止「还早呢」的拖延心理" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 2: 阶段进度 */}
      <Section
        icon={Layers}
        title="2. 实施阶段进度（Phase Progress）"
        subtitle="每个里程碑展开成具体任务清单——进度条 = 已完成任务数 / 总任务数"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="每个阶段（M0-M3）下面列出具体的可执行任务。任务粒度要小到「一个人一天内能完成」，不能是「完成集成」这种模糊任务。每个任务有 Owner，Owner 完成后勾选，进度条自动更新。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">字段</TableHead>
                  <TableHead className="text-xs">写什么</TableHead>
                  <TableHead className="text-xs">为什么写 / 有什么用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="阶段标签（M0-M3）" what="对应 MCSP 里程碑的阶段编号" why="和 MCSP 一一对应，确保两份文档讲的是同一件事" />
                <ColSpec col="里程碑名称" what="从 MCSP 里程碑表复制过来" why="保持一致，不要在这里重新命名" />
                <ColSpec col="目标日期" what="这个阶段的截止日期（YYYY-MM-DD）" why="可视化时间压力，接近截止日期时自动高亮提醒" />
                <ColSpec col="状态 Badge" what="待开始 / 进行中 / 已完成 / 已延期" why="「已延期」是一个独立状态，不能用「进行中」掩盖延期事实" />
                <ColSpec col="进度条" what="已完成任务数 / 总任务数 × 100" why="比百分比数字更直观，一眼看出还差多少" />
                <ColSpec col="任务行" what="具体可执行的任务 + Owner + 勾选框" why="任务必须小到一个人一天内能完成；Owner 必须是真实姓名" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 3: 卡点表 */}
      <Section
        icon={AlertTriangle}
        title="3. 当前卡点 & 下一步行动（Blockers）"
        subtitle="卡点是让进度停下来的事——写出来才能被解决，不写就一直卡着"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="卡点表是这份文档最重要的部分之一。「暂无卡点」是一个有效状态，但要主动确认，不是因为没人填就默认没有卡点。每个卡点必须有下一步行动和 Owner，没有行动的卡点等于放弃解决。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">列名</TableHead>
                  <TableHead className="text-xs">写什么</TableHead>
                  <TableHead className="text-xs">为什么写 / 有什么用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="卡点描述" what="具体描述是什么卡住了，不是「技术问题」，是「客户 IT 部门还没给 API 读权限」" why="越具体越容易找到解决路径" />
                <ColSpec col="影响阶段" what="这个卡点会影响哪个里程碑（M0/M1/M2/M3）" why="帮助 CSM 判断优先级，影响 M0 的卡点比影响 M3 的更紧急" />
                <ColSpec col="下一步行动" what="谁在什么时间做什么具体的事来解除这个卡点" why="没有具体行动的卡点等于没有人在解决它" />
                <ColSpec col="Owner" what="负责推进解除这个卡点的人（真实姓名）" why="单一责任人，防止「我以为你在跟进」" />
                <ColSpec col="截止日期" what="这个卡点必须在什么时间前解除" why="没有截止日期的卡点会无限拖延" />
                <ColSpec col="状态" what="处理中 / 已解除 / 已升级" why="「已升级」表示已经上报给更高层级，不是被遗忘了" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Section 4: 更新日志 */}
      <Section
        icon={FileText}
        title="4. 更新日志（Update Log）"
        subtitle="每次 cadence 会议后追加一行——这是项目历史的唯一真相来源"
      >
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout
              icon={Info}
              text="更新日志是追加式的，只加不改。每行格式：日期 + 更新内容摘要 + 更新人。不需要写长篇大论，一句话说清楚「今天发生了什么、状态变了什么」就够了。这是 CSM 交接时最有价值的历史记录。"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">字段</TableHead>
                  <TableHead className="text-xs">写什么</TableHead>
                  <TableHead className="text-xs">为什么写 / 有什么用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ColSpec col="日期" what="YYYY-MM-DD 格式" why="精确日期，方便回溯「那个问题是什么时候出现的」" />
                <ColSpec col="更新内容" what="一句话：做了什么、状态变了什么、决策了什么" why="不需要写会议纪要，只需要让下一个人看了知道发生了什么" />
                <ColSpec col="更新人" what="谁写的这条记录" why="有责任归属，也方便后续追问细节" />
              </TableBody>
            </Table>
            <div className="rounded-lg border border-dashed border-border/60 p-3">
              <p className="text-xs text-muted-foreground/60 italic text-center">
                日志示例：2026-05-20 · M0 启动会完成，API 密钥已交接，沙箱环境就绪，M1 目标日期确认为 2026-06-03 — ONIT CSM
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* MCSP 关系说明 */}
      <Card className="border-border/40 bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Layers className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-medium">与共同成功计划（MCSP）的关系</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                MCSP 是完整操作系统（目标、标准、角色、风险），OMT 是它的每日执行视图（现在到哪了、谁做什么）。
                两份文档配套使用：MCSP 在启动会上签认一次，之后按 cadence 更新；OMT 每天都可以看，有变化就更新。
                如果两份文档出现矛盾，以 MCSP 为准。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source note */}
      <Callout
        icon={BookOpen}
        text="本进度表结构参考 MAP（Mutual Action Plan）体系中的 Implementation Roadmap 规范，强调 progress bar、phase gates、milestone 可见性和 time-to-value。命名「Onboarding Milestone Tracker」聚焦实施阶段，区别于长期运营的 Success Plan。"
      />
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function LumenClient() {
  const posthog = usePostHog()
  useEffect(() => {
    posthog?.capture('page_view', { page: 'lumen' })
  }, [posthog])

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 pt-24 pb-16 w-full">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">Lumen</Badge>
          <Badge variant="secondary" className="text-xs">模板说明</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">客户成功模板</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          ONIT Lumen 的两份标准交付文档。每个字段说明写什么、为什么写、有什么用——
          让所有人看了都知道我们产出什么、怎么工作。Agent 照着填，以后打包成 Skill。
        </p>
      </div>

      <Tabs defaultValue="mcsp">
        <TabsList className="mb-6">
          <TabsTrigger value="mcsp" className="gap-2">
            <Target className="w-3.5 h-3.5" />
            共同成功计划
          </TabsTrigger>
          <TabsTrigger value="tracker" className="gap-2">
            <Layers className="w-3.5 h-3.5" />
            实施进度表
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mcsp">
          <MutualSuccessPlan />
        </TabsContent>
        <TabsContent value="tracker">
          <MilestoneTracker />
        </TabsContent>
      </Tabs>
    </main>
  )
}
