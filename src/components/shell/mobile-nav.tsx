"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";

type NavItem = {
  href: string;
  label: string;
};

type MobileNavProps = {
  navItems: NavItem[];
  signOutForm: ReactNode;
};

export function MobileNav({ navItems, signOutForm }: MobileNavProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  function closeOnAction(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("a, button")) {
      closeMenu();
    }
  }

  return (
    <details className="mobile-nav" ref={detailsRef}>
      <summary>
        <Link className="brand" href="/">
          <strong>ARO</strong>LAB
        </Link>
        <span className="badge">Menu</span>
      </summary>
      <div className="mobile-nav-panel" onClick={closeOnAction}>
        <nav className="side-nav" aria-label="Navegação da área mobile">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        {signOutForm}
      </div>
    </details>
  );
}
