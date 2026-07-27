import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={props["aria-hidden"] ?? "true"}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Bell(props: IconProps) {
  return <Icon {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></Icon>;
}

export function BriefcaseBusiness(props: IconProps) {
  return <Icon {...props}><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" /><rect height="14" rx="2" width="18" x="3" y="6" /><path d="M3 12h18" /><path d="M10 12v2h4v-2" /></Icon>;
}

export function CalendarDays(props: IconProps) {
  return <Icon {...props}><rect height="18" rx="2" width="18" x="3" y="4" /><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></Icon>;
}

export function ChevronDown(props: IconProps) {
  return <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
}

export function CircleDollarSign(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 6v12M15 9.5c-.8-.7-2-.9-3-.9-1.4 0-2.5.6-2.5 1.7 0 2.5 5.2 1.1 5.2 4 0 1.3-1.2 2.1-2.8 2.1-1.1 0-2.4-.3-3.3-1" /></Icon>;
}

export function Command(props: IconProps) {
  return <Icon {...props}><path d="M9 9H5.5A2.5 2.5 0 1 1 8 6.5V18a2.5 2.5 0 1 1-2.5-2.5H18a2.5 2.5 0 1 1-2.5 2.5V6.5A2.5 2.5 0 1 1 18 9Z" /></Icon>;
}

export function FileText(props: IconProps) {
  return <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></Icon>;
}

export function Globe2(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" /></Icon>;
}

export function Hand(props: IconProps) {
  return <Icon {...props}><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M14 10V6.5a1.5 1.5 0 0 1 3 0V14" /><path d="M8 12.5 6.8 11a1.7 1.7 0 0 0-2.6 2.2l4.1 5A7 7 0 0 0 20 13v-2" /></Icon>;
}

export function Landmark(props: IconProps) {
  return <Icon {...props}><path d="M3 21h18M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M12 3 4 7h16Z" /></Icon>;
}

export function LayoutDashboard(props: IconProps) {
  return <Icon {...props}><rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="14" y="14" /><rect height="7" rx="1" width="7" x="3" y="14" /></Icon>;
}

export function MapPin(props: IconProps) {
  return <Icon {...props}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
}

export function Menu(props: IconProps) {
  return <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
}

export function MessageCircle(props: IconProps) {
  return <Icon {...props}><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.3A8.5 8.5 0 1 1 21 11.5Z" /></Icon>;
}

export function Plane(props: IconProps) {
  return <Icon {...props}><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4Z" /></Icon>;
}

export function Plus(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
}

export function Search(props: IconProps) {
  return <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
}

export function Send(props: IconProps) {
  return <Icon {...props}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon>;
}

export function Settings(props: IconProps) {
  return <Icon {...props}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2 3.5-.2-.1a1.8 1.8 0 0 0-1.9-.1 8.7 8.7 0 0 1-1.7.7 1.7 1.7 0 0 0-1.2 1.4V22H8.8v-.3A1.7 1.7 0 0 0 7.6 20a8.7 8.7 0 0 1-1.7-.7 1.8 1.8 0 0 0-1.9.1l-.2.1-2-3.5.1-.1A1.6 1.6 0 0 0 2.2 14 8.7 8.7 0 0 1 2 12c0-.7.1-1.3.2-2a1.6 1.6 0 0 0-.3-1.8l-.1-.1 2-3.5.2.1a1.8 1.8 0 0 0 1.9.1c.5-.3 1.1-.5 1.7-.7A1.7 1.7 0 0 0 8.8 2.7V2h4.4v.3A1.7 1.7 0 0 0 14.4 4c.6.2 1.2.4 1.7.7a1.8 1.8 0 0 0 1.9-.1l.2-.1 2 3.5-.1.1a1.6 1.6 0 0 0-.3 1.8c.1.7.2 1.3.2 2s-.1 1.3-.2 2Z" /></Icon>;
}

export function Sun(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
}

export function User(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;
}

export function UserRound(props: IconProps) {
  return <User {...props} />;
}

export function UsersRound(props: IconProps) {
  return <Icon {...props}><path d="M16 21a6 6 0 0 0-12 0" /><circle cx="10" cy="8" r="4" /><path d="M22 21a5 5 0 0 0-5-5M17 4a3 3 0 0 1 0 6" /></Icon>;
}

export function WalletCards(props: IconProps) {
  return <Icon {...props}><rect height="14" rx="2" width="18" x="3" y="6" /><path d="M7 6V4h10v2M16 12h2" /></Icon>;
}

export function X(props: IconProps) {
  return <Icon {...props}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
}
