import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

interface AttachmentRow {
  id: number; name: string; url: string
  size: number | null; mime_type: string | null; uploaded_at: string
}

function fmtSize(b: number | null): string {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

export default function Arquivos() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { language } = useSettingsStore()
  const locale = language === 'en-US' ? 'en-US' : 'pt-BR'

  const [files,   setFiles]   = useState<AttachmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [empty,   setEmpty]   = useState(false)

  useEffect(() => {
    if (!user?.id) return
    void load()
  }, [user?.id])

  async function load() {
    setLoading(true)
    const { data: studentRow } = await supabase
      .from('students').select('id').eq('student_id', user!.id).single()
    if (!studentRow) { setLoading(false); setEmpty(true); return }
    const { data } = await supabase
      .from('student_attachments')
      .select('id,name,url,size,mime_type,uploaded_at')
      .eq('student_id', (studentRow as { id: number }).id)
      .order('uploaded_at', { ascending: false })
    const rows = (data as AttachmentRow[] | null) ?? []
    setFiles(rows)
    setEmpty(rows.length === 0)
    setLoading(false)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(27,42,74,.1)', flexShrink: 0 }}
        >
          <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2.5} />
        </button>
        <h1 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.3px' }}>{t('files.coach_files')}</h1>
      </div>

      <div style={{ padding: '0 18px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', font: `500 14px ${FF}`, color: '#a89f8e' }}>
            {t('files.loading')}
          </div>
        ) : empty ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📎</div>
            <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>{t('files.empty_title')}</div>
            <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>
              {t('files.empty_desc')}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            {files.map((f, i) => {
              const isImg = f.mime_type?.startsWith('image/')
              const isPdf = f.mime_type === 'application/pdf'
              const size  = fmtSize(f.size)
              return (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0', textDecoration: 'none' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: isImg ? '#eef1f6' : isPdf ? '#fbe6e1' : '#f1ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isImg ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                    ) : isPdf ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4421e" strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c7869" strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>
                      {[size, fmtDate(f.uploaded_at)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C5BFB0" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
                  </svg>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
