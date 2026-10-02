// No width cap here: the dashboard shell (dashboard/layout.tsx) is responsive,
// and the sign-in page keeps its own centered column.
export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F8F9FB] text-[#18181B] overflow-x-hidden">{children}</div>;
}
