import type { ComponentProps, SVGProps } from 'react';
import { cn } from './utils';

type HeroIcon = React.ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string }
>;

interface IconProps extends ComponentProps<'svg'> {
  icon: HeroIcon;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

export function Icon({ icon: IconComponent, size = 'sm', className, ...props }: IconProps) {
  return <IconComponent className={cn(sizeClasses[size], className)} aria-hidden {...props} />;
}
