import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@kit/ui/utils';

function LogoImage({
  className,
  width = 105,
}: {
  className?: string;
  width?: number;
}) {
  return (
    <Image
      src="/images/truck-scout-logo-light.png"
      alt="TruckScout Logo"
      width={width}
      height={width * 0.6}
      className={cn(
        'w-[80px] lg:w-[95px] block dark:hidden',
        className
      )}
      priority
    />
  );
}

export function AppLogo({
  href,
  label,
  className,
}: {
  href?: string;
  className?: string;
  label?: string;
}) {
  return (
    <Link aria-label={label ?? 'Home Page'} href={href ?? '/'}>
      <LogoImage className={className} />
      <Image
        src="/images/truck-scout-logo-dark.png"
        alt="TruckScout Logo"
        width={105}
        height={63}
        className={cn(
          'w-[80px] lg:w-[95px] hidden dark:block',
          className
        )}
        priority
      />
    </Link>
  );
}
