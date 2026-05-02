import { useState, useEffect, useCallback } from 'react'
import {
  Settings, Users, Layers, TreePine, AlertTriangle, Plus, Pencil, Trash2, X, Save, Shield, Printer,
} from 'lucide-react'
import { ownersApi, claimsApi, parcelsApi, disputesApi, usersApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import GeoFileUpload from '../components/GeoFileUpload'

const TABS = [
  { key: 'owners', label: 'Owners', icon: Users },
  { key: 'claims', label: 'Mine Claims', icon: Layers },
  { key: 'parcels', label: 'Farm Parcels', icon: TreePine },
  { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { key: 'users', label: 'Users', icon: Shield },
]

// ─── Modal Shell ──────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <input className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors" {...props} />
    </div>
  )
}

function Select({ label, options, ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <select className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-emerald-500 transition-colors" {...props}>
        {options.map((o) => <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>)}
      </select>
    </div>
  )
}

const CRS_PRESETS = [
  { value: 'WGS84', label: 'WGS 84 (EPSG:4326)' },
  { value: 'UTM36S', label: 'UTM Zone 36S (EPSG:32736)' },
  { value: 'Harare_Datum', label: 'Harare Datum' },
  { value: 'Cape_Datum', label: 'Cape Datum' },
  { value: 'EPSG:32735', label: 'UTM Zone 35S (EPSG:32735)' },
  { value: 'EPSG:20936', label: 'Arc 1950 / UTM 36S (EPSG:20936)' },
  { value: 'EPSG:4210', label: 'Arc 1960 (EPSG:4210)' },
  { value: 'EPSG:4222', label: 'Cape (EPSG:4222)' },
]

function CRSSelect({ value, onChange }) {
  const isCustom = value && !CRS_PRESETS.some((p) => p.value === value)
  const [showCustom, setShowCustom] = useState(isCustom)

  const handleSelectChange = (e) => {
    if (e.target.value === '__custom__') {
      setShowCustom(true)
      onChange({ target: { value: '' } })
    } else {
      setShowCustom(false)
      onChange(e)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">Coordinate System / EPSG</label>
      <select
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-emerald-500 transition-colors"
        value={showCustom ? '__custom__' : value}
        onChange={handleSelectChange}
      >
        {CRS_PRESETS.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
        ))}
        <option value="__custom__" className="bg-slate-800">Custom EPSG…</option>
      </select>
      {showCustom && (
        <input
          className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
          placeholder="e.g. EPSG:32735 or custom CRS name"
          value={value}
          onChange={onChange}
          autoFocus
        />
      )}
    </div>
  )
}

