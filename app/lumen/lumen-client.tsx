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
  Calendar, Clock, ArrowRight, Flag, Layers, FileText
} from 'lucide-react'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Field row ────────────────────────────────────────────────────────────────
function FieldRow({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground pt-0.5">{label}</span>
      <span className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
        {value ?? placeholder ?? '—'}
      </span>
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
          <Badge variant="outline" className="font-mono text-xs">MCSP-001</Badge>
          <Badge variant="secondary" className="text-xs">草稿</Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Mutual Customer Success Plan</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          共同成功计划是客户与 ONIT 双方签认的完整操作系统。它回答：我们要去哪里、现在在哪里、谁负责什么、什么算成功、风险在哪里。
          按 cadence 动态更新，而非一次性文档。
        </p>
      </div>

      <Separator />

      {/* Block 1: 目标与背景 */}
      <Section icon={Target} title="1. 目标与背景">
        <Card>
          <CardContent className="pt-4 space-y-0">
            <FieldRow label="客户名称" placeholder="[客户公司名]" />
            <FieldRow label="ONIT 负责人" placeholder="[CSM 姓名]" />
            <FieldRow label="客户负责人" placeholder="[客户 Champion 姓名 / 职位]" />
            <FieldRow label="合同开始日期" placeholder="YYYY-MM-DD" />
            <FieldRow label="计划周期" placeholder="例：2026-Q2（3个月）" />
            <FieldRow label="背景摘要" placeholder="用 2-3 句话说明客户为什么来、他们在解决什么问题" />
          </CardContent>
        </Card>
      </Section>

      {/* Block 2: 现状 vs 理想状态 */}
      <Section icon={ArrowRight} title="2. 现状 → 理想状态">
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">现状（As-Is）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['痛点 1', '痛点 2', '痛点 3'].map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-muted-foreground/60 italic">[{p}：描述当前低效或缺失的环节]</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">理想状态（To-Be）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['目标 1', '目标 2', '目标 3'].map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                  <span className="text-sm text-muted-foreground/60 italic">[{p}：描述 3 个月后的具体状态]</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Block 3: 成功标准 */}
      <Section icon={CheckCircle2} title="3. 成功标准（Success Criteria）">
        <Card>
          <CardContent className="pt-4">
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
                  ['Agent 接管任务数 / 周', '0', '≥ 20', 'Supabase run_logs 计数', 'M1 末'],
                  ['人工干预率', '100%', '< 30%', 'LangSmith trace 统计', 'M2 末'],
                  ['客户满意度（NPS）', '—', '≥ 8 / 10', '月度问卷', 'M3 末'],
                ].map(([metric, base, target, method, date], i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{metric}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{base}</TableCell>
                    <TableCell className="text-sm">{target}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{method}</TableCell>
                    <TableCell className="text-sm"><Badge variant="outline" className="text-xs font-mono">{date}</Badge></TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-dashed">
                  <TableCell className="text-sm text-muted-foreground/40 italic" colSpan={5}>[+ 添加自定义指标]</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 4: 角色与职责 */}
      <Section icon={Users} title="4. 角色与职责（RACI）">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">角色</TableHead>
                  <TableHead className="text-xs">姓名</TableHead>
                  <TableHead className="text-xs">职责范围</TableHead>
                  <TableHead className="text-xs">联系方式</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['ONIT CSM', '[姓名]', '整体进度跟踪、周会主持、风险上报', '—'],
                  ['ONIT 技术负责人', '[姓名]', 'Agent 配置、集成调试、技术答疑', '—'],
                  ['客户 Champion', '[姓名 / 职位]', '内部推动、需求确认、验收签字', '—'],
                  ['客户技术对接人', '[姓名 / 职位]', 'API 权限、系统对接、测试配合', '—'],
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
      <Section icon={Flag} title="5. 里程碑（Milestones）">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] text-xs">阶段</TableHead>
                  <TableHead className="text-xs">里程碑名称</TableHead>
                  <TableHead className="text-xs">交付物</TableHead>
                  <TableHead className="text-xs">目标日期</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['M0', '启动会 & 环境准备', 'API 密钥交接、沙箱环境就绪', 'YYYY-MM-DD', 'ONIT 技术', '待开始'],
                  ['M1', '首个 Agent 上线', '≥1 个 Agent 在生产环境处理真实任务', 'YYYY-MM-DD', 'ONIT CSM', '待开始'],
                  ['M2', '团队扩展 & 自动化', '≥3 个 Agent 协作，人工干预率达标', 'YYYY-MM-DD', '双方', '待开始'],
                  ['M3', '验收 & 续约评估', 'NPS 问卷、ROI 报告、续约决策', 'YYYY-MM-DD', 'ONIT CSM', '待开始'],
                ].map(([phase, name, deliverable, date, owner, status], i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{phase}</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{deliverable}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{owner}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 6: 风险登记 */}
      <Section icon={AlertTriangle} title="6. 风险登记（Risk Register）">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">风险描述</TableHead>
                  <TableHead className="text-xs">概率</TableHead>
                  <TableHead className="text-xs">影响</TableHead>
                  <TableHead className="text-xs">缓解措施</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['客户内部 API 权限审批延迟', '中', '高', '提前 2 周发送权限申请清单', '客户技术'],
                  ['Agent 输出质量不达预期', '低', '高', 'LangSmith 全链路追踪 + 每周 QA 抽查', 'ONIT 技术'],
                  ['客户 Champion 离职/换人', '低', '中', '确保 ≥2 名客户内部联系人', 'ONIT CSM'],
                ].map(([risk, prob, impact, mitigation, owner], i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{risk}</TableCell>
                    <TableCell>
                      <Badge variant={prob === '高' ? 'destructive' : 'secondary'} className="text-xs">{prob}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={impact === '高' ? 'destructive' : 'secondary'} className="text-xs">{impact}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mitigation}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{owner}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 7: 交接与 Cadence */}
      <Section icon={GitBranch} title="7. 交接 & 节奏（Handoff & Cadence）">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Review Cadence</CardTitle>
              <CardDescription className="text-xs">定期同步节奏</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ['周会', '每周一 10:00', '进度更新、风险同步', '30 min'],
                ['月度 QBR', '每月最后一个周五', '指标回顾、计划调整', '60 min'],
                ['里程碑验收', '按 M0-M3 节点', '交付物确认、签字', '按需'],
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
              <CardTitle className="text-sm font-medium">交接标准</CardTitle>
              <CardDescription className="text-xs">什么情况下本计划视为完成</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                '所有 M0-M3 里程碑状态为「已完成」',
                '成功标准中所有指标达到目标值',
                '客户 Champion 签字确认验收报告',
                '续约/扩容/结束决策已明确',
                'LangSmith 运行数据已归档',
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
          本文档结构参考 GitLab Customer Success Plan 规范（dynamic, mutually agreed roadmap）
          和 MAP（Mutual Action Plan）体系。Agent 填写时应按实际客户情况替换所有 <span className="font-mono bg-background px-1 rounded">[占位符]</span>，
          并在每次 cadence 会议后更新状态字段。
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
          <Badge variant="outline" className="font-mono text-xs">OMT-001</Badge>
          <Badge variant="secondary" className="text-xs">进行中</Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Onboarding Milestone Tracker</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          实施进度表是用户每天看的施工进度牌。它回答：现在到哪了、还有多久、卡在哪里、下一步谁做什么。
          和共同成功计划配套使用，每次 cadence 会议前更新。
        </p>
      </div>

      <Separator />

      {/* 总览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '总里程碑', value: '4', icon: Flag, sub: 'M0 → M3' },
          { label: '已完成', value: '0', icon: CheckCircle2, sub: '0%' },
          { label: '进行中', value: '1', icon: Clock, sub: 'M0 启动中' },
          { label: '距离 M3', value: '—', icon: Calendar, sub: '目标日期待定' },
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
      <Section icon={Layers} title="实施阶段进度">
        <div className="space-y-3">
          {[
            {
              phase: 'M0',
              name: '启动会 & 环境准备',
              status: 'in-progress' as const,
              progress: 40,
              owner: 'ONIT 技术',
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: 'API 密钥交接', done: true, owner: '客户技术' },
                { name: '沙箱环境配置', done: true, owner: 'ONIT 技术' },
                { name: '启动会议召开', done: false, owner: 'ONIT CSM' },
                { name: '首个 Agent 配置完成', done: false, owner: 'ONIT 技术' },
              ],
            },
            {
              phase: 'M1',
              name: '首个 Agent 上线',
              status: 'pending' as const,
              progress: 0,
              owner: 'ONIT CSM',
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: 'Agent 生产环境部署', done: false, owner: 'ONIT 技术' },
                { name: '真实任务处理验证', done: false, owner: '双方' },
                { name: 'M1 验收签字', done: false, owner: '客户 Champion' },
              ],
            },
            {
              phase: 'M2',
              name: '团队扩展 & 自动化',
              status: 'pending' as const,
              progress: 0,
              owner: '双方',
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: '≥3 个 Agent 协作配置', done: false, owner: 'ONIT 技术' },
                { name: '人工干预率 < 30% 验证', done: false, owner: 'ONIT CSM' },
                { name: 'M2 验收签字', done: false, owner: '客户 Champion' },
              ],
            },
            {
              phase: 'M3',
              name: '验收 & 续约评估',
              status: 'pending' as const,
              progress: 0,
              owner: 'ONIT CSM',
              dueDate: 'YYYY-MM-DD',
              tasks: [
                { name: 'NPS 问卷发送 & 收集', done: false, owner: 'ONIT CSM' },
                { name: 'ROI 报告输出', done: false, owner: 'ONIT CSM' },
                { name: '续约 / 扩容 / 结束决策', done: false, owner: '客户 Champion' },
              ],
            },
          ].map(({ phase, name, status, progress, owner, dueDate, tasks }) => (
            <Card key={phase} className={status === 'in-progress' ? 'border-foreground/20' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{phase}</Badge>
                    <CardTitle className="text-sm font-semibold">{name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{dueDate}</span>
                    <Badge
                      variant={status === 'in-progress' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {status === 'in-progress' ? '进行中' : '待开始'}
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
      <Section icon={AlertTriangle} title="当前卡点 & 下一步行动">
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
                    [暂无卡点 — 当前进展顺利]
                  </TableCell>
                </TableRow>
                <TableRow className="opacity-40">
                  <TableCell className="text-sm italic text-muted-foreground">[卡点示例：API 权限审批中]</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-mono">M0</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">升级至客户 IT 总监</TableCell>
                  <TableCell className="text-sm text-muted-foreground">ONIT CSM</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">YYYY-MM-DD</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">处理中</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* 更新日志 */}
      <Section icon={FileText} title="更新日志（Update Log）">
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {[
                { date: 'YYYY-MM-DD', author: 'ONIT CSM', note: '创建本进度表，M0 启动会已安排' },
              ].map((log, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">{log.date}</span>
                  <div className="flex-1">
                    <span className="text-sm">{log.note}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {log.author}</span>
                  </div>
                </div>
              ))}
              <div className="py-2 text-sm text-muted-foreground/40 italic">[每次 cadence 会议后在此追加一行]</div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Footer note */}
      <div className="rounded-lg bg-muted/50 border border-border/50 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">关于本模板：</span>
          本进度表是共同成功计划（MCSP）的每日视图，聚焦于「现在到哪了、卡在哪里、下一步谁做」。
          Agent 填写时应实时更新任务勾选状态和卡点表，并在每次 cadence 后追加更新日志。
          进度条数值 = 已完成任务数 / 总任务数 × 100。
        </p>
      </div>
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
          <Badge variant="secondary" className="text-xs">模板库</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">客户成功模板</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          ONIT Lumen 的两份标准交付文档。共同成功计划是完整操作系统，实施进度表是用户每天看的施工进度牌。
          Agent 照着填，以后打包成 Skill。
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
