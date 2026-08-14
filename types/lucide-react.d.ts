declare module "lucide-react" {
  import type { FC, SVGProps } from "react";

  type IconProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
  };

  type IconComponent = FC<IconProps>;

  export const Search: IconComponent;
  export const Minus: IconComponent;
  export const Plus: IconComponent;
  export const Trash2: IconComponent;
  export const Check: IconComponent;
  export const Loader2: IconComponent;
  export const Leaf: IconComponent;
  export const LogOut: IconComponent;
  export const Menu: IconComponent;
  export const ShoppingCart: IconComponent;
  export const User: IconComponent;
  export const X: IconComponent;
  export const Lock: IconComponent;
  export const Mail: IconComponent;
  export const Phone: IconComponent;
  export const Heart: IconComponent;
  export const ShieldCheck: IconComponent;
  export const Truck: IconComponent;
  export const CheckCircle: IconComponent;
  export const Image: IconComponent;
  export const Package: IconComponent;
  export const PlusCircle: IconComponent;
  export const RefreshCw: IconComponent;
  export const Upload: IconComponent;
  export const Instagram: IconComponent;
  export const Facebook: IconComponent;
  export const Twitter: IconComponent;
  export const MapPin: IconComponent;
  export const AlertTriangle: IconComponent;
  export const AlertCircle: IconComponent;
  export const Info: IconComponent;
}