'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import {
  Target, Users, CheckCircle2, AlertTriangle, GitBranch,
  Calendar, Clock, ArrowRight, Flag, Layers, FileText, Info
} from 'lucide-react'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children }: {
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
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Field row ────────────────────────────────────────────────────────────────
function FieldRow({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground pt-0.5 font-medium">{label}</span>
      <span className="text-sm text-muted-foreground/55 italic">{placeholder}</span>
    </div>
  )
}

// ─── Callout ─────────────────────────────────────────────────────────────────
function Callout({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border/50 px-4 py-3">
      <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  )
}

// ─── Mutual Customer Success Plan ────────────────────────────────────────────
function MutualSuccessPlan() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">MCSP</Badge>
          <Badge variant="secondary" className="text-xs">模板</Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Mutual Customer Success Plan</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          这是我们双方共同签认的完整操作系统——不是 ONIT 单方面的服务承诺，而是我们一起追同一个目标的行动地图。
          它回答七个问题：我们要去哪里、现在在哪里、什么算成功、谁负责什么、关键节点是什么、风险在哪里、怎么交接。
          按 cadence 动态更新，而非一次性文档。
        </p>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: '使用时机', desc: '签约后第一次启动会前，由你创建，我们双方共同确认' },
            { label: '更新节奏', desc: '每次周会或月度 QBR 后更新状态，不是填一次就完了' },
            { label: 'Agent 用途', desc: 'Agent 照着字段结构填写，输出结构化数据，以后打包成 Lumen Skill 自动生成' },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-lg border border-border/50 p-3 space-y-1">
              <span className="text-xs font-medium">{label}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Block 1: 目标与背景 */}
      <Section icon={Target} title="1. 目标与背景" subtitle="建立我们双方对「这次合作是什么」的共同认知，防止后续对齐成本">
        <Card>
          <CardContent className="pt-4 space-y-0">
            <FieldRow label="你们的名字" placeholder="写下你们的名字，或你们的团队/组织名——这份计划从这里开始属于我们所有人" />
            <FieldRow label="你的名字（ONIT）" placeholder="填上你的名字。你是这段旅程的向导，遇到任何问题都应该能第一时间找到你" />
            <FieldRow label="你们的负责人" placeholder="填上你们这边推动这个项目的人的名字。没有这个人，我们很难走到终点" />
            <FieldRow label="合同开始日期" placeholder="YYYY-MM-DD，所有里程碑日期从这里推算" />
            <FieldRow label="计划周期" placeholder="例：2026-Q2（3个月）。到期触发我们的续约评估" />
            <FieldRow label="背景摘要" placeholder="用 2-3 句话写下我们为什么走到一起、我们在解决什么问题。让 Agent 或任何新加入的人拿起这份文档都能在 30 秒内理解我们在做什么" />
          </CardContent>
        </Card>
      </Section>

      {/* Block 2: 现状 vs 理想状态 */}
      <Section icon={ArrowRight} title="2. 现状 → 理想状态" subtitle="用对比结构锁定「起点」和「终点」，成功标准从这里推导">
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">现状（As-Is）</CardTitle>
              <CardDescription className="text-xs">
                描述我们现在的处境。越具体越好——「每周处理 200 封邮件，平均响应 48 小时」比「效率低」更有力量，因为它让改变变得可量化
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {['痛点 1：描述当前具体的低效或缺失环节（可量化最好）',
                '痛点 2：描述当前具体的低效或缺失环节',
                '痛点 3：描述当前具体的低效或缺失环节'].map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-muted-foreground/50 italic">{t}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">理想状态（To-Be）</CardTitle>
              <CardDescription className="text-xs">
                3 个月后，我们希望能庆祝什么？把它写得像一个真实的时刻——Agent 自动处理了多少、我们一起节省了多少时间
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {['目标 1：描述 3 个月后的具体可验证状态',
                '目标 2：描述 3 个月后的具体可验证状态',
                '目标 3：描述 3 个月后的具体可验证状态'].map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-muted-foreground/50 italic">{t}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Block 3: 成功标准 */}
      <Section icon={CheckCircle2} title="3. 成功标准（Success Criteria）" subtitle="把「理想状态」翻译成可量化、可验证的指标——这是我们验收和续约的唯一依据">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text="把理想状态翻译成可量化指标。「基线值」从现状来，「目标值」从理想状态来。衡量方式必须是系统可自动读取的——我们不想靠「我觉得达到了」来判断成功。「验收时间」绑定里程碑节点，防止所有指标都堆到最后才验收。" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] text-xs">指标</TableHead>
                  <TableHead className="text-xs">基线值</TableHead>
                  <TableHead className="text-xs">目标值</TableHead>
                  <TableHead className="text-xs">衡量方式</TableHead>
                  <TableHead className="text-xs">验收时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['我们要衡量什么', '我们现在的实际数值', '3个月后我们希望达到', 'Supabase / LangSmith / 问卷', 'M1 / M2 / M3'],
                ].map(([metric, base, target, method, date], i) => (
                  <TableRow key={i} className="opacity-40">
                    <TableCell className="text-sm italic text-muted-foreground">{metric}</TableCell>
                    <TableCell className="text-sm text-muted-foreground italic">{base}</TableCell>
                    <TableCell className="text-sm italic text-muted-foreground">{target}</TableCell>
                    <TableCell className="text-sm text-muted-foreground italic">{method}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-mono opacity-60">{date}</Badge></TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-dashed">
                  <TableCell className="text-sm text-muted-foreground/40 italic" colSpan={5}>[+ 添加我们共同认可的指标]</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 4: 角色与职责 */}
      <Section icon={Users} title="4. 角色与职责（RACI）" subtitle="明确我们每个人对这个项目负什么责——防止「我以为你在管」">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text="每个角色必须有唯一的真实姓名，不能只写职位。「职责范围」写这个人在本项目里具体做什么。联系方式填 Slack handle 或邮箱，确保你或 Agent 都能在 30 秒内找到对方。" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">角色</TableHead>
                  <TableHead className="text-xs">姓名</TableHead>
                  <TableHead className="text-xs">在这个项目里负责什么</TableHead>
                  <TableHead className="text-xs">联系方式</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['你（ONIT CSM）', '[你的名字]', '整体进度跟踪、周会主持、风险上报——你是单一责任人', '—'],
                  ['ONIT 技术负责人', '[姓名]', 'Agent 配置、集成调试——技术问题的唯一出口', '—'],
                  ['你们的负责人', '[姓名 / 联系方式]', '你们这边推动这个项目、协调资源、最终验收签字', '—'],
                  ['你们的技术对接人', '[姓名 / 联系方式]', 'API 权限、系统对接——缺这个人会卡死 M0', '—'],
                ].map(([role, name, scope, contact], i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground italic">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{scope}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 5: 里程碑 */}
      <Section icon={Flag} title="5. 里程碑（Milestones）" subtitle="把整个实施周期切成 4 个可验收的节点——每个节点有明确的交付物和 Owner">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text="里程碑不是「完成了某件事」，而是「我们双方都认可某个状态已达到」。每个里程碑必须有具体的交付物——可以被看见、被签字确认的东西，而不是模糊的「进展顺利」。日期在启动会上我们共同确认后填入。" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] text-xs">阶段</TableHead>
                  <TableHead className="text-xs">里程碑名称</TableHead>
                  <TableHead className="text-xs">交付物（我们能拿出来给对方看的东西）</TableHead>
                  <TableHead className="text-xs">目标日期</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['M0', '启动会 & 环境准备', '哪些系统已就绪、哪些密钥已交接——可以是截图或清单', 'YYYY-MM-DD', '你（ONIT 技术）', '待开始'],
                  ['M1', '首个 Agent 上线', '哪个 Agent 在哪个真实场景处理了多少任务', 'YYYY-MM-DD', '你（ONIT CSM）', '待开始'],
                  ['M2', '团队扩展 & 自动化', '几个 Agent 在协作、我们一起把人工干预率降到了多少', 'YYYY-MM-DD', '我们双方', '待开始'],
                  ['M3', '验收 & 续约评估', '我们共同做出的续约/扩容/结束决策，附 NPS 和 ROI 数字', 'YYYY-MM-DD', '你（ONIT CSM）', '待开始'],
                ].map(([phase, name, deliverable, date, owner, status], i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{phase}</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{deliverable}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{owner}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 6: 风险登记 */}
      <Section icon={AlertTriangle} title="6. 风险登记（Risk Register）" subtitle="提前写下可能让我们卡住的事——写出来才能提前缓解，不写就等着它发生">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text="风险不是泛泛的「可能出问题」，而是「如果 X 发生，会导致哪个里程碑延迟」。每个风险必须有缓解措施和 Owner，没有 Owner 的风险等于没有人在管。概率和影响用高/中/低即可。" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">风险描述</TableHead>
                  <TableHead className="text-xs">概率</TableHead>
                  <TableHead className="text-xs">影响</TableHead>
                  <TableHead className="text-xs">我们提前做什么</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['API 权限审批延迟超过 2 周', '中', '高', '提前 2 周发送权限申请清单，你们的技术对接人确认时间线', '你们的技术对接人'],
                  ['Agent 输出质量不达预期', '低', '高', 'LangSmith 全链路追踪 + 每周 Agent 抽查，有问题我们立刻调整', 'ONIT 技术'],
                  ['你们的负责人换人', '低', '中', '确保我们有 ≥2 名联系人，文档随时可以交接', '你（ONIT CSM）'],
                ].map(([risk, prob, impact, mitigation, owner], i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{risk}</TableCell>
                    <TableCell><Badge variant={prob === '高' ? 'destructive' : 'secondary'} className="text-xs">{prob}</Badge></TableCell>
                    <TableCell><Badge variant={impact === '高' ? 'destructive' : 'secondary'} className="text-xs">{impact}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mitigation}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{owner}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-dashed">
                  <TableCell className="text-sm text-muted-foreground/40 italic" colSpan={5}>[+ 写下我们预见到的其他风险]</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 7: 交接与 Cadence */}
      <Section icon={GitBranch} title="7. 交接 & 节奏（Handoff & Cadence）" subtitle="定义这份文档怎么活着——什么时候更新、什么情况下视为完成">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">我们的同步节奏</CardTitle>
              <CardDescription className="text-xs">定期见面是我们保持对齐的方式，不是形式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ['周会', '每周固定时间', '你或 Agent 更新进度和卡点，15-30 分钟', '30 min'],
                ['月度 QBR', '每月一次', '我们一起回顾成功标准指标，调整计划', '60 min'],
                ['里程碑验收', '每个 M 节点', '交付物确认，我们双方签字', '按需'],
              ].map(([name, time, agenda, duration], i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">{time} · {agenda}</div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{duration}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">什么时候我们视为完成</CardTitle>
              <CardDescription className="text-xs">这是续约谈判的起点，也是这份计划的终点</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                '所有 M0-M3 里程碑状态为「已完成」',
                '成功标准中所有指标达到目标值，或我们双方书面同意调整',
                '你们的负责人签字确认验收报告',
                '续约/扩容/结束决策已明确并记录',
                'Agent 运行数据已归档，链接写入本文档',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Footer note */}
      <div className="rounded-lg bg-muted/50 border border-border/50 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">关于本模板：</span>
          结构参考 GitLab Customer Success Plan 规范（dynamic, mutually agreed roadmap，按 cadence review）和 MAP（Mutual Action Plan）体系。
          「Mutual」的意思是：我们和你们是同一个团队，在追同一个目标。
          Agent 填写时替换所有 <span className="font-mono bg-background px-1 rounded">[占位符]</span>，并在每次 cadence 会议后更新状态字段。
        </p>
      </div>
    </div>
  )
}

