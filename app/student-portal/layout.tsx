export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1a1d5e] flex justify-center" style={{ background: 'linear-gradient(160deg, #1a1d5e 0%, #2E3093 40%, #2A6BB5 100%)' }}>
      <div className="relative w-full max-w-[430px] min-h-screen bg-[#f5f6fa] shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
