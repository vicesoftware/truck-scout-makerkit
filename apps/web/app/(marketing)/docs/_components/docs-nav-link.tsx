'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SidebarMenuButton, SidebarMenuItem } from '@kit/ui/shadcn-sidebar';
import { cn, isRouteActive } from '@kit/ui/utils';

export function DocsNavLink({ label, url }: { label: string; url: string }) {
  const currentPath = usePathname();
  const isCurrent = isRouteActive(url, currentPath, true);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isCurrent}
        className={cn('border-l-3 transition-background !font-normal')}
      >
        <Link href={url}>
          <span className="block max-w-full truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