// ─── Onboarding Milestone Tracker ────────────────────────────────────────────
function MilestoneTracker() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">OMT</Badge>
          <Badge variant="secondary" className="text-xs">模板</Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Onboarding Milestone Tracker</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          这是我们每天看的施工进度牌——共同成功计划的「每日视图」。
          它聚焦四个问题：现在到哪了、还有多久、卡在哪里、下一步你或 Agent 做什么。
          每次 cadence 会议前更新，有卡点变化时随时更新。
        </p>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: '更新频率', desc: '每次 cadence 会议前更新，或有卡点变化时随时更新，不需要等周会才改' },
            { label: '主要读者', desc: '你们日常跟进的人——他们需要知道「今天该做什么」，不一定是负责人' },
            { label: 'Agent 用途', desc: 'Agent 读取 MCSP 里程碑结构自动生成初始进度表，并在每次任务完成后自动更新勾选状态' },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-lg border border-border/50 p-3 space-y-1">
              <span className="text-xs font-medium">{label}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* 总览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '总里程碑', value: '4', icon: Flag, sub: 'M0 → M3' },
          { label: '已完成', value: '0', icon: CheckCircle2, sub: '你们汇报进度时用这个' },
          { label: '进行中', value: '—', icon: Clock, sub: '我们现在在哪个阶段' },
          { label: '距离 M3', value: '—', icon: Calendar, sub: '目标日期确认后自动计算' },
        ].map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 进度时间线 */}
      <Section icon={Layers} title="实施阶段进度" subtitle="每个阶段下面列出具体可执行的任务——任务要小到「你或 Agent 一天内能完成」，每个任务有 Owner，完成后勾选，进度条自动更新">
        <div className="space-y-3">
          {[
            {
              phase: 'M0',
              name: '启动会 & 环境准备',
              status: 'pending',
              progress: 0,
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: '确认我们双方的联系人名单和沟通渠道', done: false, owner: '你（ONIT CSM）' },
                { name: '完成 API 权限申请和密钥交接', done: false, owner: '你们的技术对接人' },
                { name: '沙箱环境验证通过', done: false, owner: 'ONIT 技术' },
                { name: '启动会召开，我们双方签认 MCSP', done: false, owner: '我们双方' },
              ],
            },
            {
              phase: 'M1',
              name: '首个 Agent 上线',
              status: 'pending',
              progress: 0,
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: 'Agent 生产环境部署完成', done: false, owner: 'ONIT 技术' },
                { name: '真实任务处理验证——我们一起看结果', done: false, owner: '我们双方' },
                { name: 'M1 验收，你们的负责人签字', done: false, owner: '你们的负责人' },
              ],
            },
            {
              phase: 'M2',
              name: '团队扩展 & 自动化',
              status: 'pending',
              progress: 0,
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: '≥3 个 Agent 协作配置完成', done: false, owner: 'ONIT 技术' },
                { name: '人工干预率达到我们共同定的目标', done: false, owner: '你（ONIT CSM）' },
                { name: 'M2 验收，你们的负责人签字', done: false, owner: '你们的负责人' },
              ],
            },
            {
              phase: 'M3',
              name: '验收 & 续约评估',
              status: 'pending',
              progress: 0,
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: 'NPS 问卷发送 & 收集', done: false, owner: '你（ONIT CSM）' },
                { name: 'ROI 报告输出——我们一起看数字', done: false, owner: '你（ONIT CSM）' },
                { name: '续约 / 扩容 / 结束决策，我们共同确认', done: false, owner: '我们双方' },
              ],
            },
          ].map(({ phase, name, status, progress, dueDate, tasks }) => (
            <Card key={phase}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{phase}</Badge>
                    <CardTitle className="text-sm font-semibold">{name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{dueDate}</span>
                    <Badge variant="secondary" className="text-xs">
                      {status === 'in-progress' ? '进行中' : status === 'done' ? '已完成' : '待开始'}
                    </Badge>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>进度</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1">
                      <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                        task.done ? 'bg-foreground border-foreground' : 'border-border'
                      }`}>
                        {task.done && (
                          <svg className="w-2.5 h-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm flex-1 ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                        {task.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{task.owner}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* 当前卡点 */}
      <Section icon={AlertTriangle} title="当前卡点 & 下一步行动" subtitle="现在有什么在拖慢我们？写出来是解决它的第一步。每个卡点必须有下一步行动和 Owner，没有行动的卡点等于放弃解决">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">卡点描述</TableHead>
                  <TableHead className="text-xs">影响阶段</TableHead>
                  <TableHead className="text-xs">下一步行动</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">截止日期</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-dashed">
                  <TableCell className="text-sm text-muted-foreground/40 italic" colSpan={6}>
                    暂无卡点 — 我们现在进展顺利，这也是一个值得记录的好消息
                  </TableCell>
                </TableRow>
                <TableRow className="opacity-30">
                  <TableCell className="text-sm italic text-muted-foreground">[示例：API 权限审批中，卡住了 M0]</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-mono">M0</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">你升级至你们的 IT 负责人，本周内确认时间线</TableCell>
                  <TableCell className="text-sm text-muted-foreground">你们的技术对接人</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">YYYY-MM-DD</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">处理中</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* 更新日志 */}
      <Section icon={FileText} title="更新日志（Update Log）" subtitle="每次有进展，你或 Agent 追加一行就好——只加不改，这是我们项目故事的一部分">
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {[
                { date: 'YYYY-MM-DD', author: '你（ONIT CSM）', note: '创建本进度表，M0 启动会已安排，我们双方确认了时间' },
              ].map((log, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0 opacity-40">
                  <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">{log.date}</span>
                  <div className="flex-1">
                    <span className="text-sm italic">{log.note}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {log.author}</span>
                  </div>
                </div>
              ))}
              <div className="py-2 text-sm text-muted-foreground/40 italic">[每次有进展就在这里追加一行]</div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Footer note */}
      <div className="rounded-lg bg-muted/50 border border-border/50 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">关于本模板：</span>
          实施进度表是共同成功计划（MCSP）的每日视图，聚焦于「现在到哪了、卡在哪里、下一步谁做」。
          如果两份文档出现矛盾，以 MCSP 为准。
          Agent 填写时实时更新任务勾选状态和卡点表，并在每次 cadence 后追加更新日志。
          进度条 = 已完成任务数 / 总任务数 × 100。
        </p>
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────
export function LumenClient() {
  const posthog = usePostHog()

  useEffect(() => {
    posthog?.capture('page_view', { page: 'lumen', template: 'customer_success' })
  }, [posthog])

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 pt-24 pb-16 w-full">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">Lumen</Badge>
          <Badge variant="secondary" className="text-xs">模板</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">客户成功模板</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          ONIT Lumen 的两份标准交付文档。共同成功计划是我们双方共同签认的完整操作系统，
          实施进度表是每天看的施工进度牌。Agent 照着填，以后打包成 Skill。
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