function ActionBtn({ onClick, icon: Icon, color = 'text-slate-400 hover:text-white', title }) {
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${color}`}>
      <Icon size={15} />
    </button>
  )
}

// ─── Owners Tab ───────────────────────────────────────────────
function OwnersTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | {edit obj}
  const emptyOwner = { name: '', national_id: '', phone: '', email: '', address: '' }
  const [form, setForm] = useState(emptyOwner)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ownersApi.list({ page_size: 500 })
      setItems(res.data?.results || [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => { setForm(emptyOwner); setModal('create') }
  const openEdit = (o) => { setForm({ name: o.name, national_id: o.national_id, phone: o.phone || '', email: o.email || '', address: o.address || '' }); setModal(o) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') await ownersApi.create(form)
      else await ownersApi.update(modal.id, form)
      toast.success(modal === 'create' ? 'Owner created.' : 'Owner updated.')
      setModal(null); fetch()
    } catch { toast.error('Failed to save owner.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this owner? Associated claims and parcels will also be deleted.')) return
    try { await ownersApi.delete(id); toast.success('Owner deleted.'); fetch() } catch { toast.error('Failed to delete owner.') }
  }

  if (loading) return <Loader />

  return (
    <>
      <TableHeader title={`${items.length} Owner(s)`} onAdd={openCreate} />
      <Table
        cols={['Name', 'National ID', 'Phone', 'Email', 'Created']}
        rows={items}
        render={(o) => (
          <tr key={o.id} className="hover:bg-slate-800/50 transition-colors">
            <td className="px-5 py-3 text-sm font-medium text-white">{o.name}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{o.national_id}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{o.phone || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{o.email || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{fmtDate(o.created_at)}</td>
            <td className="px-5 py-3 text-right">
              <div className="flex justify-end gap-1">
                <ActionBtn icon={Pencil} onClick={() => openEdit(o)} title="Edit" />
                <ActionBtn icon={Trash2} onClick={() => handleDelete(o.id)} color="text-red-400 hover:text-red-300" title="Delete" />
              </div>
            </td>
          </tr>
        )}
      />
      {modal && (
        <Modal title={modal === 'create' ? 'New Owner' : 'Edit Owner'} onClose={() => setModal(null)}>
          <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Moyo" />
          <Input label="National ID" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} placeholder="e.g. 63-123456A78" />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263 771 234 567" />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@email.co.zw" />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Physical address" />
          <SaveBtn saving={saving} onClick={handleSave} />
        </Modal>
      )}
    </>
  )
}

// ─── Mine Claims Tab ──────────────────────────────────────────
function ClaimsTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const emptyClaim = {
    claim_code: '', claim_name: '', claim_reg_no: '', mine_type: '',
    owner: '', area: '', status: 'ACTIVE', district: '',
    surveyed_date: '', surveyor: '', coordinate_system: 'WGS84', geom: '',
  }
  const [form, setForm] = useState(emptyClaim)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [claimsRes, ownersRes] = await Promise.all([
        claimsApi.list({ page_size: 500 }),
        ownersApi.list({ page_size: 500 }),
      ])
      setItems((claimsRes.data?.results?.features || []).map((f) => ({ id: f.id, ...f.properties, geometry: f.geometry })))
      setOwners(ownersRes.data?.results || [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setForm({ ...emptyClaim, owner: owners[0]?.id || '' })
    setModal('create')
  }
  const openEdit = (c) => {
    setForm({
      claim_code: c.claim_code, claim_name: c.claim_name || '', claim_reg_no: c.claim_reg_no || '',
      mine_type: c.mine_type || '', owner: c.owner, area: c.area || '', status: c.status,
      district: c.district || '', surveyed_date: c.surveyed_date ? c.surveyed_date.split('T')[0] : '',
      surveyor: c.surveyor || '', coordinate_system: c.coordinate_system || 'WGS84',
      geom: c.geometry ? JSON.stringify(c.geometry) : '',
    })
    setModal(c)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, owner: Number(form.owner), area: Number(form.area) || 0 }
      if (!payload.surveyed_date) payload.surveyed_date = null
      if (form.geom) payload.geom = typeof form.geom === 'string' ? JSON.parse(form.geom) : form.geom
      else delete payload.geom

      if (modal === 'create') await claimsApi.create(payload)
      else await claimsApi.update(modal.id, payload)
      toast.success(modal === 'create' ? 'Mine claim created.' : 'Mine claim updated.')
      setModal(null); fetch()
    } catch { toast.error('Failed to save mine claim.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this mine claim?')) return
    try { await claimsApi.delete(id); toast.success('Mine claim deleted.'); fetch() } catch { toast.error('Failed to delete mine claim.') }
  }

  if (loading) return <Loader />

  return (
    <>
      <TableHeader title={`${items.length} Mine Claim(s)`} onAdd={openCreate} />
      <Table
        cols={['Claim Code', 'Claim Name', 'Reg No', 'Mine Type', 'Owner', 'District', 'Status', 'Area (ha)', 'CRS']}
        rows={items}
        render={(c) => (
          <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
            <td className="px-5 py-3 text-sm font-medium text-white">{c.claim_code}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{c.claim_name || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{c.claim_reg_no || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{c.mine_type || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{c.owner_name}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{c.district || '—'}</td>
            <td className="px-5 py-3"><Badge status={c.status} /></td>
            <td className="px-5 py-3 text-sm text-slate-300">{c.area || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{c.coordinate_system || '—'}</td>
            <td className="px-5 py-3 text-right">
              <div className="flex justify-end gap-1">
                <ActionBtn icon={Pencil} onClick={() => openEdit(c)} title="Edit" />
                <ActionBtn icon={Trash2} onClick={() => handleDelete(c.id)} color="text-red-400 hover:text-red-300" title="Delete" />
              </div>
            </td>
          </tr>
        )}
      />
      {modal && (
        <Modal title={modal === 'create' ? 'New Mine Claim' : 'Edit Mine Claim'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Claim Code *" value={form.claim_code} onChange={(e) => setForm({ ...form, claim_code: e.target.value })} placeholder="e.g. MC-001" />
            <Input label="Claim Name" value={form.claim_name} onChange={(e) => setForm({ ...form, claim_name: e.target.value })} placeholder="e.g. Mukaradzi Gold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Registration No" value={form.claim_reg_no} onChange={(e) => setForm({ ...form, claim_reg_no: e.target.value })} placeholder="e.g. REG/2024/001" />
            <Select label="Mine Type" value={form.mine_type} onChange={(e) => setForm({ ...form, mine_type: e.target.value })} options={[
              { value: '', label: '— Select —' }, { value: 'Gold', label: 'Gold' }, { value: 'Chrome', label: 'Chrome' },
              { value: 'Diamond', label: 'Diamond' }, { value: 'Platinum', label: 'Platinum' }, { value: 'Lithium', label: 'Lithium' },
              { value: 'Coal', label: 'Coal' }, { value: 'Iron', label: 'Iron' }, { value: 'Copper', label: 'Copper' },
              { value: 'Nickel', label: 'Nickel' }, { value: 'Tantalite', label: 'Tantalite' }, { value: 'Other', label: 'Other' },
            ]} />
          </div>
          <Select label="Owner *" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} options={owners.map((o) => ({ value: o.id, label: `${o.name} (${o.national_id})` }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'EXPIRED', label: 'Expired' }, { value: 'DISPUTED', label: 'Disputed' }, { value: 'REVOKED', label: 'Revoked' }]} />
            <Input label="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="e.g. Mazowe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Area (ha)" type="number" readOnly value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Auto-calculated" />
            <CRSSelect value={form.coordinate_system} onChange={(e) => setForm({ ...form, coordinate_system: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Survey Date" type="date" value={form.surveyed_date} onChange={(e) => setForm({ ...form, surveyed_date: e.target.value })} />
            <Input label="Surveyor" value={form.surveyor} onChange={(e) => setForm({ ...form, surveyor: e.target.value })} placeholder="Surveyor name" />
          </div>
          <GeoFileUpload value={form.geom} onChange={(v, crs, area) => setForm((prev) => ({ 
            ...prev, 
            geom: v, 
            ...(crs ? { coordinate_system: crs } : {}),
            ...(area ? { area } : {})
          }))} />
          <SaveBtn saving={saving} onClick={handleSave} />
        </Modal>
      )}
    </>
  )
}

// ─── Farm Parcels Tab ─────────────────────────────────────────
function ParcelsTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const emptyParcel = {
    parcel_code: '', farm_name: '', deed_no: '', lease_type: '',
    owner: '', land_use: '', area: '',
    survey_date: '', surveyor: '', coordinate_system: 'WGS84', geom: '',
  }
  const [form, setForm] = useState(emptyParcel)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [parcelsRes, ownersRes] = await Promise.all([
        parcelsApi.list({ page_size: 500 }),
        ownersApi.list({ page_size: 500 }),
      ])
      setItems((parcelsRes.data?.results?.features || []).map((f) => ({ id: f.id, ...f.properties, geometry: f.geometry })))
      setOwners(ownersRes.data?.results || [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setForm({ ...emptyParcel, owner: owners[0]?.id || '' })
    setModal('create')
  }
  const openEdit = (p) => {
    setForm({
      parcel_code: p.parcel_code, farm_name: p.farm_name || '', deed_no: p.deed_no || '',
      lease_type: p.lease_type || '', owner: p.owner, land_use: p.land_use || '', area: p.area || '',
      survey_date: p.survey_date ? p.survey_date.split('T')[0] : '',
      surveyor: p.surveyor || '', coordinate_system: p.coordinate_system || 'WGS84',
      geom: p.geometry ? JSON.stringify(p.geometry) : '',
    })
    setModal(p)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, owner: Number(form.owner), area: Number(form.area) || null }
      if (!payload.survey_date) payload.survey_date = null
      if (form.geom) payload.geom = typeof form.geom === 'string' ? JSON.parse(form.geom) : form.geom
      else delete payload.geom
      if (modal === 'create') await parcelsApi.create(payload)
      else await parcelsApi.update(modal.id, payload)
      toast.success(modal === 'create' ? 'Farm parcel created.' : 'Farm parcel updated.')
      setModal(null); fetch()
    } catch { toast.error('Failed to save farm parcel.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this farm parcel?')) return
    try { await parcelsApi.delete(id); toast.success('Farm parcel deleted.'); fetch() } catch { toast.error('Failed to delete parcel.') }
  }

  if (loading) return <Loader />

  return (
    <>
      <TableHeader title={`${items.length} Farm Parcel(s)`} onAdd={openCreate} />
      <Table
        cols={['Parcel Code', 'Farm Name', 'Deed No', 'Lease/Offer', 'Owner', 'Land Use', 'Area (ha)', 'CRS']}
        rows={items}
        render={(p) => (
          <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
            <td className="px-5 py-3 text-sm font-medium text-white">{p.parcel_code}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{p.farm_name || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{p.deed_no || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{p.lease_type || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{p.owner_name}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{p.land_use || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{p.area || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{p.coordinate_system || '—'}</td>
            <td className="px-5 py-3 text-right">
              <div className="flex justify-end gap-1">
                <ActionBtn icon={Pencil} onClick={() => openEdit(p)} title="Edit" />
                <ActionBtn icon={Trash2} onClick={() => handleDelete(p.id)} color="text-red-400 hover:text-red-300" title="Delete" />
              </div>
            </td>
          </tr>
        )}
      />
      {modal && (
        <Modal title={modal === 'create' ? 'New Farm Parcel' : 'Edit Farm Parcel'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Parcel Code *" value={form.parcel_code} onChange={(e) => setForm({ ...form, parcel_code: e.target.value })} placeholder="e.g. FP-001" />
            <Input label="Farm Name" value={form.farm_name} onChange={(e) => setForm({ ...form, farm_name: e.target.value })} placeholder="e.g. Chisipiti Farm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Deed No" value={form.deed_no} onChange={(e) => setForm({ ...form, deed_no: e.target.value })} placeholder="e.g. DEED/2024/123" />
            <Select label="Lease / Offer Letter" value={form.lease_type} onChange={(e) => setForm({ ...form, lease_type: e.target.value })} options={[
              { value: '', label: '— Select —' }, { value: 'Lease', label: 'Lease' },
              { value: 'Offer Letter', label: 'Offer Letter' }, { value: 'Title Deed', label: 'Title Deed' },
            ]} />
          </div>
          <Select label="Owner *" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} options={owners.map((o) => ({ value: o.id, label: `${o.name} (${o.national_id})` }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Land Use" value={form.land_use} onChange={(e) => setForm({ ...form, land_use: e.target.value })} placeholder="e.g. Crop farming" />
            <Input label="Area (ha)" type="number" readOnly value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Auto-calculated" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Survey Date" type="date" value={form.survey_date} onChange={(e) => setForm({ ...form, survey_date: e.target.value })} />
            <Input label="Surveyor" value={form.surveyor} onChange={(e) => setForm({ ...form, surveyor: e.target.value })} placeholder="Surveyor name" />
          </div>
          <CRSSelect value={form.coordinate_system} onChange={(e) => setForm({ ...form, coordinate_system: e.target.value })} />
          <GeoFileUpload value={form.geom} onChange={(v, crs, area) => setForm((prev) => ({ 
            ...prev, 
            geom: v, 
            ...(crs ? { coordinate_system: crs } : {}),
            ...(area ? { area } : {})
          }))} />
          <SaveBtn saving={saving} onClick={handleSave} />
        </Modal>
      )}
    </>
  )
}

// ─── Disputes Tab ─────────────────────────────────────────────
function DisputesTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await disputesApi.list({ page_size: 500 })
      setItems((res.data?.results?.features || []).map((f) => ({ id: f.id, ...f.properties })))
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const updateStatus = async (id, status) => {
    try { await disputesApi.update(id, { status }); toast.success(`Dispute ${status.toLowerCase()}.`); fetch() } catch { toast.error('Failed to update dispute.') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this dispute record?')) return
    try { await disputesApi.delete(id); toast.success('Dispute deleted.'); fetch() } catch { toast.error('Failed to delete dispute.') }
  }

  if (loading) return <Loader />

  return (
    <>
      <TableHeader title={`${items.length} Dispute(s)`} />
      <Table
        cols={['Mine Claim', 'Farm Parcel', 'Status', 'Conflict Area', 'Detected', 'Actions']}
        rows={items}
        render={(d) => (
          <tr key={d.id} className="hover:bg-slate-800/50 transition-colors">
            <td className="px-5 py-3 text-sm font-medium text-white">{d.mine_claim_code}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{d.farm_parcel_code}</td>
            <td className="px-5 py-3"><Badge status={d.status} /></td>
            <td className="px-5 py-3 text-sm text-slate-300">{d.conflict_area ? `${Number(d.conflict_area).toFixed(4)} ha` : '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{fmtDate(d.detected_at)}</td>
            <td className="px-5 py-3">
              <div className="flex items-center gap-1">
                {d.status !== 'RESOLVED' && (
                  <button onClick={() => updateStatus(d.id, 'RESOLVED')} className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 transition-colors">
                    Resolve
                  </button>
                )}
                {d.status !== 'OPEN' && (
                  <button onClick={() => updateStatus(d.id, 'OPEN')} className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md hover:bg-amber-500/20 transition-colors">
                    Reopen
                  </button>
                )}
                <ActionBtn icon={Trash2} onClick={() => handleDelete(d.id)} color="text-red-400 hover:text-red-300" title="Delete" />
              </div>
            </td>
          </tr>
        )}
      />
    </>
  )
}

// ─── Users Tab ────────────────────────────────────────────────
function UsersTab() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list()
      setItems(res.data?.results || [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const toggleRole = async (u) => {
    const newRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN'
    if (!confirm(`Change ${u.username} role to ${newRole}?`)) return
    try { await usersApi.update(u.id, { role: newRole }); toast.success(`${u.username} is now ${newRole}.`); fetch() } catch { toast.error('Failed to update role.') }
  }

  const handleDelete = async (u) => {
    if (u.id === currentUser?.id) return toast.error('Cannot delete your own account.')
    if (!confirm(`Delete user ${u.username}? This cannot be undone.`)) return
    try { await usersApi.delete(u.id); toast.success(`User ${u.username} deleted.`); fetch() } catch { toast.error('Failed to delete user.') }
  }

  if (loading) return <Loader />

  return (
    <>
      <TableHeader title={`${items.length} User(s)`} />
      <Table
        cols={['Username', 'Name', 'Email', 'Role', 'Joined']}
        rows={items}
        render={(u) => (
          <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
            <td className="px-5 py-3 text-sm font-medium text-white">{u.username}</td>
            <td className="px-5 py-3 text-sm text-slate-300">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
            <td className="px-5 py-3 text-sm text-slate-400">{u.email || '—'}</td>
            <td className="px-5 py-3">
              <button onClick={() => toggleRole(u)} title="Click to toggle role" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                u.role === 'ADMIN'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20'
              }`}>
                {u.role === 'ADMIN' && <Shield size={11} />}
                {u.role}
              </button>
            </td>
            <td className="px-5 py-3 text-sm text-slate-400">{fmtDate(u.date_joined)}</td>
            <td className="px-5 py-3 text-right">
              {u.id !== currentUser?.id && (
                <ActionBtn icon={Trash2} onClick={() => handleDelete(u)} color="text-red-400 hover:text-red-300" title="Delete" />
              )}
            </td>
          </tr>
        )}
      />
    </>
  )
}

