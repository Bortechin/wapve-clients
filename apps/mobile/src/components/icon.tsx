import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { themeColor, useAppearance } from '@/lib/appearance';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = Omit<ComponentProps<typeof MaterialCommunityIcons>, 'name'> & {
  name: IconName;
};

export function Icon({ name, size = 24, color, ...props }: Props) {
  const { palette } = useAppearance();
  return <MaterialCommunityIcons name={name} size={size} {...props} color={themeColor(color, palette) as Props['color']} />;
}
