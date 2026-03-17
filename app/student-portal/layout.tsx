export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {children}
    </div>
  );
}
