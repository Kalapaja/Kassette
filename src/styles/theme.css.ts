import { css } from "lit";

export const theme = css`
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap");

  :host {
    --font-family: "Inter", sans-serif;
    font-family: var(--font-family);
    /* Brand Colors */
    --deep-navy: oklch(0.34 0.161 263.507);
    --royal-blue: oklch(0.524 0.181 256.292);
    --sky-blue: oklch(0.779 0.125 240.476);
    --warm-yellow: oklch(0.818 0.17 77.948);
    --burnt-orange: oklch(0.636 0.197 39.364);
    --flux-red: oklch(0.577 0.225 28.176);
    --vector-green: oklch(0.711 0.182 153.43);
    --forest-green: oklch(0.647 0.165 153.493);
    --black: oklch(0 0 0);
    --glacier-grey: oklch(0.916 0.018 229.162);
    --ice-grey: oklch(0.947 0.013 214.627);
    --white: oklch(1 0 0);
    --brand-quaternary: oklch(0.912 0.021 230);
    --brand-quinary: oklch(0.97 0.006 220);

    /* Semantic Variables (shadcn/ui convention) */
    --content-primary: var(--black);
    --content-secondary: oklch(0.42 0 0);
    --content-tetriary: oklch(0.52 0 0);
    --fill-primary: var(--white);
    --brand-primary: var(--deep-navy);
    --brand-border-tetriary: var(--brand-quaternary);
    --border-secondary: oklch(0.88 0 0);
    --border-tetriary: oklch(0.94 0 0);
    --radius: 0.625rem;

    --background: var(--white);
    --foreground: var(--deep-navy);

    --card: var(--white);
    --card-foreground: var(--deep-navy);

    --popover: var(--white);
    --popover-foreground: var(--deep-navy);

    --primary: var(--royal-blue);
    --primary-foreground: var(--white);

    --secondary: var(--ice-grey);
    --secondary-foreground: var(--deep-navy);

    --muted: var(--glacier-grey);
    --muted-foreground: oklch(0.556 0 0);

    --accent: var(--sky-blue);
    --accent-foreground: var(--deep-navy);

    --destructive: var(--flux-red);
    --destructive-foreground: var(--white);

    --warning: var(--warm-yellow);
    --warning-foreground: var(--deep-navy);

    --success: var(--vector-green);
    --success-foreground: var(--white);

    --border: var(--glacier-grey);
    --input: var(--glacier-grey);
    --ring: var(--royal-blue);

    --chart-1: var(--royal-blue);
    --chart-2: var(--vector-green);
    --chart-3: var(--warm-yellow);
    --chart-4: var(--burnt-orange);
    --chart-5: var(--flux-red);
  }
`;