// ─── Shared Helpers ───────────────────────────────────────────
function Loader() {
  return (
    <div className="flex items-center justify-center p-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      <span className="ml-3 text-slate-400">Loading...</span>
    </div>
  )
}

function TableHeader({ title, onAdd }) {
  return (
    <div className="flex items-center justify-between mb-4 no-print">
      <p className="text-sm text-slate-400 font-medium">{title}</p>
      <div className="flex items-center gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:text-white transition-all print-keep">
          <Printer size={15} /> Print
        </button>
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all">
            <Plus size={15} /> Add New
          </button>
        )}
      </div>
    </div>
  )
}

function Table({ cols, rows, render }) {
  if (rows.length === 0) {
    return <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">No records found.</div>
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto print:border-none print:bg-transparent print:overflow-visible">
      <table className="min-w-full divide-y divide-slate-800 print-table">
        <thead>
          <tr className="bg-slate-800/50">
            {cols.map((c) => (
              <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{c}</th>
            ))}
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">{rows.map(render)}</tbody>
      </table>
    </div>
  )
}

function Badge({ status }) {
  const colors = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    EXPIRED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    DISPUTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REVOKED: 'bg-red-500/10 text-red-400 border-red-500/20',
    OPEN: 'bg-red-500/10 text-red-400 border-red-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    DISMISSED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border print-badge print-badge-${status.toLowerCase()} ${colors[status] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
      {status}
    </span>
  )
}

function SaveBtn({ saving, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
    >
      {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={16} />}
      {saving ? 'Saving...' : 'Save'}
    </button>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

// ─── Main Admin Page ──────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('owners')

  const TabContent = {
    owners: OwnersTab,
    claims: ClaimsTab,
    parcels: ParcelsTab,
    disputes: DisputesTab,
    users: UsersTab,
  }[tab]

  return (
    <div id="print-root" className="p-6 max-w-7xl mx-auto space-y-5 print-page">
      {/* Print Report Header */}
      <div className="hidden print:flex print-report-header">
        <div>
          <h1>GIS Mine & Claim Registry</h1>
          <p>{TABS.find(t => t.key === tab)?.label} Report</p>
        </div>
        <div className="print-meta">
          Generated: {new Date().toLocaleDateString()}<br/>
          System Administrator
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 no-print">
        <div className="p-2 bg-violet-500/10 rounded-lg">
          <Settings size={20} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-slate-400">Manage owners, claims, parcels, disputes, and users</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 no-print">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <TabContent />
    </div>
  )
}
