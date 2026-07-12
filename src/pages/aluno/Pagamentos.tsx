const FF = '"Libre Franklin",sans-serif'

export default function Pagamentos() {
  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#1B2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        </div>
        <h1 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 10px', letterSpacing: '-.4px' }}>Pagamentos</h1>
        <p style={{ font: `400 14px ${FF}`, color: '#7c7869', lineHeight: 1.6, margin: 0 }}>
          O controle de pagamentos é gerenciado diretamente pelo seu coach. Entre em contato com ele para mais informações.
        </p>
      </div>
    </div>
  )
}
