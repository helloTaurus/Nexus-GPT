import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CaretDown,
  List,
  Moon,
  Sun,
  X,
  User,
  ShieldCheck,
  House,
} from "@phosphor-icons/react";
import { useTheme } from "../../hooks/useTheme";
import { NEXUS_PRODUCTS } from "../../data/content";

export interface NavbarProps {
  onOpenApply: (productName?: string) => void;
  onNavigate: (view: string, productId?: string) => void;
  currentView?: string;
}

const companyLinks = [
  ["About Nexus", "about"],
  ["Our people", "leadership"],
  ["News & insights", "blog"],
  ["Gallery", "gallery"],
  ["Careers", "careers"],
];

export const Navbar: React.FC<NavbarProps> = ({
  onOpenApply,
  onNavigate,
  currentView = "home",
}) => {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdown, setDropdown] = useState<"company" | "products" | "portals" | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const companyTrigger = useRef<HTMLButtonElement>(null);
  const productTrigger = useRef<HTMLButtonElement>(null);
  const portalTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setDropdown(null);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const navigate = (view: string, productId?: string) => {
    setMenuOpen(false);
    setDropdown(null);
    onNavigate(view, productId);
  };

  return (
    <header
      className="nx-header sticky top-0 z-40 bg-canvas/95 backdrop-blur-md border-b border-rule"
      ref={headerRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (dropdown === "company") companyTrigger.current?.focus();
        if (dropdown === "products") productTrigger.current?.focus();
        if (dropdown === "portals") portalTrigger.current?.focus();
        if (menuOpen) mobileTrigger.current?.focus();
        setDropdown(null);
        setMenuOpen(false);
      }}
    >
      <a className="nx-skip" href="#main-content">
        Skip to content
      </a>
      <div className="nx-container nx-nav-row flex items-center justify-between h-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <button
          className="nx-brand cursor-pointer flex items-center gap-2.5"
          aria-label="Nexus Finance home"
          onClick={() => navigate("home")}
        >
          <div className="w-9 h-9 rounded-[7px] bg-action text-on-action flex items-center justify-center font-bold font-display text-lg shadow-sm">
            N
          </div>
          <span className="font-display font-semibold text-lg text-ink tracking-tight">
            Nexus Finance
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="nx-desktop-nav hidden md:flex items-center gap-6" aria-label="Main navigation">
          <button
            className={`text-xs font-semibold cursor-pointer transition-colors ${
              currentView === "home" ? "text-brand" : "text-muted hover:text-ink"
            }`}
            aria-current={currentView === "home" ? "page" : undefined}
            onClick={() => navigate("home")}
          >
            Home
          </button>

          {/* Who we are dropdown */}
          <div className="nx-nav-group relative">
            <button
              ref={companyTrigger}
              className="text-xs font-semibold text-muted hover:text-ink flex items-center gap-1 cursor-pointer transition-colors"
              aria-expanded={dropdown === "company"}
              aria-controls="nx-company-menu"
              onClick={() =>
                setDropdown(dropdown === "company" ? null : "company")
              }
            >
              Who we are <CaretDown size={13} aria-hidden="true" />
            </button>
            {dropdown === "company" && (
              <div
                id="nx-company-menu"
                className="nx-dropdown absolute top-full left-0 mt-2 w-52 p-2 rounded-[12px] bg-surface border border-rule shadow-dropdown z-50 space-y-1"
              >
                <span className="nx-eyebrow block px-3 py-1 text-[10px] uppercase font-bold text-muted">
                  Meet Nexus
                </span>
                {companyLinks.map(([label, view]) => (
                  <button
                    key={view}
                    className="w-full text-left px-3 py-2 rounded-[7px] text-xs font-medium text-ink hover:bg-subtle hover:text-brand flex items-center justify-between cursor-pointer"
                    onClick={() => navigate(view)}
                  >
                    <span>{label}</span>
                    <ArrowUpRight size={14} className="text-muted" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products dropdown */}
          <div className="nx-nav-group relative">
            <button
              ref={productTrigger}
              className="text-xs font-semibold text-muted hover:text-ink flex items-center gap-1 cursor-pointer transition-colors"
              aria-expanded={dropdown === "products"}
              aria-controls="nx-product-menu"
              onClick={() =>
                setDropdown(dropdown === "products" ? null : "products")
              }
            >
              Our products <CaretDown size={13} aria-hidden="true" />
            </button>
            {dropdown === "products" && (
              <div
                id="nx-product-menu"
                className="nx-dropdown nx-dropdown-products absolute top-full left-0 mt-2 w-64 p-2 rounded-[12px] bg-surface border border-rule shadow-dropdown z-50 space-y-1 max-h-96 overflow-y-auto"
              >
                <span className="nx-eyebrow block px-3 py-1 text-[10px] uppercase font-bold text-muted">
                  Credit &amp; Wealth Facilities
                </span>
                {NEXUS_PRODUCTS.map((product) => (
                  <button
                    key={product.id}
                    className="w-full text-left px-3 py-2 rounded-[7px] text-xs font-medium text-ink hover:bg-subtle hover:text-brand flex items-center justify-between cursor-pointer"
                    onClick={() => navigate("product-detail", product.id)}
                  >
                    <span className="truncate">{product.name}</span>
                    <ArrowUpRight size={14} className="text-muted shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="text-xs font-semibold text-muted hover:text-ink cursor-pointer transition-colors"
            onClick={() => navigate("calculator")}
          >
            Loan calculator
          </button>
          <button
            className="text-xs font-semibold text-muted hover:text-ink cursor-pointer transition-colors"
            onClick={() => navigate("contact")}
          >
            Contact
          </button>

          {/* Portals menu */}
          <div className="nx-nav-group relative">
            <button
              ref={portalTrigger}
              className="text-xs font-semibold text-brand hover:underline flex items-center gap-1 cursor-pointer"
              aria-expanded={dropdown === "portals"}
              onClick={() => setDropdown(dropdown === "portals" ? null : "portals")}
            >
              <span>Portals</span>
              <CaretDown size={13} />
            </button>
            {dropdown === "portals" && (
              <div className="absolute top-full right-0 mt-2 w-56 p-2 rounded-[12px] bg-surface border border-rule shadow-dropdown z-50 space-y-1">
                <span className="block px-3 py-1 text-[10px] uppercase font-bold text-muted">
                  Internal Systems
                </span>
                <button
                  className="w-full text-left px-3 py-2 rounded-[7px] text-xs font-medium text-ink hover:bg-subtle hover:text-brand flex items-center gap-2 cursor-pointer"
                  onClick={() => navigate("portal")}
                >
                  <House size={16} className="text-brand" />
                  <div>
                    <div>Staff Portal</div>
                    <div className="text-[10px] text-muted font-normal">Leaves, Claims &amp; Profile</div>
                  </div>
                </button>
                <button
                  className="w-full text-left px-3 py-2 rounded-[7px] text-xs font-medium text-ink hover:bg-subtle hover:text-brand flex items-center gap-2 cursor-pointer"
                  onClick={() => navigate("admin")}
                >
                  <ShieldCheck size={16} className="text-brand" />
                  <div>
                    <div>HRMS Admin Console</div>
                    <div className="text-[10px] text-muted font-normal">Workforce &amp; Approvals</div>
                  </div>
                </button>
                <div className="border-t border-rule my-1" />
                <button
                  className="w-full text-left px-3 py-2 rounded-[7px] text-xs font-medium text-muted hover:text-ink hover:bg-subtle flex items-center gap-2 cursor-pointer"
                  onClick={() => navigate("login")}
                >
                  <User size={16} />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Right Actions */}
        <div className="nx-nav-actions flex items-center gap-3">
          <button
            className="nx-icon-button nx-theme-button p-2.5 rounded-[7px] text-muted hover:text-ink hover:bg-subtle border border-rule transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
          </button>
          <button
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[7px] bg-action hover:bg-action-hover text-on-action text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            onClick={() => {
              setMenuOpen(false);
              setDropdown(null);
              onOpenApply();
            }}
          >
            <span>Apply now</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
          <button
            ref={mobileTrigger}
            className="md:hidden p-2.5 rounded-[7px] text-muted hover:text-ink hover:bg-subtle border border-rule transition-colors cursor-pointer"
            aria-expanded={menuOpen}
            aria-controls="nx-mobile-nav"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {menuOpen && (
        <div id="nx-mobile-nav" className="md:hidden border-t border-rule bg-surface p-6 space-y-4">
          <div className="space-y-1">
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("home")}
            >
              Home
            </button>
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("about")}
            >
              About Nexus
            </button>
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("calculator")}
            >
              Loan Calculator
            </button>
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("careers")}
            >
              Careers
            </button>
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("blog")}
            >
              Blog &amp; Insights
            </button>
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("gallery")}
            >
              Gallery
            </button>
            <button
              className="w-full text-left py-2 text-sm font-semibold text-ink"
              onClick={() => navigate("contact")}
            >
              Contact
            </button>
          </div>

          <div className="pt-4 border-t border-rule space-y-2">
            <div className="text-[11px] uppercase font-bold tracking-wider text-muted">
              Portals
            </div>
            <button
              className="w-full py-2.5 px-4 rounded-[7px] bg-subtle text-ink text-xs font-semibold text-left flex items-center justify-between"
              onClick={() => navigate("portal")}
            >
              <span>Staff Portal</span>
              <ArrowUpRight size={14} />
            </button>
            <button
              className="w-full py-2.5 px-4 rounded-[7px] bg-subtle text-ink text-xs font-semibold text-left flex items-center justify-between"
              onClick={() => navigate("admin")}
            >
              <span>HRMS Admin Console</span>
              <ArrowUpRight size={14} />
            </button>
            <button
              className="w-full py-2.5 px-4 rounded-[7px] bg-action text-on-action text-xs font-semibold text-center"
              onClick={() => {
                setMenuOpen(false);
                onOpenApply();
              }}
            >
              Apply now ↗
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
