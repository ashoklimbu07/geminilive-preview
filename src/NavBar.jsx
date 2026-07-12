// App-wide nav: bottom tab bar on mobile, floating pill bar on larger screens.
function HomeIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

function TodayIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      <path d="m9 14.5 2 2 4-4.5" />
    </svg>
  )
}

function TabButton({ label, icon, active, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 md:flex-none flex md:inline-flex items-center justify-center gap-2 rounded-2xl md:rounded-full px-4 py-2.5 md:py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-rose-400/15 text-rose-600' : 'text-[#a68f86] hover:text-[#4a2f27]'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 right-2 md:static md:ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-400 text-white text-[10px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function NavBar({ view, onNavigate, todayCount }) {
  const isHome = view === 'conversation'
  const isToday = view === 'today'

  return (
    <nav className="fixed md:static bottom-0 inset-x-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:p-0 md:mt-1">
      <div className="mx-auto max-w-xs md:max-w-none flex md:inline-flex gap-1 bg-white/95 backdrop-blur border border-[#f0d0b8] rounded-3xl md:rounded-full px-1.5 py-1.5 md:px-1.5 shadow-[0_8px_24px_rgba(210,140,100,0.25)]">
        <TabButton
          label="Home"
          icon={<HomeIcon active={isHome} />}
          active={isHome}
          onClick={() => onNavigate('conversation')}
        />
        <TabButton
          label="Today"
          icon={<TodayIcon active={isToday} />}
          active={isToday}
          badge={todayCount}
          onClick={() => onNavigate('today')}
        />
      </div>
    </nav>
  )
}
