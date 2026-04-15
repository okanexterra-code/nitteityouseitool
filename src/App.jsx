
import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'schedule_tool_projects_v5'
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''
const TIME_OPTIONS = Array.from({ length: 19 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2)
  const minute = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})
const DURATION_OPTIONS = [
  { value: '15', label: '30分未満' },
  { value: '30', label: '30分' },
  { value: '60', label: '60分' },
  { value: '90', label: '90分' },
  { value: '120', label: '120分' },
  { value: '150', label: '150分' },
  { value: '180', label: '180分' },
  { value: '210', label: '210分' },
  { value: '240', label: '240分' },
  { value: '270', label: '270分' },
  { value: '300', label: '300分' },
  { value: '330', label: '330分' },
  { value: '360', label: '360分' },
]
const MEETING_OPTIONS = ['管理員室前で合流','エントランスで合流','現地へ直接訪問','インターホン呼び出し','担当者へ電話','その他']

const randomToken = (length = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
const createProjectId = () => {
  const now = new Date()
  return `MS${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(Math.random() * 900 + 100)}`
}
const loadProjects = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
const saveProjects = (projects) => localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
const formatDateTime = (value) => {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', weekday:'short', hour:'2-digit', minute:'2-digit' }).format(date)
}
const durationLabel = (value) => value === '15' ? '30分未満' : `${value}分`
const parseRoute = () => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { mode: 'adminHome' }
  if (parts[0] === 'admin' && parts[1] && parts[2]) return { mode: 'adminProject', projectId: parts[1], token: parts[2] }
  if (parts[0] === 'vendor' && parts[1] && parts[2]) return { mode: 'vendorProject', projectId: parts[1], token: parts[2] }
  if (parts[0] === 'customer' && parts[1] && parts[2]) return { mode: 'customerProject', projectId: parts[1], token: parts[2] }
  return { mode: 'adminHome' }
}
const createVendor = (vendorName) => ({
  id: crypto.randomUUID(),
  vendorName,
  vendorToken: randomToken(10),
  contactName: '',
  contactPhone: '',
  visitMethod: '車',
  vendorRequest: '',
  defaultDuration: '60',
  defaultStaffCount: '1',
  candidates: [],
  customerResponse: { status: '', selectedCandidateId: '', meetingMethod: '', meetingMethodDetail: '', note: '' },
})
const createProject = (form) => ({
  id: createProjectId(),
  adminToken: randomToken(10),
  customerToken: randomToken(10),
  internalOwner: form.internalOwner,
  caseNumber: form.caseNumber,
  propertyName: form.propertyName,
  workName: form.workName,
  siteAddress: form.siteAddress,
  notes: form.notes,
  vendors: [],
  customerUrlEnabled: false,
})
const adminUrl = (p) => `${APP_ORIGIN}/admin/${p.id}/${p.adminToken}`
const customerUrl = (p) => `${APP_ORIGIN}/customer/${p.id}/${p.customerToken}`
const vendorUrl = (p, v) => `${APP_ORIGIN}/vendor/${p.id}/${v.vendorToken}`
const vendorStatus = (v) => v.customerResponse.status === 'unavailable' ? '再調整中' : v.customerResponse.status === 'selected' ? '日程確定' : v.candidates.length > 0 ? 'お客様回答待ち' : '候補日未登録'
const projectStatus = (p) => !p.vendors.length ? '事業者未登録' : p.vendors.some(v => vendorStatus(v) === '再調整中') ? '再調整中あり' : p.vendors.every(v => vendorStatus(v) === '日程確定') ? '全社確定' : p.vendors.some(v => vendorStatus(v) === 'お客様回答待ち') ? 'お客様回答待ち' : '候補日未登録'
const copyText = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}
export default function App() {
  const [route, setRoute] = useState(parseRoute())
  const [projects, setProjects] = useState([])
  useEffect(() => {
    setProjects(loadProjects())
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const saveAll = (next) => { setProjects(next); saveProjects(next) }
  const goTo = (path) => { window.history.pushState({}, '', path); setRoute(parseRoute()) }
  const project = useMemo(() => route.projectId ? projects.find((item) => item.id === route.projectId) || null : null, [projects, route.projectId])

  if (route.mode === 'adminProject') {
    if (!project || project.adminToken !== route.token) return <Notice title="管理者用URLが見つかりません。" onHome={() => goTo('/admin')} />
    return <AdminProjectPage project={project} projects={projects} onSave={saveAll} onHome={() => goTo('/admin')} />
  }
  if (route.mode === 'vendorProject') {
    if (!project) return <Notice title="事業者用URLが見つかりません。" onHome={() => goTo('/admin')} />
    const vendor = project.vendors.find((item) => item.vendorToken === route.token)
    if (!vendor) return <Notice title="事業者用URLが見つかりません。" onHome={() => goTo('/admin')} />
    return <VendorPage project={project} vendor={vendor} projects={projects} onSave={saveAll} />
  }
  if (route.mode === 'customerProject') {
    if (!project || project.customerToken !== route.token || !project.customerUrlEnabled) return <Notice title="お客様用URLはまだ有効化されていません。" onHome={() => goTo('/admin')} />
    return <CustomerPage project={project} projects={projects} onSave={saveAll} />
  }
  return <AdminHomePage projects={projects} onSave={saveAll} onOpenProject={goTo} />
}

function AdminHomePage({ projects, onSave, onOpenProject }) {
  const [form, setForm] = useState({ internalOwner:'', caseNumber:'', propertyName:'', workName:'', siteAddress:'', notes:'' })
  const handleCreate = () => {
    if (!form.caseNumber || !form.propertyName || !form.workName) return
    const project = createProject(form)
    onSave([project, ...projects])
    onOpenProject(`/admin/${project.id}/${project.adminToken}`)
  }
  return <PageShell title="日程調整ツール 管理者画面" subtitle="案件を作成し、同じ案件に複数事業者を追加して進捗を管理します。" badge="保存先：このブラウザ内">
    <div className="grid two">
      <div className="panel">
        <h2>新規案件作成</h2>
        <div className="form-grid">
          <Field label="社内担当者" value={form.internalOwner} onChange={(v)=>setForm({...form, internalOwner:v})} />
          <Field label="案件管理番号" value={form.caseNumber} onChange={(v)=>setForm({...form, caseNumber:v})} />
          <Field label="物件名" value={form.propertyName} onChange={(v)=>setForm({...form, propertyName:v})} />
          <Field label="工事名称" value={form.workName} onChange={(v)=>setForm({...form, workName:v})} />
          <Field wide label="現地住所" value={form.siteAddress} onChange={(v)=>setForm({...form, siteAddress:v})} />
          <TextField wide label="備考" value={form.notes} onChange={(v)=>setForm({...form, notes:v})} />
        </div>
        <button className="primary-btn" onClick={handleCreate}>案件を作成</button>
      </div>
      <div className="panel">
        <h2>案件一覧</h2>
        <div className="stack">
          {projects.length === 0 ? <EmptyText text="まだ案件はありません。" /> : projects.map((project) =>
            <div className="mini-box" key={project.id}>
              <div className="row-between">
                <div>
                  <div className="strong">{project.propertyName}</div>
                  <div className="muted">案件管理番号：{project.caseNumber}</div>
                  <div className="muted">工事名称：{project.workName}</div>
                  <div className="muted">全体進捗：{projectStatus(project)}</div>
                </div>
                <button className="ghost-btn" onClick={()=>onOpenProject(`/admin/${project.id}/${project.adminToken}`)}>開く</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </PageShell>
}

function AdminProjectPage({ project, projects, onSave, onHome }) {
  const [vendorNameInput, setVendorNameInput] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const updateProject = (updater) => onSave(projects.map((item) => item.id === project.id ? updater(item) : item))
  const addVendor = () => { if (!vendorNameInput.trim()) return; updateProject((current) => ({ ...current, vendors:[...current.vendors, createVendor(vendorNameInput.trim())] })); setVendorNameInput('') }
  const enableCustomer = () => { if (!project.vendors.some((vendor) => vendor.candidates.length > 0)) return; updateProject((current) => ({ ...current, customerUrlEnabled: true })) }
  const handleCopy = async (key, text) => { try { await copyText(text); setCopiedKey(key); setTimeout(()=>setCopiedKey(''), 1200) } catch {} }

  return <PageShell title={project.propertyName} subtitle={`案件管理番号：${project.caseNumber} / 工事名称：${project.workName}`} badge={projectStatus(project)} rightButton={<button className="ghost-btn" onClick={onHome}>案件一覧へ戻る</button>}>
    <div className="summary-grid">
      <SummaryCard label="案件管理番号" value={project.caseNumber} />
      <SummaryCard label="物件名" value={project.propertyName} />
      <SummaryCard label="工事名称" value={project.workName} />
      <SummaryCard label="登録事業者数" value={`${project.vendors.length}社`} />
    </div>

    <div className="grid two">
      <div className="panel">
        <h2>発行URL</h2>
        <UrlBox label="管理者用URL" value={adminUrl(project)} onCopy={()=>handleCopy('admin', adminUrl(project))} copied={copiedKey==='admin'} />
        {project.customerUrlEnabled
          ? <UrlBox label="お客様用URL" value={customerUrl(project)} onCopy={()=>handleCopy('customer', customerUrl(project))} copied={copiedKey==='customer'} />
          : <div className="mini-box">
              <div className="strong">お客様用URL</div>
              <div className="muted">事業者が候補日を登録した後に発行します。</div>
              <button className="primary-btn small-btn" onClick={enableCustomer} disabled={!project.vendors.some((vendor) => vendor.candidates.length > 0)}>お客様用URLを発行</button>
            </div>}
      </div>
      <div className="panel">
        <h2>案件情報</h2>
        <div className="mini-box"><div className="muted">社内担当者</div><div className="strong">{project.internalOwner || '未入力'}</div></div>
        <div className="mini-box"><div className="muted">現地住所</div><div>{project.siteAddress || '未入力'}</div></div>
        <div className="mini-box"><div className="muted">備考</div><div>{project.notes || '未入力'}</div></div>
      </div>
    </div>

    <div className="panel section-gap">
      <h2>事業者追加</h2>
      <div className="form-grid"><Field label="事業者名" value={vendorNameInput} onChange={setVendorNameInput} /></div>
      <button className="primary-btn" onClick={addVendor}>事業者を追加</button>
    </div>

    <div className="panel section-gap">
      <h2>事業者一覧</h2>
      <div className="stack">
        {project.vendors.length === 0 ? <EmptyText text="まだ事業者は登録されていません。" /> : project.vendors.map((vendor) =>
          <div className="mini-box" key={vendor.id}>
            <div className="row-between">
              <div>
                <div className="strong">{vendor.vendorName}</div>
                <div className="muted">事業者用URL：{vendorUrl(project, vendor)}</div>
                <div className="muted">登録済み候補日：{vendor.candidates.length}件</div>
                <div className="muted">ステータス：{vendorStatus(vendor)}</div>
              </div>
              <button className="ghost-btn" onClick={()=>handleCopy(vendor.id, vendorUrl(project, vendor))}>{copiedKey===vendor.id ? 'コピー済み' : 'URLコピー'}</button>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="panel section-gap">
      <h2>お客様回答結果</h2>
      <div className="stack">
        {project.vendors.length === 0 ? <EmptyText text="まだ事業者は登録されていません。" /> : project.vendors.map((vendor) => {
          const selected = vendor.candidates.find((row) => row.id === vendor.customerResponse.selectedCandidateId)
          return <div className="mini-box" key={vendor.id}>
            <div className="strong">{vendor.vendorName}</div>
            <div className="muted">ステータス：{vendorStatus(vendor)}</div>
            {vendor.customerResponse.status === 'selected' && selected ? <>
              <div className="muted">確定日時：{formatDateTime(selected.datetime)}</div>
              <div className="muted">合流方法：{vendor.customerResponse.meetingMethod || '未入力'}</div>
              <div className="muted">詳細：{vendor.customerResponse.meetingMethodDetail || 'なし'}</div>
              <div className="muted">備考：{vendor.customerResponse.note || 'なし'}</div>
            </> : vendor.customerResponse.status === 'unavailable' ? <div className="muted">対応可能な日時がないため、再調整中です。</div> : <div className="muted">まだお客様回答はありません。</div>}
          </div>
        })}
      </div>
    </div>
  </PageShell>
}

function VendorPage({ project, vendor, projects, onSave }) {
  const [saved, setSaved] = useState(false)
  const [common, setCommon] = useState({
    contactName: vendor.contactName || '',
    contactPhone: vendor.contactPhone || '',
    visitMethod: vendor.visitMethod || '車',
    vendorRequest: vendor.vendorRequest || '',
    duration: vendor.defaultDuration || '60',
    staffCount: vendor.defaultStaffCount || '1',
  })
  const [candidateForm, setCandidateForm] = useState({ date:'', time:'09:00' })
  const updateVendor = (updater) => onSave(projects.map((item) => item.id !== project.id ? item : ({ ...item, vendors: item.vendors.map((v) => v.id === vendor.id ? updater(v) : v) })))
  const saveCommon = () => {
    updateVendor((current) => ({ ...current, contactName: common.contactName, contactPhone: common.contactPhone, visitMethod: common.visitMethod, vendorRequest: common.vendorRequest, defaultDuration: common.duration, defaultStaffCount: common.staffCount }))
    setSaved(true); setTimeout(()=>setSaved(false), 1200)
  }
  const addCandidate = () => {
    if (!candidateForm.date || !candidateForm.time || !common.contactName) return
    const nextCandidate = {
      id: crypto.randomUUID(),
      datetime: `${candidateForm.date}T${candidateForm.time}`,
      duration: common.duration,
      staffCount: common.staffCount,
      personInCharge: common.contactName,
      contactPhone: common.contactPhone,
      visitMethod: common.visitMethod,
      note: common.vendorRequest,
    }
    updateVendor((current) => ({ ...current, contactName: common.contactName, contactPhone: common.contactPhone, visitMethod: common.visitMethod, vendorRequest: common.vendorRequest, defaultDuration: common.duration, defaultStaffCount: common.staffCount, candidates: [...current.candidates, nextCandidate] }))
    setCandidateForm({ date:'', time:'09:00' })
    setSaved(true); setTimeout(()=>setSaved(false), 1200)
  }
  const selected = vendor.candidates.find((row) => row.id === vendor.customerResponse.selectedCandidateId)

  return <PageShell title="事業者用画面" subtitle={vendor.vendorName} badge={saved ? '保存しました' : vendorStatus(vendor)}>
    <div className="panel">
      <div className="mini-box"><div className="muted">工事名称</div><div>{project.workName || '未入力'}</div></div>
      <div className="mini-box"><div className="muted">現地住所</div><div>{project.siteAddress || '未入力'}</div></div>
    </div>

    <div className="panel section-gap">
      <h2>共通情報</h2>
      <div className="form-grid">
        <Field label="担当者名" value={common.contactName} onChange={(v)=>setCommon({...common, contactName:v})} />
        <Field label="担当者連絡先" value={common.contactPhone} onChange={(v)=>setCommon({...common, contactPhone:v})} />
        <SelectField label="訪問方法" value={common.visitMethod} options={[{value:'車',label:'車'},{value:'徒歩',label:'徒歩'}]} onChange={(v)=>setCommon({...common, visitMethod:v})} />
        <SelectField label="所要時間" value={common.duration} options={DURATION_OPTIONS} onChange={(v)=>setCommon({...common, duration:v})} />
        <Field label="対応人数" value={common.staffCount} onChange={(v)=>setCommon({...common, staffCount:v})} />
        <div className="field"></div>
        <TextField wide label="現地調査に関するご要望・確認事項" value={common.vendorRequest} onChange={(v)=>setCommon({...common, vendorRequest:v})} />
      </div>
      <button className="ghost-btn" onClick={saveCommon}>共通情報を保存</button>
    </div>

    <div className="panel section-gap">
      <h2>候補日時を追加</h2>
      <div className="form-grid">
        <Field label="候補日" type="date" value={candidateForm.date} onChange={(v)=>setCandidateForm({...candidateForm, date:v})} />
        <SelectField label="候補時間" value={candidateForm.time} options={TIME_OPTIONS.map((value)=>({value,label:value}))} onChange={(v)=>setCandidateForm({...candidateForm, time:v})} />
        <SummaryInline label="所要時間" value={durationLabel(common.duration)} />
        <SummaryInline label="対応人数" value={`${common.staffCount}名`} />
      </div>
      <button className="primary-btn" onClick={addCandidate}>候補日時を追加</button>
      <div className="help-text">2件目以降は、候補日と候補時間だけ選んで追加できます。</div>
    </div>

    <div className="panel section-gap">
      <h2>登録済み候補日</h2>
      <div className="stack">
        {vendor.candidates.length === 0 ? <EmptyText text="まだ候補日は登録されていません。" /> : vendor.candidates.map((row) =>
          <div className="mini-box" key={row.id}>
            <div className="strong">{formatDateTime(row.datetime)}</div>
            <div className="muted">所要時間：{durationLabel(row.duration)} / 対応人数：{row.staffCount}名</div>
            <div className="muted">担当者名：{row.personInCharge || '未入力'} / 担当者連絡先：{row.contactPhone || '未入力'}</div>
            <div className="muted">訪問方法：{row.visitMethod || '未入力'}</div>
          </div>
        )}
      </div>
    </div>

    <div className="panel section-gap">
      <h2>お客様の選択結果</h2>
      {vendor.customerResponse.status === 'selected' && selected ? <div className="mini-box">
        <div className="strong">確定日時：{formatDateTime(selected.datetime)}</div>
        <div className="muted">合流方法：{vendor.customerResponse.meetingMethod || '未入力'}</div>
        <div className="muted">詳細：{vendor.customerResponse.meetingMethodDetail || 'なし'}</div>
        <div className="muted">備考：{vendor.customerResponse.note || 'なし'}</div>
      </div> : vendor.customerResponse.status === 'unavailable' ? <EmptyText text="対応可能な日時がないため、再調整中です。" /> : <EmptyText text="まだお客様の日時選択はありません。" />}
    </div>
  </PageShell>
}

function CustomerPage({ project, projects, onSave }) {
  const updateVendorResponse = (vendorId, updater) => {
    onSave(projects.map((item) => item.id !== project.id ? item : ({ ...item, vendors: item.vendors.map((vendor) => vendor.id === vendorId ? { ...vendor, customerResponse: updater(vendor.customerResponse) } : vendor) })))
  }

  return <PageShell title="お客様用画面" subtitle="各事業者ごとに、ご都合の良い日時をお選びください。該当する日時がない場合は『対応可能な日時がない』をお選びください。" badge={`${project.vendors.length}社`}>
    <div className="panel">
      <div className="mini-box"><div className="muted">物件名</div><div>{project.propertyName}</div></div>
      <div className="mini-box"><div className="muted">工事名称</div><div>{project.workName}</div></div>
      <div className="mini-box"><div className="muted">現地住所</div><div>{project.siteAddress || '未入力'}</div></div>
    </div>
    <div className="stack section-gap">
      {project.vendors.length === 0 ? <EmptyText text="まだ事業者は登録されていません。" /> : project.vendors.map((vendor) =>
        <CustomerVendorBlock key={vendor.id} vendor={vendor} onChange={(updater)=>updateVendorResponse(vendor.id, updater)} />
      )}
    </div>
  </PageShell>
}

function CustomerVendorBlock({ vendor, onChange }) {
  const response = vendor.customerResponse
  const isUnavailable = response.status === 'unavailable'
  const selectCandidate = (candidateId) => onChange((current) => ({ ...current, status: 'selected', selectedCandidateId: candidateId }))
  const selectUnavailable = () => onChange((current) => ({ ...current, status: 'unavailable', selectedCandidateId: '', meetingMethod: '', meetingMethodDetail: '' }))

  return <div className="panel vendor-block">
    <h2>{vendor.vendorName}</h2>
    <div className="radio-list">
      {vendor.candidates.map((candidate) =>
        <label className="radio-row" key={candidate.id}>
          <input type="radio" name={`candidate-${vendor.id}`} checked={response.selectedCandidateId === candidate.id && response.status === 'selected'} onChange={()=>selectCandidate(candidate.id)} />
          <span className="radio-text">{formatDateTime(candidate.datetime)}</span>
        </label>
      )}
      <label className="radio-row">
        <input type="radio" name={`candidate-${vendor.id}`} checked={isUnavailable} onChange={selectUnavailable} />
        <span className="radio-text">対応可能な日時がない</span>
      </label>
    </div>

    {!isUnavailable && (
      <div className="form-grid section-gap-small">
        <SelectField label="合流方法" value={response.meetingMethod} options={[{ value:'', label:'選択してください' }, ...MEETING_OPTIONS.map((value)=>({ value, label:value }))]} onChange={(v)=>onChange((current)=>({ ...current, status: current.status || 'selected', meetingMethod:v }))} />
        <Field label="合流方法詳細" value={response.meetingMethodDetail} onChange={(v)=>onChange((current)=>({ ...current, status: current.status || 'selected', meetingMethodDetail:v }))} />
        <TextField wide label="備考" value={response.note} onChange={(v)=>onChange((current)=>({ ...current, status: current.status || 'selected', note:v }))} />
      </div>
    )}

    {isUnavailable && (
      <div className="section-gap-small">
        <TextField label="備考" value={response.note} onChange={(v)=>onChange((current)=>({ ...current, note:v }))} />
      </div>
    )}
  </div>
}

function PageShell({ title, subtitle, badge, rightButton, children }) {
  return <div className="page"><div className="container">
    <div className="hero">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="hero-actions">{rightButton}{badge && <div className="status-badge">{badge}</div>}</div>
    </div>
    {children}
  </div></div>
}

function Notice({ title, onHome }) {
  return <PageShell title="ご案内" subtitle={title} badge="未表示"><div className="panel"><button className="primary-btn" onClick={onHome}>戻る</button></div></PageShell>
}

function UrlBox({ label, value, onCopy, copied }) {
  return <div className="mini-box"><div className="row-between"><div><div className="strong">{label}</div><div className="url-text">{value}</div></div><button className="ghost-btn" onClick={onCopy}>{copied ? 'コピー済み' : 'URLコピー'}</button></div></div>
}
function SummaryCard({ label, value }) { return <div className="card"><div className="muted">{label}</div><div className="strong">{value}</div></div> }
function SummaryInline({ label, value }) { return <div className="field"><label>{label}</label><div className="readonly-box">{value}</div></div> }
function Field({ label, value, onChange, type='text', wide=false }) {
  return <div className={wide ? 'field wide' : 'field'}><label>{label}</label><input type={type} value={value} onChange={(e)=>onChange(e.target.value)} /></div>
}
function TextField({ label, value, onChange, wide=false }) {
  return <div className={wide ? 'field wide' : 'field'}><label>{label}</label><textarea rows="3" value={value} onChange={(e)=>onChange(e.target.value)} /></div>
}
function SelectField({ label, value, options, onChange }) {
  return <div className="field"><label>{label}</label><select value={value} onChange={(e)=>onChange(e.target.value)}>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
}
function EmptyText({ text }) { return <div className="mini-box muted">{text}</div> }
