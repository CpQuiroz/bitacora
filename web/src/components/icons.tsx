// Set de íconos propio, en SVG inline (sin dependencias externas ni
// fotos) — trazos simples, mismo estilo (stroke, sin relleno) en todos.
import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function IconBriefcase(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M3 13h18" />
    </Icon>
  );
}

export function IconReceipt(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 3h12v17l-2.5-1.5L13 20l-2.5-1.5L8 20l-2-1.5V3Z" />
      <path d="M9 8h6M9 12h6" />
    </Icon>
  );
}

export function IconSparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M12 3 14 10 21 12 14 14 12 21 10 14 3 12 10 10 Z"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1c0-2.8 2.7-5 6-5s6 2.2 6 5v1" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M21 20v-.8c0-2-1.4-3.7-3.5-4.3" />
    </Icon>
  );
}

export function IconArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Icon>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 13l4.5 4.5L19 7" />
    </Icon>
  );
}

export function IconLogOut(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="10" height="16" rx="1.5" />
      <path d="M15 12h6" />
      <path d="M18 9l3 3-3 3" />
    </Icon>
  );
}

export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  );
}

export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 4h6l1.5 3H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.5L9 4Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </Icon>
  );
}

export function IconClipboardCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="3.2" rx="1" />
      <path d="M9 13l2 2 4-4.5" />
    </Icon>
  );
}

export function IconMail(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Icon>
  );
}

export function IconTruck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="1" y="9" width="13" height="8" rx="1" />
      <path d="M14 12h4l3.5 3v2H14z" />
      <circle cx="6" cy="19" r="1.8" />
      <circle cx="17.5" cy="19" r="1.8" />
    </Icon>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}
