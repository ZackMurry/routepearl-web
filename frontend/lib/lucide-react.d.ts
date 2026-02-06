declare module 'lucide-react' {
  import { FC, SVGProps } from 'react'

  export interface LucideProps extends Partial<SVGProps<SVGSVGElement>> {
    size?: string | number
    absoluteStrokeWidth?: boolean
    className?: string
  }

  export type LucideIcon = FC<LucideProps>

  export const X: LucideIcon
  export const ChevronLeft: LucideIcon
  export const ChevronRight: LucideIcon
  export const ChevronUp: LucideIcon
  export const ChevronDown: LucideIcon
  export const Plus: LucideIcon
  export const Trash2: LucideIcon
  export const MapPin: LucideIcon
  export const AlertTriangle: LucideIcon
  export const AlertCircle: LucideIcon
  export const Target: LucideIcon
  export const Settings: LucideIcon
  export const Layers: LucideIcon
  export const Play: LucideIcon
  export const Pause: LucideIcon
  export const Square: LucideIcon
  export const Save: LucideIcon
  export const Upload: LucideIcon
  export const Download: LucideIcon
  export const FileText: LucideIcon
  export const Clock: LucideIcon
  export const CheckCircle: LucideIcon
  export const Heading1: LucideIcon
  export const Heading2: LucideIcon
  export const FlagTriangleRight: LucideIcon
}
