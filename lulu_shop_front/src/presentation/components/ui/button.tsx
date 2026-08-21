import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "whatsapp"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

type SharedProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Occupe toute la largeur disponible. */
  block?: boolean;
  /**
   * Affiche un indicateur de chargement et neutralise les interactions.
   * La largeur du bouton reste identique : aucun saut de mise en page.
   */
  loading?: boolean;
  className?: string;
};

type LinkButtonProps = SharedProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type NativeButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

const sizeClasses: Record<ButtonSize, string | null> = {
  sm: "btn-sm",
  md: null, // taille par défaut, aucune classe nécessaire
  lg: "btn-lg",
};

export function Button(props: LinkButtonProps | NativeButtonProps) {
  const {
    variant = "primary",
    size = "md",
    block = false,
    loading = false,
    className: extraClassName,
  } = props;

  const className = cn(
    "btn",
    `btn-${variant}`,
    sizeClasses[size],
    block && "btn-block",
    extraClassName,
  );

  if ("href" in props && props.href) {
    const {
      children,
      href,
      className: _className,
      variant: _variant,
      size: _size,
      block: _block,
      loading: _loading,
      ...anchorProps
    } = props;

    return (
      <a
        href={href}
        className={className}
        data-loading={loading ? "true" : undefined}
        aria-disabled={loading || undefined}
        {...(anchorProps as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  const {
    children,
    className: _className,
    variant: _variant,
    size: _size,
    block: _block,
    loading: _loading,
    disabled,
    ...buttonProps
  } = props as NativeButtonProps;

  return (
    <button
      className={className}
      data-loading={loading ? "true" : undefined}
      disabled={disabled || loading}
      // Signale l'attente aux technologies d'assistance, que le libellé
      // visuel soit masqué ou non.
      aria-busy={loading || undefined}
      {...(buttonProps as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
