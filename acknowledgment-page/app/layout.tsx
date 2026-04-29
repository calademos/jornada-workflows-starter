export const metadata = {
  title: 'Jornada — Confirmação de hora extra',
  description: 'Página de acknowledgment de hora extra do Jornada Workflows Starter.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
