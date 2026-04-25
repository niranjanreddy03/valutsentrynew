interface DividerProps {
  label?: string
}

export function Divider({ label = 'or' }: DividerProps) {
  return (
    <div className="relative my-6 flex items-center">
      <span
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(to right, transparent, rgba(82, 82, 82, 0.5))',
        }}
      />
      <span
        className="px-3 text-[10.5px] font-medium uppercase tracking-[0.12em]"
        style={{ color: '#a3a3a3' }}
      >
        {label}
      </span>
      <span
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(to left, transparent, rgba(82, 82, 82, 0.5))',
        }}
      />
    </div>
  )
}

export default Divider
