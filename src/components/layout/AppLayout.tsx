import { type ReactNode } from 'react';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  navItems: NavItem[];
}

export function AppLayout({ children, title, subtitle, navItems }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title={title} subtitle={subtitle} />
      <main className="px-4 py-4 sm:px-6">{children}</main>
      <MobileNav items={navItems} />
    </div>
  );
}
