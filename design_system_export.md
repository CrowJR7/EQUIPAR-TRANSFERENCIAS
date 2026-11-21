# Design System - Equipar Devoluções

Este arquivo contém a extração do Design System utilizado no sistema "Equipar Devoluções", formatado para ser facilmente implementado no seu novo projeto interno.

## 1. Stack Tecnológica Base
Para replicar o design de forma idêntica, certifique-se de que o novo projeto utiliza:
- **Tailwind CSS v4** (a configuração é feita diretamente no CSS e não no `tailwind.config.ts`).
- **Shadcn UI** (com as variáveis de cor CSS mapeadas corretamente).
- **Framer Motion** (para as animações de FadeIn, PageTransition, etc).
- **Lucide React** (para a padronização dos ícones).
- **Google Fonts**: `Inter` (corpo), `Hanken Grotesk` (títulos) e `JetBrains Mono` (dados e códigos).

---

## 2. Configuração de Cores e Tema (globals.css)
Copie e cole o conteúdo abaixo no arquivo principal de estilos globais do seu novo projeto (ex: `src/app/globals.css`). Ele define toda a paleta de cores (primária, secundária, erros, superfícies) e as variáveis estruturais do Shadcn.

```css
@import "tailwindcss";
@import "tw-animate-css"; /* Se for usar animações pré-prontas */
@import "shadcn/tailwind.css"; /* Se for usar shadcn como base */

@custom-variant dark (&:is(.dark *));

@theme {
  /* =========================================
     Cores da Marca e Semânticas
  ========================================= */
  --color-primary: #031635;
  --color-on-primary: #ffffff;
  --color-primary-container: #1a2b4b;
  --color-on-primary-container: #8293b8;
  
  --color-secondary: #b6171e;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #da3433;
  --color-on-secondary-container: #fffbff;
  
  --color-tertiary: #001733;
  --color-on-tertiary: #ffffff;
  --color-tertiary-container: #002c56;
  --color-on-tertiary-container: #4794f2;
  
  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;
  
  /* =========================================
     Cores de Superfície e Fundo
  ========================================= */
  --color-background: #f8f9fa;
  --color-on-background: #191c1d;
  
  --color-surface: #f8f9fa;
  --color-surface-dim: #d9dadb;
  --color-surface-bright: #f8f9fa;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f3f4f5;
  --color-surface-container: #edeeef;
  --color-surface-container-high: #e7e8e9;
  --color-surface-container-highest: #e1e3e4;
  
  --color-on-surface: #191c1d;
  --color-on-surface-variant: #44474e;
  
  --color-outline: #75777f;
  --color-outline-variant: #c5c6cf;
  
  /* =========================================
     Mapeamentos Shadcn UI
  ========================================= */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);

  /* =========================================
     Tipografia
  ========================================= */
  --font-display-lg: var(--font-hanken), sans-serif;
  --font-headline-md: var(--font-hanken), sans-serif;
  --font-title-sm: var(--font-hanken), sans-serif;
  --font-body-md: var(--font-inter), sans-serif;
  --font-body-sm: var(--font-inter), sans-serif;
  --font-label-caps: var(--font-inter), sans-serif;
  --font-data-mono: var(--font-jetbrains), monospace;

  --font-sans: var(--font-inter), sans-serif;
  --font-display: var(--font-hanken), sans-serif;
  --font-mono: var(--font-jetbrains), monospace;

  /* =========================================
     Espaçamentos e Bordas (Radius)
  ========================================= */
  --spacing-base: 4px;
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-margin: 24px;
  --spacing-gutter: 20px;

  --radius-DEFAULT: 0.25rem;
  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;
}

:root {
  /* Variáveis de sistema no formato OKLCH para UI e Gráficos */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

---

## 3. Formato e Estilo de Cards
Os cards possuem um formato premium focado em visual limpo com detalhes sutis, como ícones de fundo com baixa opacidade e sombras macias.

**Regras para o Card Principal (Ex: Dashboard):**
- **Classes estruturais:** `bg-primary rounded-2xl p-6 shadow-lg relative overflow-hidden`
- **Conteúdo em Z-index 10:** Para garantir que os elementos textuais não sejam cobertos pelo efeito de fundo, eles sempre devem estar dentro de um wrapper relativo: `<div className="relative z-10">...</div>`.
- **Efeitos de Ícones em background:** Use ícones do Lucide no fundo em tamanhos muito grandes, rodando lentamente. Exemplo:

```tsx
// ESTRUTURA PADRÃO DE CARD COM DESTAQUE
<div className="bg-primary rounded-2xl p-6 shadow-lg h-full flex flex-col justify-between relative overflow-hidden">
  
  {/* Decoração: Ícones transparentes e rotacionando */}
  <Settings className="absolute -right-12 -bottom-12 w-64 h-64 text-blue-400 opacity-[0.08] animate-[spin_40s_linear_infinite] pointer-events-none" />
  
  {/* Conteúdo */}
  <div className="relative z-10">
    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 border border-blue-400/20">
      <DollarSign className="w-5 h-5 text-blue-400" />
    </div>
    <p className="text-xs font-semibold text-blue-100/60 uppercase tracking-widest mb-2">
      Título do Card
    </p>
    <p className="font-black text-white text-4xl">
      R$ 10.000,00
    </p>
  </div>
</div>
```

---

## 4. Estilos Base de Botões
Os botões seguem classes utilitárias bem definidas. Eles não usam estilos brutos nas tags, mas sim a base de componentes (`buttonVariants`).

Se não estiver usando `shadcn` pronto, as principais definições de Tailwind para os botões são:
- **Base:** `inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all`
- **Variante Primária:** `bg-primary text-primary-foreground hover:bg-primary/80`
- **Variante Outline:** `border-border bg-background hover:bg-muted hover:text-foreground`
- **Tamanhos Base:** `h-8 px-2.5` (default), `h-9` (lg), `h-7` (sm).

---

## 5. Animações (Framer Motion)
No sistema base, existe um arquivo dedicado `src/components/ui/motion.tsx` que padroniza os layouts e como as páginas carregam. Se você for usar essas animações no novo projeto, adicione framer-motion (`npm install framer-motion`) e crie componentes semelhantes:

```tsx
import { motion } from 'framer-motion';

// Para envolver as páginas
export const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    {children}
  </motion.div>
);

// Para animar uma grid de forma sequencial (stagger)
export const StaggerContainer = ({ children, className }: any) => (
  <motion.div 
    initial="hidden" animate="show" className={className}
    variants={{ show: { transition: { staggerChildren: 0.1 } } }}
  >
    {children}
  </motion.div>
);

// Item da grid sequencial
export const StaggerItem = ({ children, className }: any) => (
  <motion.div 
    className={className}
    variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring" } } }}
  >
    {children}
  </motion.div>
);
```

---

## Dica Final
Se você gerar um novo projeto do zero, faça:
1. `npx create-next-app@latest` (Use App router e Tailwind)
2. Mude o CSS principal para aceitar as variáveis deste arquivo.
3. Se for utilizar Shadcn UI, inicie o `shadcn init` com as variáveis neutras e depois sobreponha com o arquivo CSS gerado acima.
