export default function KDSLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-[#111] min-h-screen text-white font-sans overflow-x-auto">
      {children}
    </div>
  );
}
